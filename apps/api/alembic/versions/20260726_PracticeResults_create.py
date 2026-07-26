"""create child_practice_results

Revision ID: PracticeResults
Revises: AppSettings
Create Date: 2026-07-26 00:00:00.000000

SADECE CREATE TABLE. Mevcut hicbir tabloya dokunulmaz; mufredat tablolari
(modules, lessons, lesson_steps, child_lesson_progress, child_lesson_step_results)
etkilenmez — KURAL #4.
"""
import sqlalchemy as sa
from alembic import op

revision = 'PracticeResults'
down_revision = 'AppSettings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'child_practice_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('lesson_step_id', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(length=16), nullable=False),
        sa.Column('best_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_correct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('attempts_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_played_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id']),
        sa.ForeignKeyConstraint(['lesson_step_id'], ['lesson_steps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('child_id', 'lesson_step_id', 'mode', name='uq_practice_child_step_mode'),
    )
    op.create_index('ix_child_practice_results_child_id', 'child_practice_results', ['child_id'])
    op.create_index('ix_child_practice_results_lesson_step_id', 'child_practice_results', ['lesson_step_id'])


def downgrade() -> None:
    op.drop_index('ix_child_practice_results_lesson_step_id', table_name='child_practice_results')
    op.drop_index('ix_child_practice_results_child_id', table_name='child_practice_results')
    op.drop_table('child_practice_results')
