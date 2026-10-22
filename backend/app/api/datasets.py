from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.session import get_db
from app.models.entities import Dataset, Pipeline, PipelineRun, RegisteredModel
from app.schemas.requests import DatasetUpdate
from app.schemas.responses import DatasetOut
from app.services import datasets as service
from app.services.common import get_record, list_records, serialize

router = APIRouter(prefix="/datasets", tags=["Datasets"])


async def read_upload(file: UploadFile, limit: int):
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > limit:
            raise api_error(413, "UPLOAD_TOO_LARGE", "Upload exceeds the configured size limit.")
    return bytes(content)


@router.get("", response_model=list[DatasetOut])
def datasets(project_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize(item, exclude=("path",)) for item in list_records(db, Dataset, project_id)]


@router.post("", status_code=201, response_model=DatasetOut)
async def upload_dataset(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    target_column: str | None = Form(None),
    db: Session = Depends(get_db),
):
    content = await read_upload(file, settings.max_upload_bytes)
    return service.upload_dataset(db, project_id, file.filename or "dataset.csv", content, target_column)


@router.get("/{dataset_id}", response_model=DatasetOut)
def dataset_detail(dataset_id: str, db: Session = Depends(get_db)):
    return service.detail(get_record(db, Dataset, dataset_id))


@router.patch("/{dataset_id}", response_model=DatasetOut)
def select_target(dataset_id: str, body: DatasetUpdate, db: Session = Depends(get_db)):
    return service.update_target(db, get_record(db, Dataset, dataset_id), body.target_column)


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    dataset = get_record(db, Dataset, dataset_id)
    referenced = db.scalar(select(PipelineRun.id).where(PipelineRun.dataset_id == dataset_id)) or db.scalar(
        select(RegisteredModel.id).where(RegisteredModel.dataset_id == dataset_id)
    )
    pipelines = db.scalars(select(Pipeline).where(Pipeline.project_id == dataset.project_id)).all()
    if referenced or any(
        node.get("parameters", {}).get("dataset_id") == dataset_id
        for pipeline in pipelines
        for node in pipeline.definition["nodes"]
    ):
        raise api_error(
            409,
            "DATASET_IN_USE",
            "This dataset is referenced by a pipeline or experiment. Delete its project to remove the complete lineage.",
        )
    db.delete(dataset)
    db.commit()
    return Response(status_code=204)
