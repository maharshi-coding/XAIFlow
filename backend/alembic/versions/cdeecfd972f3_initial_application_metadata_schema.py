"""Initial application metadata schema

Revision ID: cdeecfd972f3
Revises:
"""

from alembic import op
import sqlalchemy as sa


revision = "cdeecfd972f3"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "projects",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_status"), "projects", ["status"], unique=False)
    op.create_table(
        "backups",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_backups_project_id"), "backups", ["project_id"], unique=False)
    op.create_table(
        "datasets",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("target_column", sa.String(length=255), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("statistics", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_datasets_project_id"), "datasets", ["project_id"], unique=False)
    op.create_table(
        "pipelines",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipelines_project_id"), "pipelines", ["project_id"], unique=False)
    op.create_table(
        "pipeline_runs",
        sa.Column("pipeline_id", sa.String(length=36), nullable=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("pipeline_name", sa.String(length=160), nullable=False),
        sa.Column("pipeline_version", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration", sa.Double(), nullable=True),
        sa.Column("model_type", sa.String(length=80), nullable=True),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("preprocessing", sa.JSON(), nullable=False),
        sa.Column("environment", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("explanations", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("logs", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipeline_runs_dataset_id"), "pipeline_runs", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_pipeline_runs_pipeline_id"), "pipeline_runs", ["pipeline_id"], unique=False)
    op.create_index(op.f("ix_pipeline_runs_project_id"), "pipeline_runs", ["project_id"], unique=False)
    op.create_index(op.f("ix_pipeline_runs_status"), "pipeline_runs", ["status"], unique=False)
    op.create_table(
        "artifacts",
        sa.Column("run_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_artifacts_project_id"), "artifacts", ["project_id"], unique=False)
    op.create_index(op.f("ix_artifacts_run_id"), "artifacts", ["run_id"], unique=False)
    op.create_table(
        "metrics",
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_metrics_run_id"), "metrics", ["run_id"], unique=False)
    op.create_table(
        "models",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("algorithm", sa.String(length=80), nullable=False),
        sa.Column("framework", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("pipeline_id", sa.String(length=36), nullable=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=True),
        sa.Column("artifact_path", sa.Text(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("preprocessing", sa.JSON(), nullable=False),
        sa.Column("explanations", sa.JSON(), nullable=False),
        sa.Column("baseline", sa.JSON(), nullable=False),
        sa.Column("input_schema", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "name", "version", name="uq_model_version"),
    )
    op.create_index(op.f("ix_models_project_id"), "models", ["project_id"], unique=False)
    op.create_index(op.f("ix_models_run_id"), "models", ["run_id"], unique=False)
    op.create_table(
        "node_runs",
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("node_id", sa.String(length=100), nullable=False),
        sa.Column("node_type", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration", sa.Double(), nullable=True),
        sa.Column("logs", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "node_id", name="uq_node_run"),
    )
    op.create_index(op.f("ix_node_runs_run_id"), "node_runs", ["run_id"], unique=False)
    op.create_table(
        "deployments",
        sa.Column("model_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("explanation_method", sa.String(length=20), nullable=True),
        sa.Column("drift_threshold", sa.Double(), nullable=False),
        sa.Column("degradation_threshold", sa.Double(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["models.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_deployments_model_id"), "deployments", ["model_id"], unique=False)
    op.create_index(op.f("ix_deployments_project_id"), "deployments", ["project_id"], unique=False)
    op.create_table(
        "explanations",
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("artifact_id", sa.String(length=36), nullable=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_explanations_project_id"), "explanations", ["project_id"], unique=False)
    op.create_index(op.f("ix_explanations_run_id"), "explanations", ["run_id"], unique=False)
    op.create_table(
        "model_versions",
        sa.Column("model_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["models.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_model_versions_model_id"), "model_versions", ["model_id"], unique=False)
    op.create_table(
        "alerts",
        sa.Column("deployment_id", sa.String(length=36), nullable=True),
        sa.Column("run_id", sa.String(length=36), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("kind", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_deployment_id"), "alerts", ["deployment_id"], unique=False)
    op.create_index(op.f("ix_alerts_project_id"), "alerts", ["project_id"], unique=False)
    op.create_index(op.f("ix_alerts_run_id"), "alerts", ["run_id"], unique=False)
    op.create_index(op.f("ix_alerts_status"), "alerts", ["status"], unique=False)
    op.create_table(
        "monitoring_metrics",
        sa.Column("deployment_id", sa.String(length=36), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_monitoring_metrics_deployment_id"), "monitoring_metrics", ["deployment_id"], unique=False
    )
    op.create_index(
        op.f("ix_monitoring_metrics_project_id"), "monitoring_metrics", ["project_id"], unique=False
    )
    op.create_table(
        "prediction_logs",
        sa.Column("deployment_id", sa.String(length=36), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("predictions", sa.JSON(), nullable=False),
        sa.Column("probabilities", sa.JSON(), nullable=False),
        sa.Column("labels", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Double(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["deployment_id"], ["deployments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_prediction_logs_deployment_id"), "prediction_logs", ["deployment_id"], unique=False
    )
    op.create_index(op.f("ix_prediction_logs_project_id"), "prediction_logs", ["project_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_prediction_logs_project_id"), table_name="prediction_logs")
    op.drop_index(op.f("ix_prediction_logs_deployment_id"), table_name="prediction_logs")
    op.drop_table("prediction_logs")
    op.drop_index(op.f("ix_monitoring_metrics_project_id"), table_name="monitoring_metrics")
    op.drop_index(op.f("ix_monitoring_metrics_deployment_id"), table_name="monitoring_metrics")
    op.drop_table("monitoring_metrics")
    op.drop_index(op.f("ix_alerts_status"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_run_id"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_project_id"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_deployment_id"), table_name="alerts")
    op.drop_table("alerts")
    op.drop_index(op.f("ix_model_versions_model_id"), table_name="model_versions")
    op.drop_table("model_versions")
    op.drop_index(op.f("ix_explanations_run_id"), table_name="explanations")
    op.drop_index(op.f("ix_explanations_project_id"), table_name="explanations")
    op.drop_table("explanations")
    op.drop_index(op.f("ix_deployments_project_id"), table_name="deployments")
    op.drop_index(op.f("ix_deployments_model_id"), table_name="deployments")
    op.drop_table("deployments")
    op.drop_index(op.f("ix_node_runs_run_id"), table_name="node_runs")
    op.drop_table("node_runs")
    op.drop_index(op.f("ix_models_run_id"), table_name="models")
    op.drop_index(op.f("ix_models_project_id"), table_name="models")
    op.drop_table("models")
    op.drop_index(op.f("ix_metrics_run_id"), table_name="metrics")
    op.drop_table("metrics")
    op.drop_index(op.f("ix_artifacts_run_id"), table_name="artifacts")
    op.drop_index(op.f("ix_artifacts_project_id"), table_name="artifacts")
    op.drop_table("artifacts")
    op.drop_index(op.f("ix_pipeline_runs_status"), table_name="pipeline_runs")
    op.drop_index(op.f("ix_pipeline_runs_project_id"), table_name="pipeline_runs")
    op.drop_index(op.f("ix_pipeline_runs_pipeline_id"), table_name="pipeline_runs")
    op.drop_index(op.f("ix_pipeline_runs_dataset_id"), table_name="pipeline_runs")
    op.drop_table("pipeline_runs")
    op.drop_index(op.f("ix_pipelines_project_id"), table_name="pipelines")
    op.drop_table("pipelines")
    op.drop_index(op.f("ix_datasets_project_id"), table_name="datasets")
    op.drop_table("datasets")
    op.drop_index(op.f("ix_backups_project_id"), table_name="backups")
    op.drop_table("backups")
    op.drop_index(op.f("ix_projects_status"), table_name="projects")
    op.drop_table("projects")
