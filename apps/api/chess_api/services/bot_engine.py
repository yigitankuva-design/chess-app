"""Bot maci motoru — sunucu tarafi (madde: motor sunucuda).

depth_for_skill saf bir fonksiyondur, testte dogrudan sinanir. get_bot_move
gercek Stockfish binary'sini cagirir — testlerde HER ZAMAN monkeypatch ile
degistirilir (bu bilgisayarda binary kurulu degil, dogrulandi; production'da
Nixpacks ile kurulacak, bkz. tasarim belgesi).
"""
import chess
import chess.engine

# apps/web/lib/play/levels.ts'teki 8 duzeyle AYNI (skill -> depth). Sunucu
# bugune kadar yalnizca skill_level'i biliyordu; depth olmadan bot cok daha
# guclu oynardi (bkz. tasarim belgesi, "sorun B").
_SKILL_TO_DEPTH: list[tuple[int, int]] = [
    (0, 1), (3, 3), (6, 5), (9, 7), (12, 8), (15, 9), (18, 11), (20, 12),
]


def depth_for_skill(skill_level: int) -> int:
    """skill_level tabloda yoksa EN YAKIN ALT basamagin derinligini kullanir
    — sessizce cok guclu bir bot uretmekten daha guvenli."""
    depth = _SKILL_TO_DEPTH[0][1]
    for skill, d in _SKILL_TO_DEPTH:
        if skill_level >= skill:
            depth = d
        else:
            break
    return depth


async def get_bot_move(fen: str, skill_level: int) -> str | None:
    """Verilen pozisyonda botun hamlesini UCI notasyonunda dondurur.

    Motor hatasi/beklenmedik durumda None doner — cagiran taraf bunu 'bu
    turda hamle oynanmadi' olarak ele alir, mac KILITLENMEZ (bugunku istemci
    davranisiyla tutarli, bkz. BotGame.tsx'teki 'motor hatasi oyunu
    kilitlemez' yorumu).
    """
    board = chess.Board(fen)
    depth = depth_for_skill(skill_level)
    transport, engine = await chess.engine.popen_uci("stockfish")
    try:
        await engine.configure({"Skill Level": max(0, min(20, skill_level))})
        result = await engine.play(board, chess.engine.Limit(depth=depth))
        return result.move.uci() if result.move else None
    finally:
        await engine.quit()
