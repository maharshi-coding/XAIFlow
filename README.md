# XAIFlow

Visual machine learning orchestration with explanations, experiment lineage, model serving, and recovery in one application. Built as a functional academic prototype for moderate tabular classification datasets.

To work on another computer, follow the [clone, setup, and sync guide](docs/cross-pc-development.md).

![Refreshed XAIFlow workspace](docs/screenshots/ui-overview.jpg)

The React Flow editor persists a backend-neutral DAG. A background executor validates it, fits training-only preprocessing, trains a model, evaluates held-out data, generates actual SHAP or LIME attributions, and records node progress, logs, metrics, and artifacts. Registered versions can serve predictions using their saved transforms. Prediction traffic feeds monitoring and threshold alerts. Signed project backups recover metadata and model artifacts into a separate project.

## Start with Docker

Requires Docker Engine with Compose. From this directory:

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD in .env to your local development password.
docker compose up --build
```

Open [XAIFlow](http://localhost:8080) and [API documentation](http://localhost:8000/docs). Compose starts PostgreSQL 16, applies Alembic migrations, and persists the database and artifacts in named volumes. The API and UI ports bind to localhost. Initial dependency/image downloads need internet access; demonstrations use the included CSV offline.

Use the interface to create a project, upload `data/demo_churn.csv`, choose `churn` as the target, and create a pipeline. To prepare all three editable demo pipelines automatically:

```bash
python3 scripts/demo.py
# Also train all three models and a second forest experiment:
python3 scripts/demo.py --run
```

## Local development

Requires Python **3.12** and Node.js **22**. The local option uses SQLite; PostgreSQL remains the Compose database. Both use the same SQLAlchemy schema and Alembic migrations.

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt -c backend/requirements.lock
cd frontend
npm ci
cd ..
bash scripts/dev.sh
```

Open [the development UI](http://localhost:5173). The script manages both servers and stores local metadata under `.local/` and artifacts under `artifacts/`. Stop it with Ctrl+C.

If port 8000 is occupied, use `BACKEND_PORT=8001 bash scripts/dev.sh` and pass `--base http://localhost:8001/api/v1` to the demo script. The frontend proxy follows `BACKEND_PORT` automatically.

To run each server separately:

```bash
cd backend
export DATABASE_URL=sqlite:///./xaiflow.db
export ARTIFACT_ROOT=../artifacts
../.venv/bin/alembic upgrade head
../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
# In another terminal, from XAIFlow/frontend:
npm run dev
```

For PostgreSQL, set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE`. Database connection values are environment configuration; no credentials belong in source control. Startup also applies pending migrations unless `AUTO_MIGRATE=false`. Use one API process for this prototype's in-process background executor.

## Interface design

The entire app shares a readable dashboard design, locally bundled IBM Plex Sans / JetBrains Mono, responsive navigation, and consistent resource views. The visual editor includes a stage picker and keyboard connection controls. See the [UI refresh and validation](docs/ui-refresh.md) and [design system](design-system/xaiflow/MASTER.md).

## Features and stack

- Project management; immutable UTF-8 CSV upload, preview, statistics, class distribution, and target selection.
- Drag/drop DAG editing, configuration, save/reload, graph validation, execution, and node progress.
- Train/test split, missing-value handling, one-hot/ordinal encoding, standard/min-max scaling, and SelectKBest.
- Logistic regression, random forest, and a configurable PyTorch feed-forward classifier.
- Accuracy, precision, recall, F1, confusion matrix, and ROC-AUC/curve where applicable.
- Real SHAP local/global attribution and LIME local attribution with a normalized UI contract.
- Persistent experiment snapshots, logs, artifact downloads, re-runs, and comparison.
- Versioned registry and REST deployment with saved preprocessing and explanation support.
- Prediction volume, errors, latency, class distribution, PSI drift, labelled accuracy degradation, and persistent alerts.
- Controlled distribution shifts and signed project backup/download/restore with UUID remapping.

Frontend: React, TypeScript, Vite, React Flow, Tailwind CSS, TanStack Query, Recharts, Lucide. Backend: Python, FastAPI, Pydantic, SQLAlchemy, Alembic, PostgreSQL. ML: NumPy, pandas, scikit-learn, PyTorch, SHAP, LIME.

## Configuration

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database connection | `sqlite:///./xaiflow.db` |
| `ARTIFACT_ROOT` | Confined filesystem storage root | `../artifacts` relative to backend |
| `CORS_ORIGINS` | Comma-separated allowed UI origins | localhost/127.0.0.1 on port 5173 |
| `MAX_UPLOAD_BYTES` | CSV upload limit | 20 MiB |
| `MAX_BACKUP_BYTES` | Compressed backup limit; expanded cap is twice this value | 200 MiB |
| `DRIFT_THRESHOLD` | Default feature PSI alert threshold | `0.2` |
| `AUTO_MIGRATE` | Apply Alembic migrations on startup | `true` |
| `BACKUP_SIGNING_KEY` | Optional externally managed backup HMAC secret | Generated persistent key in artifact storage |

Keep the generated `.backup-signing-key` or configured signing key separately for disaster recovery. A different installation needs the same signing key to restore a signed backup. The secret is deliberately excluded from downloadable backup packages.

## Test and verify

```bash
.venv/bin/python -m pytest
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
cd frontend
npm test
npm run lint
npm run build
```

Integration tests migrate an isolated temporary SQLite database and train real models. To run the same suite on an empty, disposable PostgreSQL database:

```bash
XAI_TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/xaiflow_test \
  .venv/bin/python -m pytest
```

See [testing and verification](docs/testing.md) for recorded results and the browser workflow, and the [implementation report](docs/implementation-report.md) for delivered scope and limitations. Do not point tests at a database containing important application data.

## API and project layout

The versioned REST API is under `/api/v1`; interactive OpenAPI is at `/docs`. See the [endpoint reference](docs/api.md). Important resources are projects, datasets, pipelines, runs, models, deployments, monitoring, alerts, artifacts, and backups. A deployment accepts `POST /api/v1/deployments/{id}/predict` with `{"rows": [{"feature": "value"}], "explain": "lime"}`. Its feature schema comes from the trained dataset; explanations operate in transformed model feature space.

```text
frontend/src/   application shell, API hooks, typed feature pages, visual editor
backend/app/   API, metadata services, DAG engine, ML/XAI adapters, serving and monitoring
backend/alembic/ versioned schema migrations
backend/tests/ unit, API, integration and recovery tests
data/          deterministic synthetic churn CSV
docker/        backend/frontend images and reverse proxy
scripts/       local servers, demo generation and demo API workflows
docs/          architecture, execution, XAI, storage, serving, monitoring and tests
```

## Scope and limitations

This is a single-host academic prototype. Enterprise authentication, authorization, tenant isolation, distributed workers, HA, infrastructure sandboxing, and secrets management are future work. Use it with trusted local users and non-sensitive data. Model artifacts use Python serialization; restore accepts only authenticated, signed packages from a trusted installation.

CSV datasets are limited to 20 MiB, 200,000 rows, and 500 columns. Transformed models support at most 512 features and explanation requests at most 10 rows. Pipelines support fan-out; each processing node accepts one parent. Train-only transforms are deferred until the split/model stage, even when the visual graph lists preprocessing before splitting. Training and explanations run in a bounded in-process executor, so horizontal replicas require a shared task queue. SHAP/LIME sampling is bounded for interactive demonstrations. Monitoring uses a finite recent-traffic window and a reference dataset; PSI alerts indicate distribution change, not proof of accuracy loss. Labels are required for performance degradation monitoring. Captum and remote S3/MinIO storage are extension points.

Detailed walkthrough: [demo](docs/demo.md). Design: [architecture](docs/architecture.md), [pipeline engine](docs/pipeline-engine.md), [XAI](docs/xai.md), [database](docs/database.md), [deployment](docs/deployment.md), [monitoring](docs/monitoring.md).
