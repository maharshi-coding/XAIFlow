"""Persistent incidents distinguish a new failure from an already active condition."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models.entities import Alert, PipelineRun
from app.services.common import serialize

REPEATED_FAILURE_THRESHOLD = 3


def alert_source(alert):
    return alert.details.get("source") or (
        f"deployment:{alert.deployment_id}"
        if alert.deployment_id
        else f"run:{alert.run_id}"
        if alert.run_id
        else f"project:{alert.project_id}"
    )


def upsert_incident(
    session,
    *,
    project_id,
    kind,
    source,
    title,
    message,
    severity="warning",
    details=None,
    run_id=None,
    deployment_id=None,
):
    candidates = session.scalars(
        select(Alert).where(
            Alert.project_id == project_id, Alert.kind == kind, Alert.status.in_(["open", "acknowledged"])
        )
    ).all()
    existing = next((alert for alert in candidates if alert_source(alert) == source), None)
    data = {**(details or {}), "source": source, "last_seen_at": datetime.now(timezone.utc).isoformat()}
    if existing:
        data["occurrences"] = existing.details.get("occurrences", 1) + 1
        if data.get("metric") in {"deployment_failures", "prediction_failures"}:
            data["observed_value"] = data["occurrences"]
        existing.details, existing.message = data, message
        existing.title, existing.severity = title[:180], severity
        existing.run_id = run_id or existing.run_id
        return existing
    alert = Alert(
        project_id=project_id,
        run_id=run_id,
        deployment_id=deployment_id,
        kind=kind,
        title=title[:180],
        message=message,
        severity=severity,
        details={**data, "occurrences": 1},
    )
    session.add(alert)
    return alert


def record_repeated_execution_error(session, run):
    if not run.pipeline_id:
        return
    history = session.scalars(
        select(PipelineRun)
        .where(
            PipelineRun.project_id == run.project_id,
            PipelineRun.pipeline_id == run.pipeline_id,
            PipelineRun.status.in_(["completed", "failed"]),
        )
        .order_by(PipelineRun.created_at.desc())
        .limit(100)
    ).all()
    failures = []
    for item in history:
        if item.status != "failed":
            break
        failures.append(item.id)
    if len(failures) >= REPEATED_FAILURE_THRESHOLD:
        upsert_incident(
            session,
            project_id=run.project_id,
            run_id=run.id,
            kind="repeated_execution_error",
            source=f"pipeline:{run.pipeline_id}",
            severity="critical",
            title=f"Repeated execution failures: {run.pipeline_name}",
            message=f"The pipeline has failed {len(failures)} consecutive executions. Latest error: {run.error}",
            details={
                "pipeline_id": run.pipeline_id,
                "metric": "consecutive_failures",
                "threshold": REPEATED_FAILURE_THRESHOLD,
                "observed_value": len(failures),
                "run_ids": failures,
                "latest_error": run.error,
            },
        )


def alert_payload(alert):
    details = alert.details or {}
    source = alert_source(alert)
    return {
        **serialize(alert),
        "description": alert.message,
        "source": source,
        "metric": details.get("metric"),
        "threshold": details.get("threshold"),
        "observed_value": details.get("observed_value"),
    }
