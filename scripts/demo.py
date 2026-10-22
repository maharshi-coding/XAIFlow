"""Seed a running server with reproducible pipelines. Requires only Python's standard library."""

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4


def pipeline(dataset_id: str, algorithm: str, explainer: str, *, trees: int = 60, deploy: bool = False):
    stages = [
        ("dataset", {"dataset_id": dataset_id}),
        ("impute", {"strategy": "median"}),
        ("encode", {"method": "onehot"}),
        ("scale", {"method": "standard"}),
        ("split", {"test_size": 0.25, "random_state": 42, "stratify": True}),
        (
            algorithm,
            {"n_estimators": trees, "max_depth": 8, "random_state": 42}
            if algorithm == "random_forest"
            else {"epochs": 30, "hidden_dims": [24, 12], "random_state": 42}
            if algorithm == "pytorch"
            else {"C": 1.0, "max_iter": 500, "random_state": 42},
        ),
        ("evaluate", {}),
        (explainer, {"max_samples": 12} if explainer == "shap" else {"num_samples": 600}),
        ("register", {"name": f"churn-{algorithm}"}),
    ]
    if deploy:
        stages.append(("deploy", {"name": "churn-service", "explanation_method": "lime"}))
    nodes = [
        {
            "id": str(uuid4()),
            "type": kind,
            "label": kind.replace("_", " ").title(),
            "parameters": params,
            "position": {"x": 260 * (i % 5), "y": 180 * (i // 5)},
        }
        for i, (kind, params) in enumerate(stages)
    ]
    edges = [{"id": str(uuid4()), "source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])]
    return {"nodes": nodes, "edges": edges}


def request(base: str, path: str, data=None, method=None):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


def upload(base: str, project_id: str):
    boundary = f"xaiflow-{uuid4().hex}"
    body = bytearray()
    for name, value in [("project_id", project_id), ("target_column", "churn")]:
        body.extend(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    body.extend(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="demo_churn.csv"\r\nContent-Type: text/csv\r\n\r\n'.encode()
    )
    body.extend((Path(__file__).resolve().parents[1] / "data" / "demo_churn.csv").read_bytes())
    body.extend(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(
        base + "/datasets", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:8000/api/v1")
    parser.add_argument(
        "--run",
        action="store_true",
        help="Execute all three models and a second forest run; otherwise create editable pipelines only.",
    )
    args = parser.parse_args()
    project = request(
        args.base,
        "/projects",
        {
            "name": "Customer churn laboratory",
            "description": "Deterministic synthetic data for the complete XAIFlow workflow.",
        },
    )
    dataset = upload(args.base, project["id"])
    runs = []
    for algorithm, explainer in [
        ("logistic_regression", "lime"),
        ("random_forest", "shap"),
        ("pytorch", "lime"),
    ]:
        pipe = request(
            args.base,
            "/pipelines",
            {
                "project_id": project["id"],
                "name": f"Churn · {algorithm}",
                "definition": pipeline(
                    dataset["id"], algorithm, explainer, deploy=algorithm == "logistic_regression"
                ),
            },
        )
        if args.run:
            for attempt in range(2 if algorithm == "random_forest" else 1):
                if attempt:
                    pipe = request(
                        args.base,
                        f"/pipelines/{pipe['id']}",
                        {"definition": pipeline(dataset["id"], algorithm, explainer, trees=100)},
                        "PATCH",
                    )
                run = request(args.base, f"/pipelines/{pipe['id']}/runs", {})
                deadline = time.monotonic() + 300
                while run["status"] in ("queued", "running") and time.monotonic() < deadline:
                    time.sleep(0.5)
                    run = request(args.base, f"/runs/{run['id']}")
                if run["status"] != "completed":
                    raise RuntimeError(f"Workflow failed: {run.get('error', run)}")
                runs.append(run["id"])
                print(f"{algorithm}: {run['id']} · accuracy={run['metrics'].get('accuracy')}")
    print(json.dumps({"project_id": project["id"], "dataset_id": dataset["id"], "run_ids": runs}, indent=2))


if __name__ == "__main__":
    main()
