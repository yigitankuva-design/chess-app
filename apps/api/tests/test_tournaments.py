import pytest
from sqlalchemy import select
from chess_api.models import (
    ChildProfile, Game, GameType, GameStatus, GameResult,
    Tournament, TournamentStatus, TournamentParticipant, TournamentPairing,
)
from chess_api.services.jwt import encode_token
from chess_api.services.tournaments import finalize_tournament_pairing
from chess_api.services.child_deletion import delete_child_cascade


async def _teacher(client, email="tt@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Hoca",
    })
    body = r.json()
    return body["access_token"], body["user_id"]


async def _parent_id(client, email="pp@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
    })
    return r.json()["user_id"]


async def _add_child(db, name: str, teacher_id: int | None, parent_id: int) -> ChildProfile:
    c = ChildProfile(
        parent_user_id=parent_id, display_name=name, age=10,
        pin_hash="x", teacher_user_id=teacher_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


def _child_token(child_id: int) -> str:
    return encode_token({"child_profile_id": child_id})


@pytest.mark.asyncio
async def test_turnuva_olusturma_ve_listeleme(client, db):
    tok, teacher_id = await _teacher(client, "t1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/tournaments", headers=h,
                          json={"name": "Yaz Turnuvası", "rounds_total": 3, "base_ms": 300000, "increment_ms": 2000})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Yaz Turnuvası"
    assert body["status"] == "upcoming"
    assert body["current_round"] is None

    r = await client.get("/admin/tournaments", headers=h)
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_baska_hocanin_turnuvasini_goremez(client, db):
    tok1, _ = await _teacher(client, "t2a@t.com")
    tok2, _ = await _teacher(client, "t2b@t.com")
    h1 = {"Authorization": f"Bearer {tok1}"}
    h2 = {"Authorization": f"Bearer {tok2}"}
    created = (await client.post("/admin/tournaments", headers=h1,
                                 json={"name": "Gizli", "rounds_total": 2})).json()
    r = await client.get(f"/admin/tournaments/{created['id']}", headers=h2)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_2den_az_katilimciyla_baslatilamaz(client, db):
    tok, teacher_id = await _teacher(client, "t3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p3@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T", "rounds_total": 2})).json()
    c1 = await _add_child(db, "A", teacher_id, parent_id)
    db.add(TournamentParticipant(tournament_id=created["id"], child_id=c1.id))
    await db.commit()

    r = await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_sporcu_katilir_ve_1_tur_eslesir(client, db):
    tok, teacher_id = await _teacher(client, "t4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p4@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T4", "rounds_total": 2})).json()
    children = [await _add_child(db, f"Sporcu{i}", teacher_id, parent_id) for i in range(4)]

    for c in children:
        r = await client.post(f"/tournaments/{created['id']}/join",
                              headers={"Authorization": f"Bearer {_child_token(c.id)}"})
        assert r.status_code == 201

    r = await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "active"
    assert body["current_round"] == 1
    assert len(body["pairings_by_round"]["1"]) == 2  # 4 kisi -> 2 eslesme, bay yok

    r = await client.get(f"/tournaments/{created['id']}",
                         headers={"Authorization": f"Bearer {_child_token(children[0].id)}"})
    assert r.status_code == 200
    my = r.json()["my_pairing"]
    assert my is not None
    assert my["round_number"] == 1


@pytest.mark.asyncio
async def test_tek_sayida_katilimci_bay_gecer(client, db):
    tok, teacher_id = await _teacher(client, "t5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p5@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T5", "rounds_total": 1})).json()
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(3)]
    for c in children:
        db.add(TournamentParticipant(tournament_id=created["id"], child_id=c.id))
    await db.commit()

    r = await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)
    assert r.status_code == 200
    pairings = r.json()["pairings_by_round"]["1"]
    assert len(pairings) == 2  # 1 gercek mac + 1 bay
    byes = [p for p in pairings if p["black_child_id"] is None]
    assert len(byes) == 1
    assert byes[0]["result"] == "bye"


@pytest.mark.asyncio
async def test_yetkisiz_sporcu_start_game_403(client, db):
    tok, teacher_id = await _teacher(client, "t6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p6@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T6", "rounds_total": 1})).json()
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(3)]
    for c in children[:2]:
        db.add(TournamentParticipant(tournament_id=created["id"], child_id=c.id))
    await db.commit()
    await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)

    pairing_id = (await db.execute(
        select(TournamentPairing.id).where(TournamentPairing.tournament_id == created["id"])
    )).scalar_one()

    # children[2] eslesmenin tarafi degil.
    r = await client.post(f"/tournaments/{created['id']}/pairings/{pairing_id}/start-game",
                          headers={"Authorization": f"Bearer {_child_token(children[2].id)}"})
    assert r.status_code == 403

    r = await client.post(f"/tournaments/{created['id']}/pairings/{pairing_id}/start-game",
                          headers={"Authorization": f"Bearer {_child_token(children[0].id)}"})
    assert r.status_code == 200
    assert r.json()["game_id"] is not None


@pytest.mark.asyncio
async def test_tum_eslesmeler_bitmeden_sonraki_tur_acilamaz(client, db):
    tok, teacher_id = await _teacher(client, "t7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p7@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T7", "rounds_total": 2})).json()
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(2)]
    for c in children:
        db.add(TournamentParticipant(tournament_id=created["id"], child_id=c.id))
    await db.commit()
    await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)

    r = await client.post(f"/admin/tournaments/{created['id']}/next-round", headers=h)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_son_turdan_sonra_next_round_turnuvayi_bitirir(client, db):
    tok, teacher_id = await _teacher(client, "t8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p8@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T8", "rounds_total": 1})).json()
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(2)]
    for c in children:
        db.add(TournamentParticipant(tournament_id=created["id"], child_id=c.id))
    await db.commit()
    await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)

    pairing = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == created["id"])
    )).scalar_one()
    pairing.result = "1-0"
    await db.commit()

    r = await client.post(f"/admin/tournaments/{created['id']}/next-round", headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "finished"


@pytest.mark.asyncio
async def test_ayni_rakiple_tekrar_eslesmez(client, db):
    tok, teacher_id = await _teacher(client, "t9@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    parent_id = await _parent_id(client, "p9@t.com")
    created = (await client.post("/admin/tournaments", headers=h,
                                 json={"name": "T9", "rounds_total": 3})).json()
    children = [await _add_child(db, f"S{i}", teacher_id, parent_id) for i in range(4)]
    for c in children:
        db.add(TournamentParticipant(tournament_id=created["id"], child_id=c.id))
    await db.commit()
    await client.post(f"/admin/tournaments/{created['id']}/start", headers=h)

    async def _resolve_round(n):
        rows = (await db.execute(
            select(TournamentPairing).where(
                TournamentPairing.tournament_id == created["id"],
                TournamentPairing.round_number == n,
                TournamentPairing.result.is_(None),
            )
        )).scalars().all()
        for p in rows:
            p.result = "1-0"
        await db.commit()

    await _resolve_round(1)
    r = await client.post(f"/admin/tournaments/{created['id']}/next-round", headers=h)
    assert r.json()["current_round"] == 2

    all_pairs = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == created["id"])
    )).scalars().all()
    seen = set()
    for p in all_pairs:
        if p.black_child_id is None:
            continue
        key = frozenset((p.white_child_id, p.black_child_id))
        assert key not in seen, "aynı ikili birden fazla kez eşleşti"
        seen.add(key)


@pytest.mark.asyncio
async def test_finalize_hook_terk_etmede_puan_gunceller(db):
    """5 mac-bitis noktasindan biri: resign. Diger 4'u (checkmate/stalemate/
    flag/draw) da AYNI finalize_tournament_pairing fonksiyonunu cagirir —
    bu fonksiyon zaten dogrudan test ediliyor, WS uzerinden tekrar etmeye
    gerek yok (live_game.py'deki 5 cagri noktasi kod okumasiyla dogrulandi)."""
    t = Tournament(name="X", created_by_user_id=1, rounds_total=1, status=TournamentStatus.active, current_round=1)
    db.add(t)
    await db.commit()
    await db.refresh(t)

    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id, score=0))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id, score=0))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=p1.id, black_child_id=p2.id, result=GameResult.black_wins)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    pairing = TournamentPairing(tournament_id=t.id, round_number=1,
                                white_child_id=p1.id, black_child_id=p2.id, game_id=game.id)
    db.add(pairing)
    await db.commit()

    await finalize_tournament_pairing(db, game)
    await db.commit()

    await db.refresh(pairing)
    assert pairing.result == "0-1"
    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 0.0
    assert scores[p2.id] == 1.0


@pytest.mark.asyncio
async def test_finalize_hook_turnuva_disi_maci_gormez(db):
    """Turnuvaya bagli OLMAYAN sıradan bir Arkadaşla Oyna maci — hicbir
    seye dokunmamali (sessizce cikar)."""
    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=1, black_child_id=2, result=GameResult.draw)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    await finalize_tournament_pairing(db, game)  # exception atmamali


@pytest.mark.asyncio
async def test_cocuk_silinince_turnuva_kayitlari_temizlenir(db):
    p1 = ChildProfile(parent_user_id=1, display_name="Silinecek", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="Rakip", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    t = Tournament(name="X", created_by_user_id=1, rounds_total=1, status=TournamentStatus.active, current_round=1)
    db.add(t)
    await db.commit()
    await db.refresh(t)

    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.active, white_child_id=p1.id, black_child_id=p2.id)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    pairing = TournamentPairing(tournament_id=t.id, round_number=1, white_child_id=p1.id,
                                black_child_id=p2.id, game_id=game.id)
    db.add(pairing)
    await db.commit()

    await delete_child_cascade(db, p1)
    await db.commit()  # patlamamali

    remaining_pairings = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == t.id)
    )).scalars().all()
    assert remaining_pairings == []
    remaining_participants = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    assert [p.child_id for p in remaining_participants] == [p2.id]
