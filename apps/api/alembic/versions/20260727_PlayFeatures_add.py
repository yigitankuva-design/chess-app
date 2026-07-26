"""add play features: draw offer counters, start_fen, openings table

Revision ID: PlayFeatures
Revises: PracticeResults
Create Date: 2026-07-27 00:00:00.000000

SADECE ADD COLUMN + CREATE TABLE. Mevcut satirlar etkilenmez:
server_default='0' sayesinde eski oyunlarda sayaclar 0 olur, start_fen NULL
kalir ve NULL => standart baslangic pozisyonu demektir (KURAL #3).
Mufredat tablolarina dokunulmadi (KURAL #4).
"""
import sqlalchemy as sa
from alembic import op

revision = 'PlayFeatures'
down_revision = 'PracticeResults'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('games', sa.Column('white_draw_offers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('games', sa.Column('black_draw_offers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('games', sa.Column('start_fen', sa.String(length=120), nullable=True))
    op.create_table(
        'openings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('start_fen', sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('openings')
    op.drop_column('games', 'start_fen')
    op.drop_column('games', 'black_draw_offers')
    op.drop_column('games', 'white_draw_offers')
