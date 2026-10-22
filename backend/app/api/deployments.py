from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deployment.service import predict
from app.models.entities import Dataset, Deployment, RegisteredModel
from app.schemas.requests import DeploymentCreate, DeploymentUpdate, PredictionRequest
from app.schemas.responses import DeploymentOut
from app.services.common import get_record, list_records, serialize
from app.services.datasets import json_frame, read_dataset
from app.services.registry import deploy_model

router = APIRouter(prefix="/deployments", tags=["Deployments"])


def detail(session, deployment, include_example=False):
    model = get_record(session, RegisteredModel, deployment.model_id)
    example_rows = []
    if include_example and model.dataset_id:
        dataset = session.get(Dataset, model.dataset_id)
        if dataset:
            frame = (
                read_dataset(dataset)
                .head(1)
                .drop(columns=[dataset.target_column] if dataset.target_column else [])
            )
            example_rows = json_frame(frame)
    return {
        **serialize(deployment),
        "model": serialize(model),
        "model_name": model.name,
        "model_version": model.version,
        "algorithm": model.algorithm,
        "input_schema": model.input_schema,
        "example_rows": example_rows,
        "predict_url": f"/api/v1/deployments/{deployment.id}/predict",
    }


@router.get("", response_model=list[DeploymentOut])
def deployments(project_id: str | None = None, db: Session = Depends(get_db)):
    return [detail(db, item) for item in list_records(db, Deployment, project_id)]


@router.post("", status_code=201, response_model=DeploymentOut)
def create_deployment(body: DeploymentCreate, db: Session = Depends(get_db)):
    model = get_record(db, RegisteredModel, body.model_id)
    deployment = deploy_model(
        db, model, body.name, body.explanation_method, body.drift_threshold, body.degradation_threshold
    )
    return detail(db, deployment)


@router.get("/{deployment_id}", response_model=DeploymentOut)
def deployment_detail(deployment_id: str, db: Session = Depends(get_db)):
    return detail(db, get_record(db, Deployment, deployment_id), include_example=True)


@router.patch("/{deployment_id}", response_model=DeploymentOut)
def update_deployment(deployment_id: str, body: DeploymentUpdate, db: Session = Depends(get_db)):
    deployment = get_record(db, Deployment, deployment_id)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(deployment, key, value)
    db.commit()
    return detail(db, deployment)


@router.post("/{deployment_id}/predict")
def predict_deployment(deployment_id: str, body: PredictionRequest, db: Session = Depends(get_db)):
    return predict(db, get_record(db, Deployment, deployment_id), body.rows, body.explain, body.labels)
