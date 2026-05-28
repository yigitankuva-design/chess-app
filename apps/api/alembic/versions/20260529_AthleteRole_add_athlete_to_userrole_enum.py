"""add athlete to userrole enum

Revision ID: AthleteRole
Revises: ClassModels
Create Date: 2026-05-29 00:00:00.000000

"""
from alembic import op

revision = 'AthleteRole'
down_revision = 'ClassModels'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires this to add a value to an existing ENUM type
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'athlete'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass
