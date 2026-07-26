import pytest
from sqlalchemy import select
from chess_api.models import Game, GameType, GameStatus
from chess_api.routers.live_game import _handle_offer_draw, _handle_decline_draw
from chess_api.services.game_room import get_room, _reset_for_tests


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


async def _make_game(db) -> Game:
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2,
                status=GameStatus.active)
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
async def test_beraberlik_teklifi_rakibe_iletilir_ve_sayac_artar(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_offer_draw(game.id, child_id=1, white_id=1, room=room)

    assert any(m.get("type") == "draw_offered" for m in black.messages)
    await db.refresh(game)
    assert game.white_draw_offers == 1


@pytest.mark.asyncio
async def test_dorduncu_teklif_reddedilir(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    game.white_draw_offers = 3
    await db.commit()
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_offer_draw(game.id, child_id=1, white_id=1, room=room)

    # Rakibe teklif GITMEZ, teklif edene limit uyarisi gider
    assert not any(m.get("type") == "draw_offered" for m in black.messages)
    assert any(m.get("type") == "draw_offer_rejected" for m in white.messages)
    await db.refresh(game)
    assert game.white_draw_offers == 3  # artmadi


@pytest.mark.asyncio
async def test_red_rakibe_bildirilir_ve_oyun_devam_eder(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_decline_draw(game.id, child_id=2, room=room)

    assert any(m.get("type") == "draw_declined" for m in white.messages)
    await db.refresh(game)
    assert game.status == GameStatus.active  # oyun BITMEDI


@pytest.mark.asyncio
async def test_matta_game_over_yayinlanir(db, monkeypatch):
    """Mat sonunda sonuc bildirimi icin game_over sart (aksi halde frontend
    sonuc satirini hic gostermez)."""
    from chess_api.routers.live_game import _handle_move
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    # Ilk hamleden itibaren en kisa mat (Fool's mate) yerine dogrudan
    # validate_move'u taklit etmek yerine gercek hamleleri oynuyoruz:
    # 1. f3 e5 2. g4 Qh4# -> siyah mat eder.
    for uci, cid in [("f2f3", 1), ("e7e5", 2), ("g2g4", 1), ("d8h4", 2)]:
        await _handle_move(game.id, cid, 1, 2, {"uci": uci}, room)

    all_msgs = white.messages + black.messages
    over = [m for m in all_msgs if m.get("type") == "game_over"]
    assert over, "mat sonunda game_over yayinlanmali"
    assert over[-1]["result"] == "0-1"
