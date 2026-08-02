"""Bota beraberlik teklifi — sunucu tarafi saf mantik.

apps/web/lib/play/botDraw.ts'teki materialDiff/botAcceptsDraw ile BIREBIR
AYNI mantik (Python'a birebir cevrildi).
"""
VALUE = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}


def material_diff(fen: str) -> int:
    """FEN'in tas dizilimi bolumunden malzeme farkini hesaplar (beyaz lehine)."""
    board = fen.strip().split()[0]
    diff = 0
    for ch in board:
        lower = ch.lower()
        v = VALUE.get(lower)
        if v is None:
            continue  # rakam veya '/'
        diff += -v if ch == lower else v  # kucuk harf siyah, buyuk beyaz
    return diff


def bot_accepts_draw(fen: str, bot_color: str) -> bool:
    """Bot teklifi kabul eder mi? bot_color botun rengi ('w'/'b')."""
    white = material_diff(fen)
    bot_lead = white if bot_color == "w" else -white
    return bot_lead <= 1
