async def _setup_parent_with_child(client):
    """Helper: signup parent, create child with PIN 1234. Returns (parent_token, child_id)."""
    r = await client.post("/auth/parent/signup", json={
        "email": "pc@t.com", "password": "guvenli12345", "name": "PC",
    })
    parent_token = r.json()["access_token"]
    r = await client.post(
        "/children",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"display_name": "Ali", "age": 10, "pin": "1234"},
    )
    child_id = r.json()["id"]
    return parent_token, child_id


async def test_register_device(client):
    parent_token, _ = await _setup_parent_with_child(client)
    response = await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "abc123fingerprint", "name": "Anne tablet"},
    )
    assert response.status_code == 201
    assert response.json()["registered"] is True


async def test_child_pin_login_on_trusted_device(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "dev1", "name": "Test"},
    )
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "1234",
        "device_fingerprint": "dev1",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["child_profile_id"] == child_id


async def test_child_pin_login_wrong_pin(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "dev2", "name": "Test"},
    )
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "9999",
        "device_fingerprint": "dev2",
    })
    assert response.status_code == 401


async def test_child_pin_login_untrusted_device(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    # device NOT registered
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "1234",
        "device_fingerprint": "unknown_device",
    })
    assert response.status_code == 403
