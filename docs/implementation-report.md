# Implementation report

XAIFlow implements visual tabular classification workflows, experiment lineage, real feature attributions, versioned models, REST inference, monitoring, alerts, and signed project recovery. The application runs locally with persisted PostgreSQL metadata and trained demo models. Source and setup live entirely inside `XAIFlow/`.

## Architecture and important files

The React/TypeScript frontend uses React Flow for graph editing, TanStack Query for server state, and Recharts for visualizations. `frontend/src/App.tsx` defines lazy routes; `pages/` contains resource workflows, `features/pipelines/` handles portable graph state and configuration, and `components/ExplanationView.tsx` renders the normalized attribution contract.

FastAPI routers under `backend/app/api/` delegate to resource services. SQLAlchemy entities and Alembic revisions persist project, dataset, pipeline, run, node, metric, artifact, explanation, registry, deployment, traffic, alert, and backup records. `pipeline/` validates and schedules a backend-neutral DAG. `nodes/`, `ml/`, and `xai/` implement stage execution, training, evaluation, serialization, and attribution. Serving and monitoring use the fitted saved model bundle rather than refitting transforms.

`backups/service.py` creates authenticated manifests and checks checksums and extraction boundaries before remapping metadata/artifact IDs into a new project. `artifacts/storage.py` confines filesystem paths. `scripts/dev.sh` starts local servers; `scripts/demo.py` seeds and executes the included synthetic dataset workflows. Dockerfiles, Compose, nginx, environment examples, dependency locks, and the MIT license are included.

Detailed design: [architecture](architecture.md), [pipeline engine](pipeline-engine.md), [database](database.md), [XAI](xai.md), [deployment](deployment.md), and [monitoring](monitoring.md).

## APIs and supported execution

The REST API uses `/api/v1`; OpenAPI is at `/docs`. [The endpoint reference](api.md) covers projects, dataset upload/preview/statistics/target selection, pipeline validation/runs, experiments/comparison/rerun, model registration/download/status, deployment/prediction/status, monitoring/simulation/alerts, artifacts, and backup/download/restore.

Supported node types are dataset, split, impute, encode, scale, select, logistic_regression, random_forest, pytorch, evaluate, shap, lime, register, and deploy. Pipelines support fan-out and single-parent processing nodes. Graph validation rejects invalid connections, cycles, missing datasets/parameters, incompatible methods, and resource-bound violations. Execution persists progress, duration, logs, errors, and artifacts, and marks orphaned active runs failed after restart.

The ML adapters implement scikit-learn logistic regression and random forest plus a CPU PyTorch feed-forward classifier. Metrics include accuracy, precision, recall, F1, confusion matrix, ROC-AUC/curve when applicable, and actual/predicted held-out class counts. Preprocessing fits training data only. Seeds, graph versions, parameters, data checksums, and environment versions accompany experiment snapshots. Dataset targets become immutable after use so reruns and monitoring retain the original interpretation.

SHAP supports tree explanations and sampled probability-based explanations for other supported adapters. LIME trains a real local surrogate. The shared result contract includes sample index, predicted class, confidence, signed contributions, and method metadata; SHAP also records global importance and additivity values. Explanations operate in transformed model feature space. A standalone Explainability page and experiment/model views display persisted results with a non-causation notice.

Registry versions retain saved model bundles and lineage. Deployment inference validates raw input, applies the saved preprocessing, records latency/predictions/errors, and optionally produces SHAP/LIME. Monitoring computes actual request activity, predicted classes, feature PSI, and labelled accuracy degradation. Persistent alerts cover pipeline failure, repeated consecutive execution failure, deployment failure, prediction failure, drift, and degradation; active incidents preserve acknowledgement and avoid unnecessary duplicate alerts.

## Verification and demo

The complete backend suite passed on both SQLite and PostgreSQL: 59 tests per database. All 25 frontend tests passed across 12 files. Production compilation, linting, formatting, local startup, real ML workflows, and browser recovery were verified. See [testing](testing.md) for exact results and limitations.

Follow [README](../README.md) for installation, then run `python3 scripts/demo.py --run`. The [demo walkthrough](demo.md) explains project creation, dataset selection, editable pipelines, execution, attribution, comparison, model serving, real distribution shift, alerts, and backup recovery. The included CSV is synthetic and requires no external dataset download.

## Known limits and future extensions

Docker configuration is supplied but container build/startup could not be executed here because Docker is unavailable. Local Python/Node startup and real PostgreSQL operation were verified separately.

This is a trusted-user, single-host academic prototype. It has no enterprise authentication, tenant isolation, distributed workers, high availability, or production infrastructure sandbox. Files use local artifact storage and trusted Python serialization. Signed recovery requires the originating installation's separately retained signing key. Historical backup records are captured as manifest metadata; previous ZIP binaries are not recursively included.

CSV uploads are bounded to 20 MiB, 200,000 rows, and 500 columns. Dense transformed width is at most 512, with an allocation budget. Explained inference is bounded to ten rows; ordinary batches support 1,000. SHAP/LIME samples are bounded. Dataset feature plots are explicitly preview samples, while summary statistics and target counts describe the full uploaded data. Drift uses a finite recent traffic window and can be noisy with few samples; accuracy degradation requires labels. Arbitrary graph merge nodes, regression/time-series models, Captum, S3/MinIO, authentication, distributed task queues, automated browser regression, and container CI are natural extensions.
