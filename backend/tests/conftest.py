"""Integration tests use an isolated migrated database and real temporary artifacts."""

import os
import shutil
import tempfile
from pathlib import Path

import pytest

TEST_ROOT = Path(tempfile.mkdtemp(prefix="xaiflow-tests-"))
os.environ["DATABASE_URL"] = os.getenv("XAI_TEST_DATABASE_URL", f"sqlite:///{TEST_ROOT / 'test.db'}")
os.environ["ARTIFACT_ROOT"] = str(TEST_ROOT / "artifacts")
os.environ["AUTO_MIGRATE"] = "true"
os.environ["MPLCONFIGDIR"] = str(TEST_ROOT / "matplotlib")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
    shutil.rmtree(TEST_ROOT, ignore_errors=True)


@pytest.fixture
def project(client):
    response = client.post(
        "/api/v1/projects", json={"name": "Integration laboratory", "description": "Isolated verification"}
    )
    assert response.status_code == 201, response.text
    record = response.json()
    yield record
    client.delete(f"/api/v1/projects/{record['id']}")


@pytest.fixture
def dataset(client, project):
    content = (Path(__file__).resolve().parents[2] / "data" / "demo_churn.csv").read_bytes()
    response = client.post(
        "/api/v1/datasets",
        data={"project_id": project["id"], "target_column": "churn"},
        files={"file": ("churn.csv", content, "text/csv")},
    )
    assert response.status_code == 201, response.text
    return response.json()
