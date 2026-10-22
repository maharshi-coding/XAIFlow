import numpy as np
from app.ml.adapters import python_value
from .base import ExplainerAdapter, ATTRIBUTION_NOTICE
from .compatibility import is_compatible


class LimeAdapter(ExplainerAdapter):
    def supports(self, model_type):
        return is_compatible(model_type, "lime")

    def explain_local(self, model, background, sample, feature_names, **kwargs):
        from lime.lime_tabular import LimeTabularExplainer

        sample = np.asarray(sample).reshape(-1)
        probabilities = model.predict_proba(sample.reshape(1, -1))[0]
        class_index = int(probabilities.argmax())
        explainer = LimeTabularExplainer(
            np.asarray(background, dtype=float),
            feature_names=feature_names,
            class_names=[str(value) for value in model.classes_],
            mode="classification",
            random_state=int(kwargs.get("random_state", 42)),
            discretize_continuous=True,
        )
        explanation = explainer.explain_instance(
            sample,
            model.predict_proba,
            labels=(class_index,),
            num_features=min(int(kwargs.get("num_features", 8)), len(feature_names)),
            num_samples=int(kwargs.get("num_samples", 500)),
        )
        contributions = [
            {"feature": feature_names[index], "value": float(sample[index]), "contribution": float(weight)}
            for index, weight in explanation.as_map()[class_index]
        ]
        return {
            "explainer": "lime",
            "method": "local_surrogate",
            "model_type": model.model_type,
            "sample_index": int(kwargs.get("sample_index", 0)),
            "predicted_class": python_value(model.classes_[class_index]),
            "confidence": float(probabilities[class_index]),
            "feature_contributions": sorted(
                contributions, key=lambda item: abs(item["contribution"]), reverse=True
            ),
            "global_importance": [],
            "fidelity": float(explanation.score),
            "intercept": float(explanation.intercept[class_index]),
            "conditions": [
                {"condition": condition, "contribution": float(weight)}
                for condition, weight in explanation.as_list(label=class_index)
            ],
            "notice": ATTRIBUTION_NOTICE,
        }
