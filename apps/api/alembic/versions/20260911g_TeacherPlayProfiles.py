"""Görsel Turu Aşama F: mevcut antrenörlere oyun profili (ChildProfile) aç

Revision ID: TeacherPlayProfile
Revises: DropBildirimlerTab

Madde 2026-09-11 (Görsel Turu Aşama F, Zafer'in S3 kararı): antrenör de
sporcu gibi oynasın. Sporcu uçları bir ChildProfile ister; antrenörlerin
yoktu. 18+ sporcularla AYNI desen: parent_user_id KENDİ hesabını gösteren
bir ChildProfile ("kendi kendinin velisi"). Yeni antrenörlerde kayıt/giriş
anında kod açar (bkz. services/play_profile.py); bu migration MEVCUT
antrenörler için tek seferliktir. Zaten profili olan (parent_user_id ==
kendi id) antrenöre dokunulmaz — idempotent.

PIN: rastgele, atılır — antrenör PIN'le değil kendi jetonuyla girer.
"""
import secrets
import sqlalchemy as sa
from alembic import op

revision = "TeacherPlayProfile"
down_revision = "DropBildirimlerTab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from chess_api.services.password import hash_pin

    conn = op.get_bind()
    rows = conn.execute(sa.text(
        """
        SELECT u.id, u.name, u.email, u.phone, u.province, u.lichess_username
        FROM users u
        WHERE u.role = 'teacher'
          AND NOT EXISTS (
            SELECT 1 FROM child_profiles c WHERE c.parent_user_id = u.id
          )
        """
    )).fetchall()
    for uid, name, email, phone, province, lichess in rows:
        conn.execute(sa.text(
            """
            INSERT INTO child_profiles
                (parent_user_id, display_name, age, avatar, pin_hash,
                 province, athlete_phone, athlete_email, lichess_username, created_at)
            VALUES
                (:uid, :name, 0, 'default', :pin_hash,
                 :province, :phone, :email, :lichess, CURRENT_TIMESTAMP)
            """
        ), {
            "uid": uid, "name": name or "Antrenör",
            "pin_hash": hash_pin(secrets.token_urlsafe(16)),
            "province": province, "phone": phone, "email": email, "lichess": lichess,
        })


def downgrade() -> None:
    # Antrenörün oyun profili maç/pratik verisi taşıyabilir — geri alma
    # bilinçli olarak no-op (veri silinmez).
    pass
