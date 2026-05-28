"""create curriculum and progress tables

Revision ID: gkqiwhbPEI
Revises: mlfthqlqpj
Create Date: 2026-05-28 11:22:09.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'gkqiwhbPEI'
down_revision = 'mlfthqlqpj'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create modules table
    op.create_table(
        'modules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('icon', sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_index')
    )

    # Create lessons table
    op.create_table(
        'lessons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=160), nullable=False),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lessons_module_id'), 'lessons', ['module_id'], unique=False)

    # Create lesson_steps table
    op.create_table(
        'lesson_steps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('explanation', 'inline_exercise', 'quiz', name='lessonsteptype'), nullable=False),
        sa.Column('content_json', sa.JSON(), nullable=False),
        sa.Column('correct_answer_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lesson_steps_lesson_id'), 'lesson_steps', ['lesson_id'], unique=False)

    # Create child_lesson_progress table
    op.create_table(
        'child_lesson_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('locked', 'in_progress', 'completed', name='lessonstatus'), nullable=False),
        sa.Column('current_step_index', sa.Integer(), nullable=False),
        sa.Column('total_time_seconds', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_lesson_progress_child_id'), 'child_lesson_progress', ['child_id'], unique=False)
    op.create_index(op.f('ix_child_lesson_progress_lesson_id'), 'child_lesson_progress', ['lesson_id'], unique=False)

    # Create child_lesson_step_results table
    op.create_table(
        'child_lesson_step_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('lesson_step_id', sa.Integer(), nullable=False),
        sa.Column('attempts_count', sa.Integer(), nullable=False),
        sa.Column('success_at_attempt', sa.Integer(), nullable=True),
        sa.Column('time_seconds', sa.Integer(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['lesson_step_id'], ['lesson_steps.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_lesson_step_results_child_id'), 'child_lesson_step_results', ['child_id'], unique=False)
    op.create_index(op.f('ix_child_lesson_step_results_lesson_step_id'), 'child_lesson_step_results', ['lesson_step_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_child_lesson_step_results_lesson_step_id'), table_name='child_lesson_step_results')
    op.drop_index(op.f('ix_child_lesson_step_results_child_id'), table_name='child_lesson_step_results')
    op.drop_table('child_lesson_step_results')

    op.drop_index(op.f('ix_child_lesson_progress_lesson_id'), table_name='child_lesson_progress')
    op.drop_index(op.f('ix_child_lesson_progress_child_id'), table_name='child_lesson_progress')
    op.drop_table('child_lesson_progress')

    op.drop_index(op.f('ix_lesson_steps_lesson_id'), table_name='lesson_steps')
    op.drop_table('lesson_steps')

    op.drop_index(op.f('ix_lessons_module_id'), table_name='lessons')
    op.drop_table('lessons')

    op.drop_table('modules')
