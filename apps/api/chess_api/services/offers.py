"""In-memory teklif panosu: sporcularin biraktigi acik mac teklifleri.

lobby.py ve presence.py ile ayni deseni izler (tek instance deploy varsayimi).
Coklu instance icin Redis pub/sub gerekir — mevcut lobby.py, matchmaking.py ve
game_room.py'de de ayni sinir var.

Teklif KALICI DEGILDIR: sporcu lobiden ciktigi an silinir, sunucu yeniden
baslarsa pano bosalir. Bu yuzden veritabani tablosu yoktur.
"""
from typing import Any

VALID_COLORS = ("white", "black", "random")

# child_id -> teklif. Bir cocugun AYNI ANDA tek teklifi olabilir.
_offers: dict[int, dict[str, Any]] = {}


def create_offer(child_id: int, display_name: str, tempo: str, tc_label: str,
                 tc_base: int, tc_increment: int, color: str) -> dict[str, Any]:
    """Yeni teklif. Ayni cocugun eski teklifi USTUNE YAZILIR (tek teklif kurali)."""
    if color not in VALID_COLORS:
        raise ValueError(f"gecersiz renk: {color}")
    offer: dict[str, Any] = {
        "child_id": child_id,
        "display_name": display_name,
        "tempo": tempo,
        "tc_label": tc_label,
        "tc_base": tc_base,
        "tc_increment": tc_increment,
        "color": color,
    }
    _offers[child_id] = offer
    return offer


def cancel_offer(child_id: int) -> None:
    """Teklifi kaldirir. Teklif yoksa sessizce gecer."""
    _offers.pop(child_id, None)


def list_offers(exclude: int | None = None) -> list[dict[str, Any]]:
    """Panodaki teklifler. exclude verilirse o cocugun teklifi cikarilir."""
    return [o for cid, o in _offers.items() if cid != exclude]


def take_offer(child_id: int) -> dict[str, Any] | None:
    """Teklifi panodan CEKER ve dondurur; yoksa None.

    Yaris durumunun tek savunmasi budur: iki sporcu ayni teklife ayni anda
    bassa dict.pop yalnizca birinde deger dondurur (tek olay dongusu).
    """
    return _offers.pop(child_id, None)


def my_offer(child_id: int) -> dict[str, Any] | None:
    """Sporcunun KENDI teklifi. list_offers herkese kendi teklifi haric liste
    gonderdigi icin, sporcu kendi teklifini ancak buradan gorebilir."""
    return _offers.get(child_id)


def _reset_for_tests() -> None:
    _offers.clear()
