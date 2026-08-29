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
from chess_api.schemas.tournament import TournamentCreateRequest


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


def test_starts_at_tz_aware_gelirse_naive_utcye_cevrilir():
    """BUG FIX (2026-09-07): tarayici starts_at'i `new Date().toISOString()`
    ile "Z" ekli (tz-AWARE) gonderir; tournaments.starts_at kolonu duz
    DateTime (timezone=False) oldugu icin asyncpg AWARE bir deger gelince
    'timestamp cannot be aware' hatasi atip 500 ile patliyordu (sqlite
    kullanan testler bu hatayi hic gormedi — bu yuzden ilk seferinde kacti).
    Schema artik AWARE gelen degeri naive UTC'ye ceviriyor."""
    req = TournamentCreateRequest(
        name="X", starts_at="2026-09-07T15:45:00.000Z", duration_minutes=60,
    )
    assert req.starts_at.tzinfo is None
    assert req.starts_at.hour == 15 and req.starts_at.minute == 45

    # Naive giris (eski/dogrudan API cagrilari) degismeden kalir.
    req2 = TournamentCreateRequest(
        name="X", starts_at="2026-09-07T15:45:00", duration_minutes=60,
    )
    assert req2.starts_at.tzinfo is None
    assert req2.starts_at.hour == 15


@pytest.mark.asyncio
async def test_tarayici_gibi_tz_aware_starts_at_ile_olusturma_basarili(client, db):
    """Ucdan uca: gercek tarayicinin gonderdigi "Z" ekli ISO string ile
    turnuva olusturma BASARILI olmali (bkz. yukaridaki schema testi)."""
    _, teacher_id = await _teacher(client, "t1f@t.com")
    parent_id = await _parent_id(client, "p1f@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)

    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "Tarayici Testi",
        "starts_at": "2026-09-07T15:45:00.000Z", "duration_minutes": 60,
    })
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_liste_katilimci_sayisini_dondurur(client, db):
    """Madde 2026-09-07 (lobi tablosu — "Katılımcı Sayısı" sütunu):
    GET /tournaments her turnuva icin GUNCEL katilimci sayisini doner."""
    _, teacher_id = await _teacher(client, "t1e@t.com")
    parent_id = await _parent_id(client, "p1e@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    classmate = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)  # olusturan otomatik katilir -> 1

    r = await client.get("/tournaments", headers=_child_headers(creator.id))
    assert r.json()[0]["participant_count"] == 1

    await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(classmate.id))
    r = await client.get("/tournaments", headers=_child_headers(creator.id))
    assert r.json()[0]["participant_count"] == 2


@pytest.mark.asyncio
async def test_olusturma_ekrani_yeni_alanlari_kaydeder(client, db):
    """Madde 2026-09-06 (Turnuva Oluştur ekranı): açıklama, başlangıç konumu
    (FEN), galibiyet ödülü (seri katlama aç/kapa) turnuvayla birlikte
    kaydedilir ve GET'te geri döner."""
    _, teacher_id = await _teacher(client, "t1c@t.com")
    parent_id = await _parent_id(client, "p1c@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)

    fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    created = await _create_tournament(
        client, creator.id,
        description="Yaz kampı final turnuvası",
        start_fen=fen, winning_streak_bonus=False,
    )
    assert created["description"] == "Yaz kampı final turnuvası"
    assert created["start_fen"] == fen
    assert created["winning_streak_bonus"] is False

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    body = r.json()
    assert body["description"] == "Yaz kampı final turnuvası"
    assert body["start_fen"] == fen
    assert body["winning_streak_bonus"] is False


@pytest.mark.asyncio
async def test_olusturma_ekrani_yeni_alanlar_bos_gecilebilir(client, db):
    """Açıklama/başlangıç konumu boş bırakılabilir; galibiyet ödülü
    varsayılan olarak açık (True) gelir (geriye dönük uyumlu)."""
    _, teacher_id = await _teacher(client, "t1d@t.com")
    parent_id = await _parent_id(client, "p1d@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)

    created = await _create_tournament(client, creator.id)
    assert created["description"] is None
    assert created["start_fen"] is None
    assert created["winning_streak_bonus"] is True


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
async def test_hocaya_bagli_olmayan_sporcu_da_turnuva_olusturabilir(client, db):
    """Madde 2026-09-08: hocaya bağlı olmayan sporcu ARTIK engellenmiyor —
    turnuva bu durumda velisinin adına kaydedilir (kardeşler görüp katılabilsin)."""
    parent_id = await _parent_id(client, "pnone@t.com")
    lonely = await _add_child(db, "Bagsiz", None, parent_id)
    r = await client.post("/tournaments", headers=_child_headers(lonely.id),
                          json={"name": "X", "starts_at": datetime.utcnow().isoformat(),
                                "duration_minutes": 30})
    assert r.status_code == 201, r.text
    assert r.json()["joined"] is True

    # Kendisi listede görebiliyor mu?
    r2 = await client.get("/tournaments", headers=_child_headers(lonely.id))
    assert len(r2.json()) == 1


@pytest.mark.asyncio
async def test_hocasiz_sporcunun_turnuvasini_ayni_velinin_diger_cocugu_gorur(client, db):
    """Hocasız sporcunun oluşturduğu turnuva, AYNI VELİNİN diğer çocuğuna
    (kardeşine) da görünür ve katılabilir olmalı."""
    parent_id = await _parent_id(client, "psib@t.com")
    creator = await _add_child(db, "Abla", None, parent_id)
    sibling = await _add_child(db, "Kardeş", None, parent_id)

    created = await _create_tournament(client, creator.id, name="Kardeş Turnuvası")

    r = await client.get("/tournaments", headers=_child_headers(sibling.id))
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Kardeş Turnuvası"

    r_join = await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(sibling.id))
    assert r_join.status_code == 201


@pytest.mark.asyncio
async def test_acik_lobi_baska_hocanin_sporcusu_da_turnuvayi_gorur_ve_katilir(client, db):
    """Madde 2026-09-08 (1): turnuvalar artık TAMAMEN AÇIK lobi — hoca/veli
    grubu farklı olsa bile herkes birbirinin turnuvasını görüp katılabilir
    (Lichess'teki gibi). Yalnızca SİLME yetkisi hâlâ gruba göre kısıtlı
    (bkz. test_baska_hocanin_sporcusu_silemez)."""
    _, teacher1_id = await _teacher(client, "t2a@t.com")
    _, teacher2_id = await _teacher(client, "t2b@t.com")
    parent_id = await _parent_id(client, "p2@t.com")
    creator = await _add_child(db, "A", teacher1_id, parent_id)
    outsider = await _add_child(db, "B", teacher2_id, parent_id)

    created = await _create_tournament(client, creator.id, name="Herkese Açık")
    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(outsider.id))
    assert r.status_code == 200

    r_list = await client.get("/tournaments", headers=_child_headers(outsider.id))
    assert any(t["id"] == created["id"] for t in r_list.json())

    r_join = await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(outsider.id))
    assert r_join.status_code == 201


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
async def test_sporcu_turnuvadan_cikabilir(client, db):
    """Madde 2026-09-09 (5): sporcu istediği zaman turnuvadan çıkabilir —
    katılım kaydı silinir, /tournaments listesinde joined=False'a döner ve
    tekrar GET ile detaya bakınca da joined=False görünür."""
    _, teacher_id = await _teacher(client, "t9a@t.com")
    parent_id = await _parent_id(client, "p9a@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    joiner = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)
    await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(joiner.id))

    r = await client.post(f"/tournaments/{created['id']}/leave", headers=_child_headers(joiner.id))
    assert r.status_code == 200
    assert r.json()["joined"] is False

    r_get = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(joiner.id))
    assert r_get.json()["joined"] is False


@pytest.mark.asyncio
async def test_katilmamis_sporcu_cikinca_hata_vermez(client, db):
    """Hiç katılmamış bir sporcu 'leave' çağırırsa da 200 dönmeli (idempotent)."""
    _, teacher_id = await _teacher(client, "t9b@t.com")
    parent_id = await _parent_id(client, "p9b@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    outsider = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)

    r = await client.post(f"/tournaments/{created['id']}/leave", headers=_child_headers(outsider.id))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_detay_participant_count_dondurur(client, db):
    """Detay sayfası footer'ı ('Toplam Kişi Sayısı') için GET /tournaments/{id}
    de listeleme ucundaki gibi participant_count döndürmeli."""
    _, teacher_id = await _teacher(client, "t9c@t.com")
    parent_id = await _parent_id(client, "p9c@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    joiner = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, creator.id)
    await client.post(f"/tournaments/{created['id']}/join", headers=_child_headers(joiner.id))

    r = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.json()["participant_count"] == 2


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
async def test_galibiyet_odulu_kapaliyken_seri_katlanmaz(db):
    """"Galibiyet Ödülü" kapalıyken (winning_streak_bonus=False) 2 galibiyet
    üst üste gelse bile sonraki sonuç KATLANMAZ — hep düz 2/1/0."""
    t = Tournament(name="X", created_by_user_id=1, status=TournamentStatus.active,
                   starts_at=datetime.utcnow(), duration_minutes=60,
                   winning_streak_bonus=False)
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
    await _play("1/2-1/2")   # seri>=2 ama bonus KAPALI -> katlanmaz (+1, +1)

    parts = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalars().all()
    scores = {p.child_id: p.score for p in parts}
    assert scores[p1.id] == 5.0  # 2+2+1 (katlanmadi)
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
