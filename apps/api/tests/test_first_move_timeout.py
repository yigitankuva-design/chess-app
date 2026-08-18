import asyncio
import pytest
from chess_api.models import Game, GameType, GameStatus, GameMove
from chess_api.routers.live_game import _start_first_move_timer
from chess_api.services.game_room import get_room, _reset_for_tests


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


async def _make_game(db, **overrides) -> Game:
    defaults = dict(type=GameType.human, white_child_id=1, black_child_id=2,
                    status=GameStatus.active)
    defaults.update(overrides)
    game = Game(**defaults)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game


class _SessionCtx:
    """Testte 'async with get_session_factory()() as db' kalibini karsilar."""

    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_zaman_asiminda_mac_iptal_olur_ve_iki_tarafa_bildirilir(db, monkeypatch):
    """Madde 4: iki oyuncu da baglandiktan sonra 10sn (testte kisaltilmis)
    icinde ilk hamle gelmezse mac otomatik iptal olur."""
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    monkeypatch.setattr("chess_api.routers.live_game.FIRST_MOVE_TIMEOUT_SECONDS", 0.05)
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _start_first_move_timer(game.id, room)
    await asyncio.sleep(0.15)  # zamanlayicinin tetiklenmesini bekle

    await db.refresh(game)
    assert game.status == GameStatus.aborted
    for sender in (white, black):
        aborted = [m for m in sender.messages if m.get("type") == "game_aborted"]
        assert aborted, "her iki tarafa da game_aborted gitmeli"
        assert aborted[0]["reason"] == "first_move_timeout"


@pytest.mark.asyncio
async def test_hamle_yapilmissa_mac_iptal_olmaz(db, monkeypatch):
    """Ilk hamle zamaninda yapilmissa zamanlayici sessizce hicbir sey yapmaz."""
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    monkeypatch.setattr("chess_api.routers.live_game.FIRST_MOVE_TIMEOUT_SECONDS", 0.05)
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _start_first_move_timer(game.id, room)
    # Zamanlayici hala calisirken ilk hamle "yapiliyor" (dogrudan DB'ye kayit).
    db.add(GameMove(game_id=game.id, ply=1, san="e4",
                    fen_after="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"))
    await db.commit()
    await asyncio.sleep(0.15)

    await db.refresh(game)
    assert game.status == GameStatus.active  # iptal OLMADI
    assert not any(m.get("type") == "game_aborted" for m in white.messages + black.messages)


@pytest.mark.asyncio
async def test_bitmis_mac_icin_iptal_calismaz(db, monkeypatch):
    """Zamanlayici tetiklendiginde mac zaten bitmisse (resign/draw vb.)
    dokunulmaz — 'active' disindaki durumlar korunur."""
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    monkeypatch.setattr("chess_api.routers.live_game.FIRST_MOVE_TIMEOUT_SECONDS", 0.05)
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _start_first_move_timer(game.id, room)
    game.status = GameStatus.finished  # ör. terk etme ile bitti
    await db.commit()
    await asyncio.sleep(0.15)

    await db.refresh(game)
    assert game.status == GameStatus.finished  # aborted'a DEGISMEDI
    assert not any(m.get("type") == "game_aborted" for m in white.messages + black.messages)


@pytest.mark.asyncio
async def test_ayni_mac_icin_zamanlayici_iki_kez_baslamaz(db, monkeypatch):
    """Iki cihazdan baglanma gibi durumlarda ayni oyun icin zamanlayici
    yalnizca BIR KEZ kurulur — iki kez game_aborted gitmez."""
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    monkeypatch.setattr("chess_api.routers.live_game.FIRST_MOVE_TIMEOUT_SECONDS", 0.05)
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _start_first_move_timer(game.id, room)
    await _start_first_move_timer(game.id, room)  # ikinci cagri — yok sayilmali
    await asyncio.sleep(0.15)

    aborted_white = [m for m in white.messages if m.get("type") == "game_aborted"]
    assert len(aborted_white) == 1
