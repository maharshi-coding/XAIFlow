"""The same typed node catalog is consumed by the editor and validator."""

NODE_CATALOG = [
    {
        "type": "dataset",
        "label": "Dataset Input",
        "category": "Data",
        "parameters": {"dataset_id": ""},
        "input_kind": None,
        "output_kind": "data",
    },
    {
        "type": "split",
        "label": "Train / Test Split",
        "category": "Preprocessing",
        "parameters": {"test_size": 0.2, "random_state": 42, "stratify": True},
        "input_kind": "data",
        "output_kind": "data",
    },
    {
        "type": "impute",
        "label": "Missing Value Handler",
        "category": "Preprocessing",
        "parameters": {"strategy": "median"},
        "input_kind": "data",
        "output_kind": "data",
    },
    {
        "type": "encode",
        "label": "Categorical Encoder",
        "category": "Preprocessing",
        "parameters": {"method": "onehot"},
        "input_kind": "data",
        "output_kind": "data",
    },
    {
        "type": "scale",
        "label": "Feature Scaling",
        "category": "Preprocessing",
        "parameters": {"method": "standard"},
        "input_kind": "data",
        "output_kind": "data",
    },
    {
        "type": "select",
        "label": "Feature Selection",
        "category": "Preprocessing",
        "parameters": {"k": 5},
        "input_kind": "data",
        "output_kind": "data",
    },
    {
        "type": "logistic_regression",
        "label": "Logistic Regression",
        "category": "Models",
        "parameters": {"C": 1.0, "max_iter": 500, "solver": "lbfgs", "random_state": 42},
        "input_kind": "data",
        "output_kind": "model",
    },
    {
        "type": "random_forest",
        "label": "Random Forest",
        "category": "Models",
        "parameters": {
            "n_estimators": 100,
            "max_depth": 8,
            "min_samples_split": 2,
            "min_samples_leaf": 1,
            "class_weight": None,
            "random_state": 42,
        },
        "input_kind": "data",
        "output_kind": "model",
    },
    {
        "type": "pytorch",
        "label": "PyTorch Neural Network",
        "category": "Models",
        "parameters": {
            "hidden_dims": [32, 16],
            "learning_rate": 0.01,
            "epochs": 30,
            "batch_size": 32,
            "dropout": 0.1,
            "random_state": 42,
        },
        "input_kind": "data",
        "output_kind": "model",
    },
    {
        "type": "evaluate",
        "label": "Classification Evaluation",
        "category": "Evaluation",
        "parameters": {},
        "input_kind": "model",
        "output_kind": "model",
    },
    {
        "type": "shap",
        "label": "SHAP Explanation",
        "category": "Explainability",
        "parameters": {"sample_index": 0, "max_samples": 30},
        "input_kind": "model",
        "output_kind": "model",
    },
    {
        "type": "lime",
        "label": "LIME Explanation",
        "category": "Explainability",
        "parameters": {"sample_index": 0, "num_features": 8, "num_samples": 500},
        "input_kind": "model",
        "output_kind": "model",
    },
    {
        "type": "register",
        "label": "Register Model",
        "category": "Model Operations",
        "parameters": {"name": "Classifier"},
        "input_kind": "model",
        "output_kind": "registered_model",
    },
    {
        "type": "deploy",
        "label": "Deploy Model",
        "category": "Model Operations",
        "parameters": {"name": "Model service", "explanation_method": None},
        "input_kind": "registered_model",
        "output_kind": "deployment",
    },
]
NODE_BY_TYPE = {node["type"]: node for node in NODE_CATALOG}
MODEL_TYPES = {"logistic_regression", "random_forest", "pytorch"}
PREPROCESS_TYPES = {"impute", "encode", "scale", "select"}


def node_parameters(node: dict) -> dict:
    return {**NODE_BY_TYPE[node["type"]]["parameters"], **node.get("parameters", {})}
