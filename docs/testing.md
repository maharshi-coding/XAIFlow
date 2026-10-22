# Testing and verification

## GitHub publication verification — October 21, 2026

Re-ran the current source before its initial private GitHub publication:

| Check | Result |
| --- | --- |
| Backend pytest, isolated temporary SQLite | 59 passed in 68.27 seconds |
| Frontend Vitest | 41 passed across 18 files |
| Python Ruff lint / formatting | Passed; 66 files checked for formatting |
| Frontend ESLint / Prettier | Passed |
| TypeScript compilation / Vite production build | Passed |

The backend suite executed real model training and SHAP/LIME. Seven dependency deprecation warnings remain; the frontend tests also report React Router future-flag notices. No failures occurred. This publication check did not rerun PostgreSQL or Docker containers. The earlier database and browser results below remain dated historical evidence.

## Original implementation verification

Recorded on October 6, 2026. The application was verified locally on macOS with Python 3.12, Node.js 22, SQLite, and an isolated PostgreSQL 16 database. The PostgreSQL runtime used for verification is local test tooling under ignored `.local/`; it is not an application dependency.

## Automated results

| Check | Result |
| --- | --- |
| Complete backend suite, SQLite | 59 passed, 25.52 seconds |
| Complete backend suite, PostgreSQL | 59 passed, 23.91 seconds |
| Frontend Vitest suite | 25 passed across 12 files |
| Python Ruff lint and formatting | Passed |
| TypeScript compilation and Vite production build | Passed |
| Frontend ESLint and Prettier | Passed |
| Local development startup script | Passed on unused ports 8002 / 5174; test servers stopped |
| Docker / Compose containers | Configuration supplied; build and startup unverified because Docker is unavailable |

The backend suite trains real logistic regression, random forest, and CPU PyTorch classifiers. It checks held-out metrics, saved preprocessing and predictions, actual SHAP and LIME outputs, graph validation, preprocessing order and leakage prevention, bounded dense encoding, missing values, multi-model fan-out, persisted execution failures, comparisons, model serving, monitoring, signed backups, and restore with remapped IDs. Recovery tests preserve unrelated projects and verify inference from a restored model.

Final regressions cover timezone-aware node duration, reserved characters in PostgreSQL passwords, artifact cleanup confinement, corrupt model deployment failures, repeated execution failures without duplicate active incidents, dataset target protection, and durable prediction logs when monitoring fails after inference.

The backend emits seven deprecation/future warnings from the Starlette TestClient, pandas replacement behavior, and SHAP plotting dependencies. There are no failing tests. Dependency upgrades can address these warnings independently of application correctness.

## Reproduce

Install dependencies using the README, then from `XAIFlow/` run:

```bash
.venv/bin/python -m pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
cd frontend
npm test
npm run lint
npm run format:check
npm run build
```

The backend fixture creates a temporary SQLite database and artifact directory. PostgreSQL testing requires an empty disposable database:

```bash
XAI_TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/xaiflow_test \
  .venv/bin/python -m pytest -q
```

## Browser verification

Browser checks used the real React application at port 5173, proxied to FastAPI at port 8001, with PostgreSQL metadata and filesystem artifacts. Port 8000 belonged to another local application and was preserved.

- Selected the seeded project, loaded a saved forest DAG, validated it, and submitted an execution. All nine stages completed with live node status, logs, held-out metrics, registration, and SHAP output.
- Inspected experiment metrics, confusion matrix, explanations, and artifact links. Found and fixed a PostgreSQL timezone error in displayed node durations.
- Submitted a nullable raw dataset sample to the deployed classifier. Saved preprocessing, real LIME, confidence, and monitoring records were returned.
- Sent 100 genuinely shifted samples through inference using the controlled drift UI. Monitoring recorded 101 predictions across two requests, nonzero numeric PSI, zero errors, and a persistent drift alert. Acknowledged the alert in the UI.
- Created a signed ZIP backup of the demo project. The download endpoint returned the archive. Uploaded it through the UI and restored a separate project with 23 verified artifacts, five experiments, five models, one deployment, explanations, and monitoring history. Submitted a successful explained prediction to the restored deployment.
- Compared the 60-tree and 100-tree forest runs in the UI. Accuracy/F1 improved by 2.50 percentage points; sample counts correctly stayed at 80. Corrected the discovered count-versus-rate formatting error and added regression coverage.
- Selected stored SHAP output in the standalone Explainability page, including confidence, signed contributions, and global importance. Inspected full dataset statistics and changed the preview distribution feature. Attempting to change a trained dataset's target displayed the reproducibility protection error and preserved `churn`.
- Dragged a new preprocessing stage from the palette onto the canvas and connected its input handle to an existing source. The stage/connection counts updated correctly. Removed that temporary stage, revalidated the nine-stage DAG, and executed it successfully again: all nine nodes completed, accuracy 76.25%, duration 1.22 seconds, with correct sub-second node durations.
- Inspected the final held-out class/prediction chart and counts table (actual classes 44/36, predictions 43/37) and deployment traffic cards (two requests, 101 predictions, zero errors), backed by persisted records.

These are interactive browser checks, not an automated Playwright regression suite. Unit/integration tests exercise failure paths that are impractical to trigger manually. Browser screenshots are stored under `docs/screenshots/`. The in-app browser download-event observer timed out; the same visible backup download endpoint was verified over HTTP, and that downloaded archive restored successfully through the UI.

## Demonstration results

The deterministic synthetic churn CSV has 320 rows. Seeded held-out accuracies were:

| Workflow | Accuracy | Explanation |
| --- | --- | --- |
| Logistic regression | 83.75% | LIME |
| Random forest, 60 trees | 73.75% | SHAP |
| Random forest, 100 trees | 76.25% | SHAP |
| PyTorch neural network | 78.75% | LIME |

These are measurements on synthetic demonstration data, not claims about real customer churn performance. The initial forest explanation includes cold library import time; subsequent runs are faster.
