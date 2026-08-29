from datetime import datetime, timedelta
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
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


def _patch_game_creation(db_engine, monkeypatch) -> None:
    """İsviçre round üretimi GERÇEK bir eşleşme (2+ kişi) için _create_human_game
    çağırır — o da KENDİ oturumunu açar (get_session_factory()); conftest'teki
    get_db override'i sadece FastAPI bağımlılığına uygulanır, buna DEĞİL (bkz.
    test_tournament_ws.py'deki AYNI desen/yorum) — yoksa gerçek DATABASE_URL'e
    bağlanmaya çalışıp ConnectionError verir."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory", lambda: factory)


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
    (Lichess'teki gibi). Yalnızca SİLME yetkisi hâlâ kısıtlı — madde
    2026-09-09 (4)'ten itibaren SADECE oluşturan sporcuya ait (bkz.
    test_baska_hocanin_sporcusu_silemez, test_ayni_hocanin_baska_sporcusu_artik_silemez)."""
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

    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(outsider.id))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ayni_hocanin_baska_sporcusu_artik_silemez(client, db):
    """Madde 2026-09-09 (4): silme yetkisi ARTIK sadece turnuvayı OLUŞTURAN
    sporcuya ait — aynı hocaya bağlı BAŞKA bir sporcu (eski davranışın
    aksine) silemez."""
    _, teacher_id = await _teacher(client, "t2e@t.com")
    parent_id = await _parent_id(client, "p2e@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    classmate = await _add_child(db, "B", teacher_id, parent_id)

    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(classmate.id))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_olusturan_sporcu_baslamadan_once_silebilir(client, db):
    _, teacher_id = await _teacher(client, "t2f@t.com")
    parent_id = await _parent_id(client, "p2f@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)

    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)
    assert created["status"] == "upcoming"
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_baslamis_turnuva_olusturan_tarafindan_bile_silinemez(client, db):
    """Madde 2026-09-09 (4): "turnuva başladıktan sonra silme işlemi olmasın" —
    oluşturan sporcu bile artık silemez."""
    _, teacher_id = await _teacher(client, "t2g@t.com")
    parent_id = await _parent_id(client, "p2g@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)

    created = await _create_tournament(client, creator.id)  # starts_at=simdi -> active
    assert created["status"] == "active"
    r = await client.delete(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_can_delete_alani_sadece_olusturan_ve_baslamadan_once_true(client, db):
    _, teacher_id = await _teacher(client, "t2h@t.com")
    parent_id = await _parent_id(client, "p2h@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    classmate = await _add_child(db, "B", teacher_id, parent_id)

    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)

    r_creator = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r_creator.json()["can_delete"] is True
    r_classmate = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(classmate.id))
    assert r_classmate.json()["can_delete"] is False

    # Başlayınca oluşturan için de False olmalı.
    t = await db.get(Tournament, created["id"])
    t.starts_at = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()
    r_after_start = await client.get(f"/tournaments/{created['id']}", headers=_child_headers(creator.id))
    assert r_after_start.json()["can_delete"] is False


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
async def test_cekilen_sporcunun_rakibinin_averaji_etkilenmez(client, db):
    """Madde 2026-09-09 (5): B, C'yi yenip puan topladıktan sonra A'ya
    kaybedip turnuvadan çekilirse — A'nın Sonneborn-Berger'ı B'nin
    DONDURULMUŞ puanını (0 değil, gerçek puanını) görmeye devam etmeli."""
    _, teacher_id = await _teacher(client, "t9d@t.com")
    parent_id = await _parent_id(client, "p9d@t.com")
    a = await _add_child(db, "A", teacher_id, parent_id)
    b = await _add_child(db, "B", teacher_id, parent_id)
    c = await _add_child(db, "C", teacher_id, parent_id)
    created = await _create_tournament(client, a.id, name="SB Testi")
    tid = created["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(c.id))

    async def _play(white, black, result):
        game = Game(type=GameType.human, status=GameStatus.finished,
                   white_child_id=white, black_child_id=black, result=GameResult(result))
        db.add(game)
        await db.commit()
        await db.refresh(game)
        pairing = TournamentPairing(tournament_id=tid, white_child_id=white,
                                    black_child_id=black, game_id=game.id)
        db.add(pairing)
        await db.commit()
        await finalize_tournament_pairing(db, game)
        await db.commit()

    await _play(b.id, c.id, "1-0")   # B: +2 puan (2.0)
    await _play(a.id, b.id, "1-0")   # A: +2 puan; B kaybetti, puanı değişmez

    r_leave = await client.post(f"/tournaments/{tid}/leave", headers=_child_headers(b.id))
    assert r_leave.status_code == 200

    r = await client.get(f"/tournaments/{tid}", headers=_child_headers(a.id))
    rows = {row["child_id"]: row for row in r.json()["standings"]}
    assert b.id not in rows  # B artık GÖRÜNÜM listesinde yok
    assert rows[a.id]["sb"] == 2.0  # B'nin (2.0) DONDURULMUŞ puanı sayıldı, 0 değil


@pytest.mark.asyncio
async def test_cekilen_sporcu_tekrar_katilinca_dondurulmus_puani_korunur(client, db):
    """Çekilen sporcu tekrar katılırsa satır SİLİNMEDİĞİ için puanı/serisi
    AYNEN kalır (sıfırlanmaz) — sadece left_at temizlenir."""
    _, teacher_id = await _teacher(client, "t9e@t.com")
    parent_id = await _parent_id(client, "p9e@t.com")
    a = await _add_child(db, "A", teacher_id, parent_id)
    b = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, a.id)
    tid = created["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))

    game = Game(type=GameType.human, status=GameStatus.finished,
               white_child_id=b.id, black_child_id=a.id, result=GameResult.white_wins)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    pairing = TournamentPairing(tournament_id=tid, white_child_id=b.id,
                                black_child_id=a.id, game_id=game.id)
    db.add(pairing)
    await db.commit()
    await finalize_tournament_pairing(db, game)
    await db.commit()  # B: 2.0 puan

    await client.post(f"/tournaments/{tid}/leave", headers=_child_headers(b.id))
    r_rejoin = await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))
    assert r_rejoin.status_code == 201

    r = await client.get(f"/tournaments/{tid}", headers=_child_headers(a.id))
    rows = {row["child_id"]: row for row in r.json()["standings"]}
    assert rows[b.id]["score"] == 2.0  # sıfırlanmadı, geri döndü
    assert b.id in rows  # görünüm listesine geri döndü


@pytest.mark.asyncio
async def test_turnuva_suresi_dolunca_suren_maclar_iptal_olur(client, db):
    """Madde 2026-09-09 (6): turnuva süresi dolunca hâlâ SÜREN maçlar otomatik
    biter (GameStatus.aborted), TournamentPairing.result='void' olur ve
    sıralamayı/oynanan-oyun sayısını ETKİLEMEZ."""
    _, teacher_id = await _teacher(client, "t9f@t.com")
    parent_id = await _parent_id(client, "p9f@t.com")
    a = await _add_child(db, "A", teacher_id, parent_id)
    b = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, a.id, duration_minutes=5)
    tid = created["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))

    game = Game(type=GameType.human, status=GameStatus.active,
               white_child_id=a.id, black_child_id=b.id)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    pairing = TournamentPairing(tournament_id=tid, white_child_id=a.id,
                                black_child_id=b.id, game_id=game.id)
    db.add(pairing)
    await db.commit()

    t = await db.get(Tournament, tid)
    t.starts_at = datetime.utcnow() - timedelta(minutes=10)  # süre geçmiş
    await db.commit()

    r = await client.get(f"/tournaments/{tid}", headers=_child_headers(a.id))
    body = r.json()
    assert body["status"] == "finished"

    await db.refresh(game)
    await db.refresh(pairing)
    assert game.status == GameStatus.aborted
    assert pairing.result == "void"

    rows = {row["child_id"]: row for row in body["standings"]}
    assert rows[a.id]["score"] == 0.0
    assert rows[b.id]["score"] == 0.0
    assert rows[a.id]["games_played"] == 0
    assert rows[b.id]["games_played"] == 0


@pytest.mark.asyncio
async def test_standings_oynanan_oyun_ve_kazanma_orani_hesaplanir(client, db):
    """Madde 2026-09-09 (6): turnuva bitiş bildirimindeki "Oynanmış oyunlar"/
    "Kazanma oranı" alanları — void/devam eden eşleşmeler sayılmaz."""
    _, teacher_id = await _teacher(client, "t9h@t.com")
    parent_id = await _parent_id(client, "p9h@t.com")
    a = await _add_child(db, "A", teacher_id, parent_id)
    b = await _add_child(db, "B", teacher_id, parent_id)
    created = await _create_tournament(client, a.id)
    tid = created["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))

    async def _play(white, black, result):
        game = Game(type=GameType.human, status=GameStatus.finished,
                   white_child_id=white, black_child_id=black, result=GameResult(result))
        db.add(game)
        await db.commit()
        await db.refresh(game)
        pairing = TournamentPairing(tournament_id=tid, white_child_id=white,
                                    black_child_id=black, game_id=game.id)
        db.add(pairing)
        await db.commit()
        await finalize_tournament_pairing(db, game)
        await db.commit()

    await _play(a.id, b.id, "1-0")
    await _play(b.id, a.id, "1-0")
    await _play(a.id, b.id, "1/2-1/2")

    r = await client.get(f"/tournaments/{tid}", headers=_child_headers(a.id))
    rows = {row["child_id"]: row for row in r.json()["standings"]}
    assert rows[a.id]["games_played"] == 3
    assert rows[a.id]["win_rate"] == 33  # 1 galibiyet / 3 oyun -> %33
    assert rows[b.id]["games_played"] == 3
    assert rows[b.id]["win_rate"] == 33


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
    # Madde 2026-09-09 (4): silme SADECE başlamadan önce mümkün.
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    created = await _create_tournament(client, creator.id, starts_at=future)

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


@pytest.mark.asyncio
async def test_isvicre_turnuva_olusturulabilir(client, db):
    """Madde 2026-09-XX: tur sayısı artık sporcu tarafından GÖNDERİLMİYOR —
    duration_minutes None olur (İsviçre'de anlamsız), rounds_total da
    oluşturma anında None kalır (katılım kapanınca otomatik hesaplanır, bkz.
    test_isvicre_tur_sayisi_katilimciya_gore_hesaplanir). Client eski bir
    ekrandan rounds_total=5 gönderse bile yok sayılır (_type_specific_fields)."""
    _, teacher_id = await _teacher(client, "tsw1@t.com")
    parent_id = await _parent_id(client, "psw1@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "İsviçre Turnuvası", "starts_at": future,
        "tournament_type": "swiss", "rounds_total": 5,
        "base_ms": 300000, "increment_ms": 2000,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["tournament_type"] == "swiss"
    assert body["rounds_total"] is None
    assert body["current_round"] == 0
    assert body["duration_minutes"] is None
    assert body["ends_at"] is None


@pytest.mark.asyncio
async def test_isvicre_odul_ve_berserk_zorla_kapali(client, db):
    """Madde 2026-09-XX: İsviçre'de Galibiyet Ödülü (seri katlaması) ve
    Berserk hiç kullanılmaz — client True gönderse bile backend zorla
    False'a çeker (frontend'in devre dışı bırakmasına güvenilmez)."""
    _, teacher_id = await _teacher(client, "tsw2@t.com")
    parent_id = await _parent_id(client, "psw2@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "X", "starts_at": future, "tournament_type": "swiss",
        "base_ms": 300000, "increment_ms": 2000,
        "winning_streak_bonus": True, "berserk_enabled": True,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["winning_streak_bonus"] is False
    assert body["berserk_enabled"] is False


@pytest.mark.asyncio
async def test_arena_suresi_olmadan_olusturulamaz(client, db):
    _, teacher_id = await _teacher(client, "tsw3@t.com")
    parent_id = await _parent_id(client, "psw3@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "X", "starts_at": datetime.utcnow().isoformat(),
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_isvicre_1_tur_basladiktan_sonra_katilim_kapanir(client, db, db_engine, monkeypatch):
    """3 kişi (tek sayı — 1 bay + 1 gerçek eşleşme) round 1'i HEMEN
    bitirmesin diye — starts_at GELECEKTE verilip sonra geçmişe alınır
    (mevcut arena testlerinin AYNI deseni, bkz. test_sync_status_...)."""
    _patch_game_creation(db_engine, monkeypatch)
    _, teacher_id = await _teacher(client, "tsw4@t.com")
    parent_id = await _parent_id(client, "psw4@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    b = await _add_child(db, "B", teacher_id, parent_id)
    c = await _add_child(db, "C", teacher_id, parent_id)
    latecomer = await _add_child(db, "D", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "İsviçre", "starts_at": future, "tournament_type": "swiss",
        "base_ms": 300000, "increment_ms": 0,
    })
    tid = r.json()["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(b.id))
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(c.id))

    t = await db.get(Tournament, tid)
    t.starts_at = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()

    # GET tetikler -> 1. tur üretilir (3 kişi: 1 bay + 1 gerçek eşleşme,
    # eşleşme henüz sonuçlanmadığı için tur ASILI kalır, current_round=1).
    # rounds_total da bu anda otomatik hesaplanır: ceil(log2(3)) = 2.
    r_get = await client.get(f"/tournaments/{tid}", headers=_child_headers(creator.id))
    assert r_get.json()["current_round"] == 1
    assert r_get.json()["rounds_total"] == 2

    r_join = await client.post(f"/tournaments/{tid}/join", headers=_child_headers(latecomer.id))
    assert r_join.status_code == 400


@pytest.mark.asyncio
async def test_isvicre_tur_sayisi_katilimciya_gore_hesaplanir(client, db, db_engine, monkeypatch):
    """Madde 2026-09-XX: tur sayısı artık sporcu seçmiyor — 1. tur üretilirken
    (katılım kapanınca) o anki katılımcı sayısına göre standart İsviçre
    kuralıyla (yukarı yuvarlanmış log2) otomatik hesaplanır. 5 katılımcı
    (creator + 4 katılan) → ceil(log2(5)) = 3 tur."""
    _patch_game_creation(db_engine, monkeypatch)
    _, teacher_id = await _teacher(client, "tsw6@t.com")
    parent_id = await _parent_id(client, "psw6@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    others = [await _add_child(db, f"P{i}", teacher_id, parent_id) for i in range(4)]
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "İsviçre", "starts_at": future, "tournament_type": "swiss",
        "base_ms": 300000, "increment_ms": 0,
    })
    tid = r.json()["id"]
    assert r.json()["rounds_total"] is None  # oluşturma anında henüz belirsiz
    for o in others:
        await client.post(f"/tournaments/{tid}/join", headers=_child_headers(o.id))

    t = await db.get(Tournament, tid)
    t.starts_at = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()

    r_get = await client.get(f"/tournaments/{tid}", headers=_child_headers(creator.id))
    assert r_get.json()["current_round"] == 1
    assert r_get.json()["rounds_total"] == 3


@pytest.mark.asyncio
async def test_recent_pairings_round_number_dondurur(client, db, db_engine, monkeypatch):
    _patch_game_creation(db_engine, monkeypatch)
    _, teacher_id = await _teacher(client, "tsw5@t.com")
    parent_id = await _parent_id(client, "psw5@t.com")
    creator = await _add_child(db, "A", teacher_id, parent_id)
    joiner = await _add_child(db, "B", teacher_id, parent_id)
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    r = await client.post("/tournaments", headers=_child_headers(creator.id), json={
        "name": "İsviçre", "starts_at": future, "tournament_type": "swiss",
        "base_ms": 300000, "increment_ms": 0,
    })
    tid = r.json()["id"]
    await client.post(f"/tournaments/{tid}/join", headers=_child_headers(joiner.id))

    t = await db.get(Tournament, tid)
    t.starts_at = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()

    r_get = await client.get(f"/tournaments/{tid}", headers=_child_headers(creator.id))
    body = r_get.json()
    assert len(body["recent_pairings"]) == 1
    assert body["recent_pairings"][0]["round_number"] == 1


def test_sonneborn_berger_void_esleme_sayilmaz():
    """Madde 2026-09-09 (2/6): iptal edilmiş (result="void" — 15sn'de hamle
    yok VEYA turnuva süresi doldu) eşleşme SB'yi HİÇ etkilememeli."""
    p1 = TournamentParticipant(id=1, tournament_id=1, child_id=1, score=4.0)
    p2 = TournamentParticipant(id=2, tournament_id=1, child_id=2, score=2.0)
    pairings = [
        TournamentPairing(tournament_id=1, white_child_id=1, black_child_id=2, result="void"),
    ]
    sb = compute_sonneborn_berger([p1, p2], pairings)
    assert sb[1] == 0.0
    assert sb[2] == 0.0
