from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deployment.service import predict
from app.models.entities import Alert, Deployment
from app.monitoring.service import deployment_monitoring, simulation_rows
from app.schemas.requests import AlertUpdate, SimulateRequest
from app.schemas.responses import AlertOut
from app.services.common import get_record, list_records
from app.services.alerts import alert_payload

router = APIRouter(tags=["Monitoring and alerts"])


@router.get("/monitoring")
def monitoring(deployment_id: str, db: Session = Depends(get_db)):
    return deployment_monitoring(db, get_record(db, Deployment, deployment_id))


@router.post("/monitoring/{deployment_id}/simulate")
def simulate(deployment_id: str, body: SimulateRequest, db: Session = Depends(get_db)):
    deployment = get_record(db, Deployment, deployment_id)
    rows = simulation_rows(db, deployment, body.shift)
    response = predict(db, deployment, rows, use_default_explainer=False)
    return {
        "simulation": {"shift": body.shift, "row_count": len(rows), "request_id": response["request_id"]},
        **deployment_monitoring(db, deployment),
    }


@router.get("/alerts", response_model=list[AlertOut])
def alerts(project_id: str | None = None, db: Session = Depends(get_db)):
    return [alert_payload(item) for item in list_records(db, Alert, project_id)]


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: str, body: AlertUpdate, db: Session = Depends(get_db)):
    alert = get_record(db, Alert, alert_id)
    alert.status = body.status
    db.commit()
    return alert_payload(alert)
