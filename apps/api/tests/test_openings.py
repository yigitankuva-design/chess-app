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
                          json={"name": "İtalyan Açılışı"})
    assert r.status_code == 201
    assert r.json()["name"] == "İtalyan Açılışı"


@pytest.mark.asyncio
async def test_acilis_listesi_herkese_acik_ve_varyantsiz_bos_liste_doner(client):
    """Sporcu acilis listesini gorebilmeli (mac kurarken secer). Varyant
    eklenmemis bir acilisin 'variants' alani BOS DIZIDIR."""
    tok = await _teacher_token(client, "op2@t.com")
    await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                      json={"name": "Sicilya"})
    r = await client.get("/openings")
    assert r.status_code == 200
    body = r.json()
    assert [o["name"] for o in body] == ["Sicilya"]
    assert body[0]["variants"] == []


@pytest.mark.asyncio
async def test_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "op4@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "   "})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ogretmen_acilis_siler_ve_varyantlari_da_gider(client):
    tok = await _teacher_token(client, "op5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h, json={"name": "Silinecek"})
    oid = created.json()["id"]
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Ana Hat", "start_fen": VALID_FEN})
    r = await client.delete(f"/admin/openings/{oid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_tokensiz_ekleme_engellenir(client):
    r = await client.post("/admin/openings", json={"name": "X"})
    assert r.status_code in (401, 403)


# ── Madde 7: duzenleme ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ogretmen_acilisi_duzenler(client):
    tok = await _teacher_token(client, "op6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h, json={"name": "Eski Ad"})
    oid = created.json()["id"]

    r = await client.patch(f"/admin/openings/{oid}", headers=h, json={"name": "Yeni Ad"})
    assert r.status_code == 200
    assert r.json()["name"] == "Yeni Ad"

    listing = await client.get("/openings")
    assert listing.json()[0]["name"] == "Yeni Ad"


@pytest.mark.asyncio
async def test_olmayan_acilisi_duzenlemek_404_doner(client):
    tok = await _teacher_token(client, "op8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.patch("/admin/openings/999999", headers=h, json={"name": "A"})
    assert r.status_code == 404


# ── Madde 8: siralama ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_yeni_acilislar_ekleme_sirasinda_listelenir(client):
    tok = await _teacher_token(client, "op9@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h, json={"name": "Birinci"})
    await client.post("/admin/openings", headers=h, json={"name": "İkinci"})
    await client.post("/admin/openings", headers=h, json={"name": "Üçüncü"})
    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["Birinci", "İkinci", "Üçüncü"]


@pytest.mark.asyncio
async def test_asagi_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op10@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = await client.post("/admin/openings", headers=h, json={"name": "A"})
    await client.post("/admin/openings", headers=h, json={"name": "B"})
    await client.post("/admin/openings", headers=h, json={"name": "C"})

    r = await client.post(f"/admin/openings/{a.json()['id']}/move", headers=h,
                          json={"direction": "down"})
    assert r.status_code == 200 and r.json()["moved"] is True

    listing = await client.get("/openings")
    assert [o["name"] for o in listing.json()] == ["B", "A", "C"]


@pytest.mark.asyncio
async def test_yukari_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op11@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h, json={"name": "A"})
    b = await client.post("/admin/openings", headers=h, json={"name": "B"})

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
    a = await client.post("/admin/openings", headers=h, json={"name": "A"})
    b = await client.post("/admin/openings", headers=h, json={"name": "B"})

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
    r = await client.post("/admin/openings", headers=h, json={"name": "Eski Usul"})
    assert r.status_code == 201
    assert r.json()["category"] == "diger"
    listing = await client.get("/openings")
    assert listing.json()[0]["category"] == "diger"


@pytest.mark.asyncio
async def test_kategori_ile_eklenir_ve_listede_doner(client):
    tok = await _teacher_token(client, "opc2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/openings", headers=h, json={"name": "İtalyan", "category": "e4"})
    await client.post("/admin/openings", headers=h, json={"name": "Slav", "category": "d4"})
    listing = await client.get("/openings")
    assert [(o["name"], o["category"]) for o in listing.json()] == [
        ("İtalyan", "e4"), ("Slav", "d4"),
    ]


@pytest.mark.asyncio
async def test_gecersiz_kategori_reddedilir(client):
    tok = await _teacher_token(client, "opc3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/openings", headers=h, json={"name": "X", "category": "c4"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_duzenlemede_kategori_degistirilebilir(client):
    tok = await _teacher_token(client, "opc4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h, json={"name": "Taşınacak"})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "Taşınacak", "category": "e4"})
    assert r.status_code == 200 and r.json()["category"] == "e4"


@pytest.mark.asyncio
async def test_duzenlemede_kategori_gonderilmezse_korunur(client):
    """Eski istemci category gondermezse mevcut kategori SILINMEZ."""
    tok = await _teacher_token(client, "opc5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Kalsın", "category": "d4"})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h, json={"name": "Kalsın 2"})
    assert r.status_code == 200 and r.json()["category"] == "d4"


# ── Varyantlar (madde: 2026-08-20) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_varyant_eklenir_ve_listede_ic_ice_doner(client):
    tok = await _teacher_token(client, "ov1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h, json={"name": "İtalyan Açılışı"})
    oid = created.json()["id"]

    r = await client.post(f"/admin/openings/{oid}/variants", headers=h,
                          json={"name": "Klasik Varyant", "start_fen": VALID_FEN})
    assert r.status_code == 201
    assert r.json()["name"] == "Klasik Varyant"

    listing = await client.get("/openings")
    body = listing.json()[0]
    assert body["variants"] == [{"id": r.json()["id"], "name": "Klasik Varyant", "start_fen": VALID_FEN}]


@pytest.mark.asyncio
async def test_birden_fazla_varyant_eklenme_sirasinda_doner(client):
    tok = await _teacher_token(client, "ov2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "Sicilya"})).json()["id"]
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Najdorf", "start_fen": VALID_FEN})
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Dragon", "start_fen": VALID_FEN})
    listing = await client.get("/openings")
    assert [v["name"] for v in listing.json()[0]["variants"]] == ["Najdorf", "Dragon"]


@pytest.mark.asyncio
async def test_varyant_gecersiz_fen_reddedilir(client):
    tok = await _teacher_token(client, "ov3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "X"})).json()["id"]
    r = await client.post(f"/admin/openings/{oid}/variants", headers=h,
                          json={"name": "Y", "start_fen": "bozuk fen"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_varyant_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "ov4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "X"})).json()["id"]
    r = await client.post(f"/admin/openings/{oid}/variants", headers=h,
                          json={"name": "  ", "start_fen": VALID_FEN})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_olmayan_acilisa_varyant_eklenemez(client):
    tok = await _teacher_token(client, "ov5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/openings/999999/variants", headers=h,
                          json={"name": "Y", "start_fen": VALID_FEN})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_varyant_duzenlenir(client):
    tok = await _teacher_token(client, "ov6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "X"})).json()["id"]
    vid = (await client.post(f"/admin/openings/{oid}/variants", headers=h,
                             json={"name": "Eski", "start_fen": VALID_FEN})).json()["id"]
    r = await client.patch(f"/admin/opening-variants/{vid}", headers=h,
                           json={"name": "Yeni", "start_fen": VALID_FEN})
    assert r.status_code == 200 and r.json()["name"] == "Yeni"


@pytest.mark.asyncio
async def test_varyant_silinir(client):
    tok = await _teacher_token(client, "ov7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "X"})).json()["id"]
    vid = (await client.post(f"/admin/openings/{oid}/variants", headers=h,
                             json={"name": "Silinecek", "start_fen": VALID_FEN})).json()["id"]
    r = await client.delete(f"/admin/opening-variants/{vid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert listing.json()[0]["variants"] == []


@pytest.mark.asyncio
async def test_varyant_tokensiz_islemler_engellenir(client):
    tok = await _teacher_token(client, "ov8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    oid = (await client.post("/admin/openings", headers=h, json={"name": "X"})).json()["id"]
    r = await client.post(f"/admin/openings/{oid}/variants", json={"name": "Y", "start_fen": VALID_FEN})
    assert r.status_code in (401, 403)
