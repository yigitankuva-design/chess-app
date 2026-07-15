"""Müfredat içeriğini silen migration yazılmasını engelleyen koruma testi.

İçerik artık hocanın panelden girdiği KULLANICI VERİSİ — seed değil.
Bir migration bu tabloları toplu silerse aylarca emek ve çocuk ilerlemesi gider.
"""
import re
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

CONTENT_TABLES = [
    "modules",
    "lessons",
    "lesson_steps",
    "child_lesson_progress",
    "child_lesson_step_results",
]

# Tarihsel dosyalar — zaten çalıştı, alembic zinciri bozulmasın diye silinmiyor.
ALLOWLIST = {
    "20260529_ResetCurriculum_clear_lessons_set_4_modules.py",
    "20260529_ResetCurriculum3_remove_old_seed_modules.py",
    "20260529_Lesson1_TahtaVeTaslar.py",
}


def _destructive_hits(text: str) -> list[str]:
    hits = []
    for table in CONTENT_TABLES:
        if re.search(rf"TRUNCATE\s+TABLE\s+{table}\b", text, re.IGNORECASE):
            hits.append(f"TRUNCATE {table}")
        if re.search(rf"DELETE\s+FROM\s+{table}\b", text, re.IGNORECASE):
            hits.append(f"DELETE FROM {table}")
    return hits


def test_no_new_migration_destroys_content():
    offenders = {}
    for path in VERSIONS_DIR.glob("*.py"):
        if path.name in ALLOWLIST:
            continue
        hits = _destructive_hits(path.read_text(encoding="utf-8"))
        if hits:
            offenders[path.name] = hits
    assert not offenders, (
        "İçerik tablolarını silen migration bulundu. İçerik kullanıcı verisidir, "
        f"migration'la silinemez: {offenders}"
    )


def test_allowlist_files_still_exist():
    """İzin listesi güncel kalsın — dosya silinmişse listeden de çıkarılmalı."""
    for name in ALLOWLIST:
        assert (VERSIONS_DIR / name).exists(), f"İzin listesindeki dosya yok: {name}"
