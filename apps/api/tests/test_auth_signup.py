from sqlalchemy import select
from chess_api.models import User


async def test_parent_signup_creates_user(client, db):
    response = await client.post("/auth/parent/signup", json={
        "email": "anne@test.com",
        "password": "guvenliSifre1",
        "name": "Anne Test",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "parent"
    assert data["name"] == "Anne Test"
    assert "access_token" in data

    # Verify in DB
    result = await db.execute(select(User).where(User.email == "anne@test.com"))
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.email_verified is False


async def test_parent_signup_duplicate_email_rejected(client):
    await client.post("/auth/parent/signup", json={
        "email": "anne2@test.com",
        "password": "guvenliSifre1",
        "name": "Anne",
    })
    response = await client.post("/auth/parent/signup", json={
        "email": "anne2@test.com",
        "password": "baskaSifre1",
        "name": "Tekrar",
    })
    assert response.status_code == 409


async def test_parent_signup_weak_password_rejected(client):
    response = await client.post("/auth/parent/signup", json={
        "email": "weak@test.com",
        "password": "123",
        "name": "Test",
    })
    assert response.status_code == 422
