import pytest

VALID_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1"


async def _teacher_token(client, email="op@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _create_type(client, h, name="Tür"):
    r = await client.post("/admin/opening-types", headers=h, json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def _flat_openings(list_body):
    """Ic ice [tur -> acilis] listesini duz acilis dizisine cevirir (testte
    kolay karsilastirma icin)."""
    out = []
    for t in list_body:
        out.extend(t["openings"])
    return out


@pytest.mark.asyncio
async def test_ogretmen_acilis_ekler(client):
    tok = await _teacher_token(client, "op1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    r = await client.post("/admin/openings", headers=h,
                          json={"name": "İtalyan Açılışı", "opening_type_id": tid})
    assert r.status_code == 201
    assert r.json()["name"] == "İtalyan Açılışı"
    assert r.json()["opening_type_id"] == tid


@pytest.mark.asyncio
async def test_acilis_listesi_herkese_acik_ve_varyantsiz_bos_liste_doner(client):
    """Sporcu acilis listesini gorebilmeli (mac kurarken secer). Varyant
    eklenmemis bir acilisin 'variants' alani BOS DIZIDIR."""
    tok = await _teacher_token(client, "op2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    await client.post("/admin/openings", headers=h, json={"name": "Sicilya", "opening_type_id": tid})
    r = await client.get("/openings")
    assert r.status_code == 200
    body = r.json()
    openings = _flat_openings(body)
    assert [o["name"] for o in openings] == ["Sicilya"]
    assert openings[0]["variants"] == []


@pytest.mark.asyncio
async def test_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "op4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    r = await client.post("/admin/openings", headers=h,
                          json={"name": "   ", "opening_type_id": tid})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_olmayan_tur_ile_acilis_eklenemez(client):
    tok = await _teacher_token(client, "op4b@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/openings", headers=h,
                          json={"name": "X", "opening_type_id": 999999})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ogretmen_acilis_siler_ve_varyantlari_da_gider(client):
    tok = await _teacher_token(client, "op5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Silinecek", "opening_type_id": tid})
    oid = created.json()["id"]
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Ana Hat", "start_fen": VALID_FEN})
    r = await client.delete(f"/admin/openings/{oid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert _flat_openings(listing.json()) == []


@pytest.mark.asyncio
async def test_tokensiz_ekleme_engellenir(client):
    r = await client.post("/admin/openings", json={"name": "X", "opening_type_id": 1})
    assert r.status_code in (401, 403)


# ── Madde 7: duzenleme ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ogretmen_acilisi_duzenler(client):
    tok = await _teacher_token(client, "op6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Eski Ad", "opening_type_id": tid})
    oid = created.json()["id"]

    r = await client.patch(f"/admin/openings/{oid}", headers=h, json={"name": "Yeni Ad"})
    assert r.status_code == 200
    assert r.json()["name"] == "Yeni Ad"

    listing = await client.get("/openings")
    assert _flat_openings(listing.json())[0]["name"] == "Yeni Ad"


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
    tid = await _create_type(client, h)
    await client.post("/admin/openings", headers=h, json={"name": "Birinci", "opening_type_id": tid})
    await client.post("/admin/openings", headers=h, json={"name": "İkinci", "opening_type_id": tid})
    await client.post("/admin/openings", headers=h, json={"name": "Üçüncü", "opening_type_id": tid})
    listing = await client.get("/openings")
    assert [o["name"] for o in _flat_openings(listing.json())] == ["Birinci", "İkinci", "Üçüncü"]


@pytest.mark.asyncio
async def test_asagi_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op10@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    a = await client.post("/admin/openings", headers=h, json={"name": "A", "opening_type_id": tid})
    await client.post("/admin/openings", headers=h, json={"name": "B", "opening_type_id": tid})
    await client.post("/admin/openings", headers=h, json={"name": "C", "opening_type_id": tid})

    r = await client.post(f"/admin/openings/{a.json()['id']}/move", headers=h,
                          json={"direction": "down"})
    assert r.status_code == 200 and r.json()["moved"] is True

    listing = await client.get("/openings")
    assert [o["name"] for o in _flat_openings(listing.json())] == ["B", "A", "C"]


@pytest.mark.asyncio
async def test_yukari_tasima_komsuyla_yer_degistirir(client):
    tok = await _teacher_token(client, "op11@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    await client.post("/admin/openings", headers=h, json={"name": "A", "opening_type_id": tid})
    b = await client.post("/admin/openings", headers=h, json={"name": "B", "opening_type_id": tid})

    r = await client.post(f"/admin/openings/{b.json()['id']}/move", headers=h,
                          json={"direction": "up"})
    assert r.status_code == 200 and r.json()["moved"] is True

    listing = await client.get("/openings")
    assert [o["name"] for o in _flat_openings(listing.json())] == ["B", "A"]


@pytest.mark.asyncio
async def test_TUZAK_listenin_ucundaki_tasima_sessizce_hicbir_sey_yapmaz(client):
    """En basttaki acilis yukari, en sondaki asagi tasinmaya calisilirsa
    hata FIRLATILMAZ — cagiran zaten en ucta oldugunu bilir."""
    tok = await _teacher_token(client, "op12@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    a = await client.post("/admin/openings", headers=h, json={"name": "A", "opening_type_id": tid})
    b = await client.post("/admin/openings", headers=h, json={"name": "B", "opening_type_id": tid})

    r_top = await client.post(f"/admin/openings/{a.json()['id']}/move", headers=h,
                              json={"direction": "up"})
    assert r_top.status_code == 200 and r_top.json()["moved"] is False

    r_bottom = await client.post(f"/admin/openings/{b.json()['id']}/move", headers=h,
                                 json={"direction": "down"})
    assert r_bottom.status_code == 200 and r_bottom.json()["moved"] is False

    listing = await client.get("/openings")
    assert [o["name"] for o in _flat_openings(listing.json())] == ["A", "B"]


# ── Açılış Türleri (madde: 2026-08-20) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_tur_eklenir_ve_listede_doner(client):
    tok = await _teacher_token(client, "ot1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/opening-types", headers=h, json={"name": "e4'lü Açılışlar"})
    assert r.status_code == 201
    assert r.json()["name"] == "e4'lü Açılışlar"
    listing = await client.get("/openings")
    assert [t["name"] for t in listing.json()] == ["e4'lü Açılışlar"]
    assert listing.json()[0]["openings"] == []


@pytest.mark.asyncio
async def test_tur_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "ot2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.post("/admin/opening-types", headers=h, json={"name": "  "})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_tur_duzenlenir(client):
    tok = await _teacher_token(client, "ot3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h, "Eski Ad")
    r = await client.patch(f"/admin/opening-types/{tid}", headers=h, json={"name": "Yeni Ad"})
    assert r.status_code == 200 and r.json()["name"] == "Yeni Ad"
    listing = await client.get("/openings")
    assert listing.json()[0]["name"] == "Yeni Ad"


@pytest.mark.asyncio
async def test_olmayan_tur_duzenlemek_404_doner(client):
    tok = await _teacher_token(client, "ot4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    r = await client.patch("/admin/opening-types/999999", headers=h, json={"name": "A"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_tur_silinince_altindaki_acilis_ve_varyantlar_da_gider(client):
    tok = await _teacher_token(client, "ot5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Y", "start_fen": VALID_FEN})

    r = await client.delete(f"/admin/opening-types/{tid}", headers=h)
    assert r.status_code == 200

    listing = await client.get("/openings")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_tur_silinirken_bos_turde_hata_olmaz(client):
    tok = await _teacher_token(client, "ot6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    r = await client.delete(f"/admin/opening-types/{tid}", headers=h)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_tur_tokensiz_islemler_engellenir(client):
    r = await client.post("/admin/opening-types", json={"name": "X"})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_duzenlemede_tur_degistirilebilir(client):
    tok = await _teacher_token(client, "ot7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid1 = await _create_type(client, h, "Tür 1")
    tid2 = await _create_type(client, h, "Tür 2")
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Taşınacak", "opening_type_id": tid1})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "Taşınacak", "opening_type_id": tid2})
    assert r.status_code == 200 and r.json()["opening_type_id"] == tid2


@pytest.mark.asyncio
async def test_duzenlemede_tur_gonderilmezse_korunur(client):
    """Eski istemci opening_type_id gondermezse mevcut tur SILINMEZ."""
    tok = await _teacher_token(client, "ot8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Kalsın", "opening_type_id": tid})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h, json={"name": "Kalsın 2"})
    assert r.status_code == 200 and r.json()["opening_type_id"] == tid


@pytest.mark.asyncio
async def test_duzenlemede_olmayan_tur_404_doner(client):
    tok = await _teacher_token(client, "ot9@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "X", "opening_type_id": tid})
    oid = created.json()["id"]
    r = await client.patch(f"/admin/openings/{oid}", headers=h,
                           json={"name": "X", "opening_type_id": 999999})
    assert r.status_code == 404


# ── Varyantlar (madde: 2026-08-20) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_varyant_eklenir_ve_listede_ic_ice_doner(client):
    tok = await _teacher_token(client, "ov1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "İtalyan Açılışı", "opening_type_id": tid})
    oid = created.json()["id"]

    r = await client.post(f"/admin/openings/{oid}/variants", headers=h,
                          json={"name": "Klasik Varyant", "start_fen": VALID_FEN})
    assert r.status_code == 201
    assert r.json()["name"] == "Klasik Varyant"

    listing = await client.get("/openings")
    body = _flat_openings(listing.json())[0]
    assert body["variants"] == [{"id": r.json()["id"], "name": "Klasik Varyant", "start_fen": VALID_FEN}]


@pytest.mark.asyncio
async def test_birden_fazla_varyant_eklenme_sirasinda_doner(client):
    tok = await _teacher_token(client, "ov2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "Sicilya", "opening_type_id": tid})).json()["id"]
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Najdorf", "start_fen": VALID_FEN})
    await client.post(f"/admin/openings/{oid}/variants", headers=h,
                      json={"name": "Dragon", "start_fen": VALID_FEN})
    listing = await client.get("/openings")
    variants = _flat_openings(listing.json())[0]["variants"]
    assert [v["name"] for v in variants] == ["Najdorf", "Dragon"]


@pytest.mark.asyncio
async def test_varyant_gecersiz_fen_reddedilir(client):
    tok = await _teacher_token(client, "ov3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
    r = await client.post(f"/admin/openings/{oid}/variants", headers=h,
                          json={"name": "Y", "start_fen": "bozuk fen"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_varyant_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "ov4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
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
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
    vid = (await client.post(f"/admin/openings/{oid}/variants", headers=h,
                             json={"name": "Eski", "start_fen": VALID_FEN})).json()["id"]
    r = await client.patch(f"/admin/opening-variants/{vid}", headers=h,
                           json={"name": "Yeni", "start_fen": VALID_FEN})
    assert r.status_code == 200 and r.json()["name"] == "Yeni"


@pytest.mark.asyncio
async def test_varyant_silinir(client):
    tok = await _teacher_token(client, "ov7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
    vid = (await client.post(f"/admin/openings/{oid}/variants", headers=h,
                             json={"name": "Silinecek", "start_fen": VALID_FEN})).json()["id"]
    r = await client.delete(f"/admin/opening-variants/{vid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert _flat_openings(listing.json())[0]["variants"] == []


@pytest.mark.asyncio
async def test_varyant_tokensiz_islemler_engellenir(client):
    tok = await _teacher_token(client, "ov8@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tid = await _create_type(client, h)
    oid = (await client.post("/admin/openings", headers=h,
                             json={"name": "X", "opening_type_id": tid})).json()["id"]
    r = await client.post(f"/admin/openings/{oid}/variants", json={"name": "Y", "start_fen": VALID_FEN})
    assert r.status_code in (401, 403)
