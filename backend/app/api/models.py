from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.artifacts.storage import storage
from app.db.session import get_db
from app.models.entities import Artifact, RegisteredModel
from app.schemas.requests import ModelUpdate
from app.schemas.responses import ModelOut
from app.services.common import get_record, list_records, serialize
from app.services.registry import model_detail

router = APIRouter(prefix="/models", tags=["Model registry"])


@router.get("", response_model=list[ModelOut])
def models(project_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize(item) for item in list_records(db, RegisteredModel, project_id)]


@router.get("/{model_id}", response_model=ModelOut)
def registered_model_detail(model_id: str, db: Session = Depends(get_db)):
    return model_detail(db, get_record(db, RegisteredModel, model_id))


@router.patch("/{model_id}", response_model=ModelOut)
def update_model(model_id: str, body: ModelUpdate, db: Session = Depends(get_db)):
    model = get_record(db, RegisteredModel, model_id)
    model.status = body.status
    db.commit()
    return serialize(model)


@router.get("/{model_id}/download")
def download_model(model_id: str, db: Session = Depends(get_db)):
    from sqlalchemy import select

    model = get_record(db, RegisteredModel, model_id)
    artifact = db.scalar(
        select(Artifact).where(Artifact.path == model.artifact_path, Artifact.project_id == model.project_id)
    )
    path = (
        storage.verified(artifact.path, artifact.checksum)
        if artifact
        else storage.resolve(model.artifact_path)
    )
    return FileResponse(path, filename=f"{model.name}-v{model.version}.joblib")
