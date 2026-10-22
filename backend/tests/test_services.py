"""Recovery, integrity, degradation and snapshot tests use real persisted flows."""

import hashlib
import io
import json
import time
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException
import pytest


def graph(dataset_id, *, encode=True, trees=10):
    stages = [("dataset", {"dataset_id": dataset_id}), ("impute", {"strategy": "median"})]
    if encode:
        stages.append(("encode", {"method": "onehot"}))
    stages += [
        ("split", {"test_size": 0.25}),
        ("random_forest", {"n_estimators": trees, "max_depth": 5}),
        ("evaluate", {}),
        ("register", {"name": "service-check"}),
    ]
    nodes = [
        {"id": str(uuid4()), "type": kind, "label": kind, "parameters": params} for kind, params in stages
    ]
    return {
        "nodes": nodes,
        "edges": [
            {"id": str(uuid4()), "source": left["id"], "target": right["id"]}
            for left, right in zip(nodes, nodes[1:])
        ],
    }


def save_pipeline(client, project_id, definition):
    response = client.post(
        "/api/v1/pipelines",
        json={"project_id": project_id, "name": "Service verification", "definition": definition},
    )
    assert response.status_code == 201, response.text
    return response.json()


def wait_run(client, run):
    deadline = time.monotonic() + 30
    while run["status"] in {"queued", "running"} and time.monotonic() < deadline:
        time.sleep(0.02)
        run = client.get(f"/api/v1/runs/{run['id']}").json()
    assert run["status"] not in {"queued", "running"}, run
    return run


def execute(client, pipeline_id):
    response = client.post(f"/api/v1/pipelines/{pipeline_id}/runs")
    assert response.status_code == 202, response.text
    return wait_run(client, response.json())


def test_failed_execution_persists_node_states_and_alert(client, project, dataset):
    pipeline = save_pipeline(client, project["id"], graph(dataset["id"], encode=False))
    assert client.post(f"/api/v1/pipelines/{pipeline['id']}/validate").json()["valid"]
    run = execute(client, pipeline["id"])
    assert run["status"] == "failed" and run["error"]
    statuses = {node["node_type"]: node["status"] for node in run["node_runs"]}
    assert statuses["random_forest"] == "failed"
    assert statuses["evaluate"] == statuses["register"] == "skipped"
    assert any(log["level"] == "error" for log in run["logs"])
    alerts = client.get(f"/api/v1/alerts?project_id={project['id']}").json()
    assert any(alert["kind"] == "pipeline_failure" and alert["run_id"] == run["id"] for alert in alerts)


def test_wrong_observed_labels_trigger_degradation(client, project, dataset):
    pipeline = save_pipeline(client, project["id"], graph(dataset["id"]))
    assert execute(client, pipeline["id"])["status"] == "completed"
    model = client.get(f"/api/v1/models?project_id={project['id']}").json()[0]
    deployment = client.post(
        "/api/v1/deployments", json={"model_id": model["id"], "name": "Degradation check"}
    ).json()
    rows = [{key: value for key, value in row.items() if key != "churn"} for row in dataset["preview"]]
    response = client.post(f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": rows})
    assert response.status_code == 200, response.text
    wrong = [1 - int(item["prediction"]) for item in response.json()["predictions"]]
    response = client.post(
        f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": rows, "labels": wrong}
    )
    assert response.status_code == 200, response.text
    monitoring = client.get(f"/api/v1/monitoring?deployment_id={deployment['id']}").json()
    assert monitoring["accuracy"] == 0 and monitoring["degradation"] > deployment["degradation_threshold"]
    assert any(alert["kind"] == "model_degradation" for alert in monitoring["alerts"])
    explained = client.post(
        "/api/v1/deployments",
        json={"model_id": model["id"], "name": "Explained service", "explanation_method": "lime"},
    ).json()
    simulation = client.post(f"/api/v1/monitoring/{explained['id']}/simulate", json={"shift": 4})
    assert simulation.status_code == 200, simulation.text
    assert simulation.json()["drift_score"] > explained["drift_threshold"]


@pytest.mark.parametrize("tamper", ["manifest", "artifact"])
def test_signed_backup_rejects_manifest_and_artifact_tampering(client, project, dataset, tamper):
    backup = client.post("/api/v1/backups", json={"project_id": project["id"]}).json()
    content = client.get(f"/api/v1/backups/{backup['id']}/download").content
    output = io.BytesIO()
    with ZipFile(io.BytesIO(content)) as source, ZipFile(output, "w", ZIP_DEFLATED) as target:
        artifact_name = next(name for name in source.namelist() if name.startswith("files/"))
        for name in source.namelist():
            data = source.read(name)
            if tamper == "manifest" and name == "manifest.json":
                manifest = json.loads(data)
                manifest["tables"]["projects"][0]["name"] = "Unauthorized replacement"
                data = json.dumps(manifest).encode()
            elif tamper == "artifact" and name == artifact_name:
                data += b"\ncorruption"
            target.writestr(name, data)
    before = len(client.get("/api/v1/projects").json())
    response = client.post(
        "/api/v1/backups/restore", files={"file": ("tampered.zip", output.getvalue(), "application/zip")}
    )
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == "INVALID_BACKUP"
    assert len(client.get("/api/v1/projects").json()) == before


def test_artifact_paths_and_checksum_are_enforced(client, project):
    from app.artifacts.storage import storage
    from app.db.session import SessionLocal
    from app.models.entities import Artifact

    with pytest.raises(HTTPException) as unsafe:
        storage.resolve("../escape.json")
    assert unsafe.value.status_code == 400
    content = b'{"verified":true}'
    key = f"projects/{project['id']}/reports/verified.json"
    storage.put(key, content)
    with SessionLocal() as session:
        artifact = Artifact(
            project_id=project["id"],
            kind="report",
            name="verified.json",
            path=key,
            checksum=hashlib.sha256(content).hexdigest(),
            size_bytes=len(content),
        )
        session.add(artifact)
        session.commit()
        artifact_id = artifact.id
    url = f"/api/v1/artifacts/{artifact_id}/download"
    assert client.get(url).content == content
    storage.put(key, b"corrupted")
    response = client.get(url)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "ARTIFACT_CORRUPTED"


def test_rerun_uses_original_graph_and_version_snapshot(client, project, dataset):
    original = graph(dataset["id"], trees=5)
    pipeline = save_pipeline(client, project["id"], original)
    first = execute(client, pipeline["id"])
    assert first["status"] == "completed"
    changed = client.patch(
        f"/api/v1/pipelines/{pipeline['id']}",
        json={"definition": graph(dataset["id"], trees=17), "name": "Edited pipeline"},
    )
    assert changed.json()["version"] == 2
    response = client.post(f"/api/v1/runs/{first['id']}/rerun")
    assert response.status_code == 202, response.text
    repeated = wait_run(client, response.json())
    assert repeated["status"] == "completed" and repeated["id"] != first["id"]
    assert repeated["definition"] == first["definition"]
    assert repeated["parameters"]["n_estimators"] == 5
    assert repeated["pipeline_version"] == first["pipeline_version"] == 1
    assert repeated["pipeline_name"] == first["pipeline_name"]


def test_dataset_target_pipeline_edit_and_safe_delete(client, project, dataset):
    response = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"target_column": "contract"})
    assert response.status_code == 200 and response.json()["target_column"] == "contract"
    restored = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"target_column": "churn"})
    assert restored.status_code == 200
    pipeline = save_pipeline(client, project["id"], graph(dataset["id"]))
    changed = client.patch(
        f"/api/v1/pipelines/{pipeline['id']}",
        json={"name": "Edited service pipeline", "description": "Update verified"},
    )
    assert changed.status_code == 200 and changed.json()["name"] == "Edited service pipeline"
    assert client.delete(f"/api/v1/datasets/{dataset['id']}").status_code == 409
    assert client.delete(f"/api/v1/pipelines/{pipeline['id']}").status_code == 204
    assert client.get(f"/api/v1/pipelines/{pipeline['id']}").status_code == 404
    assert client.delete(f"/api/v1/datasets/{dataset['id']}").status_code == 204
    assert client.get(f"/api/v1/datasets/{dataset['id']}").status_code == 404


def test_multiple_model_branches_preserve_all_explanations(client, project, dataset):
    definition = graph(dataset["id"])
    split_index = next(index for index, node in enumerate(definition["nodes"]) if node["type"] == "split")
    definition["nodes"] = definition["nodes"][: split_index + 1]
    definition["edges"] = definition["edges"][:split_index]
    parent = definition["nodes"][-1]["id"]
    for model_type, explainer in [("random_forest", "shap"), ("logistic_regression", "lime")]:
        stages = [
            (model_type, {"n_estimators": 10} if model_type == "random_forest" else {"max_iter": 500}),
            ("evaluate", {}),
            (explainer, {"max_samples": 5} if explainer == "shap" else {"num_samples": 100}),
            ("register", {"name": f"branch-{model_type}"}),
        ]
        branch_parent = parent
        for kind, parameters in stages:
            node_id = str(uuid4())
            definition["nodes"].append({"id": node_id, "type": kind, "label": kind, "parameters": parameters})
            definition["edges"].append({"id": str(uuid4()), "source": branch_parent, "target": node_id})
            branch_parent = node_id
    pipeline = save_pipeline(client, project["id"], definition)
    run = execute(client, pipeline["id"])
    assert run["status"] == "completed", run["error"]
    assert {item["explainer"] for item in run["explanations"]} == {"shap", "lime"}
    assert len(run["explanations"]) == len(run["result"]["model_runs"]) == 2
    assert len(client.get(f"/api/v1/models?project_id={project['id']}").json()) == 2
    from app.db.session import SessionLocal
    from app.models.entities import Explanation
    from sqlalchemy import func, select

    with SessionLocal() as session:
        assert (
            session.scalar(
                select(func.count()).select_from(Explanation).where(Explanation.run_id == run["id"])
            )
            == 2
        )


def test_project_delete_removes_owned_files_and_retains_unrelated_files(client, project, dataset):
    from app.artifacts.storage import storage

    unrelated = client.post("/api/v1/projects", json={"name": "Retained project"}).json()
    unrelated_key = f"projects/{unrelated['id']}/reports/retain.json"
    unrelated_path = storage.put(unrelated_key, b'{"retained":true}')
    backup = client.post("/api/v1/backups", json={"project_id": project["id"]}).json()
    backup_path = storage.resolve(f"backups/{backup['id']}.zip")
    project_path = storage.resolve(f"projects/{project['id']}")
    assert project_path.exists() and backup_path.exists()
    try:
        assert client.delete(f"/api/v1/projects/{project['id']}").status_code == 204
        assert not project_path.exists() and not backup_path.exists()
        assert unrelated_path.read_bytes() == b'{"retained":true}'
        assert client.get(f"/api/v1/projects/{unrelated['id']}").status_code == 200
    finally:
        client.delete(f"/api/v1/projects/{unrelated['id']}")


@pytest.mark.parametrize("password", ["p@ss/w:rd?#%$", "spaces and ünicode"])
def test_postgres_component_credentials_roundtrip_reserved_characters(password):
    from app.core.config import database_url_from_environment
    from sqlalchemy.engine import make_url

    values = {
        "POSTGRES_HOST": "db",
        "POSTGRES_PORT": "55432",
        "POSTGRES_USER": "user@name",
        "POSTGRES_PASSWORD": password,
        "POSTGRES_DB": "xaiflow",
    }
    parsed = make_url(database_url_from_environment(values))
    assert parsed.drivername == "postgresql+psycopg"
    assert parsed.username == values["POSTGRES_USER"] and parsed.password == password
    assert parsed.host == "db" and parsed.port == 55432 and parsed.database == "xaiflow"


def test_explicit_database_url_takes_precedence_and_sqlite_is_local_default():
    from app.core.config import database_url_from_environment

    explicit = "sqlite:////tmp/explicit.db"
    assert database_url_from_environment({"DATABASE_URL": explicit, "POSTGRES_HOST": "db"}) == explicit
    assert database_url_from_environment({}) == "sqlite:///./xaiflow.db"


@pytest.mark.parametrize("offset", [None, 0, -5])
def test_node_duration_preserves_postgres_timezone_offsets(offset):
    from datetime import datetime, timedelta, timezone
    from app.services.execution import node_duration_seconds

    finished = datetime(2026, 10, 6, 19, 30, 0, 500000, tzinfo=timezone.utc)
    started = datetime(2026, 10, 6, 19, 30, tzinfo=timezone.utc)
    started = (
        started.replace(tzinfo=None)
        if offset is None
        else started.astimezone(timezone(timedelta(hours=offset)))
    )
    assert node_duration_seconds(started, finished) == 0.5


def test_repeated_execution_failures_create_one_active_incident(client, project, dataset):
    pipeline = save_pipeline(client, project["id"], graph(dataset["id"], encode=False))
    for _ in range(2):
        assert execute(client, pipeline["id"])["status"] == "failed"
    alerts_url = f"/api/v1/alerts?project_id={project['id']}"
    assert not any(alert["kind"] == "repeated_execution_error" for alert in client.get(alerts_url).json())
    assert execute(client, pipeline["id"])["status"] == "failed"
    repeated = [
        alert for alert in client.get(alerts_url).json() if alert["kind"] == "repeated_execution_error"
    ]
    assert len(repeated) == 1
    incident = repeated[0]
    assert incident["severity"] == "critical" and incident["source"] == f"pipeline:{pipeline['id']}"
    assert (
        incident["metric"] == "consecutive_failures"
        and incident["threshold"] == incident["observed_value"] == 3
    )
    assert (
        client.patch(f"/api/v1/alerts/{incident['id']}", json={"status": "acknowledged"}).status_code == 200
    )
    assert execute(client, pipeline["id"])["status"] == "failed"
    repeated = [
        alert for alert in client.get(alerts_url).json() if alert["kind"] == "repeated_execution_error"
    ]
    assert len(repeated) == 1 and repeated[0]["id"] == incident["id"]
    assert repeated[0]["status"] == "acknowledged" and repeated[0]["observed_value"] == 4
    assert len(repeated[0]["details"]["run_ids"]) == 4


@pytest.mark.parametrize("damage", ["missing", "checksum"])
def test_deployment_failures_are_alerted_without_deployment_or_duplicates(client, project, dataset, damage):
    from app.artifacts.storage import storage

    pipeline = save_pipeline(client, project["id"], graph(dataset["id"]))
    assert execute(client, pipeline["id"])["status"] == "completed"
    model = client.get(f"/api/v1/models?project_id={project['id']}").json()[0]
    path = storage.resolve(model["artifact_path"])
    if damage == "missing":
        path.unlink()
    else:
        path.write_bytes(path.read_bytes() + b"corrupted")
    response = client.post("/api/v1/deployments", json={"model_id": model["id"], "name": "Must not deploy"})
    assert response.status_code == 409, response.text
    incidents = [
        alert
        for alert in client.get(f"/api/v1/alerts?project_id={project['id']}").json()
        if alert["kind"] == "deployment_failure"
    ]
    assert len(incidents) == 1 and incidents[0]["details"]["model_id"] == model["id"]
    incident = incidents[0]
    client.patch(f"/api/v1/alerts/{incident['id']}", json={"status": "acknowledged"})
    assert (
        client.post("/api/v1/deployments", json={"model_id": model["id"], "name": "Retry"}).status_code == 409
    )
    assert client.get(f"/api/v1/deployments?project_id={project['id']}").json() == []
    incidents = [
        alert
        for alert in client.get(f"/api/v1/alerts?project_id={project['id']}").json()
        if alert["kind"] == "deployment_failure"
    ]
    assert len(incidents) == 1 and incidents[0]["id"] == incident["id"]
    assert incidents[0]["status"] == "acknowledged" and incidents[0]["observed_value"] == 2


def test_used_dataset_target_is_locked_for_reruns_and_monitoring(client, project, dataset):
    pipeline = save_pipeline(client, project["id"], graph(dataset["id"]))
    first = execute(client, pipeline["id"])
    assert first["status"] == "completed"
    response = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"target_column": "contract"})
    assert response.status_code == 409 and response.json()["detail"]["code"] == "TARGET_LOCKED"
    assert (
        client.patch(f"/api/v1/datasets/{dataset['id']}", json={"target_column": "churn"}).status_code == 200
    )
    assert client.get(f"/api/v1/datasets/{dataset['id']}").json()["target_column"] == "churn"
    repeated = wait_run(client, client.post(f"/api/v1/runs/{first['id']}/rerun").json())
    assert repeated["status"] == "completed" and repeated["metrics"]["classes"] == first["metrics"]["classes"]
    model = client.get(f"/api/v1/models?project_id={project['id']}").json()[0]
    deployment = client.post(
        "/api/v1/deployments", json={"model_id": model["id"], "name": "Target lineage"}
    ).json()
    rows = [{name: value for name, value in row.items() if name != "churn"} for row in dataset["preview"]]
    assert (
        client.post(f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": rows}).status_code == 200
    )
    monitoring = client.get(f"/api/v1/monitoring?deployment_id={deployment['id']}").json()
    assert {item["feature"] for item in monitoring["features"]} == set(rows[0])
    assert "contract" in rows[0] and "churn" not in rows[0]


def test_monitoring_failure_preserves_request_log_and_prediction_incident(
    client, project, dataset, monkeypatch
):
    from sqlalchemy import select
    from app.core.errors import api_error
    from app.db.session import SessionLocal
    from app.models.entities import PredictionLog
    from app.deployment import service

    pipeline = save_pipeline(client, project["id"], graph(dataset["id"]))
    assert execute(client, pipeline["id"])["status"] == "completed"
    model = client.get(f"/api/v1/models?project_id={project['id']}").json()[0]
    deployment = client.post(
        "/api/v1/deployments", json={"model_id": model["id"], "name": "Failure accounting"}
    ).json()

    def fail_monitoring(*args, **kwargs):
        raise api_error(409, "ARTIFACT_CORRUPTED", "Monitoring reference is corrupted.")

    monkeypatch.setattr(service, "deployment_monitoring", fail_monitoring)
    row = {name: value for name, value in dataset["preview"][1].items() if name != "churn"}
    response = client.post(f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": [row]})
    assert response.status_code == 409 and response.json()["detail"]["code"] == "ARTIFACT_CORRUPTED"
    with SessionLocal() as session:
        logs = session.scalars(
            select(PredictionLog).where(PredictionLog.deployment_id == deployment["id"])
        ).all()
        assert len(logs) == 1 and logs[0].error and len(logs[0].predictions) == 1
    incidents = [
        alert
        for alert in client.get(f"/api/v1/alerts?project_id={project['id']}").json()
        if alert["kind"] == "prediction_failure"
    ]
    assert len(incidents) == 1 and incidents[0]["source"] == f"deployment:{deployment['id']}"
