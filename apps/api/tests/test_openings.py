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


# ── Madde 7: duzenleme ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ogretmen_acilisi_duzenler(client):
    tok = await _teacher_token(client, "op6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Eski Ad", "start_fen": VALID_FEN})
    oid = created.json()["id"]

    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "Yeni Ad", "start_fen": VALID_FEN})
    assert r.status_code == 200
    assert r.json()["name"] == "Yeni Ad"

    listing = await client.get("/openings")
    assert listing.json()[0]["name"] == "Yeni Ad"


@pytest.mark.asyncio
async def test_duzenlemede_gecersiz_fen_reddedilir(client):
    tok = await _teacher_token(client, "op7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "A", "start_fen": VALID_FEN})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "A", "start_fen": "bozuk"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_olmayan_acilisi_duzenlemek_404_doner(client):
    tok = await _teacher_token(client, "op8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.patch("/admin/openings/999999", headers=h,
                           json={"name": "A", "start_fen": VALID_FEN})
    assert r.status_code == 404


# ── Madde 8: siralama ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_yeni_acilislar_ekleme_sirasinda_listelenir(client):
    tok = await _teacher_token(client, "op9@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h, json={"name": "Birinci", "start_fen": VALID_FEN})
    await client.post("/admin/openings", headers=h, json={"name": "İkinci", "start_fen": VALID_FEN})
    await client.post("/admin/openings", headers=h, json={"name": "Üçüncü", "start_fen": VALID_FEN})
    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["Birinci", "İkinci", "Üçüncü"]


@pytest.mark.asyncio
async def test_asagi_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op10@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = await client.post("/admin/openings", headers=h, json={"name": "A", "start_fen": VALID_FEN})
    b = await client.post("/admin/openings", headers=h, json={"name": "B", "start_fen": VALID_FEN})
    await client.post("/admin/openings", headers=h, json={"name": "C", "start_fen": VALID_FEN})

    r = await client.post(f"/admin/openings/{a.json()['id']}/move", headers=h,
                          json={"direction": "down"})
    assert r.status_code == 200 and r.json()["moved"] is True

    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["B", "A", "C"]


@pytest.mark.asyncio
async def test_yukari_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op11@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h, json={"name": "A", "start_fen": VALID_FEN})
    b = await client.post("/admin/openings", headers=h, json={"name": "B", "start_fen": VALID_FEN})

    r = await client.post(f"/admin/openings/{b.json()['id']}/move", headers=h,
                          json={"direction": "up"})
    assert r.status_code == 200 and r.json()["moved"] is True

    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["B", "A"]


@pytest.mark.asyncio
async def test_TUZAK_listenin_ucundaki_tasima_sessizce_hicbir_sey_yapmaz(client):
    """En basttaki acilis yukari, en sondaki asagi tasinmaya calisilirsa
    hata FIRLATILMAZ — cagiran zaten en ucta oldugunu bilir."""
    tok = await _teacher_token(client, "op12@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = await client.post("/admin/openings", headers=h, json={"name": "A", "start_fen": VALID_FEN})
    b = await client.post("/admin/openings", headers=h, json={"name": "B", "start_fen": VALID_FEN})

    r_top = await client.post(f"/admin/openings/{a.json()['id']}/move", headers=h,
                              json={"direction": "up"})
    assert r_top.status_code == 200 and r_top.json()["moved"] is False

    r_bottom = await client.post(f"/admin/openings/{b.json()['id']}/move", headers=h,
                                 json={"direction": "down"})
    assert r_bottom.status_code == 200 and r_bottom.json()["moved"] is False

    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["A", "B"]


# ── Kategori (e4 / d4 / diger) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_kategorisiz_eklenen_acilis_diger_olur(client):
    """Eski istemciler category gondermez — kayit "Diğerleri"ne duser."""
    tok = await _teacher_token(client, "opc1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/openings", headers=h,
                          json={"name": "Eski Usul", "start_fen": VALID_FEN})
    assert r.status_code == 201
    assert r.json()["category"] == "diger"
    listing = await client.get("/openings")
    assert listing.json()[0]["category"] == "diger"


@pytest.mark.asyncio
async def test_kategori_ile_eklenir_ve_listede_doner(client):
    tok = await _teacher_token(client, "opc2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h,
                      json={"name": "İtalyan", "start_fen": VALID_FEN, "category": "e4"})
    await client.post("/admin/openings", headers=h,
                      json={"name": "Slav", "start_fen": VALID_FEN, "category": "d4"})
    listing = await client.get("/openings")
    assert [(o["name"], o["category"]) for o in listing.json()] == [
        ("İtalyan", "e4"), ("Slav", "d4"),
    ]


@pytest.mark.asyncio
async def test_gecersiz_kategori_reddedilir(client):
    tok = await _teacher_token(client, "opc3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/openings", headers=h,
                          json={"name": "X", "start_fen": VALID_FEN, "category": "c4"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_duzenlemede_kategori_degistirilebilir(client):
    tok = await _teacher_token(client, "opc4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Taşınacak", "start_fen": VALID_FEN})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "Taşınacak", "start_fen": VALID_FEN, "category": "e4"})
    assert r.status_code == 200 and r.json()["category"] == "e4"


@pytest.mark.asyncio
async def test_duzenlemede_kategori_gonderilmezse_korunur(client):
    """Eski istemci category gondermezse mevcut kategori SILINMEZ."""
    tok = await _teacher_token(client, "opc5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Kalsın", "start_fen": VALID_FEN, "category": "d4"})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "Kalsın 2", "start_fen": VALID_FEN})
    assert r.status_code == 200 and r.json()["category"] == "d4"
