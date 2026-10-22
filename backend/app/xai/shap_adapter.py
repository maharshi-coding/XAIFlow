import numpy as np
from app.ml.adapters import python_value
from .base import ExplainerAdapter, ATTRIBUTION_NOTICE
from .compatibility import is_compatible


class ShapAdapter(ExplainerAdapter):
    def supports(self, model_type):
        return is_compatible(model_type, "shap")

    def _explain(self, model, background, samples, seed=42):
        import shap

        background = np.asarray(background, dtype=float)[:50]
        if model.model_type == "random_forest":
            explainer = shap.TreeExplainer(
                model.estimator,
                data=background,
                model_output="probability",
                feature_perturbation="interventional",
            )
            return explainer(np.asarray(samples), check_additivity=False)
        # Probability wrappers work reliably for sklearn and our deterministic
        # CPU torch adapter; no gradients or fabricated fallback attributions.
        masker = shap.maskers.Independent(background, max_samples=50)
        explainer = shap.Explainer(model.predict_proba, masker, algorithm="permutation", seed=seed)
        return explainer(np.asarray(samples), max_evals=3 * (2 * samples.shape[1] + 1), silent=True)

    def explain_local(self, model, background, sample, feature_names, **kwargs):
        return self.explain_global(
            model, background, np.asarray(sample).reshape(1, -1), feature_names, **kwargs
        )

    def explain_global(self, model, background, samples, feature_names, **kwargs):
        sample_index = int(kwargs.get("sample_index", 0))
        max_samples = int(kwargs.get("max_samples", 30))
        if sample_index >= len(samples):
            raise ValueError(f"Sample index {sample_index} is outside the {len(samples)} held-out rows.")
        indices = list(range(min(max_samples, len(samples))))
        if sample_index not in indices:
            indices[-1] = sample_index
        selected = np.asarray(samples)[indices]
        if (
            model.model_type != "random_forest"
            and len(selected) * min(len(background), 50) * 3 * (2 * selected.shape[1] + 1) > 1_000_000
        ):
            raise ValueError(
                "The SHAP request exceeds the prototype computation budget. Reduce max_samples or select fewer features."
            )
        explanation = self._explain(model, background, selected, int(kwargs.get("random_state", 42)))
        values = np.asarray(explanation.values)
        if values.ndim != 3 or values.shape[-1] != len(model.classes_):
            raise ValueError("SHAP returned an unsupported classifier attribution shape.")
        local_index = indices.index(sample_index)
        probabilities = model.predict_proba(selected[local_index : local_index + 1])[0]
        class_index = int(probabilities.argmax())
        contributions = values[local_index, :, class_index]
        base = np.asarray(explanation.base_values)
        base_value = float(base[local_index, class_index] if base.ndim == 2 else base[class_index])
        importance = np.mean(np.abs(values), axis=(0, 2))
        return {
            "explainer": "shap",
            "method": "tree" if model.model_type == "random_forest" else "permutation",
            "model_type": model.model_type,
            "sample_index": sample_index,
            "predicted_class": python_value(model.classes_[class_index]),
            "confidence": float(probabilities[class_index]),
            "base_value": base_value,
            "output_value": float(probabilities[class_index]),
            "output_space": "probability",
            "feature_contributions": sorted(
                [
                    {
                        "feature": name,
                        "value": float(selected[local_index, index]),
                        "contribution": float(contributions[index]),
                    }
                    for index, name in enumerate(feature_names)
                ],
                key=lambda item: abs(item["contribution"]),
                reverse=True,
            ),
            "global_importance": sorted(
                [
                    {"feature": name, "importance": float(importance[index])}
                    for index, name in enumerate(feature_names)
                ],
                key=lambda item: item["importance"],
                reverse=True,
            ),
            "sample_count": len(selected),
            "background_sample_count": min(len(background), 50),
            "global_aggregation": "mean_absolute_attribution_over_sampled_rows_and_output_classes",
            "feature_space": "transformed_model_inputs",
            "notice": ATTRIBUTION_NOTICE,
        }
