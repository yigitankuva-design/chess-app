"""Teklif alindiginda kimin beyaz kimin siyah oynayacagini belirler.

Rastgelelik PARAMETRE olarak gelir (coin) — boylece test 'random' modulunu
yamalamak zorunda kalmaz. presence.py'deki 'now' enjeksiyonuyla ayni fikir.
"""


def resolve_sides(owner_color: str, owner_id: int, taker_id: int,
                  coin: bool) -> tuple[int, int]:
    """(white_child_id, black_child_id) doner.

    owner_color 'white'  -> teklif sahibi beyaz, kabul eden siyah
    owner_color 'black'  -> teklif sahibi siyah, kabul eden beyaz
    owner_color 'random' -> coin True ise sahibi beyaz, False ise kabul eden
    """
    if owner_color == "white":
        return owner_id, taker_id
    if owner_color == "black":
        return taker_id, owner_id
    if owner_color == "random":
        return (owner_id, taker_id) if coin else (taker_id, owner_id)
    raise ValueError(f"gecersiz renk: {owner_color}")
