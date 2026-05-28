"""create auth tables

Revision ID: mlfthqlqpj
Revises:
Create Date: 2026-05-28 03:21:37.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'mlfthqlqpj'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('parent', 'teacher', name='userrole'), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email_verified', sa.Boolean(), nullable=False),
        sa.Column('email_verification_token', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create child_profiles table
    op.create_table(
        'child_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parent_user_id', sa.Integer(), nullable=False),
        sa.Column('display_name', sa.String(length=80), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('avatar', sa.String(length=40), nullable=False),
        sa.Column('pin_hash', sa.String(length=255), nullable=False),
        sa.Column('teacher_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_active_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['parent_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['teacher_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_profiles_parent_user_id'), 'child_profiles', ['parent_user_id'], unique=False)
    op.create_index(op.f('ix_child_profiles_teacher_user_id'), 'child_profiles', ['teacher_user_id'], unique=False)

    # Create devices table
    op.create_table(
        'devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parent_user_id', sa.Integer(), nullable=False),
        sa.Column('device_fingerprint', sa.String(length=128), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('trusted_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('active_child_profile_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['active_child_profile_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['parent_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_devices_device_fingerprint'), 'devices', ['device_fingerprint'], unique=True)
    op.create_index(op.f('ix_devices_parent_user_id'), 'devices', ['parent_user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_devices_parent_user_id'), table_name='devices')
    op.drop_index(op.f('ix_devices_device_fingerprint'), table_name='devices')
    op.drop_table('devices')

    op.drop_index(op.f('ix_child_profiles_teacher_user_id'), table_name='child_profiles')
    op.drop_index(op.f('ix_child_profiles_parent_user_id'), table_name='child_profiles')
    op.drop_table('child_profiles')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
