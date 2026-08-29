"""Veri düzeltmesi: düzey isim/açıklama/konular alanları karışmıştı

Revision ID: ModuleFieldsDataFix
Revises: ModuleTopics

Madde 2026-09-08: Zafer admin panelinden düzenlerken (muhtemelen bir
tablodan kopyala-yapıştır ile) 4 düzeyin "isim" alanına isim+açıklamayı
TAB karakteriyle birleşik yapıştırmış (ör. "Temel Düzey\t(Anasınıfı...)");
ayrıca gerçek "konular" (topics) metnini "açıklama" (description) alanına
yazmış — yeni "Konular" alanı hep boş (None) kalmış. Bu, "Temel Düzey"
başlığının 3 ayrı satır yerine tek karışık satır olarak görünmesine
sebep oldu (Zafer'in bildirdiği hata).

Bu migration SADECE bu bilinen bozuk kalıpla eşleşen satırları düzeltir
(name LIKE 'X Düzey%') — temiz bir ortamda (bu 4 isim hiç oluşturulmamışsa)
hiçbir şey yapmaz, güvenli/etkisiz kalır.
"""
import sqlalchemy as sa
from alembic import op

revision = "ModuleFieldsDataFix"
down_revision = "ModuleTopics"
branch_labels = None
depends_on = None

# (eski-bozuk isim deseni, dogru isim, dogru aciklama, dogru konular)
FIXES = [
    (
        "Temel Düzey%",
        "Temel Düzey",
        "Anasınıfı Düzeyi, Temel Kuralları Öğrenme Evresinde / Puan Aralığı:0 – 399",
        "Satranç Tahtası, Taşlar ve Temel Kurallar",
    ),
    (
        "Başlangıç Düzeyi%",
        "Başlangıç Düzeyi",
        "Temel Kuralları Bilir, Taktiksel Gelişim Evresinde / Puan Aralığı:400 – 999",
        "Temel taktikler ve oyun prensipleri",
    ),
    (
        "Orta Düzey%",
        "Orta Düzey",
        "Taktiksel – Konumsal ve Stratejik Gelişim Evresinde / Puan Aralığı:1000 – 1599",
        "Açılışlar, pozisyonel oyun ve son oyun",
    ),
    (
        "İleri Düzey%",
        "İleri Düzey",
        "Taktiksel, Konumsal/Stratejik Düşüncesi Gelişmiş Evrede / Puan Aralığı: 1600 – 2199",
        "İleri taktikler, strateji ve turnuva hazırlığı",
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    for pattern, name, description, topics in FIXES:
        conn.execute(
            sa.text(
                "UPDATE modules SET name = :name, description = :description, topics = :topics "
                "WHERE name LIKE :pattern"
            ),
            {"name": name, "description": description, "topics": topics, "pattern": pattern},
        )


def downgrade() -> None:
    """Veri düzeltmesi geri alınamaz (eski karışık haline dönmenin bir
    faydası yok) — kasıtlı olarak no-op."""
    pass
