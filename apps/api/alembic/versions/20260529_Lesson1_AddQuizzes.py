"""Add quiz questions to Lesson 1 steps

Revision ID: Lesson1_AddQuizzes
Revises: Lesson1_TahtaVeTaslar
Create Date: 2026-05-29 05:00:00.000000

"""
from alembic import op
from sqlalchemy import text
import json

revision = 'Lesson1_AddQuizzes'
down_revision = 'Lesson1_TahtaVeTaslar'
branch_labels = None
depends_on = None

QUIZZES = {
    1: {
        "question": "Satranç tahtasında toplam kaç kare bulunur?",
        "options": ["32", "64", "100", "48"],
        "correct_index": 1,
    },
    2: {
        "question": "Satranç tahtasının merkezinde kaç kare bulunur?",
        "options": ["2", "4", "8", "16"],
        "correct_index": 1,
    },
    3: {
        "question": "Tahtada kaç farklı hat türü vardır?",
        "options": ["1 — Sadece yatay", "2 — Yatay ve dikey", "3 — Dikey, yatay ve çapraz", "4 — Dört yön"],
        "correct_index": 2,
    },
    4: {
        "question": "Standart bir satranç setinde kaç farklı taş türü vardır?",
        "options": ["4", "5", "6", "8"],
        "correct_index": 2,
    },
    5: {
        "question": "Her oyuncu oyuna kaç piyon ile başlar?",
        "options": ["6", "7", "8", "10"],
        "correct_index": 2,
    },
    6: {
        "question": "Aşağıdakilerden hangisi doğrudur?",
        "options": [
            "Tahta 32 kareden oluşur",
            "Tahta 64 kareden oluşur",
            "Merkezde 2 kare vardır",
            "Tüm kareler aynı renktedir",
        ],
        "correct_index": 1,
    },
}


def upgrade() -> None:
    conn = op.get_bind()

    # Fetch existing steps for Lesson 1 (module order_index=1, lesson order_index=1)
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

        if step_order in QUIZZES:
            content["quiz"] = QUIZZES[step_order]
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
        content.pop("quiz", None)
        conn.execute(text("""
            UPDATE lesson_steps SET content_json = :content WHERE id = :sid
        """), {"content": json.dumps(content, ensure_ascii=False), "sid": row[0]})
