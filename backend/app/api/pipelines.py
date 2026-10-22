from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.session import get_db
from app.models.entities import Pipeline, PipelineRun, Project
from app.schemas.requests import PipelineCreate, PipelineUpdate
from app.schemas.responses import PipelineOut, RunOut, ValidationOut
from app.services.common import get_record, list_records, serialize
from app.services.execution import create_run, run_detail, validate_definition

router = APIRouter(prefix="/pipelines", tags=["Pipelines"])


@router.get("", response_model=list[PipelineOut])
def pipelines(project_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize(item) for item in list_records(db, Pipeline, project_id)]


@router.post("", status_code=201, response_model=PipelineOut)
def save_pipeline(body: PipelineCreate, db: Session = Depends(get_db)):
    get_record(db, Project, body.project_id)
    pipeline = Pipeline(**body.model_dump())
    db.add(pipeline)
    db.commit()
    return serialize(pipeline)


@router.get("/{pipeline_id}", response_model=PipelineOut)
def pipeline_detail(pipeline_id: str, db: Session = Depends(get_db)):
    return serialize(get_record(db, Pipeline, pipeline_id))


@router.patch("/{pipeline_id}", response_model=PipelineOut)
def update_pipeline(pipeline_id: str, body: PipelineUpdate, db: Session = Depends(get_db)):
    pipeline = get_record(db, Pipeline, pipeline_id)
    updates = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in updates.items():
        setattr(pipeline, key, value)
    if "definition" in updates:
        pipeline.version += 1
    db.commit()
    return serialize(pipeline)


@router.delete("/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: str, db: Session = Depends(get_db)):
    pipeline = get_record(db, Pipeline, pipeline_id)
    if db.scalar(
        select(PipelineRun.id).where(
            PipelineRun.pipeline_id == pipeline_id, PipelineRun.status.in_(["queued", "running"])
        )
    ):
        raise api_error(
            409, "RUN_IN_PROGRESS", "Wait for current runs to finish before deleting their pipeline."
        )
    db.delete(pipeline)
    db.commit()
    return Response(status_code=204)


@router.post("/{pipeline_id}/validate", response_model=ValidationOut)
def validate_pipeline(pipeline_id: str, db: Session = Depends(get_db)):
    pipeline = get_record(db, Pipeline, pipeline_id)
    return validate_definition(db, pipeline.definition, pipeline.project_id)


@router.post("/{pipeline_id}/runs", status_code=202, response_model=RunOut)
def start_run(pipeline_id: str, db: Session = Depends(get_db)):
    return run_detail(db, create_run(db, get_record(db, Pipeline, pipeline_id)))
