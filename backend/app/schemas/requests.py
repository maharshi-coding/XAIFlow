from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProjectCreate(Request):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)


class ProjectUpdate(Request):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10000)
    status: Literal["active", "archived"] | None = None


class DatasetUpdate(Request):
    target_column: str = Field(min_length=1, max_length=255)


class PipelineNode(Request):
    id: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=80)
    label: str = Field(default="", max_length=160)
    parameters: dict[str, Any] = Field(default_factory=dict)
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})


class PipelineEdge(Request):
    id: str = Field(min_length=1, max_length=100)
    source: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=100)


class PipelineDefinition(Request):
    nodes: list[PipelineNode] = Field(max_length=100)
    edges: list[PipelineEdge] = Field(max_length=300)


class PipelineCreate(Request):
    project_id: str
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    definition: PipelineDefinition


class PipelineUpdate(Request):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10000)
    definition: PipelineDefinition | None = None


class RegisterRequest(Request):
    name: str = Field(min_length=1, max_length=160)


class ModelUpdate(Request):
    status: Literal["candidate", "approved", "production", "archived"]


class DeploymentCreate(Request):
    model_id: str
    name: str = Field(min_length=1, max_length=160)
    explanation_method: Literal["shap", "lime"] | None = None
    drift_threshold: float = Field(default=settings.drift_threshold, gt=0, le=5)
    degradation_threshold: float = Field(default=0.1, gt=0, le=1)


class DeploymentUpdate(Request):
    status: Literal["active", "inactive", "archived"] | None = None
    drift_threshold: float | None = Field(default=None, gt=0, le=5)
    degradation_threshold: float | None = Field(default=None, gt=0, le=1)


class PredictionRequest(Request):
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=1000)
    explain: Literal["shap", "lime"] | None = None
    labels: list[Any] | None = Field(default=None, max_length=1000)


class SimulateRequest(Request):
    shift: float = Field(default=2.5, ge=0, le=20)


class AlertUpdate(Request):
    status: Literal["open", "acknowledged", "resolved"]


class BackupCreate(Request):
    project_id: str
