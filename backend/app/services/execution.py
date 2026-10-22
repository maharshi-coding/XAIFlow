"""Run persistence around the reusable ML executor, isolated from HTTP requests."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
import hashlib
import platform
from pathlib import Path
import time

from fastapi.encoders import jsonable_encoder

from sqlalchemy import select

from app.artifacts.storage import storage
from app.core.errors import api_error
from app.db.session import SessionLocal
from app.models.entities import Alert, Artifact, Dataset, Explanation, Metric, NodeRun, PipelineRun
from app.services.common import get_record, serialize
from app.services.alerts import record_repeated_execution_error
from app.services.datasets import read_dataset

worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="xaiflow-run")


def environment_snapshot():
    versions = {}
    for package in ("scikit-learn", "torch", "shap", "lime", "pandas", "numpy", "scipy", "joblib", "fastapi"):
        try:
            versions[package] = version(package)
        except PackageNotFoundError:
            versions[package] = "unavailable"
    return {"python": platform.python_version(), "platform": platform.platform(), "packages": versions}


def node_duration_seconds(started_at: datetime, finished_at: datetime) -> float:
    """PostgreSQL datetimes retain offsets; SQLite's naive timestamps represent UTC."""
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return max(0.0, (finished_at - started_at).total_seconds())


def resolver_for(session, project_id):
    def resolver(dataset_id):
        dataset = get_record(session, Dataset, dataset_id)
        if dataset.project_id != project_id:
            raise ValueError("Dataset belongs to a different project.")
        return read_dataset(dataset), dataset.target_column

    return resolver


def validate_definition(session, definition, project_id):
    from app.pipeline.validator import validate_pipeline

    return validate_pipeline(definition, resolver_for(session, project_id))


def create_run(session, pipeline, definition=None, source_run=None):
    definition = definition or pipeline.definition
    validation = validate_definition(session, definition, pipeline.project_id)
    if not validation["valid"]:
        raise api_error(
            422, "INVALID_PIPELINE", "Fix pipeline validation errors before execution.", validation["errors"]
        )
    dataset_ids = [
        node["parameters"].get("dataset_id") for node in definition["nodes"] if node["type"] == "dataset"
    ]
    run = PipelineRun(
        project_id=pipeline.project_id,
        pipeline_id=pipeline.id,
        pipeline_name=source_run.pipeline_name if source_run else pipeline.name,
        pipeline_version=source_run.pipeline_version if source_run else pipeline.version,
        dataset_id=next((item for item in dataset_ids if item), None),
        definition=definition,
        environment=environment_snapshot(),
    )
    session.add(run)
    session.flush()
    for node in definition["nodes"]:
        session.add(
            NodeRun(
                run_id=run.id,
                node_id=node["id"],
                node_type=node["type"],
                label=node.get("label", node["type"]),
            )
        )
    session.commit()
    worker.submit(execute_run, run.id)
    return run


def run_detail(session, run):
    return {
        **serialize(run),
        "node_runs": [
            serialize(node)
            for node in session.scalars(
                select(NodeRun).where(NodeRun.run_id == run.id).order_by(NodeRun.created_at)
            ).all()
        ],
        "artifacts": [
            {
                **serialize(artifact, exclude=("path",)),
                "download_url": f"/api/v1/artifacts/{artifact.id}/download",
            }
            for artifact in session.scalars(select(Artifact).where(Artifact.run_id == run.id)).all()
        ],
    }


def execute_run(run_id):
    from app.pipeline.engine import execute_pipeline
    from app.services.registry import deploy_model, register_model

    with SessionLocal() as session:
        run = session.get(PipelineRun, run_id)
        if run is None:
            return
        start = time.perf_counter()
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        session.commit()
        output_dir = storage.resolve(f"projects/{run.project_id}/runs/{run.id}")
        output_dir.mkdir(parents=True, exist_ok=True)

        def on_node(node_id, status, detail):
            node = session.scalar(select(NodeRun).where(NodeRun.run_id == run_id, NodeRun.node_id == node_id))
            if node is None:
                return
            node.status = status
            now = datetime.now(timezone.utc)
            if status == "running":
                node.started_at = now
            if status in {"completed", "failed", "skipped"}:
                node.finished_at = now
                if node.started_at:
                    node.duration = node_duration_seconds(node.started_at, now)
            node.error = detail.get("error")
            node.metrics = detail.get("metrics", node.metrics)
            if detail.get("logs"):
                node.logs = list(node.logs) + detail["logs"]
            session.commit()

        def on_log(level, message, node_id=None):
            entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": level,
                "message": str(message),
                "node_id": node_id,
            }
            run.logs = list(run.logs) + [entry]
            if node_id:
                node = session.scalar(
                    select(NodeRun).where(NodeRun.run_id == run_id, NodeRun.node_id == node_id)
                )
                if node:
                    node.logs = list(node.logs) + [entry]
            session.commit()

        def on_register(bundle_path, metadata):
            run.dataset_id = metadata.get("dataset_id", run.dataset_id)
            run.model_type = metadata.get("model_type", metadata.get("algorithm"))
            run.parameters = metadata.get("hyperparameters", metadata.get("parameters", {}))
            run.preprocessing = metadata.get("preprocessing", [])
            run.metrics = metadata.get("metrics", {})
            run.explanations = metadata.get("explanations", [])
            run.result = {
                "model_artifact": str(bundle_path),
                "model_metadata": metadata,
                "baseline": metadata.get("baseline", {}),
            }
            session.commit()
            model = register_model(
                session, run, metadata.get("name", run.pipeline_name), bundle_path, metadata
            )
            return jsonable_encoder(serialize(model))

        def on_deploy(registration):
            from app.models.entities import RegisteredModel

            model = get_record(session, RegisteredModel, registration["id"])
            parameters = registration.get("deployment_parameters", {})
            return jsonable_encoder(
                serialize(
                    deploy_model(
                        session,
                        model,
                        parameters.get("name", f"{model.name} v{model.version}"),
                        parameters.get("explanation_method"),
                    )
                )
            )

        try:
            result = execute_pipeline(
                run.definition,
                resolver_for(session, run.project_id),
                output_dir,
                on_node,
                on_log,
                on_register,
                on_deploy,
            )
            run.metrics = result.get("metrics", {})
            run.model_type = result.get("model_type")
            run.parameters = result.get("hyperparameters", {})
            run.preprocessing = result.get("preprocessing", [])
            run.dataset_id = result.get("dataset_id", run.dataset_id)
            all_explanations = [
                explanation
                for model_run in result.get("model_runs", [])
                for explanation in model_run.get("explanations", [])
            ]
            all_explanations += result.get("explanations", [])
            run.explanations = list(
                {
                    explanation.get("node_id") or explanation.get("artifact_path") or str(index): explanation
                    for index, explanation in enumerate(all_explanations)
                }.values()
            )
            run.result = result
            run.status = "completed"
            for name, value in run.metrics.items():
                session.add(Metric(run_id=run.id, name=name, value=value))
            for model_run in result.get("model_runs", [])[:-1]:
                node_id = model_run["node_id"]
                prefix = hashlib.sha256(node_id.encode()).hexdigest()[:16]
                for name, value in model_run.get("metrics", {}).items():
                    session.add(
                        Metric(
                            run_id=run.id,
                            name=f"{prefix}:{name}"[:80],
                            value={"node_id": node_id, "value": value},
                        )
                    )
            for item in result.get("artifacts", []):
                path = Path(item["path"])
                key = storage.key(path) if path.is_absolute() else str(path)
                file = storage.resolve(key)
                session.add(
                    Artifact(
                        project_id=run.project_id,
                        run_id=run.id,
                        kind=item.get("kind", "output"),
                        name=item.get("name", file.name),
                        path=key,
                        checksum=storage.checksum(key),
                        size_bytes=file.stat().st_size,
                    )
                )
            for explanation in run.explanations:
                session.add(
                    Explanation(
                        project_id=run.project_id,
                        run_id=run.id,
                        method=explanation.get("explainer", "unknown"),
                        data=explanation,
                    )
                )
            run.finished_at = datetime.now(timezone.utc)
            run.duration = time.perf_counter() - start
            session.commit()
        except Exception as exc:
            session.rollback()
            run = session.get(PipelineRun, run_id)
            if run is None:
                return
            run.status = "failed"
            run.error = f"{type(exc).__name__}: {exc}"
            run.logs = list(run.logs) + [
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "level": "error",
                    "message": run.error,
                    "node_id": None,
                }
            ]
            for node in session.scalars(
                select(NodeRun).where(NodeRun.run_id == run_id, NodeRun.status.in_(["queued", "running"]))
            ):
                node.status = "failed" if node.status == "running" else "skipped"
                node.error = run.error if node.status == "failed" else None
                node.finished_at = datetime.now(timezone.utc)
            session.add(
                Alert(
                    project_id=run.project_id,
                    run_id=run.id,
                    severity="critical",
                    kind="pipeline_failure",
                    title=f"Pipeline failed: {run.pipeline_name}",
                    message=run.error,
                    details={
                        "source": f"run:{run.id}",
                        "metric": "execution_failures",
                        "threshold": 1,
                        "observed_value": 1,
                    },
                )
            )
            record_repeated_execution_error(session, run)
        run.finished_at = datetime.now(timezone.utc)
        run.duration = time.perf_counter() - start
        session.commit()


def recover_interrupted_runs():
    with SessionLocal() as session:
        for run in session.scalars(select(PipelineRun).where(PipelineRun.status.in_(["queued", "running"]))):
            run.status = "failed"
            run.error = "Execution interrupted by an application restart. Re-run the saved experiment."
            run.finished_at = datetime.now(timezone.utc)
            for node in session.scalars(
                select(NodeRun).where(NodeRun.run_id == run.id, NodeRun.status.in_(["queued", "running"]))
            ):
                node.status = "failed" if node.status == "running" else "skipped"
                node.error = run.error if node.status == "failed" else None
            session.add(
                Alert(
                    project_id=run.project_id,
                    run_id=run.id,
                    severity="critical",
                    kind="pipeline_failure",
                    title="Run interrupted",
                    message=run.error,
                    details={
                        "source": f"run:{run.id}",
                        "metric": "execution_failures",
                        "threshold": 1,
                        "observed_value": 1,
                    },
                )
            )
            record_repeated_execution_error(session, run)
        session.commit()
