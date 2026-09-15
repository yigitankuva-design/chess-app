"""Aday Hamle Pratiği — sporcu tarafı oturum yaşam döngüsü. Madde 2026-09-16.

Motor burada hiç çalışmaz — testler sadece UCI karşılaştırma mantığını ve
oturum durumu geçişlerini (devam/bitiş/sahiplik) doğrular.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.models import CustomTab, CustomTabSection

FEN1 = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1"
FEN2 = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"


def _candidates(*ucis: str) -> list[dict]:
    return [
        {"move_uci": uci, "move_san": uci, "score_cp": 10, "mate": None}
        for uci in ucis
    ]


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


async def _child_token(client: AsyncClient, tag: str) -> int:
    r = await client.post("/auth/parent/signup", json={
        "email": f"veli-{tag}@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r = await client.post("/children", headers=auth(ptok), json={
        "display_name": f"Sporcu-{tag}", "age": 10, "pin": "1234",
    })
    cid = r.json()["id"]
    await client.post("/auth/device/register", headers=auth(ptok), json={
        "device_fingerprint": f"dev-{tag}", "name": "Test",
    })
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": cid, "pin": "1234", "device_fingerprint": f"dev-{tag}",
    })
    return r.json()["access_token"]


async def _aday_hamle_section(db: AsyncSession, positions: list[dict]) -> int:
    tab = CustomTab(order_index=1, label="Pratik", emoji="💫", kind="pratik_yap")
    db.add(tab)
    await db.flush()
    section = CustomTabSection(
        custom_tab_id=tab.id, parent_id=None, order_index=1, title="Aday Hamle Pratiği",
        body="", images=[], practice_positions=positions, section_kind="aday_hamle",
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section.id


async def _generic_section(db: AsyncSession, positions: list[dict]) -> int:
    tab = CustomTab(order_index=1, label="Pratik", emoji="💫", kind="pratik_yap")
    db.add(tab)
    await db.flush()
    section = CustomTabSection(
        custom_tab_id=tab.id, parent_id=None, order_index=2, title="Taktik Beceri Pratiği",
        body="", images=[], practice_positions=positions, section_kind=None,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section.id


@pytest.mark.asyncio
async def test_oturum_olusturur_ve_ilk_pozisyonu_doner(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5", "d2d3")},
        {"id": "p2", "fen": FEN2, "candidate_moves": _candidates("e1d2")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s1")

    r = await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["total"] == 2
    assert body["current_index"] == 0
    assert body["position"] == {"id": "p1", "fen": FEN1}


@pytest.mark.asyncio
async def test_aday_hamle_disinda_bir_bolume_oturum_acilmaz(client, db):
    section_id = await _generic_section(db, [{"id": "p1", "fen": FEN1}])
    tok = await _child_token(client, "s2")

    r = await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cevap_anahtari_olmayan_pozisyonlar_havuza_girmez(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": None},
        {"id": "p2", "fen": FEN2},  # alan hiç yok — eski kayıt simülasyonu
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s3")

    r = await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_hamle_sirasi_farkli_olsa_da_eslesirse_dogru_sayilir(client, db):
    """Madde: "hamlelerin sırası farklı olabilir, aynı hamle olması şart" —
    cevap anahtarı [f3g5, d2d3, e1g1] iken sporcu [e1g1, f3g5, d2d3] sırasıyla
    tahmin etse bile HER ÜÇÜ de doğru sayılmalı."""
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5", "d2d3", "e1g1")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s4")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()

    r = await client.post(f"/aday-hamle/sessions/{created['id']}/answer", headers=auth(tok), json={
        "moves": ["e1g1", "f3g5", "d2d3"],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["results"] == [True, True, True]
    assert body["finished"] is True
    assert body["next_position"] is None


@pytest.mark.asyncio
async def test_yanlis_hamle_kirmizi_sayilir(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5", "d2d3", "e1g1")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s5")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()

    r = await client.post(f"/aday-hamle/sessions/{created['id']}/answer", headers=auth(tok), json={
        "moves": ["a2a3", "f3g5", "d2d3"],
    })
    assert r.status_code == 200
    assert r.json()["results"] == [False, True, True]


@pytest.mark.asyncio
async def test_ikinci_pozisyona_gecis_ve_havuz_bitince_oturum_kapanir(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5")},
        {"id": "p2", "fen": FEN2, "candidate_moves": _candidates("e1d2")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s6")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()
    sid = created["id"]

    r1 = await client.post(f"/aday-hamle/sessions/{sid}/answer", headers=auth(tok), json={
        "moves": ["f3g5", "a2a3", "a2a3"],
    })
    assert r1.json()["finished"] is False
    assert r1.json()["next_position"] == {"id": "p2", "fen": FEN2}

    r2 = await client.post(f"/aday-hamle/sessions/{sid}/answer", headers=auth(tok), json={
        "moves": ["e1d2", "a2a3", "a2a3"],
    })
    assert r2.json()["finished"] is True

    r3 = await client.post(f"/aday-hamle/sessions/{sid}/answer", headers=auth(tok), json={
        "moves": ["a2a3", "a2a3", "a2a3"],
    })
    assert r3.status_code == 409


@pytest.mark.asyncio
async def test_finish_ucu_yarim_kalan_pozisyonu_saymadan_oturumu_bitirir(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5")},
        {"id": "p2", "fen": FEN2, "candidate_moves": _candidates("e1d2")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s7")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()
    sid = created["id"]

    await client.post(f"/aday-hamle/sessions/{sid}/answer", headers=auth(tok), json={
        "moves": ["f3g5", "a2a3", "a2a3"],
    })
    # Süre doldu — 2. pozisyon hiç cevaplanmadı.
    r = await client.post(f"/aday-hamle/sessions/{sid}/finish", headers=auth(tok))
    assert r.status_code == 200

    detail = await client.get(f"/aday-hamle/sessions/{sid}", headers=auth(tok))
    body = detail.json()
    assert body["ended_at"] is not None
    assert len(body["items"]) == 1
    assert body["items"][0]["fen"] == FEN1

    # İdempotent — tekrar çağrılabilir.
    r2 = await client.post(f"/aday-hamle/sessions/{sid}/finish", headers=auth(tok))
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_baskasinin_oturumuna_erisilemez(client, db):
    positions = [{"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5")}]
    section_id = await _aday_hamle_section(db, positions)
    tok_a = await _child_token(client, "s8a")
    tok_b = await _child_token(client, "s8b")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok_a), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()

    r = await client.post(f"/aday-hamle/sessions/{created['id']}/answer", headers=auth(tok_b), json={
        "moves": ["f3g5", "a2a3", "a2a3"],
    })
    assert r.status_code == 404
    r2 = await client.get(f"/aday-hamle/sessions/{created['id']}", headers=auth(tok_b))
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_get_session_pozisyon_cevap_anahtari_ve_hamleleri_esler(client, db):
    positions = [
        {"id": "p1", "fen": FEN1, "candidate_moves": _candidates("f3g5", "d2d3", "e1g1")},
    ]
    section_id = await _aday_hamle_section(db, positions)
    tok = await _child_token(client, "s9")
    created = (await client.post("/aday-hamle/sessions", headers=auth(tok), json={
        "section_id": section_id, "duration_minutes": 5,
    })).json()
    sid = created["id"]
    await client.post(f"/aday-hamle/sessions/{sid}/answer", headers=auth(tok), json={
        "moves": ["a2a3", "f3g5", "d2d3"],
    })

    r = await client.get(f"/aday-hamle/sessions/{sid}", headers=auth(tok))
    item = r.json()["items"][0]
    assert item["fen"] == FEN1
    assert item["student_moves"] == ["a2a3", "f3g5", "d2d3"]
    assert item["results"] == [False, True, True]
    assert {c["move_uci"] for c in item["candidate_moves"]} == {"f3g5", "d2d3", "e1g1"}
