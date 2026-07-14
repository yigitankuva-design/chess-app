import pytest
from sqlalchemy import select, func
from chess_api.models import ChildProfile


async def _parent_token(client, email="ath@t.com", athlete_name=None):
    body = {"email": email, "password": "guvenli12345", "name": "Veli"}
    if athlete_name is not None:
        body["athlete_name"] = athlete_name
    r = await client.post("/auth/parent/signup", json=body)
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_signup_with_athlete_creates_profile_and_session(client, db):
    tok = await _parent_token(client, email="a1@t.com", athlete_name="Ali Yıldız")
    cnt = (await db.execute(select(func.count(ChildProfile.id)))).scalar_one()
    assert cnt == 1
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Ali Yıldız"
    assert body["access_token"]
    assert body["child_profile_id"]


@pytest.mark.asyncio
async def test_signup_without_athlete_has_no_session(client):
    tok = await _parent_token(client, email="a2@t.com")
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_athlete_create_then_session(client):
    tok = await _parent_token(client, email="a3@t.com")
    r = await client.post("/auth/athlete/create",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"full_name": "Veli Sporcu"})
    assert r.status_code == 201
    assert r.json()["display_name"] == "Veli Sporcu"
    r2 = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_athlete_session_returns_oldest_profile(client):
    tok = await _parent_token(client, email="a4@t.com", athlete_name="Birinci")
    await client.post("/auth/athlete/create",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"full_name": "İkinci"})
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Birinci"


@pytest.mark.asyncio
async def test_athlete_session_requires_parent(client):
    r = await client.post("/auth/teacher/signup", json={
        "email": "tt@t.com", "password": "guvenli12345", "name": "Teacher",
    })
    ttok = r.json()["access_token"]
    r2 = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {ttok}"})
    assert r2.status_code == 403
