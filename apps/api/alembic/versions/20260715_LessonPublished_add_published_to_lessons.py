"""add published to lessons

Revision ID: LessonPublished
Revises: Lesson1_Add10Exercises
Create Date: 2026-07-15 00:00:00.000000

server_default='true' KRİTİK: mevcut dersler yayında kalır, çocuklar erişimini kaybetmez.
"""
import sqlalchemy as sa
from alembic import op

revision = 'LessonPublished'
down_revision = 'Lesson1_Add10Exercises'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'lessons',
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('lessons', 'published')
