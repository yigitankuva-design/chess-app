"""Replace text quizzes with interactive board exercises for Lesson 1

Revision ID: Lesson1_AddBoardExercises
Revises: Lesson1_AddQuizzes
Create Date: 2026-05-29 06:00:00.000000

"""
from alembic import op
from sqlalchemy import text
import json

revision = 'Lesson1_AddBoardExercises'
down_revision = 'Lesson1_AddQuizzes'
branch_labels = None
depends_on = None

# Dark squares: (file_idx + rank_idx) % 2 == 0 (a=0, rank_1=0)
DARK_SQUARES = [
    f + str(r)
    for fi, f in enumerate("abcdefgh")
    for r in range(1, 9)
    if (fi + (r - 1)) % 2 == 0
]

BOARD_EXERCISES = {
    1: {
        "type": "click_square",
        "instruction": "🎯 Tahtada koyu renkli bir kareye tıkla!",
        "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
        "target_squares": DARK_SQUARES,
        "hint_squares": [],
        "success_msg": "Evet! Bu koyu renkli bir kare.",
        "fail_msg": "Bu açık renkli bir kare. Daha koyu renkli bir kareye tıkla!",
    },
    2: {
        "type": "click_square",
        "instruction": "🎯 Altın renkli MERKEZ karelerinden birine tıkla!",
        "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
        "target_squares": ["d4", "d5", "e4", "e5"],
        "hint_squares": ["d4", "d5", "e4", "e5"],
        "success_msg": "Harika! Bu tahtanın merkez karelerinden biri.",
        "fail_msg": "Altın renkli merkez karelerinden birine tıkla!",
    },
    3: {
        "type": "move_piece",
        "instruction": "🎯 Kaleyi seç ve yatay hareket ettir (aynı sıradaki altın kareye)!",
        "fen": "8/8/8/8/4R3/8/8/8 w - - 0 1",
        "piece_square": "e4",
        "target_squares": ["a4", "b4", "c4", "d4", "f4", "g4", "h4"],
        "hint_squares": ["a4", "b4", "c4", "d4", "f4", "g4", "h4"],
        "success_msg": "Süper! Kale yatay (yatay hat boyunca) hareket etti.",
        "fail_msg": "Kale yatay hareket eder — aynı sıradan bir kareye taşı!",
    },
    4: {
        "type": "identify_piece",
        "instruction": "🎯 Altın renkle işaretli taşın adı nedir?",
        "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
        "highlight_square": "e4",
        "options": ["Piyon", "At", "Fil", "Kale"],
        "correct_index": 1,
        "success_msg": "Doğru! Bu bir At (Knight). At L şeklinde hareket eder.",
    },
    5: {
        "type": "click_square",
        "instruction": "🎯 Başlangıç konumundaki PIYON'lardan birine tıkla!",
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "target_squares": [
            "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
            "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
        ],
        "hint_squares": [],
        "success_msg": "Harika! Bu bir piyon. Başlangıçta 2. ve 7. sırada dizilirler.",
        "fail_msg": "Bu piyon değil! 2. veya 7. sıradaki küçük taşlara tıkla.",
    },
    6: {
        "type": "move_piece",
        "instruction": "🎯 Fili seç ve çapraz hareket ettir (altın karelerden birine)!",
        "fen": "8/8/8/8/8/8/8/2B5 w - - 0 1",
        "piece_square": "c1",
        "target_squares": ["b2", "a3", "d2", "e3", "f4", "g5", "h6"],
        "hint_squares": ["b2", "a3", "d2", "e3", "f4", "g5", "h6"],
        "success_msg": "Mükemmel! Fil sadece çapraz hareket eder.",
        "fail_msg": "Fil yalnızca çapraz hareket eder. Altın renkli karelerden birine taşı!",
    },
}


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(text("""
        SELECT ls.id, ls.order_index, ls.content_json
        FROM lesson_steps ls
        JOIN lessons l ON ls.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.order_index = 1 AND l.order_index = 1
        ORDER BY ls.order_index
    """)).fetchall()

    for row in rows:
        step_id = row[0]
        step_order = row[1]
        content = row[2] if isinstance(row[2], dict) else json.loads(row[2])

        if step_order in BOARD_EXERCISES:
            # Add board_exercise, remove old text quiz
            content["board_exercise"] = BOARD_EXERCISES[step_order]
            content.pop("quiz", None)
            conn.execute(text("""
                UPDATE lesson_steps SET content_json = :content WHERE id = :sid
            """), {
                "content": json.dumps(content, ensure_ascii=False),
                "sid": step_id,
            })


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(text("""
        SELECT ls.id, ls.content_json
        FROM lesson_steps ls
        JOIN lessons l ON ls.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.order_index = 1 AND l.order_index = 1
    """)).fetchall()

    for row in rows:
        content = row[1] if isinstance(row[1], dict) else json.loads(row[1])
        content.pop("board_exercise", None)
        conn.execute(text("""
            UPDATE lesson_steps SET content_json = :content WHERE id = :sid
        """), {"content": json.dumps(content, ensure_ascii=False), "sid": row[0]})
