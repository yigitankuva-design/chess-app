"""In-memory varlik takibi: uygulamada olan sporcular.

lobby.py ile ayni desen (tek instance deploy varsayimi). lobby.py'den AYRI
yasar cunku iki kavram farklidir:
  - lobby.py  = "oyun lobisinde, oynamaya hazir"
  - presence  = "uygulamanin herhangi bir yerinde"

Zaman DISARIDAN verilir (now parametresi); time.time() burada cagrilmaz.
Sebep: zaman asimi davranisi ancak boyle sleep'siz test edilebilir.
"""
from typing import Any

PRESENCE_TTL_SECONDS = 60.0

# child_id -> (display_name, last_seen_epoch)
_seen: dict[int, tuple[str, float]] = {}


def _prune(now: float) -> None:
    """Suresi gecmis kayitlari atar — sozluk sinirsiz buyumesin."""
    expired = [cid for cid, (_, seen) in _seen.items() if now - seen > PRESENCE_TTL_SECONDS]
    for cid in expired:
        _seen.pop(cid, None)


def touch(child_id: int, display_name: str, now: float) -> None:
    """Sporcunun 'buradayim' sinyalini kaydeder."""
    _prune(now)
    _seen[child_id] = (display_name, now)


def active_players(exclude: int | None, now: float) -> list[dict[str, Any]]:
    """Son PRESENCE_TTL_SECONDS icinde gorulen sporcular; exclude listeden cikarilir."""
    return [
        {"child_id": cid, "display_name": name}
        for cid, (name, seen) in _seen.items()
        if cid != exclude and now - seen <= PRESENCE_TTL_SECONDS
    ]


def active_count(exclude: int | None, now: float) -> int:
    """Aktif sporcu sayisi. active_players ile AYNI filtreyi kullanir (DRY)."""
    return len(active_players(exclude=exclude, now=now))


def _reset_for_tests() -> None:
    _seen.clear()
