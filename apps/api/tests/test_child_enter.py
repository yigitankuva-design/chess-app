import pytest


@pytest.mark.asyncio
async def test_child_enter_trusted_device_succeeds(client):
    # Parent signup
    r = await client.post("/auth/parent/signup", json={
        "email": "enter1@t.com", "password": "guvenli12345", "name": "Pa",
    })
    parent_token = r.json()["access_token"]
    # Create child
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    # Register device
    await client.post("/auth/device/register",
                      headers={"Authorization": f"Bearer {parent_token}"},
                      json={"device_fingerprint": "dev-ok", "name": "T"})
    # Enter without PIN
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": child_id, "device_fingerprint": "dev-ok",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["child_profile_id"] == child_id
    assert body["access_token"]


@pytest.mark.asyncio
async def test_child_enter_untrusted_device_403(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "enter2@t.com", "password": "guvenli12345", "name": "Pa",
    })
    parent_token = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    # No device registered → untrusted
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": child_id, "device_fingerprint": "stranger",
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_child_enter_unknown_child_404(client):
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": 999999, "device_fingerprint": "x",
    })
    assert r.status_code == 404
