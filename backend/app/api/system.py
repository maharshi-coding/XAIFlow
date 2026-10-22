from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.artifacts.storage import storage
from app.core.errors import api_error
from app.db.session import get_db
from app.models.entities import (
    Alert,
    Artifact,
    Dataset,
    Deployment,
    Pipeline,
    PipelineRun,
    Project,
    RegisteredModel,
)
from app.services.common import list_records, serialize

router = APIRouter(tags=["System"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise api_error(503, "DATABASE_UNAVAILABLE", "The metadata database is unavailable.") from exc
    return {"status": "ok", "database": "connected", "service": "XAIFlow"}


@router.get("/nodes")
def nodes():
    from app.pipeline.registry import NODE_CATALOG

    return NODE_CATALOG


@router.get("/overview")
def overview(project_id: str | None = None, db: Session = Depends(get_db)):
    def count(model, predicate=None):
        query = select(func.count()).select_from(model)
        if project_id:
            query = (
                query.where(model.id == project_id)
                if model is Project
                else query.where(model.project_id == project_id)
            )
        if predicate is not None:
            query = query.where(predicate)
        return db.scalar(query)

    counts = {
        "projects": count(Project),
        "datasets": count(Dataset),
        "pipelines": count(Pipeline),
        "runs": count(PipelineRun),
        "successful_runs": count(PipelineRun, PipelineRun.status == "completed"),
        "failed_runs": count(PipelineRun, PipelineRun.status == "failed"),
        "models": count(RegisteredModel),
        "active_deployments": count(Deployment, Deployment.status == "active"),
        "alerts": count(Alert, Alert.status == "open"),
    }
    runs = list_records(db, PipelineRun, project_id, 10)
    alerts = list_records(db, Alert, project_id, 8)
    recent_models = list_records(db, RegisteredModel, project_id, 8)
    return {
        "counts": counts,
        **counts,
        "recent_runs": [serialize(item) for item in runs],
        "recent_alerts": [serialize(item) for item in alerts],
        "recent_models": [serialize(item) for item in recent_models],
        "deployments": [serialize(item) for item in list_records(db, Deployment, project_id, 8)],
    }


@router.get("/artifacts/{artifact_id}/download")
def download_artifact(artifact_id: str, db: Session = Depends(get_db)):
    from app.services.common import get_record

    artifact = get_record(db, Artifact, artifact_id)
    return FileResponse(storage.verified(artifact.path, artifact.checksum), filename=artifact.name)
