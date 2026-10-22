"""Real model/XAI workflows and leakage, persistence and DAG boundaries."""

from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import train_test_split
from app.pipeline.validator import validate_pipeline
from app.pipeline.engine import execute_pipeline, PipelineExecutionError
from app.ml.bundle import load_bundle, predict_bundle
from app.ml.preprocessing import TabularPreprocessor
from app.xai.compatibility import is_compatible


@pytest.fixture
def classification_data():
    rng = np.random.default_rng(42)
    age = rng.normal(40, 10, 100)
    balance = rng.normal(0, 1, 100)
    target = (balance + (age - 40) / 10 > 0).astype(int)
    frame = pd.DataFrame(
        {
            "age": age,
            "balance": balance,
            "segment": np.where(age > 40, "business", "personal"),
            "target": target,
        }
    )
    frame.loc[[2, 8, 13], "age"] = np.nan
    return frame


def workflow(model="random_forest", explainer=None):
    kinds = ["dataset", "impute", "encode", "scale", "split", model, "evaluate"]
    if explainer:
        kinds.append(explainer)
    parameters = {
        "dataset": {"dataset_id": "dataset-1"},
        "random_forest": {"n_estimators": 15},
        "pytorch": {"epochs": 8, "hidden_dims": [12]},
        "shap": {"max_samples": 4},
        "lime": {"num_samples": 200},
    }
    return {
        "nodes": [
            {"id": str(index), "type": kind, "parameters": parameters.get(kind, {})}
            for index, kind in enumerate(kinds)
        ],
        "edges": [
            {"id": f"e-{index}", "source": str(index), "target": str(index + 1)}
            for index in range(len(kinds) - 1)
        ],
    }


def run(definition, frame, path, **kwargs):
    return execute_pipeline(
        definition,
        lambda _: (frame, "target"),
        path,
        kwargs.pop("on_node", lambda *args: None),
        lambda *args: None,
        **kwargs,
    )


def test_structural_validation_rejects_cycles_and_dangling_edges():
    definition = workflow()
    definition["edges"].append({"source": "5", "target": "4"})
    definition["edges"].append({"source": "missing", "target": "6"})
    validation = validate_pipeline(definition)
    assert not validation["valid"]
    assert {"CYCLE", "DANGLING_EDGE"} <= {error["code"] for error in validation["errors"]}


def test_validation_checks_order_compatibility_parameters_and_splits():
    definition = workflow()
    assert validate_pipeline(definition)["order"] == [str(i) for i in range(7)]
    definition["nodes"][4]["parameters"] = {"test_size": 0.99}
    definition["edges"].append({"source": "0", "target": "5"})
    validation = validate_pipeline(definition)
    assert {"INVALID_CONFIGURATION", "MULTIPLE_INPUTS"} <= {item["code"] for item in validation["errors"]}
    assert is_compatible("pytorch", "shap")
    assert not is_compatible("unknown_model", "lime")


@pytest.mark.parametrize(
    "model,explainer", [("logistic_regression", "shap"), ("random_forest", "shap"), ("pytorch", "lime")]
)
def test_real_model_workflows_roundtrip_with_normalized_xai(tmp_path, classification_data, model, explainer):
    statuses = []
    result = run(
        workflow(model, explainer),
        classification_data,
        tmp_path,
        on_node=lambda node_id, status, detail: statuses.append((node_id, status)),
    )
    assert 0 <= result["metrics"]["accuracy"] <= 1
    assert len(result["metrics"]["confusion_matrix"]) == 2
    assert result["metrics"]["roc_auc"] is not None
    assert result["explanations"][0]["explainer"] == explainer
    assert result["explanations"][0]["feature_contributions"]
    if explainer == "shap":
        explanation = result["explanations"][0]
        assert explanation["global_importance"]
        assert explanation["base_value"] + sum(
            feature["contribution"] for feature in explanation["feature_contributions"]
        ) == pytest.approx(explanation["output_value"], abs=1e-5)
    assert all(status == "completed" for _, status in statuses[-1:])
    bundle = load_bundle(result["model_artifact"])
    raw = (
        classification_data.drop(columns="target")
        .iloc[:2]
        .where(pd.notna(classification_data), None)
        .to_dict("records")
    )
    prediction = predict_bundle(bundle, raw, explain="lime")
    assert len(prediction["predictions"]) == 2
    assert all(
        sum(item["probabilities"].values()) == pytest.approx(1.0) for item in prediction["predictions"]
    )
    assert prediction["predictions"][0]["explanation"]["explainer"] == "lime"
    if model == "pytorch":
        assert len(result["training_history"]) == 8
        assert list(tmp_path.rglob("weights.pt"))


def test_preprocessing_before_split_never_fits_test_distribution(tmp_path):
    frame = pd.DataFrame(
        {"number": np.arange(80, dtype=float), "category": ["train"] * 80, "target": [0, 1] * 40}
    )
    train, test = train_test_split(frame.index, test_size=0.2, random_state=42, stratify=frame.target)
    frame.loc[test, "number"] = 1_000_000
    frame.loc[test, "category"] = "heldout-only"
    definition = workflow("logistic_regression")
    result = run(definition, frame, tmp_path)
    bundle = load_bundle(result["model_artifact"])
    scaler = next(step for step in bundle["preprocessor"].steps if step.kind == "scale")
    encoder = next(step for step in bundle["preprocessor"].steps if step.kind == "encode")
    assert scaler.transformer.mean_[0] == pytest.approx(frame.loc[train, "number"].mean())
    assert "heldout-only" not in encoder.transformer.categories_[0]
    assert predict_bundle(bundle, frame.drop(columns="target").iloc[test[:1]].to_dict("records"))[
        "predictions"
    ]


def test_inference_validates_raw_schema_and_reuses_transform(tmp_path, classification_data):
    result = run(workflow(), classification_data, tmp_path)
    bundle = load_bundle(result["model_artifact"])
    row = classification_data.drop(columns="target").iloc[0].to_dict()
    expected = bundle["model"].predict_proba(bundle["preprocessor"].transform(pd.DataFrame([row])))[0]
    actual = predict_bundle(bundle, [row])["predictions"][0]
    assert list(actual["probabilities"].values()) == pytest.approx(expected)
    with pytest.raises(ValueError, match="feature mismatch"):
        predict_bundle(bundle, [{"age": 40}])
    with pytest.raises(ValueError, match="finite number"):
        predict_bundle(bundle, [{**row, "age": "invalid"}])
    with pytest.raises(ValueError, match="unexpected"):
        predict_bundle(bundle, [{**row, "target": 1}])


def test_failure_records_failed_and_skipped_nodes(tmp_path, classification_data):
    definition = workflow()
    definition["nodes"].insert(5, {"id": "selection", "type": "select", "parameters": {"k": 500}})
    definition["edges"] = [edge for edge in definition["edges"] if edge["target"] != "5"] + [
        {"source": "4", "target": "selection"},
        {"source": "selection", "target": "5"},
    ]
    statuses = []
    with pytest.raises(PipelineExecutionError, match="only .* available"):
        run(
            definition,
            classification_data,
            tmp_path,
            on_node=lambda node, status, detail: statuses.append((node, status, detail)),
        )
    assert any(node == "5" and status == "failed" for node, status, _ in statuses)
    assert any(node == "6" and status == "skipped" for node, status, _ in statuses)


def test_branches_train_independent_models_and_preserve_outputs(tmp_path, classification_data):
    definition = workflow()
    definition["nodes"] += [
        {"id": "other", "type": "logistic_regression", "parameters": {}},
        {"id": "other_eval", "type": "evaluate", "parameters": {}},
    ]
    definition["edges"] += [{"source": "4", "target": "other"}, {"source": "other", "target": "other_eval"}]
    result = run(definition, classification_data, tmp_path)
    assert len(result["model_runs"]) == 2
    assert {model["model_type"] for model in result["model_runs"]} == {"random_forest", "logistic_regression"}
    assert all(model["metrics"] for model in result["model_runs"])
    assert len({model["model_artifact"] for model in result["model_runs"]}) == 2


def test_register_and_deploy_callbacks_receive_lineage(tmp_path, classification_data):
    definition = workflow()
    definition["nodes"] += [
        {"id": "registry", "type": "register", "parameters": {"name": "Risk classifier"}},
        {"id": "deployment", "type": "deploy", "parameters": {}},
    ]
    definition["edges"] += [
        {"source": "6", "target": "registry"},
        {"source": "registry", "target": "deployment"},
    ]
    registered = []

    def register(path, metadata):
        assert Path(path).is_file()
        assert metadata["metrics"] and metadata["baseline"] and metadata["input_schema"]
        registered.append(metadata)
        return {"id": "model-1", "version": 1}

    result = run(
        definition,
        classification_data,
        tmp_path,
        on_register=register,
        on_deploy=lambda model: {"id": "deployment-1", "model_id": model["id"]},
    )
    assert registered[0]["name"] == "Risk classifier"
    assert result["deployment"]["model_id"] == "model-1"


def test_pytorch_seed_reproduces_probabilities(tmp_path, classification_data):
    result_a = run(workflow("pytorch"), classification_data, tmp_path / "a")
    result_b = run(workflow("pytorch"), classification_data, tmp_path / "b")
    raw = classification_data.drop(columns="target").iloc[:1].to_dict("records")
    a = predict_bundle(load_bundle(result_a["model_artifact"]), raw)
    b = predict_bundle(load_bundle(result_b["model_artifact"]), raw)
    assert a == b


@pytest.mark.parametrize("strategy", ["mean", "median", "most_frequent"])
def test_imputation_encoding_scaling_and_feature_selection(strategy):
    frame = pd.DataFrame(
        {
            "a": [1.0, np.nan, 3.0, 5.0, 6.0, 8.0],
            "b": [2.0, 3.0, 4.0, 6.0, 7.0, 9.0],
            "category": ["a", "b", None, "a", "b", "b"],
        }
    )
    processor = TabularPreprocessor(
        [
            {"type": "impute", "parameters": {"strategy": strategy}},
            {"type": "encode", "parameters": {"method": "ordinal"}},
            {"type": "scale", "parameters": {"method": "minmax"}},
            {"type": "select", "parameters": {"k": 2}},
        ]
    )
    transformed = processor.fit_transform(frame, np.array([0, 0, 0, 1, 1, 1]))
    assert transformed.shape == (6, 2)
    assert np.isfinite(transformed).all()
    assert transformed.min() >= 0 and transformed.max() <= 1
    assert processor.transform(frame) == pytest.approx(transformed)


def test_missing_row_drop_preserves_targets_and_validates_inference(tmp_path, classification_data):
    definition = workflow()
    definition["nodes"][1]["parameters"] = {"strategy": "drop"}
    result = run(definition, classification_data, tmp_path)
    bundle = load_bundle(result["model_artifact"])
    assert bundle["train_samples"] + bundle["test_samples"] == 97
    row = classification_data.drop(columns="target").iloc[0].to_dict()
    with pytest.raises(ValueError, match="complete feature values"):
        predict_bundle(bundle, [{**row, "age": None}])


def test_boolean_features_are_usable_categories(tmp_path, classification_data):
    classification_data["flag"] = classification_data["balance"] > 0
    result = run(workflow(), classification_data, tmp_path)
    bundle = load_bundle(result["model_artifact"])
    row = classification_data.drop(columns="target").iloc[0].to_dict()
    assert predict_bundle(bundle, [row])["predictions"]


def test_pytorch_shap_probability_wrapper_is_supported(tmp_path, classification_data):
    result = run(workflow("pytorch", "shap"), classification_data, tmp_path)
    explanation = result["explanations"][0]
    assert explanation["method"] == "permutation"
    assert explanation["base_value"] + sum(
        feature["contribution"] for feature in explanation["feature_contributions"]
    ) == pytest.approx(explanation["output_value"], abs=1e-5)


def test_all_missing_columns_and_null_categories_keep_original_types():
    frame = pd.DataFrame(
        {
            "numeric": [np.nan] * 6,
            "category": pd.Series([None] * 6, dtype=object),
            "value": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
        }
    )
    processor = TabularPreprocessor(
        [
            {"type": "impute", "parameters": {"strategy": "median"}},
            {"type": "encode", "parameters": {"method": "onehot"}},
        ]
    )
    training = processor.fit_transform(frame, [0, 0, 0, 1, 1, 1])
    assert np.isfinite(training).all()
    nulls = processor.transform(pd.DataFrame([{"numeric": None, "category": None, "value": None}]))
    unseen = processor.transform(pd.DataFrame([{"numeric": 2.0, "category": "new", "value": 2.0}]))
    assert np.isfinite(nulls).all() and np.isfinite(unseen).all()


def test_impute_then_drop_honors_transform_order(tmp_path, classification_data):
    definition = workflow()
    definition["nodes"].insert(2, {"id": "drop", "type": "impute", "parameters": {"strategy": "drop"}})
    definition["edges"] = [edge for edge in definition["edges"] if edge["target"] != "2"] + [
        {"source": "1", "target": "drop"},
        {"source": "drop", "target": "2"},
    ]
    result = run(definition, classification_data, tmp_path)
    bundle = load_bundle(result["model_artifact"])
    assert bundle["train_samples"] + bundle["test_samples"] == 100
    row = classification_data.drop(columns="target").iloc[0].to_dict()
    assert predict_bundle(bundle, [{**row, "age": None}])["predictions"]


@pytest.mark.parametrize(
    "parameter,value",
    [("C", np.nan), ("C", np.inf), ("max_iter", np.inf), ("max_iter", 10001), ("unknown", 1)],
)
def test_nonfinite_extreme_and_unknown_parameters_rejected(parameter, value):
    definition = workflow("logistic_regression")
    definition["nodes"][5]["parameters"] = {parameter: value}
    assert not validate_pipeline(definition)["valid"]


def test_multiclass_liblinear_is_rejected_before_execution():
    definition = workflow("logistic_regression")
    definition["nodes"][5]["parameters"] = {"solver": "liblinear"}
    frame = pd.DataFrame({"value": range(30), "target": [0, 1, 2] * 10})
    validation = validate_pipeline(definition, lambda _: (frame, "target"))
    assert "INCOMPATIBLE_SOLVER" in {error["code"] for error in validation["errors"]}


def test_high_cardinality_encoding_is_rejected_before_dense_allocation(monkeypatch):
    import app.ml.preprocessing as module

    frame = pd.DataFrame({"category": [f"category-{index}" for index in range(600)]})
    original_transform = module.FittedStep.transform

    def guarded_transform(self, data):
        if self.kind == "encode":
            pytest.fail("Dense encoding was attempted before the feature budget check.")
        return original_transform(self, data)

    monkeypatch.setattr(module.FittedStep, "transform", guarded_transform)
    processor = TabularPreprocessor([{"type": "encode", "parameters": {"method": "onehot"}}])
    with pytest.raises(ValueError, match="512 transformed feature"):
        processor.fit_transform(frame, [0, 1] * 300)


def test_cell_budget_checked_before_transforming(monkeypatch):
    import app.ml.preprocessing as module

    monkeypatch.setattr(module, "MAX_PREPROCESS_CELLS", 20)
    frame = pd.DataFrame({"number": range(10), "category": ["a", "b", "c", "d", "e"] * 2})
    processor = TabularPreprocessor([{"type": "encode", "parameters": {"method": "onehot"}}])
    with pytest.raises(ValueError, match="cell budget"):
        processor.fit_transform(frame, [0, 1] * 5)


def test_unlimited_forest_depth_is_a_valid_configuration():
    definition = workflow()
    definition["nodes"][5]["parameters"]["max_depth"] = None
    assert validate_pipeline(definition)["valid"]
