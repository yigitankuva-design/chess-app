import pytest
from sqlalchemy import select
from chess_api.models import Game, GameType, GameStatus, ChildProfile, ChildTempoRating
from chess_api.routers.live_game import _handle_resign
from chess_api.services.game_room import get_room, _reset_for_tests
from chess_api.services.jwt import encode_token


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


def _child_token(child_id: int) -> str:
    return encode_token({"child_profile_id": child_id})


async def _teacher(client, email):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Hoca",
    })
    return r.json()["access_token"], r.json()["user_id"]


async def _parent_id(client, email):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
    })
    return r.json()["user_id"]


async def _add_child(db, name, teacher_id, parent_id):
    c = ChildProfile(parent_user_id=parent_id, display_name=name, age=10, pin_hash="x", teacher_user_id=teacher_id)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.mark.asyncio
async def test_rated_mac_terk_edilince_ayni_committe_puan_guncellenir(db, monkeypatch):
    """5 bitis noktasindan biri (_handle_resign) — turnuva puanlamasi VE
    Performans Puani AYNI islemde (finalize_tournament_pairing +
    apply_rating_update, ikisi de _on_human_game_finished icinde) guncellenir."""
    _reset_for_tests()
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.active,
               white_child_id=p1.id, black_child_id=p2.id,
               base_ms=300_000, increment_ms=0, rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(p1.id, white)
    room.join(p2.id, black)

    await _handle_resign(game.id, child_id=p1.id, white_id=p1.id, black_id=p2.id, room=room)

    rows = (await db.execute(select(ChildTempoRating))).scalars().all()
    scores = {r.child_id: r.rating for r in rows}
    assert scores[p1.id] == 380  # p1 terk etti, kaybetti
    assert scores[p2.id] == 420


@pytest.mark.asyncio
async def test_athletes_tempo_parametresiyle_puan_doner(client, db):
    """Madde 2026-09-10: unvan sadece provisional (20 maç) bitince gelir —
    burada games_played=PROVISIONAL_GAMES ile established senaryosu test
    edilir (bkz. test_athletes_provisional_sporcuda_unvan_gizli, provisional hâli)."""
    tok, teacher_id = await _teacher(client, "rt1@t.com")
    parent_id = await _parent_id(client, "rp1@t.com")
    me = await _add_child(db, "Ben", teacher_id, parent_id)
    other = await _add_child(db, "Arkadaş", teacher_id, parent_id)
    db.add(ChildTempoRating(child_id=other.id, tempo="Hızlı", rating=555, games_played=20))
    await db.commit()

    h = {"Authorization": f"Bearer {_child_token(me.id)}"}
    r = await client.get("/athletes?tempo=Hızlı", headers=h)
    assert r.status_code == 200
    body = r.json()
    row = next(a for a in body if a["child_id"] == other.id)
    assert row["rating"] == 555
    assert row["title"] == "BD-2"


@pytest.mark.asyncio
async def test_athletes_provisional_sporcuda_unvan_gizli(client, db):
    """Madde 2026-09-10: 20 maçtan AZ oynamış bir sporcuda unvan None döner —
    puan yine görünür, sadece unvan gizlenir."""
    tok, teacher_id = await _teacher(client, "rt1b@t.com")
    parent_id = await _parent_id(client, "rp1b@t.com")
    me = await _add_child(db, "Ben", teacher_id, parent_id)
    other = await _add_child(db, "Arkadaş", teacher_id, parent_id)
    db.add(ChildTempoRating(child_id=other.id, tempo="Hızlı", rating=555, games_played=3))
    await db.commit()

    h = {"Authorization": f"Bearer {_child_token(me.id)}"}
    r = await client.get("/athletes?tempo=Hızlı", headers=h)
    body = r.json()
    row = next(a for a in body if a["child_id"] == other.id)
    assert row["rating"] == 555
    assert row["title"] is None


@pytest.mark.asyncio
async def test_athletes_tempo_verilmezse_puan_none(client, db):
    tok, teacher_id = await _teacher(client, "rt2@t.com")
    parent_id = await _parent_id(client, "rp2@t.com")
    me = await _add_child(db, "Ben", teacher_id, parent_id)
    await _add_child(db, "Arkadaş", teacher_id, parent_id)

    h = {"Authorization": f"Bearer {_child_token(me.id)}"}
    r = await client.get("/athletes", headers=h)
    assert r.status_code == 200
    assert all(a["rating"] is None for a in r.json())


@pytest.mark.asyncio
async def test_puanli_turnuva_maci_bitince_siralamaya_yansir(client, db):
    """Arena modelinde eslesme normalde WS uzerinden olusur (bkz.
    test_tournament_ws.py / arena_matchmaking) — burada asil test edilen
    finalize_tournament_pairing + apply_rating_update'in AYNI commit icinde
    puani gunceleyip standings'e yansimasi."""
    from datetime import datetime
    _, teacher_id = await _teacher(client, "rt3@t.com")
    parent_id = await _parent_id(client, "rp3@t.com")
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(2)]
    creator_h = {"Authorization": f"Bearer {_child_token(children[0].id)}"}
    created = (await client.post("/tournaments", headers=creator_h, json={
        "name": "Puanlı Turnuva",
        "starts_at": datetime.utcnow().isoformat(), "duration_minutes": 60,
        "base_ms": 300_000, "increment_ms": 0, "rated": True,
    })).json()
    assert created["rated"] is True
    assert created["tempo"] == "Yıldırım"

    r = await client.post(f"/tournaments/{created['id']}/join",
                          headers={"Authorization": f"Bearer {_child_token(children[1].id)}"})
    assert r.status_code == 201

    r = await client.get(f"/tournaments/{created['id']}",
                         headers={"Authorization": f"Bearer {_child_token(children[0].id)}"})
    standings = r.json()["standings"]
    assert all(s["rating"] == 400 for s in standings)  # henuz mac oynanmadi

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=children[0].id, black_child_id=children[1].id,
               base_ms=300_000, increment_ms=0, rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    from chess_api.models import TournamentPairing, GameResult
    pairing = TournamentPairing(tournament_id=created["id"],
                                white_child_id=children[0].id, black_child_id=children[1].id,
                                game_id=game.id)
    db.add(pairing)
    await db.commit()
    from chess_api.services.tournaments import finalize_tournament_pairing
    from chess_api.services.rating import apply_rating_update
    game.result = GameResult.white_wins
    await finalize_tournament_pairing(db, game)
    await apply_rating_update(db, game)
    await db.commit()

    r = await client.get(f"/tournaments/{created['id']}",
                         headers={"Authorization": f"Bearer {_child_token(children[0].id)}"})
    standings = r.json()["standings"]
    ratings = {s["child_id"]: s["rating"] for s in standings}
    assert ratings[children[0].id] == 420
    assert ratings[pairing.black_child_id] == 380
