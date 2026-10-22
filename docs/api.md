# API endpoint reference

Generated from the running FastAPI OpenAPI schema. Base URL: `/api/v1`; interactive schema: `/docs`.

| Method | Path | Operation |
| --- | --- | --- |
| GET | `/api/v1/alerts` | Alerts |
| PATCH | `/api/v1/alerts/{alert_id}` | Update Alert |
| GET | `/api/v1/artifacts/{artifact_id}/download` | Download Artifact |
| GET | `/api/v1/backups` | Backups |
| POST | `/api/v1/backups` | Backup Project |
| POST | `/api/v1/backups/restore` | Restore Project |
| GET | `/api/v1/backups/{backup_id}/download` | Download Backup |
| GET | `/api/v1/datasets` | Datasets |
| POST | `/api/v1/datasets` | Upload Dataset |
| GET | `/api/v1/datasets/{dataset_id}` | Dataset Detail |
| PATCH | `/api/v1/datasets/{dataset_id}` | Select Target |
| DELETE | `/api/v1/datasets/{dataset_id}` | Delete Dataset |
| GET | `/api/v1/deployments` | Deployments |
| POST | `/api/v1/deployments` | Create Deployment |
| GET | `/api/v1/deployments/{deployment_id}` | Deployment Detail |
| PATCH | `/api/v1/deployments/{deployment_id}` | Update Deployment |
| POST | `/api/v1/deployments/{deployment_id}/predict` | Predict Deployment |
| GET | `/api/v1/health` | Health |
| GET | `/api/v1/models` | Models |
| GET | `/api/v1/models/{model_id}` | Registered Model Detail |
| PATCH | `/api/v1/models/{model_id}` | Update Model |
| GET | `/api/v1/models/{model_id}/download` | Download Model |
| GET | `/api/v1/monitoring` | Monitoring |
| POST | `/api/v1/monitoring/{deployment_id}/simulate` | Simulate |
| GET | `/api/v1/nodes` | Nodes |
| GET | `/api/v1/overview` | Overview |
| GET | `/api/v1/pipelines` | Pipelines |
| POST | `/api/v1/pipelines` | Save Pipeline |
| GET | `/api/v1/pipelines/{pipeline_id}` | Pipeline Detail |
| PATCH | `/api/v1/pipelines/{pipeline_id}` | Update Pipeline |
| DELETE | `/api/v1/pipelines/{pipeline_id}` | Delete Pipeline |
| POST | `/api/v1/pipelines/{pipeline_id}/runs` | Start Run |
| POST | `/api/v1/pipelines/{pipeline_id}/validate` | Validate Pipeline |
| GET | `/api/v1/projects` | Projects |
| POST | `/api/v1/projects` | Create Project |
| GET | `/api/v1/projects/{project_id}` | Project Detail |
| PATCH | `/api/v1/projects/{project_id}` | Update Project |
| DELETE | `/api/v1/projects/{project_id}` | Delete Project |
| GET | `/api/v1/runs` | Runs |
| GET | `/api/v1/runs/compare` | Compare Runs |
| GET | `/api/v1/runs/{run_id}` | Experiment Detail |
| POST | `/api/v1/runs/{run_id}/register` | Register Run |
| POST | `/api/v1/runs/{run_id}/rerun` | Rerun |
| GET | `/health` | Health |
