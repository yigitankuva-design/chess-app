async def test_parent_login_success(client):
    await client.post("/auth/parent/signup", json={
        "email": "login@test.com",
        "password": "guvenli1234",
        "name": "Login User",
    })
    response = await client.post("/auth/login", json={
        "email": "login@test.com",
        "password": "guvenli1234",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "parent"


async def test_login_wrong_password(client):
    await client.post("/auth/parent/signup", json={
        "email": "wrong@test.com",
        "password": "guvenli1234",
        "name": "W",
    })
    response = await client.post("/auth/login", json={
        "email": "wrong@test.com",
        "password": "yanlisSifre",
    })
    assert response.status_code == 401


async def test_login_unknown_email(client):
    response = await client.post("/auth/login", json={
        "email": "yok@test.com",
        "password": "yok",
    })
    assert response.status_code == 401
