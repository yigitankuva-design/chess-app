"""No-op — logic moved to ResetCurriculum

Revision ID: ResetCurriculum2
Revises: ResetCurriculum
Create Date: 2026-05-29 02:00:00.000000

"""
from alembic import op

revision = 'ResetCurriculum2'
down_revision = 'ResetCurriculum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Logic was merged into the ResetCurriculum migration.
    pass


def downgrade() -> None:
    pass
