from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Response(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)


class RecordOut(Response):
    id: str
    created_at: datetime
    updated_at: datetime


class ProjectOut(RecordOut):
    name: str
    description: str
    status: str


class DatasetOut(RecordOut):
    project_id: str
    name: str
    target_column: str | None
    row_count: int
    column_count: int
    columns: list[dict[str, Any]]
    statistics: dict[str, Any]
    checksum: str
    preview: list[dict[str, Any]] | None = None


class PipelineOut(RecordOut):
    project_id: str
    name: str
    description: str
    definition: dict[str, Any]
    version: int


class RunOut(RecordOut):
    project_id: str
    pipeline_id: str | None
    dataset_id: str | None
    pipeline_name: str
    status: str
    definition: dict[str, Any]
    model_type: str | None
    parameters: dict[str, Any]
    metrics: dict[str, Any]
    explanations: list[dict[str, Any]]
    logs: list[dict[str, Any]]
    node_runs: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None
    duration: float | None


class ModelOut(RecordOut):
    project_id: str
    name: str
    version: int
    algorithm: str
    framework: str
    status: str
    run_id: str
    pipeline_id: str | None
    dataset_id: str | None
    metrics: dict[str, Any]
    parameters: dict[str, Any]
    preprocessing: list[Any]
    explanations: list[Any]
    input_schema: list[Any]


class DeploymentOut(RecordOut):
    project_id: str
    model_id: str
    name: str
    status: str
    explanation_method: str | None
    drift_threshold: float
    degradation_threshold: float


class AlertOut(RecordOut):
    project_id: str
    severity: str
    kind: str
    title: str
    message: str
    status: str
    details: dict[str, Any]
    description: str | None = None
    source: str | None = None
    metric: str | None = None
    threshold: float | None = None
    observed_value: float | None = None


class BackupOut(RecordOut):
    project_id: str
    name: str
    checksum: str
    size_bytes: int
    summary: dict[str, Any]


class ValidationOut(Response):
    valid: bool
    errors: list[dict[str, Any]]
    order: list[str] = Field(default_factory=list)
