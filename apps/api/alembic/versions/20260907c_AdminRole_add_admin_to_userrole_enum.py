"""add admin to userrole enum

Revision ID: AdminRole
Revises: ClassAssignmentLessonStepTarget
Create Date: 2026-09-07 00:00:00.000000

Madde 2026-09-07 (Antrenör Paneli, 5): gerçek yönetici (Zafer) rolünü
"teacher"dan ayırmanın İLK adımı — SADECE enum'a yeni değer ekler.

BİLEREK bu migration'da BAŞKA HİÇBİR ŞEY yapılmıyor (örn. belirli bir
hesabın rolünü 'admin' yapmak) — PostgreSQL, bir transaction içinde
ENUM'a eklenen YENİ değeri AYNI transaction içinde KULLANMAYA izin
vermiyor ("unsafe use of new value of enum type"). Bu projede
`alembic upgrade head` tüm bekleyen migration'ları TEK bir transaction
içinde çalıştırıyor (bkz. alembic/env.py: `context.begin_transaction()`
tüm run_migrations() çağrısını sarıyor) — o yüzden 'admin' değerini
KULLANAN asıl veri güncellemesi (hesap rolü ataması) AYRI, SONRAKİ bir
deploy'da (sonraki migration) yapılacak. Aynı desen 2026-05-29'daki
'athlete' ekleme migration'ında da kullanılmış (bkz. AthleteRole
migration'ı) — orada da tek başına, veri değişikliği içermeden.
"""
from alembic import op

revision = 'AdminRole'
down_revision = 'ClassAssignmentLessonStepTarget'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires this to add a value to an existing ENUM type
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'admin'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass
