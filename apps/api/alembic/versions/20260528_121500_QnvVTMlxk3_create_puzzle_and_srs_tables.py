"""create puzzle and srs tables

Revision ID: QnvVTMlxk3
Revises: gkqiwhbPEI
Create Date: 2026-05-28 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'QnvVTMlxk3'
down_revision = 'gkqiwhbPEI'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create puzzle_themes table
    op.create_table(
        'puzzle_themes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=40), nullable=False),
        sa.Column('name_tr', sa.String(length=80), nullable=False),
        sa.Column('description_tr', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    op.create_index(op.f('ix_puzzle_themes_slug'), 'puzzle_themes', ['slug'], unique=True)

    # Create puzzles table
    op.create_table(
        'puzzles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lichess_id', sa.String(length=20), nullable=False),
        sa.Column('fen', sa.String(length=120), nullable=False),
        sa.Column('moves_json', sa.JSON(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('popularity', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lichess_id')
    )
    op.create_index(op.f('ix_puzzles_lichess_id'), 'puzzles', ['lichess_id'], unique=True)
    op.create_index(op.f('ix_puzzles_rating'), 'puzzles', ['rating'], unique=False)
    op.create_index(op.f('ix_puzzles_module_id'), 'puzzles', ['module_id'], unique=False)
    op.create_index('ix_puzzles_module_rating', 'puzzles', ['module_id', 'rating'], unique=False)

    # Create puzzle_themes_assoc association table
    op.create_table(
        'puzzle_themes_assoc',
        sa.Column('puzzle_id', sa.Integer(), nullable=False),
        sa.Column('theme_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['puzzle_id'], ['puzzles.id'], ),
        sa.ForeignKeyConstraint(['theme_id'], ['puzzle_themes.id'], ),
        sa.PrimaryKeyConstraint('puzzle_id', 'theme_id')
    )

    # Create child_puzzle_attempts table
    op.create_table(
        'child_puzzle_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('puzzle_id', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('time_seconds', sa.Integer(), nullable=False),
        sa.Column('attempted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.ForeignKeyConstraint(['puzzle_id'], ['puzzles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_child_puzzle_attempts_child_id'), 'child_puzzle_attempts', ['child_id'], unique=False)
    op.create_index(op.f('ix_child_puzzle_attempts_puzzle_id'), 'child_puzzle_attempts', ['puzzle_id'], unique=False)

    # Create srs_cards table
    op.create_table(
        'srs_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('item_type', sa.Enum('lesson_step', 'puzzle', name='srsitemtype'), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('due_at', sa.DateTime(), nullable=False),
        sa.Column('interval_days', sa.Float(), nullable=False),
        sa.Column('ease_factor', sa.Float(), nullable=False),
        sa.Column('reps_count', sa.Integer(), nullable=False),
        sa.Column('last_result', sa.String(length=10), nullable=True),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_srs_cards_child_id'), 'srs_cards', ['child_id'], unique=False)
    op.create_index(op.f('ix_srs_cards_due_at'), 'srs_cards', ['due_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_srs_cards_due_at'), table_name='srs_cards')
    op.drop_index(op.f('ix_srs_cards_child_id'), table_name='srs_cards')
    op.drop_table('srs_cards')

    op.drop_index(op.f('ix_child_puzzle_attempts_puzzle_id'), table_name='child_puzzle_attempts')
    op.drop_index(op.f('ix_child_puzzle_attempts_child_id'), table_name='child_puzzle_attempts')
    op.drop_table('child_puzzle_attempts')

    op.drop_table('puzzle_themes_assoc')

    op.drop_index('ix_puzzles_module_rating', table_name='puzzles')
    op.drop_index(op.f('ix_puzzles_module_id'), table_name='puzzles')
    op.drop_index(op.f('ix_puzzles_rating'), table_name='puzzles')
    op.drop_index(op.f('ix_puzzles_lichess_id'), table_name='puzzles')
    op.drop_table('puzzles')

    op.drop_index(op.f('ix_puzzle_themes_slug'), table_name='puzzle_themes')
    op.drop_table('puzzle_themes')
