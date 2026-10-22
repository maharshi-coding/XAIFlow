"""Concrete node operations; storage and API concerns enter via callbacks."""

from dataclasses import replace
from pathlib import Path
import hashlib
import json
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from .base import PipelineNode
from app.pipeline.context import DataContext, ModelContext
from app.ml.preprocessing import TabularPreprocessor
from app.ml.adapters import create_adapter
from app.ml.evaluation import evaluate_model
from app.xai.shap_adapter import ShapAdapter
from app.xai.lime_adapter import LimeAdapter


def node_folder(root: Path, node_id: str):
    path = root / hashlib.sha256(node_id.encode()).hexdigest()[:16]
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False), encoding="utf-8")


def baseline_statistics(frame):
    features = {}
    for name in frame.columns:
        column = frame[name]
        summary = {"missing_fraction": float(column.isna().mean())}
        if pd.api.types.is_numeric_dtype(column) and not pd.api.types.is_bool_dtype(column):
            clean = pd.to_numeric(column, errors="coerce").dropna()
            summary.update(
                {
                    "dtype": "numeric",
                    **{
                        key: float(value) if np.isfinite(value) else None
                        for key, value in {
                            "mean": clean.mean(),
                            "std": clean.std(ddof=0),
                            "min": clean.min(),
                            "max": clean.max(),
                        }.items()
                    },
                }
            )
        else:
            summary.update(
                {
                    "dtype": "categorical",
                    "counts": {
                        str(key): int(value)
                        for key, value in column.fillna("<missing>").value_counts().head(100).items()
                    },
                }
            )
        features[name] = summary
    return {"features": features, "samples": len(frame)}


def model_metadata(output):
    bundle = output.bundle
    return {
        **bundle["model"].metadata(),
        "dataset_id": output.dataset_id,
        "metrics": output.metrics,
        "preprocessing": bundle["preprocessing"],
        "input_schema": bundle["input_schema"],
        "feature_columns": bundle["feature_columns"],
        "transformed_features": bundle["preprocessor"].feature_names,
        "baseline": bundle["baseline"],
        "training_history": bundle["model"].training_history,
        "explanation_methods": sorted({item["explainer"] for item in output.explanations}),
        "explanations": output.explanations,
        "train_samples": bundle["train_samples"],
        "test_samples": bundle["test_samples"],
    }


class DatasetNode(PipelineNode):
    def execute(self, upstream, context):
        frame, target = context.dataset_resolver(self.parameters["dataset_id"])
        return DataContext(self.parameters["dataset_id"], frame.copy().reset_index(drop=True), target)

    def serialize_output(self, output):
        return {
            "rows": len(output.frame),
            "columns": len(output.frame.columns),
            "dataset_id": output.dataset_id,
        }


class PreprocessingNode(PipelineNode):
    def execute(self, upstream, context):
        context.on_log(
            "info",
            "Recorded transformation plan. Fitting occurs on the training partition at the model node to prevent leakage.",
            self.definition["id"],
        )
        return replace(
            upstream, plan=[*upstream.plan, {"type": self.definition["type"], "parameters": self.parameters}]
        )

    def serialize_output(self, output):
        return {"fit_strategy": "training_partition_only", "preprocessing_steps": len(output.plan)}


class SplitNode(PipelineNode):
    def execute(self, upstream, context):
        target = upstream.frame[upstream.target_column]
        try:
            train, test = train_test_split(
                upstream.frame.index,
                test_size=float(self.parameters["test_size"]),
                random_state=int(self.parameters["random_state"]),
                stratify=target if self.parameters["stratify"] else None,
            )
        except ValueError as exc:
            raise ValueError(f"Train/test split failed: {exc}") from exc
        return replace(
            upstream, split_parameters=self.parameters, train_index=train.tolist(), test_index=test.tolist()
        )

    def serialize_output(self, output):
        return {"train_samples": len(output.train_index), "test_samples": len(output.test_index)}


class TrainingNode(PipelineNode):
    def execute(self, upstream, context):
        if upstream.train_index is None:
            raise ValueError("Training requires a train/test split.")
        train = upstream.frame.loc[upstream.train_index].copy()
        test = upstream.frame.loc[upstream.test_index].copy()
        preprocessor = TabularPreprocessor(upstream.plan)
        if len(train) < 2 or not len(test):
            raise ValueError("Preprocessing left insufficient training or test rows.")
        train_raw, test_raw = (
            train.drop(columns=[upstream.target_column]),
            test.drop(columns=[upstream.target_column]),
        )
        train_target, test_target = (
            train[upstream.target_column].to_numpy(),
            test[upstream.target_column].to_numpy(),
        )
        if len(np.unique(train_target)) < 2:
            raise ValueError("The training partition must contain at least two classes.")
        if not set(np.unique(test_target)).issubset(set(np.unique(train_target))):
            raise ValueError("Test data includes classes absent from training; use a stratified split.")
        train_features = preprocessor.fit_transform(train_raw, train_target)
        train = train.loc[preprocessor.training_index]
        train_raw = train_raw.loc[preprocessor.training_index]
        train_target = train[upstream.target_column].to_numpy()
        test_features, test_index = preprocessor.transform_partition(test_raw)
        test = test.loc[test_index]
        test_target = test[upstream.target_column].to_numpy()
        if not len(test) or len(np.unique(train_target)) < 2:
            raise ValueError("Preprocessing left insufficient test rows or fewer than two training classes.")
        if not set(np.unique(test_target)).issubset(set(np.unique(train_target))):
            raise ValueError(
                "Preprocessing removed every training example of a test class. Choose an imputation strategy that preserves rows."
            )
        if train_features.shape[1] > 512:
            raise ValueError(
                "This prototype supports at most 512 transformed features. Use feature selection or fewer categories."
            )
        adapter = create_adapter(self.definition["type"], self.parameters)
        start = time.perf_counter()
        adapter.fit(train_features, train_target)
        duration = time.perf_counter() - start
        path = node_folder(context.artifact_dir, self.definition["id"])
        raw_frame = upstream.frame.drop(columns=[upstream.target_column])
        schema = [
            {
                "name": name,
                "dtype": "numeric"
                if pd.api.types.is_numeric_dtype(raw_frame[name])
                and not pd.api.types.is_bool_dtype(raw_frame[name])
                else "categorical",
                "required": True,
            }
            for name in raw_frame.columns
        ]
        bundle = {
            "format_version": 1,
            "model": adapter,
            "preprocessor": preprocessor,
            "model_type": adapter.model_type,
            "framework": adapter.framework,
            "input_schema": schema,
            "feature_columns": list(raw_frame.columns),
            "preprocessing": upstream.plan,
            "dataset_id": upstream.dataset_id,
            "random_state": int(self.parameters.get("random_state", 42)),
            "background": train_features[:100],
            "baseline": baseline_statistics(train_raw),
            "train_samples": len(train),
            "test_samples": len(test),
            "test_indices": test.index.tolist(),
            "training_duration": duration,
        }
        bundle_path = path / "model.joblib"
        joblib.dump(bundle, bundle_path)
        context.artifact(bundle_path, "model")
        if adapter.model_type == "pytorch":
            weights = adapter.save_weights(path)
            context.artifact(weights, "weights")
            history_path = path / "training_history.json"
            write_json(history_path, adapter.training_history)
            context.artifact(history_path, "training_history")
        output = ModelContext(
            self.definition["id"],
            upstream.dataset_id,
            bundle,
            str(bundle_path),
            train_features,
            test_features,
            test_target,
        )
        metadata_path = path / "metadata.json"
        write_json(metadata_path, model_metadata(output))
        context.artifact(metadata_path, "model_metadata")
        return output

    def serialize_output(self, output):
        return {
            "model_type": output.bundle["model"].model_type,
            "train_samples": len(output.train_features),
            "test_samples": len(output.test_features),
            "training_duration": output.bundle["training_duration"],
        }


class EvaluationNode(PipelineNode):
    def execute(self, upstream, context):
        metrics = evaluate_model(upstream.bundle["model"], upstream.test_features, upstream.test_target)
        path = node_folder(context.artifact_dir, self.definition["id"]) / "metrics.json"
        write_json(path, metrics)
        context.artifact(path, "metrics")
        return replace(upstream, metrics=metrics)

    def serialize_output(self, output):
        return {"metrics": output.metrics}


class ExplanationNode(PipelineNode):
    def execute(self, upstream, context):
        kind = self.definition["type"]
        index = int(self.parameters["sample_index"])
        if index >= len(upstream.test_features):
            raise ValueError(
                f"Sample index {index} exceeds held-out sample count {len(upstream.test_features)}."
            )
        model, names = upstream.bundle["model"], upstream.bundle["preprocessor"].feature_names
        options = {**self.parameters, "random_state": upstream.bundle["random_state"]}
        if kind == "shap":
            explanation = ShapAdapter().explain_global(
                model, upstream.train_features, upstream.test_features, names, **options
            )
        else:
            explanation = LimeAdapter().explain_local(
                model, upstream.train_features, upstream.test_features[index], names, **options
            )
        explanation["node_id"] = self.definition["id"]
        explanation["dataset_id"] = upstream.dataset_id
        explanation["dataset_row_index"] = upstream.bundle["test_indices"][index]
        path = node_folder(context.artifact_dir, self.definition["id"]) / f"{kind}.json"
        write_json(path, explanation)
        explanation["artifact_path"] = str(path)
        context.artifact(path, "explanation")
        return replace(upstream, explanations=[*upstream.explanations, explanation])

    def serialize_output(self, output):
        last = output.explanations[-1]
        return {"explainer": last["explainer"], "contribution_count": len(last["feature_contributions"])}


class RegisterNode(PipelineNode):
    def execute(self, upstream, context):
        if context.on_register is None:
            raise ValueError("The model registry is unavailable in this execution context.")
        metadata = {**model_metadata(upstream), "name": self.parameters["name"]}
        registration = context.on_register(upstream.bundle_path, metadata)
        context.registrations.append(registration)
        return replace(upstream, registration=registration)

    def serialize_output(self, output):
        return {"registration": output.registration}


class DeployNode(PipelineNode):
    def execute(self, upstream, context):
        if context.on_deploy is None or not upstream.registration:
            raise ValueError("Deployment requires an available deployment service and a registered model.")
        deployment = context.on_deploy({**upstream.registration, "deployment_parameters": self.parameters})
        context.deployments.append(deployment)
        return upstream

    def serialize_output(self, output):
        return {"registered_model_id": output.registration.get("id")}


NODE_IMPLEMENTATIONS = {
    "dataset": DatasetNode,
    "split": SplitNode,
    **{kind: PreprocessingNode for kind in ("impute", "encode", "scale", "select")},
    **{kind: TrainingNode for kind in ("logistic_regression", "random_forest", "pytorch")},
    "evaluate": EvaluationNode,
    "shap": ExplanationNode,
    "lime": ExplanationNode,
    "register": RegisterNode,
    "deploy": DeployNode,
}
