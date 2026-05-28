import pytest


async def _parent_token(client):
    """Helper to create a parent account and get its token."""
    r = await client.post("/auth/parent/signup", json={
        "email": "gam@test.com",
        "password": "guvenli12345",
        "name": "Gamification Tester",
    })
    assert r.status_code in (200, 201)
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_badges_endpoint_requires_auth(client):
    """GET /gamification/badges without token should fail."""
    r = await client.get("/gamification/badges")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_badges_endpoint_returns_list(client):
    """GET /gamification/badges with valid token should return list."""
    token = await _parent_token(client)
    r = await client.get("/gamification/badges", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Each badge should have required fields
    for badge in data:
        assert "slug" in badge
        assert "name_tr" in badge
        assert "description_tr" in badge
        assert "icon" in badge
        assert "earned" in badge
        assert isinstance(badge["earned"], bool)


@pytest.mark.asyncio
async def test_me_endpoint_returns_progress(client):
    """GET /gamification/me should return rank and XP progress."""
    token = await _parent_token(client)
    r = await client.get("/gamification/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()

    # Check required fields
    assert "rank_name" in data
    assert "rank_icon" in data
    assert "xp_total" in data
    assert "next_rank_xp" in data
    assert "badges_earned" in data
    assert "badges_total" in data

    # New user should have 0 XP and 0 badges
    assert data["xp_total"] == 0
    assert data["badges_earned"] == 0


@pytest.mark.asyncio
async def test_me_endpoint_requires_auth(client):
    """GET /gamification/me without token should fail."""
    r = await client.get("/gamification/me")
    assert r.status_code in (401, 403)
