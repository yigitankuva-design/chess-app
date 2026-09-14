# Madde 2026-09-14 (sunucu analiz motoru): "Analiz Et" özeti artık backend'de
# native Stockfish ile HESAPLANIYOR (istemci sadece POST ile tetikliyor, GET
# ile poll ediyor) — bkz. services/game_analysis_engine.py. Gerçek stockfish
# binary'si testte KURULU DEĞİL (bot_engine testleriyle AYNI durum) —
# `_run_full_analysis` monkeypatch'lenir. Arka plan işi kendi DB session'ını
# `chess_api.database.get_session_factory()` üzerinden açtığı için, testin
# kullandığı in-memory SQLite `db_engine`'e yönlendirilmesi GEREKİR (autouse
# fixture, aşağıda).
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from chess_api.models import Game, GameMove, GameStatus, GameType
from chess_api.services import game_analysis_engine

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
FEN_AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
FEN_AFTER_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"


@pytest.fixture(autouse=True)
def _patch_analysis_session(monkeypatch, db_engine):
    """Arka plan işinin AYRI DB session'ını testin in-memory SQLite
    motoruna yönlendirir — yoksa `settings().DATABASE_URL`'e (gerçek/prod
    bağlantı dizesi) bağlanmaya çalışırdı."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(game_analysis_engine, "get_session_factory", lambda: factory)


async def _fake_analysis(fens: list[str]):
    """Deterministik sahte motor: ply 0 eval=0, sonraki HER ply -350 —
    sporcunun (beyaz varsayılan) ilk hamlesi tek başına 350cp'lik bir
    'vahim hata' (blunder, eşik 300) olarak sınıflansın diye."""
    eval_by_ply = [{"ply": i, "cp": 0 if i == 0 else -350, "mate": None} for i in range(len(fens))]
    best_move_by_ply = {i: "g1f3" for i in range(len(fens))}
    return eval_by_ply, best_move_by_ply


async def _finished_bot_game(db, child_id: int, moves: list[tuple[str, str]] | None = None) -> int:
    game = Game(type=GameType.bot, status=GameStatus.finished, white_child_id=child_id, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    for ply, (san, fen_after) in enumerate(moves or [], start=1):
        db.add(GameMove(game_id=game.id, ply=ply, san=san, fen_after=fen_after))
    if moves:
        await db.commit()
    return game.id


async def _active_bot_game(db, child_id: int) -> int:
    game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=child_id, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game.id


async def _wait_for_analysis(client, auth, game_id):
    """POST'un başlattığı arka plan task'ını (varsa) DOĞRUDAN bekler, sonra
    tek bir GET yapar. Testteki in-memory SQLite `StaticPool` TEK bir fiziksel
    bağlantıyı paylaştığı için, GET'i tekrar tekrar (ayrı session'larla) POLL
    etmek arka plan işiyle YARIŞA girip commit'i görünmez kılabiliyor — gerçek
    Postgres'te (ayrı connection pool) bu sorun yok, bu tamamen test ortamına
    özgü bir yarış. Task'ı doğrudan awaitlemek bunu bypass eder."""
    for task in list(game_analysis_engine._background_tasks):
        await task
    return await client.get(f"/games/{game_id}/analysis", headers=auth)


@pytest.mark.asyncio
async def test_analiz_istenir_arka_planda_hesaplanir_ve_poll_ile_alinir(client, child_auth, db, monkeypatch):
    monkeypatch.setattr(game_analysis_engine, "_run_full_analysis", _fake_analysis)
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id, moves=[("e4", FEN_AFTER_E4), ("e5", FEN_AFTER_E5)])
    auth = {"Authorization": f"Bearer {token}"}

    r = await client.post(f"/games/{game_id}/analysis", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"

    r = await _wait_for_analysis(client, auth, game_id)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "done"
    assert data["blunders"] == 1
    assert data["mistakes"] == 0
    assert data["inaccuracies"] == 0
    assert data["acpl"] == 350
    assert len(data["mistake_moves"]) == 1
    assert data["mistake_moves"][0]["severity"] == "blunder"
    assert data["mistake_moves"][0]["played_san"] == "e4"
    assert data["mistake_moves"][0]["best_move"] == "g1f3"
    # Madde: notasyon ?/??/!/!! işaretleri için HER ply'ın ham skoru da döner.
    assert len(data["eval_by_ply"]) == 3
    assert data["eval_by_ply"][0]["cp"] == 0


@pytest.mark.asyncio
async def test_zaten_hesaplanmis_analiz_tekrar_hesaplanmaz(client, child_auth, db, monkeypatch):
    call_count = 0

    async def counting_fake(fens):
        nonlocal call_count
        call_count += 1
        return await _fake_analysis(fens)

    monkeypatch.setattr(game_analysis_engine, "_run_full_analysis", counting_fake)
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id, moves=[("e4", FEN_AFTER_E4), ("e5", FEN_AFTER_E5)])
    auth = {"Authorization": f"Bearer {token}"}

    await client.post(f"/games/{game_id}/analysis", headers=auth)
    await _wait_for_analysis(client, auth, game_id)

    r = await client.post(f"/games/{game_id}/analysis", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "done"
    assert call_count == 1


@pytest.mark.asyncio
async def test_henuz_istenmediyse_get_404(client, child_auth, db):
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id, moves=[("e4", FEN_AFTER_E4)])
    r = await client.get(f"/games/{game_id}/analysis", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bitmemis_mac_analiz_edilemez(client, child_auth, db):
    token, child_id = child_auth
    game_id = await _active_bot_game(db, child_id)
    r = await client.post(f"/games/{game_id}/analysis", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_baskasinin_macina_istek_atamaz_ve_okuyamaz(client, child_auth, db, monkeypatch):
    monkeypatch.setattr(game_analysis_engine, "_run_full_analysis", _fake_analysis)
    from tests.test_notifications import _child_login, ch

    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id, moves=[("e4", FEN_AFTER_E4)])

    other_tok, _ = await _child_login(client, "ga_other@t.com")
    r = await client.post(f"/games/{game_id}/analysis", headers=ch(other_tok))
    assert r.status_code == 403
    r = await client.get(f"/games/{game_id}/analysis", headers=ch(other_tok))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_hic_hata_yoksa_bos_mistake_moves(client, child_auth, db, monkeypatch):
    async def _no_mistakes(fens: list[str]):
        # HER ply aynı skor -> hiç cp kaybı yok -> mistake_moves bos.
        eval_by_ply = [{"ply": i, "cp": 10, "mate": None} for i in range(len(fens))]
        return eval_by_ply, {i: "g1f3" for i in range(len(fens))}

    monkeypatch.setattr(game_analysis_engine, "_run_full_analysis", _no_mistakes)
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id, moves=[("e4", FEN_AFTER_E4), ("e5", FEN_AFTER_E5)])
    auth = {"Authorization": f"Bearer {token}"}

    await client.post(f"/games/{game_id}/analysis", headers=auth)
    r = await _wait_for_analysis(client, auth, game_id)
    data = r.json()
    assert data["mistake_moves"] == []
    assert data["blunders"] == 0 and data["mistakes"] == 0 and data["inaccuracies"] == 0
