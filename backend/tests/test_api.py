import io
import time
import zipfile
from uuid import uuid4

import pytest


def definition(dataset_id, algorithm="random_forest", explainer="shap", *, trees=25, deploy=False):
    stages = [
        ("dataset", {"dataset_id": dataset_id}),
        ("impute", {"strategy": "median"}),
        ("encode", {"method": "onehot"}),
        ("scale", {"method": "standard"}),
        ("split", {"test_size": 0.25, "random_state": 42, "stratify": True}),
        (
            algorithm,
            {"n_estimators": trees, "max_depth": 5}
            if algorithm == "random_forest"
            else {"epochs": 8, "hidden_dims": [12], "batch_size": 32}
            if algorithm == "pytorch"
            else {"max_iter": 300},
        ),
        ("evaluate", {}),
        (explainer, {"max_samples": 6} if explainer == "shap" else {"num_samples": 300}),
        ("register", {"name": f"churn-{algorithm}"}),
    ]
    if deploy:
        stages.append(("deploy", {"name": "integration-service", "explanation_method": "lime"}))
    nodes = [
        {
            "id": str(uuid4()),
            "type": kind,
            "label": kind,
            "parameters": params,
            "position": {"x": i * 250, "y": 0},
        }
        for i, (kind, params) in enumerate(stages)
    ]
    return {
        "nodes": nodes,
        "edges": [
            {"id": str(uuid4()), "source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])
        ],
    }


def create_pipeline(client, project_id, graph):
    response = client.post(
        "/api/v1/pipelines", json={"project_id": project_id, "name": "Test pipeline", "definition": graph}
    )
    assert response.status_code == 201, response.text
    return response.json()


def execute(client, pipeline_id):
    response = client.post(f"/api/v1/pipelines/{pipeline_id}/runs", json={})
    assert response.status_code in (201, 202), response.text
    run = response.json()
    deadline = time.monotonic() + 120
    while run["status"] in {"queued", "running"} and time.monotonic() < deadline:
        time.sleep(0.03)
        response = client.get(f"/api/v1/runs/{run['id']}")
        assert response.status_code == 200, response.text
        run = response.json()
    assert run["status"] == "completed", run.get("error", run)
    return run


def test_project_and_dataset_crud(client, project, dataset):
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/health").status_code == 200
    assert len(client.get("/api/v1/nodes").json()) == 14
    changed = client.patch(
        f"/api/v1/projects/{project['id']}", json={"name": "Updated project", "status": "archived"}
    )
    assert changed.status_code == 200
    assert changed.json()["status"] == "archived"
    detail = client.get(f"/api/v1/datasets/{dataset['id']}").json()
    assert detail["row_count"] == 320 and detail["column_count"] == 6
    assert detail["statistics"]["missing_values"] > 0
    assert len(detail["preview"]) > 0
    assert set(detail["statistics"]["class_distribution"]) == {"0", "1"}
    assert (
        client.patch(f"/api/v1/datasets/{dataset['id']}", json={"target_column": "missing"}).status_code
        == 422
    )
    assert client.get(f"/api/v1/overview?project_id={project['id']}").status_code == 200


@pytest.mark.parametrize("content", [b"", b"a,a\n1,2\n", b"a,b\n", b"\xff\xfeinvalid"])
def test_invalid_csv_rejected(client, project, content):
    response = client.post(
        "/api/v1/datasets",
        data={"project_id": project["id"]},
        files={"file": ("invalid.csv", content, "text/csv")},
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize(
    "algorithm,explainer", [("logistic_regression", "lime"), ("random_forest", "shap"), ("pytorch", "lime")]
)
def test_three_real_workflows(client, project, dataset, algorithm, explainer):
    pipe = create_pipeline(
        client,
        project["id"],
        definition(dataset["id"], algorithm, explainer, deploy=algorithm == "logistic_regression"),
    )
    validation = client.post(f"/api/v1/pipelines/{pipe['id']}/validate").json()
    assert validation["valid"], validation
    run = execute(client, pipe["id"])
    assert all(node["status"] == "completed" for node in run["node_runs"])
    assert all(0 <= node["duration"] < run["duration"] + 1 for node in run["node_runs"])
    assert run["logs"] and run["artifacts"]
    assert run["model_type"] == algorithm
    for metric in ["accuracy", "precision", "recall", "f1", "roc_auc"]:
        assert 0 <= run["metrics"][metric] <= 1
    assert len(run["metrics"]["confusion_matrix"]) == 2
    explanations = run["explanations"]
    assert explanations and explanations[0]["explainer"] == explainer
    assert explanations[0]["feature_contributions"]
    if explainer == "shap":
        assert explanations[0]["global_importance"]
    models = client.get(f"/api/v1/models?project_id={project['id']}").json()
    assert len(models) == 1 and models[0]["version"] == 1
    model = models[0]
    assert model["framework"] == ("pytorch" if algorithm == "pytorch" else "scikit-learn")
    deployment_response = client.post(
        "/api/v1/deployments",
        json={"name": "Test inference", "model_id": model["id"], "explanation_method": explainer},
    )
    assert deployment_response.status_code == 201, deployment_response.text
    deployment = deployment_response.json()
    row = {k: v for k, v in dataset["preview"][1].items() if k != "churn"}
    response = client.post(
        f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": [row], "explain": explainer}
    )
    assert response.status_code == 200, response.text
    prediction = response.json()
    assert prediction["predictions"]
    assert prediction.get("explanations") or prediction["predictions"][0].get("explanation")
    assert (
        client.post(
            f"/api/v1/deployments/{deployment['id']}/predict", json={"rows": [{"unknown": 10}]}
        ).status_code
        == 422
    )
    assert client.patch(f"/api/v1/models/{model['id']}", json={"status": "production"}).status_code == 200
    assert client.get(f"/api/v1/models/{model['id']}").json()["run_id"] == run["id"]
    assert client.get(f"/api/v1/deployments/{deployment['id']}").status_code == 200


def test_run_comparison_monitoring_and_restore(client, project, dataset):
    pipe = create_pipeline(client, project["id"], definition(dataset["id"], trees=15))
    first = execute(client, pipe["id"])
    updated = client.patch(
        f"/api/v1/pipelines/{pipe['id']}", json={"definition": definition(dataset["id"], trees=35)}
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] == 2
    second = execute(client, pipe["id"])
    assert first["id"] != second["id"]
    assert first["parameters"] != second["parameters"]
    compared = client.get(f"/api/v1/runs/compare?ids={first['id']},{second['id']}")
    assert compared.status_code == 200, compared.text
    models = client.get(f"/api/v1/models?project_id={project['id']}").json()
    assert sorted(m["version"] for m in models) == [1, 2]
    deployment = client.post(
        "/api/v1/deployments", json={"model_id": models[0]["id"], "name": "Monitored forest"}
    ).json()
    simulated = client.post(f"/api/v1/monitoring/{deployment['id']}/simulate", json={"shift": 4})
    assert simulated.status_code == 200, simulated.text
    monitoring = client.get(f"/api/v1/monitoring?deployment_id={deployment['id']}")
    assert monitoring.status_code == 200, monitoring.text
    alerts = client.get(f"/api/v1/alerts?project_id={project['id']}").json()
    assert any(alert["kind"] == "data_drift" for alert in alerts), alerts
    assert (
        client.patch(f"/api/v1/alerts/{alerts[0]['id']}", json={"status": "acknowledged"}).status_code == 200
    )
    unrelated = client.post("/api/v1/projects", json={"name": "Unrelated project"}).json()
    try:
        backup_response = client.post("/api/v1/backups", json={"project_id": project["id"]})
        assert backup_response.status_code == 201, backup_response.text
        backup = backup_response.json()
        package = client.get(f"/api/v1/backups/{backup['id']}/download")
        assert package.status_code == 200 and package.content[:2] == b"PK"
        restored_response = client.post(
            "/api/v1/backups/restore", files={"file": ("backup.zip", package.content, "application/zip")}
        )
        assert restored_response.status_code == 201, restored_response.text
        restored = restored_response.json()
        restored_id = restored.get("project_id", restored.get("id"))
        assert restored_id != project["id"]
        try:
            restored_runs = client.get(f"/api/v1/runs?project_id={restored_id}").json()
            restored_models = client.get(f"/api/v1/models?project_id={restored_id}").json()
            restored_pipes = client.get(f"/api/v1/pipelines?project_id={restored_id}").json()
            assert len(restored_runs) == 2 and len(restored_models) == 2 and len(restored_pipes) == 1
            assert all(item["project_id"] == restored_id for item in restored_runs + restored_models)
            restored_deployments = client.get(f"/api/v1/deployments?project_id={restored_id}").json()
            row = {k: v for k, v in dataset["preview"][1].items() if k != "churn"}
            prediction = client.post(
                f"/api/v1/deployments/{restored_deployments[0]['id']}/predict", json={"rows": [row]}
            )
            assert prediction.status_code == 200, prediction.text
            # Restored dataset references must be remapped and executable.
            assert client.post(f"/api/v1/pipelines/{restored_pipes[0]['id']}/validate").json()["valid"]
            assert client.get(f"/api/v1/projects/{unrelated['id']}").status_code == 200
        finally:
            client.delete(f"/api/v1/projects/{restored_id}")
    finally:
        client.delete(f"/api/v1/projects/{unrelated['id']}")


def test_corrupted_and_unsafe_backups_rejected(client):
    invalid = client.post(
        "/api/v1/backups/restore", files={"file": ("invalid.zip", b"bad bytes", "application/zip")}
    )
    assert invalid.status_code == 422
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("../escape", "bad")
    unsafe = client.post(
        "/api/v1/backups/restore", files={"file": ("unsafe.zip", buffer.getvalue(), "application/zip")}
    )
    assert unsafe.status_code == 422


def test_cross_project_dataset_is_rejected(client, project, dataset):
    other = client.post("/api/v1/projects", json={"name": "Separate project"}).json()
    try:
        pipe = create_pipeline(client, other["id"], definition(dataset["id"]))
        validation = client.post(f"/api/v1/pipelines/{pipe['id']}/validate")
        assert validation.status_code >= 400 or not validation.json()["valid"]
        assert client.post(f"/api/v1/pipelines/{pipe['id']}/runs", json={}).status_code >= 400
    finally:
        client.delete(f"/api/v1/projects/{other['id']}")
