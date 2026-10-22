"""Index remaining model and explanation foreign keys

Revision ID: a4ca2b0abb4d
Revises: cdeecfd972f3
"""

from alembic import op


revision = "a4ca2b0abb4d"
down_revision = "cdeecfd972f3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(op.f("ix_explanations_artifact_id"), "explanations", ["artifact_id"], unique=False)
    op.create_index(op.f("ix_models_dataset_id"), "models", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_models_pipeline_id"), "models", ["pipeline_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_models_pipeline_id"), table_name="models")
    op.drop_index(op.f("ix_models_dataset_id"), table_name="models")
    op.drop_index(op.f("ix_explanations_artifact_id"), table_name="explanations")
