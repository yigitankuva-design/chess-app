"""create parent and activity log tables

Revision ID: ParentModels
Revises: KxYzAbCdEf
Create Date: 2026-05-28 14:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ParentModels'
down_revision = 'KxYzAbCdEf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create parent_time_limits table
    op.create_table(
        'parent_time_limits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('daily_minutes_limit', sa.Integer(), nullable=False),
        sa.Column('reset_hour', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_parent_time_limits_child_id'), 'parent_time_limits', ['child_id'], unique=True)

    # Create child_activity_logs table
    op.create_table(
        'child_activity_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('total_seconds', sa.Integer(), nullable=False),
        sa.Column('lessons_completed', sa.Integer(), nullable=False),
        sa.Column('puzzles_solved', sa.Integer(), nullable=False),
        sa.Column('games_played', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_activity_logs_child_id'), 'child_activity_logs', ['child_id'], unique=False)
    op.create_index(op.f('ix_child_activity_logs_date'), 'child_activity_logs', ['date'], unique=False)

    # Create parent_surveys table
    op.create_table(
        'parent_surveys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=160), nullable=False),
        sa.Column('questions_json', sa.JSON(), nullable=False),
        sa.Column('created_by_teacher_id', sa.Integer(), nullable=False),
        sa.Column('target_class_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_teacher_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create parent_survey_responses table
    op.create_table(
        'parent_survey_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('parent_user_id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=True),
        sa.Column('answers_json', sa.JSON(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['parent_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['survey_id'], ['parent_surveys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_parent_survey_responses_parent_user_id'), 'parent_survey_responses', ['parent_user_id'], unique=False)
    op.create_index(op.f('ix_parent_survey_responses_survey_id'), 'parent_survey_responses', ['survey_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_parent_survey_responses_survey_id'), table_name='parent_survey_responses')
    op.drop_index(op.f('ix_parent_survey_responses_parent_user_id'), table_name='parent_survey_responses')
    op.drop_table('parent_survey_responses')

    op.drop_table('parent_surveys')

    op.drop_index(op.f('ix_child_activity_logs_date'), table_name='child_activity_logs')
    op.drop_index(op.f('ix_child_activity_logs_child_id'), table_name='child_activity_logs')
    op.drop_table('child_activity_logs')

    op.drop_index(op.f('ix_parent_time_limits_child_id'), table_name='parent_time_limits')
    op.drop_table('parent_time_limits')
