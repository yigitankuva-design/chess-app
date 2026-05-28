"""create game and gamification tables

Revision ID: KxYzAbCdEf
Revises: QnvVTMlxk3
Create Date: 2026-05-28 12:48:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'KxYzAbCdEf'
down_revision = 'QnvVTMlxk3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create games table
    op.create_table(
        'games',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('bot', 'human', name='gametype'), nullable=False),
        sa.Column('status', sa.Enum('active', 'finished', 'aborted', name='gamestatus'), nullable=False),
        sa.Column('result', sa.Enum('1-0', '0-1', '1/2-1/2', name='gameresult'), nullable=True),
        sa.Column('white_child_id', sa.Integer(), nullable=True),
        sa.Column('black_child_id', sa.Integer(), nullable=True),
        sa.Column('black_bot_level', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('pgn', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['white_child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['black_child_id'], ['child_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_games_white_child_id'), 'games', ['white_child_id'], unique=False)
    op.create_index(op.f('ix_games_black_child_id'), 'games', ['black_child_id'], unique=False)

    # Create game_moves table
    op.create_table(
        'game_moves',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('ply', sa.Integer(), nullable=False),
        sa.Column('san', sa.String(length=10), nullable=False),
        sa.Column('fen_after', sa.String(length=120), nullable=False),
        sa.Column('time_left_seconds', sa.Integer(), nullable=True),
        sa.Column('by_child_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ),
        sa.ForeignKeyConstraint(['by_child_id'], ['child_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_game_moves_game_id'), 'game_moves', ['game_id'], unique=False)

    # Create badges table
    op.create_table(
        'badges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=40), nullable=False),
        sa.Column('name_tr', sa.String(length=80), nullable=False),
        sa.Column('description_tr', sa.String(length=255), nullable=False),
        sa.Column('icon', sa.String(length=40), nullable=False),
        sa.Column('criteria_json', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    op.create_index(op.f('ix_badges_slug'), 'badges', ['slug'], unique=True)

    # Create child_badges table
    op.create_table(
        'child_badges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('badge_id', sa.Integer(), nullable=False),
        sa.Column('earned_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_badges_child_id'), 'child_badges', ['child_id'], unique=False)

    # Create ranks table
    op.create_table(
        'ranks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('name_tr', sa.String(length=40), nullable=False),
        sa.Column('xp_required', sa.Integer(), nullable=False),
        sa.Column('icon', sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_index')
    )

    # Create child_ranks table
    op.create_table(
        'child_ranks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('current_rank_id', sa.Integer(), nullable=False),
        sa.Column('xp_total', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['current_rank_id'], ['ranks.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('child_id')
    )
    op.create_index(op.f('ix_child_ranks_child_id'), 'child_ranks', ['child_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_child_ranks_child_id'), table_name='child_ranks')
    op.drop_table('child_ranks')

    op.drop_table('ranks')

    op.drop_index(op.f('ix_child_badges_child_id'), table_name='child_badges')
    op.drop_table('child_badges')

    op.drop_index(op.f('ix_badges_slug'), table_name='badges')
    op.drop_table('badges')

    op.drop_index(op.f('ix_game_moves_game_id'), table_name='game_moves')
    op.drop_table('game_moves')

    op.drop_index(op.f('ix_games_black_child_id'), table_name='games')
    op.drop_index(op.f('ix_games_white_child_id'), table_name='games')
    op.drop_table('games')
