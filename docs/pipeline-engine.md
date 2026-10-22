# Pipeline engine

A definition contains nodes `{id,type,label,parameters,position}` and edges `{id,source,target}`. Positions are display metadata; execution depends solely on edges. The catalog supplies node labels, categories, defaults and input/output kinds to the editor and validator.

Validation checks nonempty/unique nodes, dangling/duplicate connections, cycles, required parents, kind compatibility, dataset and target validity, split lineage, model parameters and XAI compatibility. A deterministic Kahn topological order governs execution. Validation errors identify the affected node and an error code; the UI highlights invalid nodes.

Data contexts carry immutable source data, split configuration and preprocessing plans. Imputation, encoding, scaling and feature selection append operations; their learned values are fitted exclusively on the training partition at model execution. This supports the requested graph order without leaking holdout statistics. Training bundles persist transforms, feature names/schema, classes, reference/background data, model metadata and the adapter.

Model contexts carry the fitted bundle, holdout features/labels, metrics and explanations. Evaluation and explanation nodes pass this context along, allowing registration after either operation. Registration returns persistent model metadata; deployment consumes a registered version. Node status callbacks record queued/running/completed/failed/skipped states, timing, details and actual exceptions. A failure stops execution and marks remaining dependent work skipped; no successful state is fabricated.

Supported types: `dataset`, `split`, `impute`, `encode`, `scale`, `select`, `logistic_regression`, `random_forest`, `pytorch`, `evaluate`, `shap`, `lime`, `register`, `deploy`. Fan-out is supported; merging multiple parents is rejected because there is no implemented merge operator. Seeds are captured in parameters and set for Python/NumPy/model frameworks.
