import pytest

VALID_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1"


async def _teacher_token(client, email="op@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_acilis_ekler(client):
    tok = await _teacher_token(client, "op1@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "İtalyan Açılışı", "start_fen": VALID_FEN})
    assert r.status_code == 201
    assert r.json()["name"] == "İtalyan Açılışı"


@pytest.mark.asyncio
async def test_acilis_listesi_herkese_acik(client):
    """Sporcu acilis listesini gorebilmeli (mac kurarken secer)."""
    tok = await _teacher_token(client, "op2@t.com")
    await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                      json={"name": "Sicilya", "start_fen": VALID_FEN})
    r = await client.get("/openings")
    assert r.status_code == 200
    assert [o["name"] for o in r.json()] == ["Sicilya"]


@pytest.mark.asyncio
async def test_gecersiz_fen_reddedilir(client):
    tok = await _teacher_token(client, "op3@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Bozuk", "start_fen": "bu bir fen degil"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "op4@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "   ", "start_fen": VALID_FEN})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ogretmen_acilis_siler(client):
    tok = await _teacher_token(client, "op5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Silinecek", "start_fen": VALID_FEN})
    oid = created.json()["id"]
    r = await client.delete(f"/admin/openings/{oid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_tokensiz_ekleme_engellenir(client):
    r = await client.post("/admin/openings", json={"name": "X", "start_fen": VALID_FEN})
    assert r.status_code in (401, 403)
