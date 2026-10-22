# Model serving

Registering a completed run saves a named immutable version with model/framework, dataset/pipeline/run lineage, metrics, hyperparameters, preprocessing, explanation availability and artifact reference. Registry status records the review lifecycle. Deployment selects a registered version and optional default explanation method.

`POST /api/v1/deployments/{id}/predict` accepts a `rows` array of raw feature objects. Required names and types derive from the training dataset. Extra/missing features, invalid numerical values and inactive deployments produce structured errors. Saved transforms handle supported missing values and unseen categorical values consistently with training. Optional `labels` must match the number of rows and enable measured accuracy monitoring.

```json
{
  "rows": [{
    "tenure_months": 18,
    "monthly_charges": 81.5,
    "support_calls": 2,
    "contract": "monthly",
    "internet": "fiber"
  }],
  "explain": "lime"
}
```

The response includes predictions, class probabilities/confidence, optional normalized explanation, request ID, latency, deployment ID, model name/version and producing model metadata. The UI provides a JSON console and schema/example input. Every successful or failed request produces monitoring records; inference errors also create alerts.

Serving occurs within FastAPI for this prototype; it is not an isolated external container per model. The saved bundle includes exactly the training preprocessor. PyTorch also saves explicit weights/architecture metadata for inspection. Model files are trusted application artifacts, so only authenticated backups are accepted. Use authentication, traffic limits and isolated model workers before exposing this service to untrusted clients.
