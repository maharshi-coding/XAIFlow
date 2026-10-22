"""Classification metrics are computed from a held-out test partition."""

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
)
from .adapters import python_value


def evaluate_model(model, features, target):
    predictions, probabilities = model.predict(features), model.predict_proba(features)
    classes = model.classes_
    metrics = {
        "accuracy": float(accuracy_score(target, predictions)),
        "precision": float(precision_score(target, predictions, average="weighted", zero_division=0)),
        "recall": float(recall_score(target, predictions, average="weighted", zero_division=0)),
        "f1": float(f1_score(target, predictions, average="weighted", zero_division=0)),
        "confusion_matrix": confusion_matrix(target, predictions, labels=classes).tolist(),
        "classes": [python_value(x) for x in classes],
        "test_samples": int(len(target)),
        "prediction_distribution": {str(c): int(np.sum(predictions == c)) for c in classes},
        "class_distribution": {str(c): int(np.sum(np.asarray(target) == c)) for c in classes},
    }
    try:
        if len(classes) == 2:
            truth = (np.asarray(target) == classes[1]).astype(int)
            metrics["roc_auc"] = float(roc_auc_score(truth, probabilities[:, 1]))
            fpr, tpr, thresholds = roc_curve(truth, probabilities[:, 1])
            metrics["roc_curve"] = {
                "fpr": fpr.tolist(),
                "tpr": tpr.tolist(),
                "thresholds": [float(x) if np.isfinite(x) else None for x in thresholds],
            }
        else:
            metrics["roc_auc"] = float(
                roc_auc_score(target, probabilities, multi_class="ovr", average="weighted", labels=classes)
            )
    except ValueError:
        metrics["roc_auc"] = None
    return metrics
