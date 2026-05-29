"""Fix exercise 1.1 dark squares — replace inverted target_squares with correct dark squares

Revision ID: Fix_DarkSquares
Revises: Lesson1_AddBoardExercises
Create Date: 2026-05-29 07:00:00.000000
"""
from alembic import op
from sqlalchemy import text
import json

revision = 'Fix_DarkSquares'
down_revision = 'Lesson1_AddBoardExercises'
branch_labels = None
depends_on = None

# Standard chess dark squares: (fileIndex + rank) % 2 == 1, where a=0, rank 1-8
# a1 is dark (bottom-left for white), h1 is light (bottom-right for white).
DARK_SQUARES = [
    "a1", "a3", "a5", "a7",
    "b2", "b4", "b6", "b8",
    "c1", "c3", "c5", "c7",
    "d2", "d4", "d6", "d8",
    "e1", "e3", "e5", "e7",
    "f2", "f4", "f6", "f8",
    "g1", "g3", "g5", "g7",
    "h2", "h4", "h6", "h8",
]


def upgrade() -> None:
    conn = op.get_bind()

    row = conn.execute(text("""
        SELECT ls.id, ls.content_json
        FROM lesson_steps ls
        JOIN lessons l ON ls.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.order_index = 1 AND l.order_index = 1 AND ls.order_index = 1
    """)).fetchone()

    if not row:
        return

    step_id = row[0]
    content = row[1] if isinstance(row[1], dict) else json.loads(row[1])

    be = content.get("board_exercise", {})
    if be.get("type") == "click_square":
        be["target_squares"] = DARK_SQUARES
        content["board_exercise"] = be
        conn.execute(text("""
            UPDATE lesson_steps SET content_json = :content WHERE id = :sid
        """), {
            "content": json.dumps(content, ensure_ascii=False),
            "sid": step_id,
        })


def downgrade() -> None:
    pass  # no rollback needed — original data was wrong
