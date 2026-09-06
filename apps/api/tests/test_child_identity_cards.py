"""Sporcu Profili kimlik kartları — fotoğraf yükleme + İletişim Bilgileri
(madde 2026-09-07, GRUP C)."""
import pytest


TINY_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.mark.asyncio
async def test_child_uploads_own_photo(client, child_auth):
    """Sporcu kendi token'ıyla fotoğraf yükleyebilir; /gamification/me
    bunu geri döndürür."""
    token, child_id = child_auth
    h = {"Authorization": f"Bearer {token}"}
    r = await client.post("/children/me/photo", headers=h, json={"photo_data_url": TINY_PNG_DATA_URL})
    assert r.status_code == 200

    r = await client.get("/gamification/me", headers=h)
    assert r.json()["photo_data_url"] == TINY_PNG_DATA_URL


@pytest.mark.asyncio
async def test_upload_photo_rejects_non_image_data_url(client, child_auth):
    token, _ = child_auth
    r = await client.post(
        "/children/me/photo", headers={"Authorization": f"Bearer {token}"},
        json={"photo_data_url": "not-an-image"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_upload_photo_requires_child_token(client):
    r = await client.post("/children/me/photo", json={"photo_data_url": TINY_PNG_DATA_URL})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_parent_updates_contact_info_partial(client):
    """Veli il + baba telefonunu girer; GÖNDERMEDİĞİ alanlar (anne bilgisi)
    None kalır — kısmi güncelleme (PATCH semantiği)."""
    r = await client.post("/auth/parent/signup", json={
        "email": "contactparent@t.com", "password": "guvenli12345", "name": "Veli",
    })
    parent_token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {parent_token}"}
    r = await client.post("/children", headers=h, json={"display_name": "Ayşe", "age": 8, "pin": "1234"})
    child_id = r.json()["id"]

    r = await client.patch(
        f"/parent/children/{child_id}/contact-info", headers=h,
        json={"province": "Bilecik", "father_phone": "05551112233"},
    )
    assert r.status_code == 200

    # Aynı çocuğa PIN ile girip /gamification/me'den doğrula.
    await client.post("/auth/device/register", headers=h,
                      json={"device_fingerprint": "devcontact", "name": "T"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "devcontact",
    })
    child_token = r.json()["access_token"]
    r = await client.get("/gamification/me", headers={"Authorization": f"Bearer {child_token}"})
    data = r.json()
    assert data["province"] == "Bilecik"
    assert data["father_phone"] == "05551112233"
    assert data["mother_phone"] is None


@pytest.mark.asyncio
async def test_parent_cannot_update_another_parents_child_contact_info(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "contactparent_a@t.com", "password": "guvenli12345", "name": "Veli A",
    })
    token_a = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {token_a}"},
                          json={"display_name": "Çocuk A", "age": 9, "pin": "1234"})
    child_id = r.json()["id"]

    r = await client.post("/auth/parent/signup", json={
        "email": "contactparent_b@t.com", "password": "guvenli12345", "name": "Veli B",
    })
    token_b = r.json()["access_token"]

    r = await client.patch(
        f"/parent/children/{child_id}/contact-info",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"province": "İstanbul"},
    )
    assert r.status_code == 403
