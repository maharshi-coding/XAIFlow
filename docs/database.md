# Metadata and recovery

PostgreSQL 16 is the Compose persistence service. SQLite is supported for a single-user local development session and fast tests. SQLAlchemy uses stable UUID strings, foreign keys with cascading cleanup, timestamps and lookup indexes. Alembic applies the schema; `create_all()` is not a deployment strategy.

Tables include projects, datasets, pipelines, pipeline_runs, node_runs, metrics, artifacts, explanations, models, model_versions, deployments, prediction_logs, monitoring_metrics, alerts and backups. Pipeline definitions and run snapshots use JSON; fitted estimators, CSV bytes and explanations are files. Versions and producing-run references preserve lineage. The `(project_id,name,version)` registry constraint protects version uniqueness.

Run and artifact rows preserve timing, configuration, environment, metrics, exceptions, logs, size and checksum. Original dataset bytes are immutable. Artifact keys are confined to the storage root; API downloads verify checksums. Deleting metadata cascades its dependent rows; filesystem retention/cleanup behavior is implemented by the project service.

Backups contain schema-versioned project metadata and referenced artifact files, with checksums and an HMAC-authenticated manifest. Restore validates authentication, archive paths, uncompressed sizes, foreign-key relationships and project scope before writing. A fresh project ID and remapped UUIDs prevent collision with existing projects. Historical backup metadata is preserved in the manifest and restore response; historical backup rows and nested old backup binaries are excluded to keep packages finite. Uploads are capped at 200 MiB by default and expanded contents at 400 MiB.

Keep the signing key and archive separately for disaster recovery. A signing key generated inside the artifact volume survives container restarts. On a fresh installation, configure the same `BACKUP_SIGNING_KEY` or recover the key file before restoration. Restore does not deserialize uploaded model files during validation.

Migration commands, run from `backend/`:

```bash
../.venv/bin/alembic upgrade head
../.venv/bin/alembic current
../.venv/bin/alembic revision --autogenerate -m "describe schema change"
```

Inspect generated migrations and test both upgrades and application flows before deploying a schema change.
