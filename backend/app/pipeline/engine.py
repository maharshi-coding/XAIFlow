"""Reusable synchronous DAG worker, called by the background executor service."""

from pathlib import Path
import time
import joblib
from .validator import validate_pipeline
from .registry import node_parameters
from .context import ExecutionContext, ModelContext
from app.nodes.operations import NODE_IMPLEMENTATIONS, model_metadata, write_json


class PipelineExecutionError(ValueError):
    def __init__(self, message, node_id=None, errors=None):
        super().__init__(message)
        self.node_id = node_id
        self.errors = errors or []


def execute_pipeline(
    definition, dataset_resolver, artifact_dir, on_node, on_log, on_register=None, on_deploy=None
):
    validation = validate_pipeline(definition, dataset_resolver)
    if not validation["valid"]:
        raise PipelineExecutionError(
            "Pipeline validation failed: " + "; ".join(error["message"] for error in validation["errors"]),
            errors=validation["errors"],
        )
    artifact_root = Path(artifact_dir).resolve()
    artifact_root.mkdir(parents=True, exist_ok=True)
    context = ExecutionContext(artifact_root, dataset_resolver, on_log, on_register, on_deploy)
    by_id = {node["id"]: node for node in definition["nodes"]}
    parent = {edge["target"]: edge["source"] for edge in definition.get("edges", [])}
    outputs, models = {}, {}
    order = validation["order"]
    for node_id in order:
        on_node(node_id, "queued", {})
    for position, node_id in enumerate(order):
        definition_node = by_id[node_id]
        start = time.perf_counter()
        on_node(node_id, "running", {})
        on_log("info", f"Starting {definition_node.get('label') or definition_node['type']}", node_id)
        try:
            operation = NODE_IMPLEMENTATIONS[definition_node["type"]](
                definition_node, node_parameters(definition_node)
            )
            operation.validate()
            output = operation.execute(outputs.get(parent.get(node_id)), context)
            outputs[node_id] = output
            if isinstance(output, ModelContext):
                key = output.training_node_id
                current = models.get(key, {"metrics": {}, "explanations": []})
                # Branches preserve their own runtime contexts; aggregate lineage
                # merges only completed evaluation/explanation records by ID.
                explanations = {
                    item["node_id"]: item for item in [*current["explanations"], *output.explanations]
                }
                models[key] = {
                    "node_id": key,
                    "output": output,
                    "metrics": {**current["metrics"], **output.metrics},
                    "explanations": list(explanations.values()),
                }
            detail = {**operation.serialize_output(output), "duration": time.perf_counter() - start}
            on_node(node_id, "completed", detail)
            on_log("info", f"Completed {definition_node.get('label') or definition_node['type']}", node_id)
        except Exception as exc:
            detail = {"error": str(exc), "duration": time.perf_counter() - start}
            on_node(node_id, "failed", detail)
            on_log("error", str(exc), node_id)
            for remaining in order[position + 1 :]:
                on_node(remaining, "skipped", {"reason": f"Execution stopped after node {node_id} failed."})
            raise PipelineExecutionError(f"Node {node_id} failed: {exc}", node_id) from exc
    model_runs = []
    for item in models.values():
        output = item["output"]
        metadata = {
            **model_metadata(output),
            "metrics": item["metrics"],
            "explanations": item["explanations"],
            "explanation_methods": sorted({x["explainer"] for x in item["explanations"]}),
        }
        write_json(Path(output.bundle_path).with_name("metadata.json"), metadata)
        output.bundle["metadata"] = metadata
        joblib.dump(output.bundle, output.bundle_path)
        model_runs.append(
            {
                "node_id": item["node_id"],
                "model_type": output.bundle["model"].model_type,
                "hyperparameters": output.bundle["model"].parameters,
                "preprocessing": output.bundle["preprocessing"],
                "dataset_id": output.dataset_id,
                "model_artifact": output.bundle_path,
                "model_metadata": metadata,
                "baseline": output.bundle["baseline"],
                "metrics": item["metrics"],
                "explanations": item["explanations"],
                "training_history": output.bundle["model"].training_history,
                "training_duration": output.bundle["training_duration"],
            }
        )
    primary = model_runs[-1]
    return {
        **primary,
        "model_runs": model_runs,
        "artifacts": context.artifacts,
        "registrations": context.registrations,
        "deployments": context.deployments,
        "registration": context.registrations[-1] if context.registrations else None,
        "deployment": context.deployments[-1] if context.deployments else None,
    }
