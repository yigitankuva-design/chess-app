"""Üyelik Girişi Yenileme AŞAMA 1: User + ChildProfile'a yeni alanlar

Revision ID: MembershipStage1
Revises: CustomTabKindC
Create Date: 2026-09-09

Madde 2026-09-09 (Üyelik Girişi Yenileme): yeni "Kayıt Ol" formunun ihtiyaç
duyduğu alanlar. Hepsi NULLABLE (mevcut hesaplarda boş — KURAL #3), tek
istisna `users.approval_status` — DEFAULT 'approved' ile eklenir ki
MEVCUT hesaplar (veli/antrenör/eski sporcu) hiç etkilenmesin; sadece
BUNDAN SONRA 18+ kendi kaydolan sporcu hesapları backend kodunda açıkça
'pending' ile oluşturulacak (bkz. auth.py athlete_signup).

`users.username` benzersiz (unique) — e-postanın YANINDA kullanılabilen
ikinci giriş kimliği.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "MembershipStage1"
down_revision = "CustomTabKindC"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=50), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("province", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("lichess_username", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("kvkk_consent_at", sa.DateTime(), nullable=True))
    op.add_column(
        "users",
        sa.Column("approval_status", sa.String(length=20), nullable=False, server_default="approved"),
    )
    op.add_column("child_profiles", sa.Column("lichess_username", sa.String(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column("child_profiles", "lichess_username")
    op.drop_column("users", "approval_status")
    op.drop_column("users", "kvkk_consent_at")
    op.drop_column("users", "lichess_username")
    op.drop_column("users", "province")
    op.drop_column("users", "phone")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
