"""Turnuva sahibi (silme yetkisi) ve yumuşak çekilme (Sonneborn-Berger için)

Revision ID: TournamentOwnerAndLeave
Revises: ModuleFieldsDataFix

Madde 2026-09-09 (4, 5):
- tournaments.created_by_child_id: turnuvayı OLUŞTURAN sporcunun kendisi
  (created_by_user_id hoca/veli grubunu tutar, silme yetkisini artık BU
  alan belirler — sadece oluşturan sporcu silebilsin). Eski turnuvalarda
  NULL kalır (o turnuvalar zaten başlamış/bitmiş olduğu için yeni "başlamadan
  önce" kuralına takılıp öyle de öyle silinemez — geriye dönük sorun yok).
- tournament_participants.left_at: sporcu turnuvadan çekilince satır
  SİLİNMEZ, bu alan doldurulur — rakiplerinin Sonneborn-Berger hesabı
  (compute_sonneborn_berger) çekilenin dondurulmuş puanını görmeye devam
  eder, sadece sıralama GÖRÜNÜMÜNDEN düşer.
"""
import sqlalchemy as sa
from alembic import op

revision = "TournamentOwnerAndLeave"
down_revision = "ModuleFieldsDataFix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("created_by_child_id", sa.Integer(), nullable=True))
    op.add_column(
        "tournament_participants", sa.Column("left_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tournament_participants", "left_at")
    op.drop_column("tournaments", "created_by_child_id")
