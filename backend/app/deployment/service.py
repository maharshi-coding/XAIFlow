import time
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from app.artifacts.storage import storage
from app.core.errors import api_error
from app.models.entities import Artifact, PredictionLog, RegisteredModel
from app.monitoring.service import deployment_monitoring
from app.services.common import get_record
from app.services.alerts import upsert_incident


def predict(session, deployment, rows, explain=None, labels=None, *, use_default_explainer=True):
    from app.ml.bundle import load_bundle, predict_bundle

    if deployment.status != "active":
        raise api_error(409, "DEPLOYMENT_INACTIVE", "Activate the deployment before sending predictions.")
    if labels is not None and len(labels) != len(rows):
        raise api_error(422, "LABEL_COUNT_MISMATCH", "Provide exactly one label per input row.")
    model = get_record(session, RegisteredModel, deployment.model_id)
    request_id = str(uuid4())
    start = time.perf_counter()
    try:
        path = storage.resolve(model.artifact_path)
        if not path.is_file():
            raise ValueError("The deployed model artifact is unavailable.")
        artifact = session.scalar(
            select(Artifact).where(
                Artifact.path == model.artifact_path, Artifact.project_id == model.project_id
            )
        )
        if artifact:
            path = storage.verified(artifact.path, artifact.checksum)
        bundle = load_bundle(path)
        method = explain or (deployment.explanation_method if use_default_explainer else None)
        result = predict_bundle(bundle, rows, method)
        latency = (time.perf_counter() - start) * 1000
        predictions = [item["prediction"] for item in result["predictions"]]
        probabilities = [item.get("probabilities", {}) for item in result["predictions"]]
        session.add(
            PredictionLog(
                id=request_id,
                project_id=deployment.project_id,
                deployment_id=deployment.id,
                inputs=rows,
                predictions=predictions,
                probabilities=probabilities,
                labels=labels,
                latency_ms=latency,
            )
        )
        session.commit()
        monitoring = deployment_monitoring(session, deployment, persist=True)
        return {
            **result,
            "request_id": request_id,
            "deployment_id": deployment.id,
            "model_id": model.id,
            "model_version": model.version,
            "latency_ms": round(latency, 3),
            "drift_score": monitoring["drift_score"],
            "metadata": {
                **result.get("metadata", {}),
                "model_id": model.id,
                "model_name": model.name,
                "model_version": model.version,
                "deployment_id": deployment.id,
            },
        }
    except Exception as exc:
        session.rollback()
        latency = (time.perf_counter() - start) * 1000
        request_log = session.get(PredictionLog, request_id)
        if request_log is None:
            session.add(
                PredictionLog(
                    id=request_id,
                    project_id=deployment.project_id,
                    deployment_id=deployment.id,
                    inputs=rows,
                    predictions=[],
                    probabilities=[],
                    labels=labels,
                    latency_ms=latency,
                    error=str(exc),
                )
            )
        else:
            # Monitoring follows the request-log commit. Its failure must update
            # that record rather than insert the same request ID a second time.
            request_log.error = str(exc)
            request_log.latency_ms = latency
        upsert_incident(
            session,
            project_id=deployment.project_id,
            deployment_id=deployment.id,
            kind="prediction_failure",
            source=f"deployment:{deployment.id}",
            title="Inference request failed",
            message=str(exc),
            details={
                "request_id": request_id,
                "metric": "prediction_failures",
                "threshold": 1,
                "observed_value": 1,
            },
        )
        session.commit()
        if isinstance(exc, HTTPException):
            raise
        input_error = isinstance(exc, (ValueError, TypeError, KeyError))
        raise api_error(
            422 if input_error else 500,
            "INVALID_PREDICTION_INPUT" if input_error else "PREDICTION_FAILED",
            str(exc),
        ) from exc
