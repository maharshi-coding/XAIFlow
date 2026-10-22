"""Trusted, server-created model bundles with raw input validation."""

from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from .adapters import python_value
from app.xai.lime_adapter import LimeAdapter
from app.xai.shap_adapter import ShapAdapter


def load_bundle(path):
    bundle = joblib.load(Path(path))
    if not isinstance(bundle, dict) or bundle.get("format_version") != 1:
        raise ValueError("Unsupported model bundle format.")
    return bundle


def validate_rows(bundle, rows):
    if not isinstance(rows, list) or not rows or len(rows) > 1000:
        raise ValueError("Provide between 1 and 1000 feature objects.")
    schema = bundle["input_schema"]
    expected = {feature["name"] for feature in schema}
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index} must be an object.")
        missing, extra = expected - row.keys(), row.keys() - expected
        if missing or extra:
            raise ValueError(
                f"Row {index} feature mismatch: missing {sorted(missing)}, unexpected {sorted(extra)}."
            )
        for feature in schema:
            value = row[feature["name"]]
            if value is None:
                continue  # The persisted imputer decides whether nulls are supported.
            if feature["dtype"] == "numeric":
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not np.isfinite(value):
                    raise ValueError(f"Row {index}: {feature['name']} must be a finite number or null.")
            elif not isinstance(value, (str, int, float, bool)):
                raise ValueError(f"Row {index}: {feature['name']} must be a scalar category or null.")
    return pd.DataFrame(rows, columns=[feature["name"] for feature in schema])


def predict_bundle(bundle, rows: list[dict], explain: str | None = None):
    if explain not in {None, "none", "lime", "shap"}:
        raise ValueError("Explanation method must be lime, shap or none.")
    raw = validate_rows(bundle, rows)
    if explain in {"lime", "shap"} and len(rows) > 10:
        raise ValueError("Explanation requests support at most 10 rows; send smaller batches.")
    features = bundle["preprocessor"].transform(raw)
    model = bundle["model"]
    probabilities = model.predict_proba(features)
    predictions = []
    for index, proba in enumerate(probabilities):
        class_index = int(proba.argmax())
        prediction = {
            "prediction": python_value(model.classes_[class_index]),
            "probabilities": {
                str(label): float(probability) for label, probability in zip(model.classes_, proba)
            },
            "confidence": float(proba[class_index]),
        }
        if explain and explain != "none":
            adapter = LimeAdapter() if explain == "lime" else ShapAdapter()
            options = {"sample_index": 0, "max_samples": 1, "random_state": int(bundle["random_state"])}
            explanation = adapter.explain_local(
                model, bundle["background"], features[index], bundle["preprocessor"].feature_names, **options
            )
            explanation["sample_index"] = index
            prediction["explanation"] = explanation
        predictions.append(prediction)
    return {"predictions": predictions, "metadata": model.metadata()}
