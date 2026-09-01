"""İsviçre: Tur Arası Süre (round_gap_minutes / round_ready_at)

Revision ID: SwissRoundGap
Revises: BerserkIncrementGameFlags

Madde 2026-09-XX: raporun "tur arası bekleme süresi yok" tespitine karşılık
Zafer, Turnuva Oluştur ekranında (SADECE İsviçre seçiliyken) "Başlangıç
Konumu/FEN" alanının yerine "Tur Arası Süre" (5/10/15/30 dk) seçimi
istedi — bu yüzden İsviçre turnuvalarında start_fen artık HİÇ ayarlanamaz
(her zaman standart başlangıç), yerine bu iki yeni alan geldi:

- tournaments.round_gap_minutes: kurucunun seçtiği dakika (SADECE İsviçre).
- tournaments.round_ready_at: bir turun TÜM eşleşmeleri sonuçlandığı an
  (bekleme süresinin başlangıcı) — sıradaki tur üretilince NULL'a döner.

İkisi de NULLABLE — eski turnuvalarda NULL kalır, services/swiss.py bunu
"0 dakika bekleme, eski (anında geçiş) davranış" olarak yorumlar (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "SwissRoundGap"
down_revision = "BerserkIncrementGameFlags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("round_gap_minutes", sa.Integer(), nullable=True))
    op.add_column("tournaments", sa.Column("round_ready_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("tournaments", "round_ready_at")
    op.drop_column("tournaments", "round_gap_minutes")
