import pytest


async def _teacher_token(client, email="settings_teach@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _parent_token(client, email="settings_par@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_public_settings_empty_by_default(client):
    r = await client.get("/settings")
    assert r.status_code == 200
    assert r.json() == {}


@pytest.mark.asyncio
async def test_teacher_can_patch_and_public_reads_it(client):
    ttok = await _teacher_token(client)
    r = await client.patch("/admin/settings",
                           headers={"Authorization": f"Bearer {ttok}"},
                           json={"labels": {"features": {"play": "Oynayalım"}}})
    assert r.status_code == 200
    pub = await client.get("/settings")
    assert pub.json()["labels"]["features"]["play"] == "Oynayalım"


@pytest.mark.asyncio
async def test_patch_deep_merges(client):
    ttok = await _teacher_token(client, email="dm_teach@t.com")
    await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                       json={"labels": {"features": {"play": "Oyna"}}})
    await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                       json={"labels": {"features": {"puzzle": "Bulmaca"}}})
    data = (await client.get("/settings")).json()
    # ilk yazılan korunmalı (deep-merge)
    assert data["labels"]["features"]["play"] == "Oyna"
    assert data["labels"]["features"]["puzzle"] == "Bulmaca"


@pytest.mark.asyncio
async def test_parent_cannot_patch(client):
    ptok = await _parent_token(client)
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ptok}"},
                           json={"labels": {}})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_invalid_color_rejected(client):
    ttok = await _teacher_token(client, email="color_teach@t.com")
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                           json={"board": {"lightSquare": "beyaz"}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_valid_color_accepted(client):
    ttok = await _teacher_token(client, email="color2_teach@t.com")
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                           json={"board": {"lightSquare": "#eef0fb", "darkSquare": "#c3c6ee"}})
    assert r.status_code == 200
    assert r.json()["board"]["lightSquare"] == "#eef0fb"


@pytest.mark.asyncio
async def test_invalid_piece_key_rejected(client):
    ttok = await _teacher_token(client, email="pk_teach@t.com")
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                           json={"board": {"pieces": {"xX": "data:image/png;base64,AAAA"}}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_piece_non_datauri_rejected(client):
    ttok = await _teacher_token(client, email="pd_teach@t.com")
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                           json={"board": {"pieces": {"wK": "http://example.com/k.png"}}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_valid_piece_datauri_accepted(client):
    ttok = await _teacher_token(client, email="pv_teach@t.com")
    r = await client.patch("/admin/settings", headers={"Authorization": f"Bearer {ttok}"},
                           json={"board": {"pieces": {"wK": "data:image/png;base64,AAAA"}}})
    assert r.status_code == 200
    assert r.json()["board"]["pieces"]["wK"].startswith("data:image/png")
