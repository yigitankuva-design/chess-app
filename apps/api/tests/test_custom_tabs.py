def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images"}


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
