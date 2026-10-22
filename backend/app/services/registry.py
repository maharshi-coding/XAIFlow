from sqlalchemy import func, select
from fastapi import HTTPException

from app.artifacts.storage import storage
from app.core.config import settings
from app.core.errors import api_error
from app.models.entities import Artifact, Deployment, ModelVersion, RegisteredModel
from app.services.alerts import upsert_incident
from app.services.common import serialize


def register_model(session, run, name, bundle_path=None, metadata=None):
    if run.status != "completed" and not bundle_path:
        raise api_error(409, "RUN_NOT_READY", "Only completed trained runs can be registered.")
    result = run.result or {}
    metadata = metadata or result.get("model_metadata", {})
    bundle_path = bundle_path or result.get("model_artifact")
    if not bundle_path:
        raise api_error(409, "NO_MODEL", "This run did not produce a trained model artifact.")
    path = (
        storage.resolve(bundle_path)
        if not str(bundle_path).startswith("/")
        else storage.resolve(storage.key(bundle_path))
    )
    if not path.is_file():
        raise api_error(409, "MODEL_MISSING", "The trained model artifact is missing.")
    version = (
        session.scalar(
            select(func.max(RegisteredModel.version)).where(
                RegisteredModel.project_id == run.project_id, RegisteredModel.name == name
            )
        )
        or 0
    ) + 1
    model = RegisteredModel(
        project_id=run.project_id,
        name=name,
        version=version,
        algorithm=run.model_type or metadata.get("model_type", "unknown"),
        framework=metadata.get(
            "framework", "pytorch" if "pytorch" in (run.model_type or "") else "scikit-learn"
        ),
        run_id=run.id,
        pipeline_id=run.pipeline_id,
        dataset_id=run.dataset_id,
        artifact_path=storage.key(path),
        metrics=run.metrics or metadata.get("metrics", {}),
        parameters=run.parameters or metadata.get("hyperparameters", {}),
        preprocessing=run.preprocessing or metadata.get("preprocessing", []),
        explanations=run.explanations or metadata.get("explanations", []),
        baseline=result.get("baseline", metadata.get("baseline", {})),
        input_schema=metadata.get("input_schema", []),
    )
    session.add(model)
    session.flush()
    session.add(
        ModelVersion(
            model_id=model.id,
            version=version,
            metadata_json={
                "run_id": run.id,
                "algorithm": model.algorithm,
                "framework": model.framework,
                "artifact_path": model.artifact_path,
            },
        )
    )
    session.commit()
    return model


def deploy_model(
    session, model, name, explanation_method=None, drift_threshold=None, degradation_threshold=0.1
):
    project_id, model_id, model_name, run_id = model.project_id, model.id, model.name, model.run_id
    try:
        if model.status == "archived":
            raise api_error(409, "MODEL_ARCHIVED", "An archived model cannot be deployed.")
        if not storage.resolve(model.artifact_path).is_file():
            raise api_error(409, "MODEL_MISSING", "The trained model artifact is missing.")
        artifact = session.scalar(
            select(Artifact).where(Artifact.project_id == project_id, Artifact.path == model.artifact_path)
        )
        if artifact:
            storage.verified(artifact.path, artifact.checksum)
        deployment = Deployment(
            project_id=project_id,
            model_id=model_id,
            name=name,
            explanation_method=explanation_method,
            drift_threshold=settings.drift_threshold if drift_threshold is None else drift_threshold,
            degradation_threshold=degradation_threshold,
        )
        session.add(deployment)
        session.commit()
        return deployment
    except Exception as exc:
        session.rollback()
        message = (
            exc.detail.get("message", str(exc.detail))
            if isinstance(exc, HTTPException) and isinstance(exc.detail, dict)
            else str(exc)
        )
        upsert_incident(
            session,
            project_id=project_id,
            run_id=run_id,
            kind="deployment_failure",
            source=f"model:{model_id}",
            severity="critical",
            title=f"Deployment failed: {model_name}",
            message=message,
            details={
                "model_id": model_id,
                "model_name": model_name,
                "requested_name": name,
                "metric": "deployment_failures",
                "threshold": 1,
                "observed_value": 1,
            },
        )
        session.commit()
        if isinstance(exc, HTTPException):
            raise
        raise api_error(500, "DEPLOYMENT_FAILED", "The deployment could not be created.") from exc


def model_detail(session, model):
    return {
        **serialize(model),
        "deployments": [
            serialize(item)
            for item in session.scalars(select(Deployment).where(Deployment.model_id == model.id)).all()
        ],
        "artifact_url": f"/api/v1/models/{model.id}/download",
    }
