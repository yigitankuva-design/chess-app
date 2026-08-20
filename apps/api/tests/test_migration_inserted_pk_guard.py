"""Migration'larda `inserted_primary_key` kullanılmasını engelleyen koruma testi.

2026-08-20'de canlı deploy bu yüzden çöktü (IndexError: tuple index out of range):
`sa.table(...)` HAFİF bir yapıdır, birincil anahtar bilgisi taşımaz. Bu yüzden
`conn.execute(tbl.insert()...).inserted_primary_key` BOŞ demet () döner ve `[0]`
patlar. PostgreSQL'de de SQLite'ta da böyle.

Migration'lar test paketinde ÇALIŞTIRILMADIĞI için (şema modellerden kuruluyor)
bu hata pytest'ten geçti ve ancak canlıda ortaya çıktı. Bu statik kontrol, aynı
tuzağa tekrar düşülmesini ucuz yoldan engeller.

Yeni satırın id'sini almanın güvenli yolu: önce INSERT, sonra benzersiz bir
sütuna göre SELECT (bkz. 20260820_OpeningType_add.py içindeki `_insert_type`).
"""
import re
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

# Nokta ZORUNLU: yasak olan OZNITELIK ERISIMI (`.inserted_primary_key`).
# Aciklama metninde noktasiz gecmesi serbest — nedeni anlatmak yasak degil.
PATTERN = re.compile(r"\.inserted_primary_key\b")


def test_no_migration_uses_inserted_primary_key():
    offenders = []
    for path in sorted(VERSIONS_DIR.glob("*.py")):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if line.lstrip().startswith("#"):
                continue  # açıklama satırı sayılmaz
            if PATTERN.search(line):
                offenders.append(f"{path.name}:{line_no}")
    assert not offenders, (
        "Migration'da `inserted_primary_key` kullanılmış. sa.table() birincil anahtar "
        "taşımadığı için bu BOŞ demet döner ve canlıda IndexError verir. Yerine "
        "INSERT + benzersiz sütuna göre SELECT kullan: " + ", ".join(offenders)
    )
