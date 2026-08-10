def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images", "practice_positions"}


import pytest


@pytest.mark.asyncio
async def test_bos_liste_bos_dizi_doner(client):
    r = await client.get("/custom-tabs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_olmayan_sekme_404_doner(client):
    r = await client.get("/custom-tabs/999999")
    assert r.status_code == 404


async def _teacher_token(client, email="ct@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_sekme_ekler_emoji_otomatik_atanir(client):
    tok = await _teacher_token(client, "ct1@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "Turnuvalar"})
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Turnuvalar"
    assert body["emoji"] == "📌"


@pytest.mark.asyncio
async def test_ikinci_sekme_farkli_emoji_alir(client):
    tok = await _teacher_token(client, "ct2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/custom-tabs", headers=h, json={"label": "Birinci"})
    r = await client.post("/admin/custom-tabs", headers=h, json={"label": "İkinci"})
    assert r.json()["emoji"] == "⭐"


@pytest.mark.asyncio
async def test_tokensiz_sekme_ekleme_engellenir(client):
    r = await client.post("/admin/custom-tabs", json={"label": "Turnuvalar"})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_bos_etiketle_sekme_reddedilir(client):
    tok = await _teacher_token(client, "ct3@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "  "})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_sekme_silinince_bolumleri_de_silinir(client):
    tok = await _teacher_token(client, "ct4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = await client.post("/admin/custom-tabs", headers=h, json={"label": "Silinecek"})
    tab_id = tab.json()["id"]
    await client.post(f"/admin/custom-tabs/{tab_id}/sections", headers=h,
                      json={"title": "Bölüm 1", "body": "metin", "images": []})

    r = await client.delete(f"/admin/custom-tabs/{tab_id}", headers=h)
    assert r.status_code == 200

    listing = await client.get("/custom-tabs")
    assert tab_id not in [t["id"] for t in listing.json()]
    detail = await client.get(f"/custom-tabs/{tab_id}")
    assert detail.status_code == 404


@pytest.mark.asyncio
async def test_sekme_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "ct5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = (await client.post("/admin/custom-tabs", headers=h, json={"label": "A"})).json()
    b = (await client.post("/admin/custom-tabs", headers=h, json={"label": "B"})).json()

    r = await client.post("/admin/custom-tabs/reorder", headers=h,
                          json={"ordered_ids": [b["id"], a["id"]]})
    assert r.status_code == 200

    listing = (await client.get("/custom-tabs")).json()
    assert [t["id"] for t in listing] == [b["id"], a["id"]]


@pytest.mark.asyncio
async def test_bolum_guncellenir(client):
    tok = await _teacher_token(client, "cts1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Eski", "body": "eski metin", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"title": "Yeni", "body": "yeni metin"})
    assert r.status_code == 200
    assert r.json()["title"] == "Yeni"
    assert r.json()["body"] == "yeni metin"


@pytest.mark.asyncio
async def test_bolum_silinir(client):
    tok = await _teacher_token(client, "cts2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Bölüm", "body": "x", "images": []})).json()

    r = await client.delete(f"/admin/custom-tab-sections/{section['id']}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"] == []


@pytest.mark.asyncio
async def test_bolum_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "cts3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    s1 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S1", "body": "", "images": []})).json()
    s2 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S2", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections/reorder", headers=h,
                          json={"ordered_ids": [s2["id"], s1["id"]]})
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert [s["id"] for s in detail["sections"]] == [s2["id"], s1["id"]]


@pytest.mark.asyncio
async def test_cok_buyuk_bolum_gorseli_reddedilir(client):
    tok = await _teacher_token(client, "cts4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    huge = "data:image/png;base64," + ("A" * 400_001)
    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                          json={"title": "Bölüm", "body": "", "images": [huge]})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_konum_havuzu_kaydedilir(client):
    tok = await _teacher_token(client, "ctp1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    assert section["practice_positions"] == []

    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "p1", "fen": fen}]})
    assert r.status_code == 200
    assert r.json()["practice_positions"] == [{"id": "p1", "fen": fen, "category": None}]


@pytest.mark.asyncio
async def test_konum_havuzu_bos_id_reddedilir(client):
    tok = await _teacher_token(client, "ctp2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1"}]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_konum_kategori_alani_korunur(client):
    tok = await _teacher_token(client, "ctp4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Oyunsonu Pratiği Yap", "body": "", "images": []})).json()

    fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [
                               {"id": "p1", "fen": fen, "category": "Piyon Finalleri"},
                               {"id": "p2", "fen": fen},
                           ]})
    assert r.status_code == 200
    poz = r.json()["practice_positions"]
    assert poz[0]["category"] == "Piyon Finalleri"
    # Kategorisiz kayit da calisir (eski veriler bozulmaz).
    assert poz[1].get("category") is None


@pytest.mark.asyncio
async def test_genel_bolum_gorunumu_konum_havuzunu_icerir(client):
    tok = await _teacher_token(client, "ctp3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                       json={"practice_positions": [{"id": "p1", "fen": fen}]})

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"][0]["practice_positions"] == [{"id": "p1", "fen": fen, "category": None}]
