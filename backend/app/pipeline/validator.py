"""Structural, parameter and dataset validation shared by save and execute."""

import math
from .graph import topological_order
from .registry import MODEL_TYPES, NODE_BY_TYPE, node_parameters
from app.xai.compatibility import is_compatible


def validate_pipeline(definition: dict, dataset_resolver=None) -> dict:
    errors = []
    dataset_classes = {}

    def error(node_id, code, message):
        errors.append({"node_id": node_id, "code": code, "message": message})

    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])
    if not isinstance(nodes, list) or not nodes:
        return {
            "valid": False,
            "errors": [
                {
                    "node_id": None,
                    "code": "EMPTY_PIPELINE",
                    "message": "Add a dataset and model to the pipeline.",
                }
            ],
            "order": [],
        }
    if any(not isinstance(n, dict) or not isinstance(n.get("id"), str) or not n["id"] for n in nodes):
        return {
            "valid": False,
            "errors": [
                {"node_id": None, "code": "INVALID_NODE", "message": "Every node needs a nonempty string ID."}
            ],
            "order": [],
        }
    by_id = {n["id"]: n for n in nodes}
    if len(by_id) != len(nodes):
        error(None, "DUPLICATE_ID", "Node IDs must be unique.")
    parents = {n["id"]: [] for n in nodes}
    valid_edges = []
    seen_edges = set()
    for edge in edges:
        source, target = edge.get("source"), edge.get("target")
        if source not in by_id or target not in by_id:
            error(target, "DANGLING_EDGE", "Every edge must connect existing nodes.")
            continue
        if (source, target) in seen_edges:
            error(target, "DUPLICATE_EDGE", "Duplicate connections are not supported.")
            continue
        seen_edges.add((source, target))
        valid_edges.append(edge)
        parents[target].append(source)
    try:
        order = topological_order(nodes, valid_edges)
    except ValueError as exc:
        error(None, "CYCLE", str(exc))
        order = []
    if not any(n.get("type") == "dataset" for n in nodes):
        error(None, "MISSING_DATASET", "A dataset input is required.")
    if not any(n.get("type") in MODEL_TYPES for n in nodes):
        error(None, "MISSING_MODEL", "Add at least one training node.")
    for node in nodes:
        node_id, kind = node["id"], node.get("type")
        if kind not in NODE_BY_TYPE:
            error(node_id, "UNKNOWN_NODE", f"Unknown node type: {kind}.")
            continue
        if not isinstance(node.get("parameters", {}), dict):
            error(node_id, "INVALID_PARAMETERS", "Parameters must be an object.")
            continue
        spec, params = NODE_BY_TYPE[kind], node_parameters(node)
        unknown = set(node.get("parameters", {})) - set(spec["parameters"])
        if unknown:
            error(
                node_id,
                "UNKNOWN_PARAMETER",
                f"Unsupported parameters for {spec['label']}: {', '.join(sorted(unknown))}.",
            )
        if kind == "dataset":
            if parents[node_id]:
                error(node_id, "UNEXPECTED_INPUT", "Dataset inputs cannot have incoming connections.")
        elif not parents[node_id]:
            error(node_id, "MISSING_INPUT", f"{spec['label']} requires an upstream {spec['input_kind']}.")
        elif len(parents[node_id]) > 1:
            error(
                node_id,
                "MULTIPLE_INPUTS",
                "This node requires one parent; branch outputs into separate workflows.",
            )
        for parent_id in parents[node_id]:
            parent = NODE_BY_TYPE.get(by_id[parent_id].get("type"))
            if parent and parent["output_kind"] != spec["input_kind"]:
                error(
                    node_id, "INCOMPATIBLE_INPUT", f"{spec['label']} cannot consume {parent['output_kind']}."
                )
        try:
            for key, default in spec["parameters"].items():
                value = params[key]
                if key == "max_depth" and value is None:
                    continue
                if key == "k" and value == "all":
                    continue
                if isinstance(default, bool) and not isinstance(value, bool):
                    raise ValueError(f"{key} must be true or false.")
                if (
                    isinstance(default, int)
                    and not isinstance(default, bool)
                    and (not isinstance(value, int) or isinstance(value, bool))
                ):
                    raise ValueError(f"{key} must be an integer.")
                if isinstance(default, float) and (
                    not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value)
                ):
                    raise ValueError(f"{key} must be a finite number.")
                if isinstance(default, str) and not isinstance(value, str):
                    raise ValueError(f"{key} must be text.")
            if kind == "dataset":
                if not params.get("dataset_id"):
                    raise ValueError("Select a dataset.")
                if dataset_resolver is not None:
                    frame, target = dataset_resolver(params["dataset_id"])
                    if not target or target not in frame.columns:
                        raise ValueError("The dataset needs an existing target column.")
                    if len(frame) < 10:
                        raise ValueError("Classification needs at least 10 rows.")
                    if frame[target].isna().any():
                        raise ValueError("Target values cannot be missing.")
                    if not 2 <= frame[target].nunique() <= min(100, len(frame) // 2):
                        raise ValueError(
                            "Select a classification target with at least two classes and repeated observations."
                        )
                    dataset_classes[node_id] = int(frame[target].nunique())
            elif kind == "split":
                if not 0.05 <= float(params["test_size"]) <= 0.5:
                    raise ValueError("Test size must be between 0.05 and 0.5.")
                if not isinstance(params["stratify"], bool):
                    raise ValueError("Stratify must be true or false.")
            elif kind == "impute" and params["strategy"] not in {"mean", "median", "most_frequent", "drop"}:
                raise ValueError("Unknown imputation strategy.")
            elif kind == "encode" and params["method"] not in {"onehot", "ordinal"}:
                raise ValueError("Encoding must be onehot or ordinal.")
            elif kind == "scale" and params["method"] not in {"standard", "minmax"}:
                raise ValueError("Scaling must be standard or minmax.")
            elif (
                kind == "select"
                and params["k"] != "all"
                and (not isinstance(params["k"], int) or isinstance(params["k"], bool) or params["k"] < 1)
            ):
                raise ValueError("Feature selection k must be a positive integer or 'all'.")
            elif kind == "logistic_regression":
                if (
                    not math.isfinite(float(params["C"]))
                    or not 0 < float(params["C"]) <= 1_000_000
                    or not 1 <= int(params["max_iter"]) <= 10_000
                ):
                    raise ValueError(
                        "C must be finite and positive (at most 1000000); max_iter must be between 1 and 10000."
                    )
                if params["solver"] not in {"lbfgs", "liblinear", "newton-cg", "sag", "saga"}:
                    raise ValueError("Unsupported logistic-regression solver.")
            elif kind == "random_forest":
                if not 1 <= int(params["n_estimators"]) <= 1000:
                    raise ValueError("Use between 1 and 1000 trees.")
                if params["max_depth"] is not None and not 1 <= int(params["max_depth"]) <= 100:
                    raise ValueError("Max depth must be between 1 and 100 or null.")
                if int(params["min_samples_split"]) < 2 or int(params["min_samples_leaf"]) < 1:
                    raise ValueError("Invalid minimum sample counts.")
                if params["class_weight"] not in {None, "balanced", "balanced_subsample"}:
                    raise ValueError("Class weight must be null, balanced or balanced_subsample.")
            elif kind == "pytorch":
                if (
                    not isinstance(params["hidden_dims"], list)
                    or not 1 <= len(params["hidden_dims"]) <= 6
                    or any(
                        not isinstance(x, int) or isinstance(x, bool) or not 1 <= x <= 512
                        for x in params["hidden_dims"]
                    )
                ):
                    raise ValueError("Use between 1 and 6 hidden layers, each with 1–512 units.")
                if (
                    not 1 <= int(params["epochs"]) <= 500
                    or not 1 <= int(params["batch_size"]) <= 4096
                    or not 0 < float(params["learning_rate"]) <= 1
                    or not 0 <= float(params["dropout"]) < 1
                ):
                    raise ValueError("Invalid neural-network training parameters.")
            elif kind in {"shap", "lime"}:
                if int(params["sample_index"]) < 0:
                    raise ValueError("Sample index must be nonnegative.")
                if kind == "shap" and not 1 <= int(params["max_samples"]) <= 200:
                    raise ValueError("SHAP sample count must be between 1 and 200.")
                if kind == "lime" and (
                    not 100 <= int(params["num_samples"]) <= 5000 or int(params["num_features"]) < 1
                ):
                    raise ValueError("LIME needs 100–5000 perturbation samples and at least one feature.")
            elif kind == "register" and not str(params["name"]).strip():
                raise ValueError("A model name is required.")
            elif kind == "deploy":
                if not str(params["name"]).strip():
                    raise ValueError("A deployment name is required.")
                if params["explanation_method"] not in {None, "shap", "lime"}:
                    raise ValueError("Deployment explanations must be shap, lime or null.")
            if "random_state" in params and (
                not isinstance(params["random_state"], int) or not 0 <= params["random_state"] < 2**32
            ):
                raise ValueError("Random state must be an integer from 0 to 4294967295.")
        except (ValueError, TypeError, KeyError, OSError, OverflowError) as exc:
            error(node_id, "INVALID_CONFIGURATION", str(exc))
    upstream_model, has_split, upstream_dataset = {}, {}, {}
    for node_id in order:
        kind = by_id[node_id].get("type")
        parent_id = parents[node_id][0] if len(parents[node_id]) == 1 else None
        upstream_model[node_id] = kind if kind in MODEL_TYPES else upstream_model.get(parent_id)
        upstream_dataset[node_id] = node_id if kind == "dataset" else upstream_dataset.get(parent_id)
        has_split[node_id] = kind == "split" or has_split.get(parent_id, False)
        if kind == "split" and has_split.get(parent_id, False):
            error(node_id, "REPEATED_SPLIT", "Each model path may contain only one train/test split.")
        if kind in MODEL_TYPES and not has_split[node_id]:
            error(node_id, "MISSING_SPLIT", "Add a train/test split before training.")
        if (
            kind == "logistic_regression"
            and isinstance(by_id[node_id].get("parameters", {}), dict)
            and node_parameters(by_id[node_id])["solver"] == "liblinear"
            and dataset_classes.get(upstream_dataset[node_id], 0) > 2
        ):
            error(
                node_id,
                "INCOMPATIBLE_SOLVER",
                "The liblinear solver supports binary classification here. Use lbfgs for multiclass targets.",
            )
        if kind in {"shap", "lime"} and not is_compatible(upstream_model[node_id], kind):
            error(node_id, "XAI_INCOMPATIBLE", "This explainer is incompatible with the upstream model.")
    return {"valid": not errors, "errors": errors, "order": order}
