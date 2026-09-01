"""Berserk (madde 2026-09-10) — routers/live_game.py::_handle_berserk testleri.

test_first_move_timeout.py'deki AYNI desen: doğrudan fonksiyon çağrısı +
FakeSender/_SessionCtx (get_session_factory KENDİ oturumunu açtığı için
monkeypatch edilir, conftest'teki get_db override'i buna uygulanmaz)."""
from datetime import datetime
import pytest
from chess_api.models import (
    Game, GameType, GameStatus, GameMove,
    Tournament, TournamentStatus, TournamentType, TournamentPairing,
)
from chess_api.routers.live_game import _handle_berserk
from chess_api.services.tournaments import finalize_tournament_pairing
from chess_api.services.game_room import get_room, _reset_for_tests


class FakeSender:
    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


class _SessionCtx:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *exc):
        return False


async def _setup(db, monkeypatch, *, tournament_type=TournamentType.arena,
                 berserk_enabled=True, base_ms=180_000, increment_ms=2_000,
                 played_move=False):
    """Yıldırım tempo (180s+2s) varsayılan — bkz. services/tempo.py."""
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    t = Tournament(
        name="X", created_by_user_id=1, tournament_type=tournament_type,
        status=TournamentStatus.active, starts_at=datetime.utcnow(),
        duration_minutes=60 if tournament_type == TournamentType.arena else None,
        rounds_total=None if tournament_type == TournamentType.arena else 3,
        berserk_enabled=berserk_enabled,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    game = Game(
        type=GameType.human, white_child_id=1, black_child_id=2, status=GameStatus.active,
        base_ms=base_ms, increment_ms=increment_ms, white_ms=base_ms, black_ms=base_ms,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    pairing = TournamentPairing(
        tournament_id=t.id, white_child_id=1, black_child_id=2, game_id=game.id,
    )
    db.add(pairing)
    await db.commit()
    await db.refresh(pairing)
    if played_move:
        db.add(GameMove(game_id=game.id, ply=1, san="e4",
                        fen_after="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"))
        await db.commit()
    _reset_for_tests()
    return game, pairing


@pytest.mark.asyncio
async def test_berserk_kendi_saatini_yariya_indirir(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch)
    room = get_room(game.id)
    white_sender = FakeSender()
    room.join(1, white_sender)

    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)

    await db.refresh(game)
    await db.refresh(pairing)
    assert game.white_ms == 90_000  # 180_000 // 2
    assert game.black_ms == 180_000  # rakibin saati DEĞİŞMEDİ
    assert pairing.white_berserked is True
    assert pairing.black_berserked is False
    # Madde 2026-09-XX: game satırında da işaretlenir — saat mantığı
    # (_clock_state) buradan okur, artırımı da SIFIRLAR (bkz. test_clock.py).
    assert game.white_berserked is True
    assert game.black_berserked is False
    berserked_msgs = [m for m in white_sender.messages if m.get("type") == "berserked"]
    assert berserked_msgs and berserked_msgs[0]["child_id"] == 1
    assert berserked_msgs[0]["color"] == "white"


@pytest.mark.asyncio
async def test_ilk_hamleden_sonra_berserk_edilemez(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch, played_move=True)
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    await db.refresh(pairing)
    assert game.white_ms == 180_000  # değişmedi
    assert pairing.white_berserked is False


@pytest.mark.asyncio
async def test_isvicrede_berserk_calismaz(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch, tournament_type=TournamentType.swiss)
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    assert game.white_ms == 180_000


@pytest.mark.asyncio
async def test_klasik_tempoda_berserk_calismaz(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch, base_ms=1_800_000, increment_ms=10_000)
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    assert game.white_ms == 1_800_000


@pytest.mark.asyncio
async def test_berserk_kapaliyken_calismaz(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch, berserk_enabled=False)
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    assert game.white_ms == 180_000


@pytest.mark.asyncio
async def test_ayni_taraf_iki_kez_berserk_edemez(db, monkeypatch):
    game, pairing = await _setup(db, monkeypatch)
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    first_ms = game.white_ms
    # İkinci deneme: saat zaten yarıya inmiş durumda tekrar yarıya İNMEMELİ.
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    assert game.white_ms == first_ms


@pytest.mark.asyncio
async def test_arkadas_macinda_berserk_calismaz(db, monkeypatch):
    """Pairing YOKSA (arkadaş maçı) berserk sessizce hiçbir şey yapmaz."""
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2, status=GameStatus.active,
               base_ms=180_000, increment_ms=2_000, white_ms=180_000, black_ms=180_000)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    _reset_for_tests()
    room = get_room(game.id)
    await _handle_berserk(game.id, 1, white_id=1, black_id=2, room=room)
    await db.refresh(game)
    assert game.white_ms == 180_000


@pytest.mark.asyncio
async def test_berserk_kazaninca_bonus_puan_alir(db):
    """Entegrasyon: finalize_tournament_pairing, pairing'in berserk bayrağını
    okuyup +1 sabit bonus uygular (madde 2026-09-10) — AMA sadece madde
    2026-09-XX'teki istismar-önleme şartı da sağlanıyorsa (en az
    MIN_BERSERK_BONUS_MOVES=10 hamle oynanmış olmalı, bkz. test_berserk_
    az_hamlede_bonus_yok)."""
    from chess_api.models import ChildProfile, GameMove, GameResult, TournamentParticipant

    t = Tournament(name="X", created_by_user_id=1, tournament_type=TournamentType.arena,
                   status=TournamentStatus.active, starts_at=datetime.utcnow(),
                   duration_minutes=60, berserk_enabled=True)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=p1.id, black_child_id=p2.id, result=GameResult.white_wins)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    for ply in range(1, 11):  # 10 hamle — eşiği TAM karşılıyor
        db.add(GameMove(game_id=game.id, ply=ply, san="e4", fen_after="x"))
    pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
                                game_id=game.id, white_berserked=True)
    db.add(pairing)
    await db.commit()

    await finalize_tournament_pairing(db, game)
    await db.commit()

    from sqlalchemy import select
    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 3.0  # 2 (galibiyet) + 1 (berserk bonusu)
    assert scores[p2.id] == 0.0


@pytest.mark.asyncio
async def test_berserk_az_hamlede_bonus_yok(db):
    """Madde 2026-09-XX: istismarı önlemek için — 10 hamleden AZ oynanmış bir
    maçta berserk yapıp kazansa bile +1 bonus VERİLMEZ (düz galibiyet puanı
    kalır)."""
    from chess_api.models import ChildProfile, GameMove, GameResult, TournamentParticipant

    t = Tournament(name="X", created_by_user_id=1, tournament_type=TournamentType.arena,
                   status=TournamentStatus.active, starts_at=datetime.utcnow(),
                   duration_minutes=60, berserk_enabled=True)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=p1.id, black_child_id=p2.id, result=GameResult.white_wins)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    for ply in range(1, 4):  # sadece 3 hamle — eşiğin (10) ALTINDA
        db.add(GameMove(game_id=game.id, ply=ply, san="e4", fen_after="x"))
    pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
                                game_id=game.id, white_berserked=True)
    db.add(pairing)
    await db.commit()

    await finalize_tournament_pairing(db, game)
    await db.commit()

    from sqlalchemy import select
    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 2.0  # SADECE galibiyet — berserk bonusu YOK
    assert scores[p2.id] == 0.0


@pytest.mark.asyncio
async def test_berserk_kaybedince_bonus_yok(db):
    from chess_api.models import ChildProfile, GameResult, TournamentParticipant

    t = Tournament(name="X", created_by_user_id=1, tournament_type=TournamentType.arena,
                   status=TournamentStatus.active, starts_at=datetime.utcnow(),
                   duration_minutes=60, berserk_enabled=True)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=p1.id, black_child_id=p2.id, result=GameResult.black_wins)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
                                game_id=game.id, white_berserked=True)
    db.add(pairing)
    await db.commit()

    await finalize_tournament_pairing(db, game)
    await db.commit()

    from sqlalchemy import select
    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 0.0  # kaybetti — berserk bonusu YOK
    assert scores[p2.id] == 2.0
