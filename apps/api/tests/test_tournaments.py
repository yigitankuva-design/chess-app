from datetime import datetime, timedelta
import pytest
from sqlalchemy import select
from chess_api.models import (
    ChildProfile, Game, GameType, GameStatus, GameResult,
    Tournament, TournamentStatus, TournamentParticipant, TournamentPairing,
)
from chess_api.services.jwt import encode_token
from chess_api.services.tournaments import finalize_tournament_pairing, compute_sonneborn_berger
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


def _child_headers(child_id: int) -> dict:
    return {"Authorization": f"Bearer {_child_token(child_id)}"}


async def _create_tournament(client, child_id: int, **overrides) -> dict:
    payload = {
        "name": "Turnuva",
        "starts_at": datetime.utcnow().isoformat(), "duration_minutes": 60,
        "base_ms": 300000, "increment_ms": 2000,
    }
    payload.update(overrides)
    r = await client.post("/tournaments", headers=_child_headers(child_id), json=payload)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_sporcu_turnuva_olusturur_ve_otomatik_katilir(client, db):
    """Lichess'te de oldugu gibi: olusturan sporcu ANINDA katilimci olur."""
    _, teacher_id = await _teacher(client, "t1@t.com")
    parent_id = await _parent_id(client, "p1@t.com")
    creator = await _add_child(db, "Yaratici", teacher_id, parent_id)

    created = await _create_tournament(client, creator.id, name="Yaz Turnuvası")
    assert created["name"] == "Yaz Turnuvası"
    assert created["joined"] is True
    assert created["status"] == "active"  # starts_at=simdi -> aninda aktif

    r = await client.get("/tournaments", headers=_child_headers(creator.id))
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["joined"] is True


@pytest.mark.asyncio
async def test_detay_joined_alani_katilmayan_icin_false_doner(client, db):
    """GET /tournaments/{id}: ayni hocaya bagli ama HENUZ katilmamis bir
    sporcu detayi gorebilir (madde: mimari) ama joined=False donmeli —
    frontend bunu 'Katil' butonunu gostermek icin kullanir."""
    _, teacher_id = await _teacher(client, "t1b@t.com")
    parent_id = await _parent_id(client, "p1b@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    classmate = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(classmate.id))
    assert r.status_code == 200
    assert r.json()["joined"] is False


@pytest.mark.asyncio
async def test_hocaya_bagli_olmayan_sporcu_turnuva_olusturamaz(client, db):
    parent_id = await _parent_id(client, "pnone@t.com")
    lonely = await _add_child(db, "Bagsiz", None, parent_id)
    r = await client.post("/tournaments", headers=_child_headers(lonely.id),
                          json={"name": "X", "starts_at": datetime.utcnow().isoformat(),
                                "duration_minutes": 30})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_baska_hocanin_sporcusu_turnuvayi_goremez(client, db):
    _, teacher1_id = await _teacher(client, "t2a@t.com")
    _, teacher2_id = await _teacher(client, "t2b@t.com")
    parent_id = await _parent_id(client, "p2@t.com")
    creator = await _add_child(db, "A", teacher1_id, parent_id)
    outsider = await _add_child(db, "B", teacher2_id, parent_id)

    created = await _create_tournament(client, creator.id, name="Gizli")
    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(outsider.id))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_baska_hocanin_sporcusu_silemez(client, db):
    _, teacher1_id = await _teacher(client, "t2c@t.com")
    _, teacher2_id = await _teacher(client, "t2d@t.com")
    parent_id = await _parent_id(client, "p2c@t.com")
    creator = await _add_child(db, "A", teacher1_id, parent_id)
    outsider = await _add_child(db, "B", teacher2_id, parent_id)

    created = await _create_tournament(client, creator.id)
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(outsider.id))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ayni_hocanin_baska_sporcusu_silebilir(client, db):
    """Turnuvayı kim oluşturduysa değil, aynı hocaya bağlı HERHANGİ bir
    sporcu silebilir (küçük, güvenilir grup)."""
    _, teacher_id = await _teacher(client, "t2e@t.com")
    parent_id = await _parent_id(client, "p2e@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    classmate = await _add_child(db, "B", teacher_id, parent_id)

    created = await _create_tournament(client, creator.id)
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(classmate.id))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_gelecekteki_turnuva_upcoming_baslar(client, db):
    _, teacher_id = await _teacher(client, "t3@t.com")
    parent_id = await _parent_id(client, "p3@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)
    assert created["status"] == "upcoming"


@pytest.mark.asyncio
async def test_sync_status_baslangic_saati_gecince_aktif_olur(client, db):
    """_sync_status: DB'de starts_at gecmiste kalmis bir turnuva, sonraki
    GET cagrisinda ANINDA 'active' olarak guncellenir (cron/scheduler yok)."""
    _, teacher_id = await _teacher(client, "t3b@t.com")
    parent_id = await _parent_id(client, "p3b@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)
    assert created["status"] == "upcoming"

    t = await db.get(Tournament, created["id"])
    t.starts_at = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.json()["status"] == "active"


@pytest.mark.asyncio
async def test_sync_status_suresi_dolan_turnuva_bitmis_sayilir(client, db):
    _, teacher_id = await _teacher(client, "t3c@t.com")
    parent_id = await _parent_id(client, "p3c@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id, duration_minutes=5)

    t = await db.get(Tournament, created["id"])
    t.starts_at = datetime.utcnow() - timedelta(minutes=10)
    await db.commit()

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    body = r.json()
    assert body["status"] == "finished"
    assert body["seconds_remaining"] == 0


@pytest.mark.asyncio
async def test_devam_eden_turnuvaya_sonradan_katilim_serbest(client, db):
    """Lichess Arena: turnuva zaten basladiysa bile sonradan katilmak
    serbesttir — yalnizca bittiyse engellenir."""
    _, teacher_id = await _teacher(client, "t4@t.com")
    parent_id = await _parent_id(client, "p4@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    latecomer = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)  # starts_at=simdi -> active
    assert created["status"] == "active"

    r = await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(latecomer.id))
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_bitmis_turnuvaya_katilinamaz(client, db):
    _, teacher_id = await _teacher(client, "t4b@t.com")
    parent_id = await _parent_id(client, "p4b@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    latecomer = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id, duration_minutes=5)
    t = await db.get(Tournament, created["id"])
    t.starts_at = datetime.utcnow() - timedelta(minutes=10)
    await db.commit()

    r = await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(latecomer.id))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_turnuva_silinebilir(client, db):
    _, teacher_id = await _teacher(client, "t8b@t.com")
    parent_id = await _parent_id(client, "p8b@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)

    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_finalize_hook_terk_etmede_puan_gunceller(db):
    """5 mac-bitis noktasindan biri: resign. Diger 4'u (checkmate/stalemate/
    flag/draw) da AYNI finalize_tournament_pairing fonksiyonunu cagirir —
    bu fonksiyon zaten dogrudan test ediliyor, WS uzerinden tekrar etmeye
    gerek yok (live_game.py'deki 5 cagri noktasi kod okumasiyla dogrulandi).
    Lichess Arena puanlamasi: galibiyet=2, kayip=0 (madde 2026-09-05)."""
    t = Tournament(name="X", created_by_user_id=1, status=TournamentStatus.active,
                   starts_at=datetime.utcnow(), duration_minutes=60)
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

    pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id,
                                black_child_id=p2.id, game_id=game.id)
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
    assert scores[p2.id] == 2.0


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
async def test_streak_katlama_lichess_ornegi(db):
    """Lichess'in kendi ornegi: iki galibiyet ardindan bir beraberlik
    2 + 2 + (2*1) = 6 puan degerinde olmali (seri, 2. galibiyette aktiflesip
    3. macin puanini katlar). Seri KISI BAZINDA tutulur — hep kaybeden
    rakibin (p2) hic seri baslamadigi icin beraberligi katlanmaz (1 puan)."""
    t = Tournament(name="X", created_by_user_id=1, status=TournamentStatus.active,
                   starts_at=datetime.utcnow(), duration_minutes=60)
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

    async def _play(result: str):
        game = Game(type=GameType.human, status=GameStatus.finished,
                   white_child_id=p1.id, black_child_id=p2.id, result=GameResult(result))
        db.add(game)
        await db.commit()
        await db.refresh(game)
        pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id,
                                    black_child_id=p2.id, game_id=game.id)
        db.add(pairing)
        await db.commit()
        await finalize_tournament_pairing(db, game)
        await db.commit()

    await _play("1-0")       # p1: 2 puan, seri=1
    await _play("1-0")       # p1: +2 puan, seri=2
    await _play("1/2-1/2")   # p1 serisi>=2 -> katlanir (+2); p2'nin serisi hic
                              # baslamadi (hep kaybetti) -> katlanmaz (+1)

    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 6.0
    assert scores[p2.id] == 1.0


@pytest.mark.asyncio
async def test_streak_kayipla_sifirlanir(db):
    t = Tournament(name="X", created_by_user_id=1, status=TournamentStatus.active,
                   starts_at=datetime.utcnow(), duration_minutes=60)
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

    async def _play(result: str):
        game = Game(type=GameType.human, status=GameStatus.finished,
                   white_child_id=p1.id, black_child_id=p2.id, result=GameResult(result))
        db.add(game)
        await db.commit()
        await db.refresh(game)
        pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id,
                                    black_child_id=p2.id, game_id=game.id)
        db.add(pairing)
        await db.commit()
        await finalize_tournament_pairing(db, game)
        await db.commit()

    await _play("1-0")  # p1 seri=1
    await _play("1-0")  # p1 seri=2
    await _play("0-1")  # p1 kaybeder -> bu mac katlanir mi? seri>=2 idi -> katlanir ama kayip 0 zaten 0
    await _play("1-0")  # seri sifirlandi -> katlanmadan 2 puan

    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 2.0 + 2.0 + 0.0 + 2.0


@pytest.mark.asyncio
async def test_cocuk_silinince_turnuva_kayitlari_temizlenir(db):
    p1 = ChildProfile(parent_user_id=1, display_name="Silinecek", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="Rakip", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    t = Tournament(name="X", created_by_user_id=1, status=TournamentStatus.active,
                   starts_at=datetime.utcnow(), duration_minutes=60)
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
    pairing = TournamentPairing(tournament_id=t.id, white_child_id=p1.id,
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


def test_sonneborn_berger_hesaplanir():
    """Saf fonksiyon: kazandigin rakibin GUNCEL puani tam, berabere
    kalinanin yarisi eklenir (klasik FIDE/Isvicre 'averaj')."""
    p1 = TournamentParticipant(id=1, tournament_id=1, child_id=1, score=4.0)
    p2 = TournamentParticipant(id=2, tournament_id=1, child_id=2, score=2.0)
    p3 = TournamentParticipant(id=3, tournament_id=1, child_id=3, score=1.0)

    pairings = [
        TournamentPairing(tournament_id=1, white_child_id=1, black_child_id=2, result="1-0"),
        TournamentPairing(tournament_id=1, white_child_id=1, black_child_id=3, result="1/2-1/2"),
        TournamentPairing(tournament_id=1, white_child_id=2, black_child_id=3, result="1-0"),
    ]
    sb = compute_sonneborn_berger([p1, p2, p3], pairings)
    # p1: p2'yi yendi (+2.0 tam) + p3'le berabere (+1.0/2=0.5) = 2.5
    assert sb[1] == 2.5
    # p2: p1'e kaybetti (+0) + p3'u yendi (+1.0 tam) = 1.0
    assert sb[2] == 1.0
    # p3: p1'le berabere (+4.0/2=2.0) + p2'ye kaybetti (+0) = 2.0
    assert sb[3] == 2.0
