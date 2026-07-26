"""In-memory lobi: o an bagli (aktif) sporcular ve aralarindaki mac davetleri.

game_room.py ile ayni deseni izler (tek instance deploy varsayimi). Coklu
instance icin Redis pub/sub gerekir — mevcut matchmaking.py'de de ayni sinir var.
"""
from typing import Any, Protocol


class Sender(Protocol):
    async def send_json(self, data: dict) -> None: ...


# child_id -> (display_name, sender)
_players: dict[int, tuple[str, Sender]] = {}


def join_lobby(child_id: int, display_name: str, sender: Sender) -> None:
    """Ayni cocuk tekrar baglanirsa eski kaydin uzerine yazilir (tek sekme kurali)."""
    _players[child_id] = (display_name, sender)


def leave_lobby(child_id: int) -> None:
    _players.pop(child_id, None)


def online_players(exclude: int | None = None) -> list[dict[str, Any]]:
    """Aktif sporcu listesi. exclude verilirse o cocuk listeden cikarilir."""
    return [
        {"child_id": cid, "display_name": name}
        for cid, (name, _) in _players.items()
        if cid != exclude
    ]


async def send_to_player(child_id: int, message: dict) -> bool:
    """Tek bir oyuncuya mesaj. Oyuncu bagli degilse False doner (sessiz)."""
    entry = _players.get(child_id)
    if not entry:
        return False
    try:
        await entry[1].send_json(message)
        return True
    except Exception:
        return False


def connected_ids() -> list[int]:
    """Lobideki tum cocuk id'leri.

    Yayin yapan taraf bunu gezip send_to_player ile HER SPORCUYA KENDI haric
    listesini gonderir (teklif panosu). _players dis dunyaya kapali kalsin
    diye yalnizca id'ler donulur.
    """
    return list(_players.keys())


def _reset_for_tests() -> None:
    _players.clear()
