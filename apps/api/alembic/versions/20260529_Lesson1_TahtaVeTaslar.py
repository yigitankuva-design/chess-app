"""Add Lesson 1 — Tahta ve Taslar (Temel Düzey)

Revision ID: Lesson1_TahtaVeTaslar
Revises: ResetCurriculum3
Create Date: 2026-05-29 04:00:00.000000

"""
from alembic import op
from sqlalchemy import text
import json

revision = 'Lesson1_TahtaVeTaslar'
down_revision = 'ResetCurriculum3'
branch_labels = None
depends_on = None

STEPS = [
    {
        "order": 1,
        "title": "Tahtanın Genel Özellikleri",
        "body": "Tahtanın kare olmasından, 64 kare oluşundan, açık ve koyu renkli karelerden oluştuğundan bahsedilir.",
    },
    {
        "order": 2,
        "title": "Merkez Kavramı",
        "body": "Tahtanın merkezinin neresi olduğu anlatılır.",
    },
    {
        "order": 3,
        "title": "Tahtadaki Yollar",
        "body": "Tahtada taşların hareket ettiği 'Dikey, Yatay ve Çapraz Hatlar' anlatılır.",
    },
    {
        "order": 4,
        "title": "Satranç Taşlarının Görünümü",
        "body": "Taşların standart görünümleri 2 ve 3 boyutlu olarak gösterilir.",
    },
    {
        "order": 5,
        "title": "Taşların Başlangıç Konumu",
        "body": "Taşların oyun başlamadan önceki dizilişi/konumu gösterilir. Olası hatalar örneklendirilir.",
    },
    {
        "order": 6,
        "title": "Uygulama Etkinlikleri",
        "body": "Tahta ve taşlar ile ilgili uygulama örnekleri üzerinden sorular sorulur. Uygulama yaptırılır.",
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # Insert lesson, get back ID
    result = conn.execute(text("""
        INSERT INTO lessons (module_id, order_index, title, estimated_minutes)
        VALUES (1, 1, 'Tahta ve Taşlar', 20)
        RETURNING id
    """))
    lesson_id = result.fetchone()[0]

    # Insert lesson steps
    for step in STEPS:
        conn.execute(text("""
            INSERT INTO lesson_steps (lesson_id, order_index, type, content_json)
            VALUES (:lid, :order, 'explanation', :content)
        """), {
            "lid": lesson_id,
            "order": step["order"],
            "content": json.dumps({"title": step["title"], "body": step["body"]}, ensure_ascii=False),
        })


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("""
        DELETE FROM lesson_steps WHERE lesson_id IN (
            SELECT id FROM lessons WHERE module_id = 1 AND order_index = 1
        )
    """))
    conn.execute(text("""
        DELETE FROM lessons WHERE module_id = 1 AND order_index = 1
    """))
