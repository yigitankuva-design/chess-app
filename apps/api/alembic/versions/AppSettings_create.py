"""create app_settings table

Revision ID: AppSettings
Revises: LessonPublished
Create Date: 2026-07-18 00:00:00.000000

Yalnızca yeni tablo ekler; mevcut tablolara (özellikle müfredat tablolarına) dokunmaz.
Sporcu ekranı ayarları (yazılar, tahta, sekmeler) için tek satırlık global depo.
"""
import sqlalchemy as sa
from alembic import op

revision = 'AppSettings'
down_revision = 'LessonPublished'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('data', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('app_settings')
