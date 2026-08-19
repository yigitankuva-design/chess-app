import pytest
from chess_api.models import Game, GameType, GameStatus
from chess_api.routers.live_game import (
    _handle_rematch_offer, _handle_rematch_accept, _handle_rematch_decline,
    _rematch_pending,
)
from chess_api.services.game_room import get_room, _reset_for_tests


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


async def _make_finished_game(db, base_ms=None, increment_ms=None, start_fen=None) -> Game:
    game = Game(
        type=GameType.human, white_child_id=1, black_child_id=2,
        status=GameStatus.finished, base_ms=base_ms, increment_ms=increment_ms,
        start_fen=start_fen,
    )
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


@pytest.fixture(autouse=True)
def _clear_pending():
    _rematch_pending.clear()
    yield
    _rematch_pending.clear()


@pytest.mark.asyncio
async def test_teklif_rakibe_iletilir(db, monkeypatch):
    _reset_for_tests()
    game = await _make_finished_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_rematch_offer(game.id, child_id=1, room=room)

    assert any(m.get("type") == "rematch_offered" and m.get("by_child_id") == 1 for m in black.messages)
    assert not any(m.get("type") == "rematch_offered" for m in white.messages)
    assert _rematch_pending[game.id] == 1


@pytest.mark.asyncio
async def test_aktif_macta_teklif_yok_sayilir(db, monkeypatch):
    _reset_for_tests()
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2, status=GameStatus.active)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_rematch_offer(game.id, child_id=1, room=room)

    assert not any(m.get("type") == "rematch_offered" for m in black.messages)
    assert game.id not in _rematch_pending


@pytest.mark.asyncio
async def test_kabul_edilince_renkler_takas_edilerek_yeni_mac_acilir(db, monkeypatch):
    _reset_for_tests()
    game = await _make_finished_game(db, base_ms=300_000, increment_ms=3000, start_fen="8/8/8/8/8/8/8/8 w - - 0 1")
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_rematch_offer(game.id, child_id=1, room=room)
    await _handle_rematch_accept(game.id, child_id=2, white_id=1, black_id=2, room=room)

    ready = [m for m in (white.messages + black.messages) if m.get("type") == "rematch_ready"]
    assert len(ready) == 2  # her iki tarafa da gitti
    r = ready[0]
    # Eski beyaz (1) simdi siyah, eski siyah (2) simdi beyaz.
    assert r["white_id"] == 2
    assert r["black_id"] == 1
    assert r["game_id"] != game.id
    assert game.id not in _rematch_pending

    from sqlalchemy import select
    new_game = await db.get(Game, r["game_id"])
    assert new_game.base_ms == 300_000
    assert new_game.increment_ms == 3000
    assert new_game.start_fen == "8/8/8/8/8/8/8/8 w - - 0 1"


@pytest.mark.asyncio
async def test_kendi_teklifini_kabul_edemez(db, monkeypatch):
    _reset_for_tests()
    game = await _make_finished_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_rematch_offer(game.id, child_id=1, room=room)
    await _handle_rematch_accept(game.id, child_id=1, white_id=1, black_id=2, room=room)

    assert not any(m.get("type") == "rematch_ready" for m in (white.messages + black.messages))
    assert _rematch_pending[game.id] == 1  # teklif hala bekliyor


@pytest.mark.asyncio
async def test_red_teklif_edene_bildirilir(db, monkeypatch):
    _reset_for_tests()
    game = await _make_finished_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_rematch_offer(game.id, child_id=1, room=room)
    await _handle_rematch_decline(game.id, child_id=2, room=room)

    assert any(m.get("type") == "rematch_declined" and m.get("by_child_id") == 2 for m in white.messages)
    assert game.id not in _rematch_pending
