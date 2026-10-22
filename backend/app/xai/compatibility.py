SUPPORTED = {
    "shap": {"logistic_regression", "random_forest", "pytorch"},
    "lime": {"logistic_regression", "random_forest", "pytorch"},
}


def is_compatible(model_type: str, explainer: str) -> bool:
    return model_type in SUPPORTED.get(explainer, set())
