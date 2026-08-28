"""Turnuva kuyrugu WS ucu — router seviyesi testler.

NEDEN monkeypatch: tournament_ws.py VE live_game.py'nin _create_human_game'i
KENDI oturumunu acar (get_session_factory()). conftest'teki get_db override'i
yalnizca FastAPI bagimliligina uygulanir, dogrudan cagrilan bu fabrikaya
DEGIL — o yuzden testler gercek DATABASE_URL'e baglanmaya kalkar ve
ConnectionError verir (bkz. test_game_clock_ws.py::clock_env, ayni desen).
"""
from datetime import datetime
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from fastapi.testclient import TestClient
from chess_api.main import create_app
from chess_api.services.jwt import encode_token
from chess_api.services.arena_matchmaking import _reset_for_tests
from chess_api.models import Tournament, TournamentStatus, TournamentParticipant, TournamentPairing


@pytest_asyncio.fixture
async def tournament_env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr("chess_api.routers.tournament_ws.get_session_factory", lambda: factory)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory", lambda: factory)
    _reset_for_tests()
    yield factory
    _reset_for_tests()


async def _make_tournament(factory, **overrides) -> int:
    async with factory() as db:
        t = Tournament(
            name="Arena", created_by_user_id=1,
            starts_at=datetime.utcnow(), duration_minutes=60,
            status=TournamentStatus.active,
        )
        for k, v in overrides.items():
            setattr(t, k, v)
        db.add(t)
        await db.commit()
        await db.refresh(t)
        return t.id


async def _join(factory, tournament_id: int, child_id: int, score: float = 0.0) -> None:
    async with factory() as db:
        db.add(TournamentParticipant(tournament_id=tournament_id, child_id=child_id, score=score))
        await db.commit()


def _token(child_id: int) -> str:
    return encode_token({"child_profile_id": child_id, "role": "child"})


@pytest.mark.asyncio
async def test_gecersiz_token_reddedilir(tournament_env):
    tid = await _make_tournament(tournament_env)
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/tournament/{tid}/queue?token=not.a.real.token") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["message"] == "auth"


@pytest.mark.asyncio
async def test_katilmamis_sporcu_reddedilir(tournament_env):
    tid = await _make_tournament(tournament_env)
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/tournament/{tid}/queue?token={_token(1)}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["message"] == "not_joined"


@pytest.mark.asyncio
async def test_bitmis_turnuvaya_baglanamaz(tournament_env):
    tid = await _make_tournament(tournament_env, status=TournamentStatus.finished)
    await _join(tournament_env, tid, 1)
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/tournament/{tid}/queue?token={_token(1)}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["message"] == "not_active"


@pytest.mark.asyncio
async def test_katilan_sporcu_bekler_ve_zaman_asimina_ugrar(tournament_env, monkeypatch):
    """Tek basina baglanan sporcu 'waiting' gorur, rakip gelmezse 'timeout'.

    NOT: find_arena_opponent'a WS ucunda sabit wait_timeout=55.0 verilir —
    fonksiyon varsayilan degeri modul import aninda BAGLANDIGI icin
    DEFAULT_WAIT_TIMEOUT'u sonradan degistirmek hicbir sey yapmaz; bu yuzden
    cagriyi KISA sureli bir sarmalayiciyla degistiriyoruz."""
    from chess_api.services.arena_matchmaking import find_arena_opponent as _real_find

    async def _short_timeout_find(*args, **kwargs):
        kwargs["wait_timeout"] = 0.3
        return await _real_find(*args, **kwargs)

    monkeypatch.setattr("chess_api.routers.tournament_ws.find_arena_opponent", _short_timeout_find)
    tid = await _make_tournament(tournament_env)
    await _join(tournament_env, tid, 1)
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/tournament/{tid}/queue?token={_token(1)}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "waiting"
        msg = ws.receive_json()
        assert msg["type"] == "timeout"


@pytest.mark.asyncio
async def test_eslesince_mac_ve_esleme_birlikte_olusur(tournament_env):
    """NOT: iki es zamanli WS istemcisini AYNI TestClient portalinda test
    ETMIYORUZ — bu, bu projede zaten bilinen bir sinir (bkz.
    test_live_two_moves.py basindaki not: 'WebSocket harness'i iki eszamanli
    istemcide kilitleniyor'). Eslesme mantigi (kim kiminle, tolerans yok)
    zaten test_arena_matchmaking.py'de saf asyncio ile dogrudan test ediliyor;
    burada sadece WS ucunun kullandigi create_game callback'inin —
    tournament_ws._create_pairing_game — GERCEK bir Game VE ona bagli
    TournamentPairing satiri olusturdugunu dogruluyoruz."""
    from chess_api.routers.tournament_ws import _create_pairing_game
    from chess_api.models import Game
    from sqlalchemy import select

    fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    tid = await _make_tournament(
        tournament_env, base_ms=300_000, increment_ms=0, rated=True, start_fen=fen,
    )

    game_id = await _create_pairing_game(tid, 1, 2)

    async with tournament_env() as db:
        game = await db.get(Game, game_id)
        assert game is not None
        assert game.white_child_id == 1 and game.black_child_id == 2
        assert game.base_ms == 300_000
        assert game.rated is True
        # "Başlangıç Konumu" (2026-09-06): turnuvanin FEN'i maca aynen tasinir.
        assert game.start_fen == fen

        pairing = (await db.execute(
            select(TournamentPairing).where(TournamentPairing.tournament_id == tid)
        )).scalar_one()
        assert pairing.game_id == game_id
        assert pairing.white_child_id == 1 and pairing.black_child_id == 2
        assert pairing.result is None
