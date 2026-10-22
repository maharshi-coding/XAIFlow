# Explanation contract

SHAP and LIME are ordinary DAG stages. An explainer adapter checks compatibility, computes an explanation and normalizes its data. The frontend reads `explainer`, `method`, `sample_index`, `predicted_class`, `confidence`, `feature_contributions` and `global_importance`; it does not parse library internals. `explainer` identifies the SHAP/LIME library and `method` describes the calculation (for example, tree or local surrogate).

SHAP uses a compatible real library explainer for the adapter, with tree explanations for random forests where applicable and model probability explanation for other supported models. Local signed contributions accompany expected/output values and the output space. Global importance averages absolute contributions over a bounded sample and output classes; local contributions explain the selected row's predicted class. LIME perturbs transformed tabular features and fits a local surrogate against the actual model probability wrapper. Its fidelity score describes that approximation.

Feature names reflect fitted transformations, including encoded categorical columns. An attribution to an encoded/scaled feature is an attribution in model input space, not a raw causal effect. SHAP and LIME values can differ because their assumptions and output spaces differ. Seeds and explanation settings are persisted; sampled background/holdout arrays are stored with the model bundle for inference explanations.

Local inference explanations are returned with prediction metadata. Unsupported combinations or computation failures surface explicit errors; no substitute values are created. Explanation JSON is stored as a checksummed artifact with a run association. The adapter boundary can accommodate Captum in the future.

Feature attribution explains model behavior under the assumptions of the selected explanation method. It does not establish causation.
