You are a senior full-stack engineer, ML engineer, MLOps architect, database architect, DevOps engineer, QA engineer, and UI/UX engineer.

Your task is to design, implement, test, document, and finish a complete working software project called:

# XAIFlow
## Machine Learning Pipeline Orchestration Tool with Explainable AI Integration

Build this as a serious, polished, production-style academic prototype. Do not create a toy app, static mockup, disconnected demo, collection of notebooks, or partially implemented UI.

The application must work end-to-end.

The core idea is to create a web-based platform where a user can visually construct a machine-learning pipeline, configure each stage, execute the pipeline, inspect its progress, compare experiments, understand model predictions using Explainable AI, register trained models, deploy a model through a REST API, monitor model behavior, generate alerts, and back up/restore the project.

The system must treat Explainable AI as a normal reusable pipeline stage instead of an isolated post-training analysis.

---

# 1. PRIMARY GOAL

Create one unified application that integrates:

- visual ML pipeline creation
- pipeline validation
- pipeline execution
- dataset management
- preprocessing
- feature engineering
- model training
- model evaluation
- Explainable AI
- experiment tracking
- run comparison
- model versioning
- model registry
- deployment
- inference
- monitoring
- drift/degradation detection
- threshold-based alerts
- logging
- artifact management
- backup
- restore
- testing
- reproducibility

The final system must allow a user to:

1. Create a project.
2. Upload a tabular dataset.
3. Inspect the dataset.
4. Build an ML workflow visually using drag-and-drop nodes.
5. Connect nodes as a Directed Acyclic Graph.
6. Configure individual nodes.
7. Validate the pipeline.
8. Save the pipeline.
9. Reload and edit it.
10. Execute the pipeline.
11. Watch node-level execution progress.
12. Train ML models.
13. Evaluate models.
14. Generate SHAP and LIME explanations.
15. Store experiment metadata.
16. Compare multiple runs.
17. Register a trained model.
18. Maintain model versions.
19. Deploy at least one model.
20. Send inference requests to the deployed model.
21. Receive prediction metadata and an explanation.
22. Monitor model behavior.
23. Detect simulated data drift or model degradation.
24. Generate alerts.
25. Inspect execution logs.
26. Create project backups.
27. Restore the application state successfully.

Do not consider the project complete until all of the required end-to-end scenarios work.

---

# 2. REQUIRED TECHNOLOGY STACK

Use the following primary stack unless there is a strong technical reason not to.

## Frontend

- React
- TypeScript
- Vite
- React Flow for the visual pipeline editor
- Tailwind CSS
- TanStack Query or equivalent for server-state handling
- Zustand or another lightweight state-management library when useful
- Recharts or Plotly for charts
- Lucide icons
- accessible reusable UI components

Do not create a generic Bootstrap-looking dashboard.

The UI should feel like a modern technical product comparable in quality to developer tools, observability platforms, workflow editors, or MLOps dashboards.

## Backend

Use:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL

## Machine Learning

Use:

- Scikit-learn
- PyTorch

Initial Scikit-learn models:

- Logistic Regression
- Random Forest

Second ML framework:

- PyTorch neural network

## Explainable AI

Implement:

- SHAP
- LIME

Design the XAI layer so Captum can be added later for PyTorch models.

If practical, implement Captum as an optional extension, but SHAP and LIME are mandatory.

## Storage

Initially use:

- PostgreSQL for application metadata
- local filesystem abstraction for datasets
- trained models
- plots
- XAI artifacts
- generated reports
- backups

Design artifact storage behind an interface so MinIO or S3 could replace local storage later.

## DevOps

Use:

- Docker
- Docker Compose
- environment variables
- `.env.example`
- health checks
- reproducible local development

## Testing

Use:

- Pytest
- FastAPI test client
- frontend tests with Vitest / React Testing Library
- integration tests
- end-to-end tests where practical

---

# 3. HIGH-LEVEL ARCHITECTURE

Create the application using these logical layers:

### Presentation Layer

Responsible for:

- dashboard
- pipeline editor
- configuration panels
- experiment views
- model registry
- model deployment UI
- monitoring dashboards
- alert center
- backup/restore UI

### API/Application Layer

Responsible for:

- API endpoints
- validation
- authentication-ready architecture
- projects
- datasets
- pipelines
- experiment management
- model management
- backups

### ML Execution Layer

Responsible for:

- DAG execution
- preprocessing
- model training
- model evaluation
- explanation generation
- inference

### Persistence Layer

Responsible for:

- pipeline definitions
- datasets metadata
- pipeline runs
- node runs
- experiment metadata
- metrics
- model metadata
- artifacts
- logs
- alerts
- backups

### Model Management and Monitoring Layer

Responsible for:

- model versions
- model registry
- deployments
- inference statistics
- monitoring metrics
- drift
- degradation
- alert rules

Keep these concerns separated.

Do not put all backend functionality into one file.

---

# 4. REPOSITORY STRUCTURE

Organize the repository approximately as follows:

```text
xaiflow/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── projects/
│   │   │   ├── datasets/
│   │   │   ├── pipelines/
│   │   │   ├── experiments/
│   │   │   ├── models/
│   │   │   ├── deployments/
│   │   │   ├── xai/
│   │   │   ├── monitoring/
│   │   │   ├── alerts/
│   │   │   └── backups/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── schemas/
│   │   ├── models/
│   │   ├── services/
│   │   ├── pipeline/
│   │   │   ├── engine.py
│   │   │   ├── validator.py
│   │   │   ├── executor.py
│   │   │   ├── graph.py
│   │   │   └── registry.py
│   │   ├── nodes/
│   │   │   ├── dataset/
│   │   │   ├── preprocessing/
│   │   │   ├── feature_engineering/
│   │   │   ├── training/
│   │   │   ├── evaluation/
│   │   │   ├── xai/
│   │   │   └── deployment/
│   │   ├── ml/
│   │   │   ├── sklearn/
│   │   │   └── pytorch/
│   │   ├── xai/
│   │   │   ├── base.py
│   │   │   ├── shap_adapter.py
│   │   │   ├── lime_adapter.py
│   │   │   └── compatibility.py
│   │   ├── monitoring/
│   │   ├── deployment/
│   │   ├── artifacts/
│   │   ├── backups/
│   │   └── main.py
│   │
│   ├── tests/
│   └── requirements.txt
│
├── data/
├── artifacts/
│   ├── datasets/
│   ├── models/
│   ├── explanations/
│   ├── logs/
│   └── backups/
│
├── docs/
├── scripts/
├── docker/
├── docker-compose.yml
├── .env.example
├── README.md
└── LICENSE
```

Adjust the exact structure when technically appropriate, but preserve modularity.

---

# 5. UI/UX REQUIREMENTS

The UI is important.

Do not make the application look like a basic student dashboard.

Create a polished, technical, visually coherent interface.

Use:

- clear information hierarchy
- restrained professional design
- strong spacing
- good typography
- responsive layouts
- subtle transitions
- meaningful empty states
- loading states
- skeletons
- success/error states
- tooltips
- command-style controls where useful
- interactive charts
- clean tables
- side panels
- badges for statuses
- clear navigation

Avoid:

- random gradients everywhere
- excessive glassmorphism
- giant cards
- unnecessary animation
- low-information dashboards
- placeholder statistics
- duplicated information
- visually cluttered layouts

Use a persistent application shell.

Suggested navigation:

```text
Overview
Projects
Datasets
Pipelines
Experiments
Models
Deployments
Monitoring
Alerts
Backups
Settings
```

Within a project, use project-specific navigation.

---

# 6. DASHBOARD

Create an overview dashboard showing meaningful real information.

Possible summary cards:

- Projects
- Datasets
- Pipeline Runs
- Successful Runs
- Failed Runs
- Registered Models
- Active Deployments
- Alerts

Show:

- recent runs
- run success/failure trends
- model performance summaries
- recent alerts
- deployment health
- recent activity

Do not show fabricated data once the backend is active.

Use real backend-derived information.

---

# 7. PROJECT MANAGEMENT

Support multiple projects.

A project should contain:

- project name
- description
- timestamps
- datasets
- pipelines
- runs
- registered models
- deployments
- alerts
- backup history

Implement:

- create project
- edit project
- open project
- archive/delete project when appropriate
- project overview

Use stable UUIDs.

---

# 8. DATASET MANAGEMENT

Initially focus on moderate-sized tabular CSV datasets.

Support:

- CSV upload
- metadata storage
- file validation
- dataset preview
- column names
- inferred data types
- row count
- column count
- missing values
- unique values
- descriptive statistics
- class distribution
- target-column selection
- basic feature visualization

Keep original uploaded data immutable.

Preprocessing should create derived data representations during pipeline execution rather than modifying the source file.

Handle errors such as:

- invalid CSV
- empty file
- unsupported encoding
- duplicate column names
- target not selected
- target column missing

---

# 9. VISUAL PIPELINE EDITOR

This is one of the most important parts of the application.

Use React Flow.

Create a drag-and-drop visual workflow canvas.

Users must be able to:

- add nodes
- remove nodes
- connect nodes
- disconnect nodes
- move nodes
- select nodes
- configure nodes
- duplicate nodes where reasonable
- zoom
- pan
- fit view
- save pipeline
- load pipeline
- rename pipeline
- validate pipeline
- execute pipeline
- inspect node status

Provide a node library/sidebar.

Initial categories:

## Data

- Dataset Input

## Preprocessing

- Train/Test Split
- Missing Value Handler
- Categorical Encoder
- Feature Scaling
- Feature Selection

## Models

- Logistic Regression
- Random Forest
- PyTorch Neural Network

## Evaluation

- Classification Evaluation

## Explainability

- SHAP
- LIME

## Model Operations

- Register Model
- Deploy Model

Nodes should visually show:

- icon
- node type
- custom label
- connection handles
- configuration status
- execution status

Execution states:

- idle
- queued
- running
- completed
- failed
- skipped

Show these states visually without making the canvas noisy.

---

# 10. DAG DATA MODEL

Every pipeline must be represented as a Directed Acyclic Graph.

Each node should contain at minimum:

```json
{
  "id": "uuid",
  "type": "random_forest",
  "label": "Random Forest",
  "parameters": {},
  "position": {
    "x": 0,
    "y": 0
  }
}
```

Edges should identify:

```json
{
  "id": "uuid",
  "source": "node-id",
  "target": "node-id"
}
```

Do not store only frontend React Flow state.

Create a backend-neutral pipeline representation.

---

# 11. PIPELINE VALIDATION

Create a real DAG validator.

Before execution check:

- pipeline is not empty
- no cyclic dependency exists
- nodes have valid configurations
- required input connections exist
- incompatible connections are rejected
- dataset node exists
- training node has valid upstream data
- evaluation follows training
- XAI follows a compatible model
- deployment follows a trained or registered model
- target column exists
- preprocessing requirements are valid

Perform:

- cycle detection
- topological ordering
- dependency validation
- compatibility validation
- parameter validation

Return structured validation errors.

Example:

```json
{
  "valid": false,
  "errors": [
    {
      "node_id": "...",
      "code": "MISSING_INPUT",
      "message": "Random Forest requires processed training data."
    }
  ]
}
```

The frontend must highlight invalid nodes.

---

# 12. PIPELINE EXECUTION ENGINE

Do not simply send a request that manually performs every step.

Build a reusable execution engine.

Responsibilities:

1. Load pipeline definition.
2. Validate DAG.
3. Compute topological execution order.
4. Create run record.
5. Execute nodes in dependency order.
6. Pass artifacts/results between nodes.
7. Track node status.
8. Record start/end timestamps.
9. Record logs.
10. Record exceptions.
11. Save artifacts.
12. Save metrics.
13. Mark run success/failure.

Create a common node abstraction.

Conceptually:

```python
class PipelineNode:
    def validate(self):
        ...

    def execute(self, context):
        ...

    def serialize_output(self):
        ...
```

Different node types should implement the same execution contract.

Create an execution context containing:

- project
- pipeline
- run
- artifacts
- temporary datasets
- train/test sets
- fitted preprocessors
- trained models
- metrics
- XAI results

Keep execution deterministic where possible.

Use random seeds.

---

# 13. PREPROCESSING NODES

Implement at least:

## Train/Test Split

Configuration:

- test size
- random state
- stratify

## Missing Value Handler

Strategies:

- mean
- median
- most frequent
- drop

Handle numeric and categorical columns appropriately.

## Categorical Encoder

Initially support:

- OneHotEncoder
- OrdinalEncoder

## Scaling

Support:

- StandardScaler
- MinMaxScaler

## Feature Selection

Support at least:

- SelectKBest

Allow configuration of `k`.

Do not leak target information into preprocessing.

Fit transforms using training data.

Apply fitted transforms to test/inference data.

Persist transformation configuration alongside trained models so deployed inference uses exactly the same preprocessing.

This is mandatory.

---

# 14. ML MODEL SUPPORT

Implement at least three model algorithms/workflows.

## Model 1

Scikit-learn Logistic Regression.

Configurable parameters should include sensible options such as:

- C
- max_iter
- solver when compatible
- random_state

## Model 2

Scikit-learn Random Forest.

Configuration should include:

- n_estimators
- max_depth
- min_samples_split
- min_samples_leaf
- class_weight
- random_state

## Model 3

PyTorch neural network.

Create a small configurable feed-forward neural network suitable for tabular classification.

Possible settings:

- hidden layers
- hidden dimensions
- learning rate
- epochs
- batch size
- dropout
- random seed

Do not overcomplicate the architecture.

Log PyTorch training history.

Save trained model weights and architecture metadata.

---

# 15. MODEL ADAPTER ARCHITECTURE

Do not spread model-specific conditions across the application.

Create a model adapter abstraction.

Example concepts:

```python
class ModelAdapter:
    def fit(...)
    def predict(...)
    def predict_proba(...)
    def save(...)
    def load(...)
    def metadata(...)
```

Implement:

- SklearnModelAdapter
- PyTorchModelAdapter

The rest of the system should consume the common interface.

---

# 16. MODEL EVALUATION

For classification implement:

- accuracy
- precision
- recall
- F1 score
- confusion matrix
- ROC-AUC when supported

Show metrics in the UI.

Create:

- metric cards
- confusion matrix visualization
- ROC curve when available
- class distribution
- prediction breakdown

Persist every metric.

Metrics must be associated with:

- run
- pipeline
- model
- model version when applicable

---

# 17. EXPERIMENT TRACKING

Every pipeline execution must create a persistent run.

Store at minimum:

- execution/run ID
- project ID
- pipeline ID
- dataset reference
- pipeline definition/version
- model type
- hyperparameters
- preprocessing parameters
- timestamps
- duration
- status
- metrics
- artifacts
- XAI artifacts
- errors
- logs
- environment information where practical

Build an Experiments page.

Show:

- run list
- filters
- run status
- model
- dataset
- primary metric
- duration
- timestamp

Create a run detail screen.

---

# 18. RUN COMPARISON

Allow selection of at least two runs of the same model/pipeline.

Comparison should show:

- model parameters
- preprocessing settings
- metrics
- training time
- run duration
- dataset reference
- XAI availability
- artifact differences

Highlight metric improvements and regressions.

Do not automatically declare one run universally "best" unless a primary metric has been selected.

---

# 19. EXPLAINABLE AI ARCHITECTURE

Treat Explainable AI as a first-class pipeline operation.

Create an adapter architecture.

Conceptually:

```python
class ExplainerAdapter:
    def supports(self, model, data):
        ...

    def explain_local(self, ...):
        ...

    def explain_global(self, ...):
        ...

    def normalize(self, ...):
        ...
```

Implement:

- SHAP adapter
- LIME adapter

Prepare for:

- Captum adapter

Do not tightly couple the frontend to SHAP's internal output formats.

Normalize explanation data.

---

# 20. SHAP

Implement SHAP where compatible.

Support:

- local explanations
- aggregate/global feature importance

Potential visualizations:

- feature contribution bars
- waterfall-style explanation if practical
- global importance
- summary visualizations

Persist explanation artifacts.

Associate explanations with:

- project
- pipeline run
- model
- dataset sample
- explainer type

If SHAP does not support a specific model configuration directly, use a compatible explainer or clearly report unsupported compatibility.

Never silently fake explanations.

---

# 21. LIME

Implement LIME for local prediction explanation.

User should be able to select or inspect a sample and see:

- predicted class
- prediction probability when available
- strongest positive features
- strongest negative features
- contribution magnitude

Persist the explanation.

Normalize the result for the frontend.

---

# 22. XAI COMPATIBILITY

Create explicit compatibility checks.

Examples:

```text
Random Forest + SHAP -> supported
Logistic Regression + SHAP -> supported
Scikit-learn + LIME -> supported
PyTorch + LIME -> supported where prediction wrapper exists
PyTorch + SHAP -> supported only where implementation is reliable
```

Do not expose incompatible configurations as if they work.

The pipeline validator should detect unsupported XAI/model combinations where possible.

---

# 23. XAI UI

Create an Explainability page that presents model reasoning clearly.

Include:

- model prediction
- confidence/probability
- explainer used
- local explanation
- global feature importance
- selected sample
- feature contributions

Add a clear notice:

"Feature attribution explains model behavior under the assumptions of the selected explanation method. It does not establish causation."

This is important.

---

# 24. MODEL REGISTRY

Create a model registry.

A registered model should include:

- model ID
- name
- algorithm
- framework
- version
- producing run
- pipeline
- dataset
- metrics
- hyperparameters
- artifact path
- preprocessing artifact
- explanation availability
- status
- created timestamp

Statuses may include:

- candidate
- staging
- production
- archived

Version models incrementally.

Never overwrite old model versions.

---

# 25. MODEL DEPLOYMENT

Allow deployment of at least one registered model.

The system must expose an inference REST endpoint.

Suggested API:

```text
POST /api/v1/deployments/{deployment_id}/predict
```

The deployed inference pipeline must:

1. validate input
2. apply the exact saved preprocessing pipeline
3. invoke the model
4. return prediction
5. return probability/confidence when available
6. return model metadata
7. return an explanation when configured/supported
8. log the prediction request metadata safely

Example response:

```json
{
  "prediction": 1,
  "probability": 0.87,
  "model": {
    "name": "customer-churn-random-forest",
    "version": 3
  },
  "run_id": "...",
  "explanation": {
    "method": "shap",
    "features": [
      {
        "feature": "monthly_charges",
        "value": 85,
        "contribution": 0.22
      }
    ]
  }
}
```

Do not hardcode model input schemas.

Derive them from dataset/model metadata when possible.

---

# 26. DEPLOYMENTS UI

Show:

- deployment name
- associated model/version
- state
- endpoint
- created date
- request count
- recent latency
- recent errors
- prediction activity

Create a test-console UI where users can send sample JSON to a deployment and inspect the response.

---

# 27. MONITORING

Implement a realistic academic prototype for monitoring.

Track:

- number of predictions
- request latency
- failed requests
- prediction distribution
- selected feature statistics
- model performance when labels are available

Create a baseline from training or validation data.

Compare monitored data against the baseline.

Because real long-running production traffic may not be available, support controlled or simulated monitored-data changes.

---

# 28. DRIFT / DEGRADATION DETECTION

Implement at least one understandable data-change detection method.

Possible choices:

- Population Stability Index
- distribution comparison
- mean/std threshold comparison
- KS test for suitable numeric features

Keep it explainable and documented.

Allow controlled test data to demonstrate drift.

Example:

Training:

```text
monthly_charges mean = 64
```

Monitored:

```text
monthly_charges mean = 83
```

Generate a drift indicator when configured thresholds are exceeded.

---

# 29. ALERT SYSTEM

Create persistent alerts.

Alert types:

- pipeline failure
- repeated execution error
- performance degradation
- detected data drift
- deployment failure

Fields:

- alert ID
- project
- type
- severity
- title
- description
- source
- metric
- threshold
- observed value
- timestamp
- status

Statuses:

- open
- acknowledged
- resolved

Severity:

- info
- warning
- critical

Create an Alerts UI.

---

# 30. LOGGING

Implement structured logging.

Log:

- pipeline execution
- individual node execution
- model training
- XAI generation
- deployment actions
- prediction errors
- monitoring
- backups
- restores

Run detail UI should show useful execution logs.

Do not expose secrets.

---

# 31. ARTIFACT MANAGEMENT

Create a consistent artifact abstraction.

Artifact types may include:

- dataset
- processed dataset
- model
- preprocessor
- evaluation plot
- metrics output
- SHAP output
- LIME output
- PyTorch weights
- logs
- backups

Store:

- artifact ID
- type
- URI/path
- size
- checksum where practical
- run
- creation timestamp

Never rely only on raw paths stored throughout random tables.

---

# 32. DATABASE DESIGN

Create a proper relational schema.

At minimum consider entities such as:

- users or future-user placeholder
- projects
- datasets
- pipelines
- pipeline_versions
- pipeline_nodes
- pipeline_edges
- pipeline_runs
- node_runs
- metrics
- artifacts
- models
- model_versions
- explanations
- deployments
- prediction_logs
- monitoring_metrics
- alerts
- backups

Use:

- foreign keys
- indexes
- UUIDs
- sensible cascading behavior
- created_at
- updated_at

Use Alembic migrations.

Do not rely on `create_all()` as the final schema-management strategy.

---

# 33. BACKUP AND RESTORE

Implement project-level backup and restore.

A backup package must preserve:

- project metadata
- pipeline definitions
- pipeline configuration
- relevant run history
- metrics
- model references
- artifact references
- registered models where feasible
- configuration needed for recovery

Create:

```text
Create Backup
Download Backup
Restore Backup
```

Validate backup packages.

Prevent cross-project/cross-tenant contamination.

Perform at least one automated or documented full restore test.

The restore test should demonstrate that:

- the project is recreated
- pipelines reappear
- run metadata is restored
- model references remain valid or are restored
- no unrelated project data is included

---

# 34. API DESIGN

Build versioned APIs.

For example:

```text
/api/v1/projects
/api/v1/datasets
/api/v1/pipelines
/api/v1/runs
/api/v1/models
/api/v1/deployments
/api/v1/monitoring
/api/v1/alerts
/api/v1/backups
```

Use:

- Pydantic request models
- Pydantic response models
- consistent error responses
- proper HTTP status codes
- pagination where useful

Generate clean OpenAPI documentation.

---

# 35. LONG-RUNNING PIPELINE EXECUTION

Do not make the browser freeze while training occurs.

Design pipeline execution so the API can create a run and the frontend can monitor its status.

For this academic implementation, use a practical approach such as:

- background worker/service
- FastAPI background execution abstraction
- lightweight task queue architecture

If Redis/Celery would add unnecessary setup for the initial prototype, create a clean executor abstraction that can later be replaced with a distributed task system.

Frontend should poll or subscribe to run status.

WebSocket or server-sent events may be used if implemented reliably.

---

# 36. ERROR HANDLING

Handle failures professionally.

Examples:

- dataset unavailable
- invalid target
- preprocessing failure
- incompatible data
- model training failure
- explainability failure
- deployment failure
- missing artifacts
- database errors
- corrupted backup

Never display a blank screen.

Show meaningful UI errors.

Backend exceptions should become structured API errors.

Preserve execution failure details for debugging.

---

# 37. SECURITY BOUNDARIES

This is an academic prototype, not an enterprise product.

Still implement basic good practices:

- no hardcoded credentials
- environment variables
- safe file upload handling
- filename sanitization
- request validation
- path traversal protection
- SQLAlchemy parameterization
- CORS configuration
- reasonable file-size limits
- safe artifact access
- no arbitrary code execution from node parameters

Clearly document that enterprise authentication, infrastructure isolation, advanced secrets management, and production-grade multi-tenancy are outside the initial scope.

Do not falsely claim enterprise-grade security.

---

# 38. TESTING REQUIREMENTS

Testing is mandatory.

## Unit tests

Test:

- DAG validation
- cycle detection
- topological sorting
- preprocessing
- model adapters
- metric generation
- XAI compatibility
- model registry
- drift calculations
- backup validation

## API tests

Test:

- projects
- datasets
- pipelines
- runs
- models
- deployments
- alerts
- backup/restore

## Integration tests

Test complete flows such as:

```text
dataset
→ preprocessing
→ model
→ evaluation
→ XAI
```

## End-to-end workflows

The final project must successfully execute at least these three representative workflows.

---

# 39. REQUIRED WORKFLOW 1

## Logistic Regression

Create a working pipeline:

```text
Dataset Input
→ Missing Value Handling
→ Encoding
→ Scaling
→ Train/Test Split
→ Logistic Regression
→ Evaluation
→ SHAP or LIME
→ Register Model
→ Deployment
```

Verify:

- execution success
- metrics
- explanations
- stored run metadata
- model registration
- deployment
- inference

---

# 40. REQUIRED WORKFLOW 2

## Random Forest

Create:

```text
Dataset Input
→ Preprocessing
→ Train/Test Split
→ Random Forest
→ Evaluation
→ SHAP
→ Register Model
```

Verify:

- successful execution
- persisted metrics
- global explanation
- local explanation
- model artifact
- run history

---

# 41. REQUIRED WORKFLOW 3

## PyTorch Neural Network

Create:

```text
Dataset Input
→ Preprocessing
→ Train/Test Split
→ PyTorch Neural Network
→ Evaluation
→ LIME or compatible XAI
→ Register Model
```

Verify:

- training
- model persistence
- metric persistence
- explanation where supported
- repeatable execution

---

# 42. REQUIRED RUN COMPARISON TEST

Run the same model at least twice with different hyperparameters.

For example:

```text
Random Forest Run A
n_estimators = 100
max_depth = 8

Random Forest Run B
n_estimators = 200
max_depth = 12
```

Compare both through the UI.

Store both runs separately.

Never overwrite an old experiment.

---

# 43. REQUIRED MONITORING TEST

Create controlled data changes.

Demonstrate:

- baseline
- modified monitored distribution
- calculated change/drift
- threshold breach
- generated alert

Persist the alert.

Show it in the UI.

---

# 44. REQUIRED BACKUP/RESTORE TEST

Create a project containing:

- dataset metadata
- pipeline
- completed run
- model
- metrics

Back it up.

Restore it.

Verify that the restored project has the expected metadata and no unrelated project data.

Document the test.

---

# 45. SEED / DEMONSTRATION DATASETS

Include one or more small public/synthetic tabular datasets so the project can be demonstrated immediately.

Good types of use cases:

- churn classification
- loan-risk classification
- disease classification
- customer behavior

Do not depend exclusively on internet access during the final demo.

Include at least one small demo dataset in the repository or generate one deterministically.

---

# 46. REPRODUCIBILITY

Set random seeds for:

- Python
- NumPy
- Scikit-learn where applicable
- PyTorch

Capture:

- algorithm
- hyperparameters
- dataset
- preprocessing settings
- random seed

A user should be able to rerun an experiment using the stored configuration.

Add a:

```text
Re-run Experiment
```

action if practical.

---

# 47. PERFORMANCE

The target is moderate-sized tabular data.

Do not optimize for enterprise-scale distributed workloads.

However:

- avoid loading unnecessarily huge datasets repeatedly
- avoid recomputing explanations unnecessarily
- show progress
- prevent blocking UI
- cache/read artifacts sensibly

---

# 48. UI DETAILS FOR PIPELINE EXECUTION

When running a pipeline, nodes should visually transition through:

```text
Queued
Running
Completed
Failed
```

Provide a side panel containing:

```text
Run ID
Current node
Elapsed time
Completed nodes
Failed nodes
Logs
Metrics
```

When a node fails:

- color the node appropriately
- show the actual error
- preserve logs
- stop dependent nodes
- mark skipped nodes

Do not silently fail.

---

# 49. MODEL DETAIL PAGE

Each registered model page should show:

- name
- version
- algorithm
- framework
- status
- produced by run
- dataset
- pipeline
- metrics
- hyperparameters
- artifact
- XAI availability
- deployment history
- creation date

Provide actions:

```text
Deploy
Compare
View Run
Archive
```

---

# 50. EXPERIMENT DETAIL PAGE

Show:

- run status
- execution graph
- parameters
- dataset
- model
- metrics
- node execution timing
- logs
- artifacts
- XAI outputs
- model link

Make experiment lineage easy to understand.

---

# 51. MONITORING DASHBOARD

Create a useful monitoring page with:

- current model
- active version
- request volume
- latency
- errors
- prediction distribution
- model performance
- baseline comparison
- feature drift
- active alerts

Use charts where appropriate.

Do not fabricate statistics.

---

# 52. DESIGN SYSTEM

Create a consistent visual system.

Use:

- spacing tokens
- typography scale
- border/radius standards
- reusable cards
- buttons
- inputs
- dialogs
- status badges
- charts
- tables

Design for both light and dark mode if it can be implemented cleanly.

Dark mode is optional.

Do not sacrifice implementation quality solely to add dark mode.

---

# 53. ACCESSIBILITY

Follow reasonable accessibility practices.

Use:

- semantic HTML
- proper labels
- keyboard support
- sufficient contrast
- focus states
- accessible dialogs
- accessible forms

React Flow controls should remain usable.

---

# 54. DOCUMENTATION

Create a professional README.

Include:

- project overview
- architecture
- features
- screenshots placeholders or final screenshots if generated
- technology stack
- installation instructions
- environment variables
- Docker setup
- local setup
- database migrations
- running backend
- running frontend
- demo workflow
- testing
- REST API
- backup/restore
- limitations

Create additional documentation under `/docs`.

Suggested:

```text
docs/
├── architecture.md
├── pipeline-engine.md
├── xai.md
├── database.md
├── deployment.md
├── monitoring.md
├── testing.md
└── demo.md
```

---

# 55. ARCHITECTURE DOCUMENTATION

Document:

- frontend architecture
- backend layers
- DAG representation
- execution context
- artifact flow
- database design
- ML adapter architecture
- XAI adapter architecture
- deployment lifecycle
- monitoring lifecycle

Include Mermaid diagrams where useful.

---

# 56. CODE QUALITY

Follow professional software-engineering practices.

Requirements:

- descriptive names
- type hints
- small modules
- separation of concerns
- reusable components
- no duplicated business logic
- no giant 2,000-line components
- no giant service files
- no unnecessary abstraction
- no abandoned experimental code
- no commented-out dead code
- no placeholder TODOs in required features
- no hidden failures

Use formatting and linting.

Python:

- Ruff or equivalent
- Black if appropriate

Frontend:

- ESLint
- Prettier

---

# 57. NO FAKE IMPLEMENTATIONS

This rule is critical.

Do not implement buttons that do nothing.

Do not display fabricated model metrics.

Do not show fake alerts.

Do not hardcode successful run histories.

Do not return placeholder predictions.

Do not use dummy SHAP values.

Do not create fake monitoring values once real functionality exists.

Every important control must either work or clearly state that it is unsupported.

---

# 58. NO OVERENGINEERING

Do not attempt to recreate every feature of Kubeflow, MLflow, SageMaker, or Databricks.

This is a focused course-scale prototype.

Prioritize:

1. correctness
2. end-to-end functionality
3. reproducibility
4. clean architecture
5. useful UI
6. testability
7. explainability

Avoid unnecessary:

- Kubernetes
- Kafka
- distributed training
- complex service mesh
- enterprise authentication infrastructure
- multi-cloud deployment

unless later explicitly requested.

---

# 59. IMPLEMENTATION ORDER

Build the system in this order.

## Phase 1 — Foundation

Set up:

- repository
- frontend
- backend
- PostgreSQL
- Docker
- configuration
- migrations
- base UI
- health endpoints

## Phase 2 — Projects and datasets

Implement:

- projects
- dataset upload
- metadata
- preview
- target selection

## Phase 3 — Pipeline editor

Implement:

- React Flow
- node palette
- node configuration
- connection management
- pipeline persistence
- save/load

## Phase 4 — DAG engine

Implement:

- DAG schema
- validation
- cycle detection
- dependency checking
- topological ordering
- executor
- run records

## Phase 5 — Scikit-learn

Implement:

- preprocessing
- Logistic Regression
- Random Forest
- evaluation
- artifact persistence

## Phase 6 — Experiment tracking

Implement:

- runs
- node runs
- metrics
- logs
- artifacts
- comparison

## Phase 7 — Explainable AI

Implement:

- explainer adapter
- SHAP
- LIME
- local explanations
- global explanations
- frontend visualization

## Phase 8 — PyTorch

Implement:

- PyTorch adapter
- neural network training
- model persistence
- evaluation
- compatible XAI

## Phase 9 — Model registry

Implement:

- models
- versions
- lineage
- statuses

## Phase 10 — Deployment

Implement:

- deployments
- inference endpoint
- saved preprocessing
- prediction responses
- supported explanations

## Phase 11 — Monitoring

Implement:

- prediction logging
- latency
- feature statistics
- baseline comparison
- drift/degradation
- alert system

## Phase 12 — Backup/restore

Implement:

- backup generation
- validation
- restore
- recovery tests

## Phase 13 — Final testing

Execute all three required workflows.

Fix all important defects.

Finish documentation.

---

# 60. DEVELOPMENT BEHAVIOR

Work autonomously.

Do not constantly ask me what to do next.

When a small design choice is unspecified, choose the option that best supports:

- maintainability
- correctness
- user experience
- academic demonstrability

Do not stop after scaffolding.

Continue through implementation.

Do not only describe how features should work.

Actually implement them.

After each major phase:

1. run relevant tests
2. inspect failures
3. fix failures
4. verify integration
5. continue

Never knowingly leave the repository in a broken state.

---

# 61. EXISTING REPOSITORY BEHAVIOR

If this prompt is executed inside an existing repository:

1. inspect the current repository completely
2. understand existing architecture
3. reuse working code
4. do not unnecessarily rewrite everything
5. identify missing requirements
6. implement them incrementally
7. preserve working functionality

Before major modifications inspect:

- package files
- Python dependencies
- Docker files
- environment configuration
- migrations
- frontend routing
- database models
- API structure
- tests

---

# 62. DATABASE MIGRATION RULE

Use migrations.

Whenever database models change:

1. create migration
2. inspect migration
3. apply migration
4. run tests

Do not manually rely on a mismatched database schema.

---

# 63. BACKEND QUALITY RULE

Use dependency injection where useful.

Keep routers thin.

Business logic belongs in services.

Machine-learning execution belongs in dedicated ML/pipeline modules.

Database persistence should not be mixed into UI-independent ML algorithms unnecessarily.

---

# 64. FRONTEND QUALITY RULE

Do not place all state in one component.

Separate:

- API hooks
- editor state
- form state
- server state
- global UI state

Use reusable components.

Avoid excessive `any` in TypeScript.

Create strong types for:

- projects
- pipelines
- nodes
- edges
- runs
- metrics
- models
- deployments
- alerts

---

# 65. DEMO EXPERIENCE

The final demo should be smooth.

A user should be able to start the application and demonstrate:

```text
Create Project
↓
Upload Dataset
↓
Select Target
↓
Build Pipeline
↓
Configure Nodes
↓
Validate
↓
Run
↓
Watch Execution
↓
View Metrics
↓
View SHAP/LIME
↓
Compare Experiments
↓
Register Model
↓
Deploy Model
↓
Send Test Prediction
↓
View Explanation
↓
Open Monitoring
↓
Trigger Demonstration Drift
↓
See Alert
↓
Create Backup
↓
Restore Project
```

Aim for this complete story.

---

# 66. FINAL ACCEPTANCE CHECKLIST

Do not declare the project complete until all applicable items below are verified.

## Project

- [ ] Project CRUD works.
- [ ] Project overview works.

## Dataset

- [ ] CSV upload works.
- [ ] Dataset preview works.
- [ ] Statistics work.
- [ ] Target selection works.

## Pipeline editor

- [ ] Drag/drop works.
- [ ] Connections work.
- [ ] Node settings work.
- [ ] Save works.
- [ ] Load works.
- [ ] Modify works.
- [ ] Delete works.
- [ ] Validation works.

## Execution

- [ ] DAG topological ordering works.
- [ ] Cycles are rejected.
- [ ] Node execution works.
- [ ] Node status is persisted.
- [ ] Errors are persisted.
- [ ] Logs are accessible.

## ML

- [ ] Logistic Regression works.
- [ ] Random Forest works.
- [ ] PyTorch model works.
- [ ] Preprocessing is persisted.
- [ ] Inference reuses training preprocessing.

## Evaluation

- [ ] Accuracy works.
- [ ] Precision works.
- [ ] Recall works.
- [ ] F1 works.
- [ ] Confusion matrix works.
- [ ] ROC-AUC works when applicable.

## XAI

- [ ] SHAP works for supported models.
- [ ] LIME works.
- [ ] Local explanation works.
- [ ] Global explanation works where supported.
- [ ] Explanation artifacts are persisted.
- [ ] Unsupported combinations are clearly handled.

## Experiment tracking

- [ ] Every run has a unique ID.
- [ ] Hyperparameters are stored.
- [ ] Dataset reference is stored.
- [ ] Metrics are stored.
- [ ] Timestamps are stored.
- [ ] Status is stored.
- [ ] Artifacts are stored.
- [ ] Two runs can be compared.

## Model registry

- [ ] Model registration works.
- [ ] Model versions work.
- [ ] Model lineage works.
- [ ] Model status works.

## Deployment

- [ ] Model deployment works.
- [ ] Prediction endpoint works.
- [ ] Input validation works.
- [ ] Preprocessing is applied.
- [ ] Metadata is returned.
- [ ] Explanation is returned when supported.

## Monitoring

- [ ] Predictions are monitored.
- [ ] Latency can be inspected.
- [ ] Baseline statistics exist.
- [ ] Controlled drift can be demonstrated.
- [ ] Threshold detection works.

## Alerts

- [ ] Pipeline failure alert works.
- [ ] Drift/degradation alert works.
- [ ] Alerts persist.
- [ ] Alert UI works.

## Backup

- [ ] Backup creation works.
- [ ] Backup validation works.
- [ ] Restore works.
- [ ] Full recovery test passes.

## Testing

- [ ] Unit tests pass.
- [ ] Backend API tests pass.
- [ ] Integration tests pass.
- [ ] Frontend tests pass.
- [ ] Three representative workflows pass.

## Documentation

- [ ] README is complete.
- [ ] Setup steps are verified.
- [ ] Architecture is documented.
- [ ] API is documented.
- [ ] Demo workflow is documented.
- [ ] Known limitations are documented.

---

# 67. DEFINITION OF DONE

The project is finished only when a fresh developer can:

```text
git clone
→ configure environment
→ docker compose up
→ access frontend
→ upload/use a dataset
→ create pipeline
→ run model
→ inspect metrics
→ inspect explanations
→ compare runs
→ register model
→ deploy model
→ call prediction API
→ monitor deployment
→ see an alert
→ create backup
→ restore project
```

without needing to manually modify source code.

---

# 68. FINAL DELIVERY

When implementation is complete:

1. Run the entire test suite.
2. Run all three required ML workflows.
3. Verify the frontend.
4. Verify database persistence.
5. Verify model artifacts.
6. Verify SHAP.
7. Verify LIME.
8. Verify experiment comparison.
9. Verify model deployment.
10. Verify inference.
11. Verify monitoring.
12. Verify alerts.
13. Verify backup.
14. Verify restore.
15. Fix all meaningful failures.
16. Remove unused code.
17. Remove obvious placeholders.
18. Finish README.
19. Finish architecture documentation.
20. Provide a concise final implementation report.

The final report should contain:

- what was implemented
- architecture
- important files
- APIs
- supported pipeline nodes
- ML models
- XAI methods
- tests executed
- test results
- demo instructions
- known limitations
- future extensions

Do not mark anything as complete unless it actually works.

The objective is to deliver a polished, functional, reproducible Machine Learning Pipeline Orchestration Tool with Explainable AI Integration that genuinely demonstrates visual orchestration, experiment tracking, multiple ML frameworks, Explainable AI, deployment, monitoring, logging, alerts, model lifecycle management, and backup/restore within one coherent web application.