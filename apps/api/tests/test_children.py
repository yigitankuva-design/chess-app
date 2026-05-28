async def _signup_parent(client, email="p@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Parent",
    })
    return r.json()["access_token"]


async def test_create_child_profile(client):
    token = await _signup_parent(client)
    response = await client.post(
        "/children",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Ali", "age": 10, "pin": "1234"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "Ali"
    assert data["age"] == 10
    assert "pin" not in data
    assert "pin_hash" not in data


async def test_list_my_children(client):
    token = await _signup_parent(client, "list@t.com")
    headers = {"Authorization": f"Bearer {token}"}
    await client.post("/children", headers=headers, json={
        "display_name": "Veli", "age": 8, "pin": "1111",
    })
    await client.post("/children", headers=headers, json={
        "display_name": "Ayse", "age": 12, "pin": "2222",
    })
    response = await client.get("/children", headers=headers)
    assert response.status_code == 200
    children = response.json()
    assert len(children) == 2


async def test_create_child_requires_auth(client):
    response = await client.post("/children", json={
        "display_name": "X", "age": 10, "pin": "1234",
    })
    assert response.status_code in (401, 403)
