"""Application metadata. Large fitted models and data live in artifact storage."""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Project(Record, Base):
    __tablename__ = "projects"
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)


class ProjectRecord(Record):
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)


class Dataset(ProjectRecord, Base):
    __tablename__ = "datasets"
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64))
    target_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    row_count: Mapped[int] = mapped_column(Integer)
    column_count: Mapped[int] = mapped_column(Integer)
    columns: Mapped[list] = mapped_column(JSON, default=list)
    statistics: Mapped[dict] = mapped_column(JSON, default=dict)


class Pipeline(ProjectRecord, Base):
    __tablename__ = "pipelines"
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    definition: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class PipelineRun(ProjectRecord, Base):
    __tablename__ = "pipeline_runs"
    pipeline_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipelines.id", ondelete="SET NULL"), index=True, nullable=True
    )
    dataset_id: Mapped[str | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), index=True, nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    definition: Mapped[dict] = mapped_column(JSON)
    pipeline_name: Mapped[str] = mapped_column(String(160), default="")
    pipeline_version: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration: Mapped[float | None] = mapped_column(nullable=True)
    model_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    preprocessing: Mapped[list] = mapped_column(JSON, default=list)
    environment: Mapped[dict] = mapped_column(JSON, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    explanations: Mapped[list] = mapped_column(JSON, default=list)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    logs: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class NodeRun(Record, Base):
    __tablename__ = "node_runs"
    __table_args__ = (UniqueConstraint("run_id", "node_id", name="uq_node_run"),)
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True)
    node_id: Mapped[str] = mapped_column(String(100))
    node_type: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(160), default="")
    status: Mapped[str] = mapped_column(String(20), default="queued")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration: Mapped[float | None] = mapped_column(nullable=True)
    logs: Mapped[list] = mapped_column(JSON, default=list)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class Metric(Record, Base):
    __tablename__ = "metrics"
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    value: Mapped[dict | float | list] = mapped_column(JSON)


class Artifact(ProjectRecord, Base):
    __tablename__ = "artifacts"
    run_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True, nullable=True
    )
    kind: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)


class Explanation(ProjectRecord, Base):
    __tablename__ = "explanations"
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True)
    method: Mapped[str] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSON)
    artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("artifacts.id", ondelete="SET NULL"), nullable=True, index=True
    )


class RegisteredModel(ProjectRecord, Base):
    __tablename__ = "models"
    __table_args__ = (UniqueConstraint("project_id", "name", "version", name="uq_model_version"),)
    name: Mapped[str] = mapped_column(String(160))
    version: Mapped[int] = mapped_column(Integer)
    algorithm: Mapped[str] = mapped_column(String(80))
    framework: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="candidate")
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True)
    pipeline_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipelines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    dataset_id: Mapped[str | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    artifact_path: Mapped[str] = mapped_column(Text)
    metrics: Mapped[dict] = mapped_column(JSON)
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    preprocessing: Mapped[list] = mapped_column(JSON, default=list)
    explanations: Mapped[list] = mapped_column(JSON, default=list)
    baseline: Mapped[dict] = mapped_column(JSON, default=dict)
    input_schema: Mapped[list] = mapped_column(JSON, default=list)


class ModelVersion(Record, Base):
    __tablename__ = "model_versions"
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class Deployment(ProjectRecord, Base):
    __tablename__ = "deployments"
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="active")
    explanation_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    drift_threshold: Mapped[float] = mapped_column(default=0.2)
    degradation_threshold: Mapped[float] = mapped_column(default=0.1)


class PredictionLog(ProjectRecord, Base):
    __tablename__ = "prediction_logs"
    deployment_id: Mapped[str] = mapped_column(ForeignKey("deployments.id", ondelete="CASCADE"), index=True)
    inputs: Mapped[list] = mapped_column(JSON, default=list)
    predictions: Mapped[list] = mapped_column(JSON, default=list)
    probabilities: Mapped[list] = mapped_column(JSON, default=list)
    labels: Mapped[list | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[float] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class MonitoringMetric(ProjectRecord, Base):
    __tablename__ = "monitoring_metrics"
    deployment_id: Mapped[str] = mapped_column(ForeignKey("deployments.id", ondelete="CASCADE"), index=True)
    data: Mapped[dict] = mapped_column(JSON)


class Alert(ProjectRecord, Base):
    __tablename__ = "alerts"
    deployment_id: Mapped[str | None] = mapped_column(
        ForeignKey("deployments.id", ondelete="CASCADE"), index=True, nullable=True
    )
    run_id: Mapped[str | None] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True, nullable=True
    )
    severity: Mapped[str] = mapped_column(String(20), default="warning")
    kind: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class Backup(ProjectRecord, Base):
    __tablename__ = "backups"
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
