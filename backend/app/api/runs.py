import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.session import get_db
from app.models.entities import Pipeline, PipelineRun
from app.schemas.requests import RegisterRequest
from app.schemas.responses import ModelOut, RunOut
from app.services.common import get_record, list_records, serialize
from app.services.execution import create_run, run_detail
from app.services.registry import register_model

router = APIRouter(prefix="/runs", tags=["Experiments"])


@router.get("", response_model=list[RunOut])
def runs(project_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize(item) for item in list_records(db, PipelineRun, project_id)]


@router.get("/compare")
def compare_runs(ids: str = Query(...), primary_metric: str = "f1", db: Session = Depends(get_db)):
    selected = list(dict.fromkeys(ids.split(",")))
    if not 2 <= len(selected) <= 10:
        raise api_error(422, "INVALID_COMPARISON", "Select two to ten unique runs.")
    records = [get_record(db, PipelineRun, run_id) for run_id in selected]
    if len({run.project_id for run in records}) != 1:
        raise api_error(422, "PROJECT_MISMATCH", "Compare runs within the same project.")
    if len({run.model_type for run in records}) != 1 and len({run.pipeline_id for run in records}) != 1:
        raise api_error(422, "INCOMPATIBLE_RUNS", "Select runs of the same model algorithm or pipeline.")
    metric_names = sorted(
        {key for run in records for key, value in run.metrics.items() if isinstance(value, (int, float))}
    )
    baseline = records[0]
    return {
        "runs": [run_detail(db, item) for item in records],
        "metric_names": metric_names,
        "primary_metric": primary_metric,
        "baseline_run_id": baseline.id,
        "deltas": [
            {
                "run_id": run.id,
                "metrics": {
                    metric: run.metrics[metric] - baseline.metrics[metric]
                    for metric in metric_names
                    if isinstance(run.metrics.get(metric), (int, float))
                    and isinstance(baseline.metrics.get(metric), (int, float))
                    and math.isfinite(run.metrics[metric])
                    and math.isfinite(baseline.metrics[metric])
                },
            }
            for run in records
        ],
    }


@router.get("/{run_id}", response_model=RunOut)
def experiment_detail(run_id: str, db: Session = Depends(get_db)):
    return run_detail(db, get_record(db, PipelineRun, run_id))


@router.post("/{run_id}/rerun", status_code=202, response_model=RunOut)
def rerun(run_id: str, db: Session = Depends(get_db)):
    source = get_record(db, PipelineRun, run_id)
    if not source.pipeline_id:
        raise api_error(409, "PIPELINE_REMOVED", "The original pipeline was removed.")
    pipeline = get_record(db, Pipeline, source.pipeline_id)
    return run_detail(db, create_run(db, pipeline, source.definition, source_run=source))


@router.post("/{run_id}/register", status_code=201, response_model=ModelOut)
def register_run(run_id: str, body: RegisterRequest, db: Session = Depends(get_db)):
    return serialize(register_model(db, get_record(db, PipelineRun, run_id), body.name))
