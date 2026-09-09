import pytest


@pytest.mark.asyncio
async def test_badges_endpoint_requires_auth(client):
    """GET /gamification/badges without token should fail."""
    r = await client.get("/gamification/badges")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_parent_token_rejected_on_badges(client):
    """A parent token must be rejected on child-only endpoint."""
    r = await client.post("/auth/parent/signup", json={
        "email": "gamparent2@test.com",
        "password": "guvenli12345",
        "name": "GamParent2",
    })
    assert r.status_code in (200, 201)
    parent_token = r.json()["access_token"]
    r = await client.get("/gamification/badges", headers={"Authorization": f"Bearer {parent_token}"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_badges_endpoint_returns_list(client, child_auth):
    """GET /gamification/badges with valid child token should return list."""
    token, child_id = child_auth
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
async def test_me_endpoint_returns_progress(client, child_auth):
    """GET /gamification/me should return rank and XP progress."""
    token, child_id = child_auth
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
    # Madde 2026-09-06: Profil kimlik şeridi — üyelik tarihi.
    assert "member_since" in data
    # Madde 2026-09-07 (GRUP C): kimlik kartları — henüz doldurulmadıysa NULL.
    assert data["photo_data_url"] is None
    assert data["province"] is None
    assert data["father_phone"] is None
    assert data["mother_email"] is None
    # Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): Lichess kullanıcı adı.
    assert "lichess_username" in data
    assert data["lichess_username"] is None

    # New child should have 0 XP and 0 badges
    assert data["xp_total"] == 0
    assert data["badges_earned"] == 0


@pytest.mark.asyncio
async def test_me_endpoint_reflects_kayit_ol_lichess_username(client):
    """Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): "Kayıt Ol"
    formundan (18 altı — POST /auth/member/signup) Lichess kullanıcı adı
    girildiyse, /gamification/me artık BUNU döndürür."""
    r = await client.post("/auth/member/signup", json={
        "first_name": "Ali", "last_name": "Yılmaz",
        "phone": "5551112233", "email": "gamlichess@test.com",
        "province": "Bilecik", "lichess_username": "aliyilmazchess",
        "username": "gamlichess", "password": "guvenli1234",
        "birth_date": "2015-01-01",
        "mother_name": "Ayşe Yılmaz", "mother_phone": "5551112244", "mother_email": "ayse@test.com",
        "kvkk_consent": True,
    })
    assert r.status_code == 201
    parent_token = r.json()["access_token"]

    session_r = await client.post(
        "/auth/athlete/session", headers={"Authorization": f"Bearer {parent_token}"},
    )
    child_token = session_r.json()["access_token"]

    r2 = await client.get("/gamification/me", headers={"Authorization": f"Bearer {child_token}"})
    assert r2.status_code == 200
    assert r2.json()["lichess_username"] == "aliyilmazchess"


@pytest.mark.asyncio
async def test_me_endpoint_requires_auth(client):
    """GET /gamification/me without token should fail."""
    r = await client.get("/gamification/me")
    assert r.status_code in (401, 403)
