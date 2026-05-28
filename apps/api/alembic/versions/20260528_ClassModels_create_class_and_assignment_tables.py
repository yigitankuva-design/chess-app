"""create class and assignment tables

Revision ID: ClassModels
Revises: ParentModels
Create Date: 2026-05-28 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ClassModels'
down_revision = 'ParentModels'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create classes table
    op.create_table(
        'classes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('teacher_user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('join_code', sa.String(length=8), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('join_code')
    )
    op.create_index(op.f('ix_classes_teacher_user_id'), 'classes', ['teacher_user_id'], unique=False)

    # Create class_assignments table
    op.create_table(
        'class_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('class_id', sa.Integer(), nullable=False),
        sa.Column('target_module_id', sa.Integer(), nullable=True),
        sa.Column('target_lesson_id', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['class_id'], ['classes.id'], ),
        sa.ForeignKeyConstraint(['target_module_id'], ['modules.id'], ),
        sa.ForeignKeyConstraint(['target_lesson_id'], ['lessons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_class_assignments_class_id'), 'class_assignments', ['class_id'], unique=False)

    # Add class_id column to child_profiles
    with op.batch_alter_table('child_profiles') as batch_op:
        batch_op.add_column(sa.Column('class_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_child_profiles_class_id_classes',
            'classes',
            ['class_id'],
            ['id']
        )
        batch_op.create_index('ix_child_profiles_class_id', ['class_id'], unique=False)

    # Add FK constraint on target_class_id in parent_surveys (column already exists)
    with op.batch_alter_table('parent_surveys') as batch_op:
        batch_op.create_foreign_key(
            'fk_parent_surveys_target_class_id_classes',
            'classes',
            ['target_class_id'],
            ['id']
        )


def downgrade() -> None:
    # Remove FK constraint on parent_surveys.target_class_id
    with op.batch_alter_table('parent_surveys') as batch_op:
        batch_op.drop_constraint('fk_parent_surveys_target_class_id_classes', type_='foreignkey')

    # Remove class_id from child_profiles
    with op.batch_alter_table('child_profiles') as batch_op:
        batch_op.drop_index('ix_child_profiles_class_id')
        batch_op.drop_constraint('fk_child_profiles_class_id_classes', type_='foreignkey')
        batch_op.drop_column('class_id')

    # Drop class_assignments table
    op.drop_index(op.f('ix_class_assignments_class_id'), table_name='class_assignments')
    op.drop_table('class_assignments')

    # Drop classes table
    op.drop_index(op.f('ix_classes_teacher_user_id'), table_name='classes')
    op.drop_table('classes')
