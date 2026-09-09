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


# Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 1): e-posta VEYA
# kullanıcı adı ile giriş — "email" alan adı geriye uyumluluk için AYNEN
# kaldı, sadece kabul ettiği DEĞER genişledi.
async def test_login_with_username(client, db):
    from sqlalchemy import select
    from chess_api.models import User

    await client.post("/auth/parent/signup", json={
        "email": "usernametest@t.com",
        "password": "guvenli1234",
        "name": "Kullanıcı Adlı",
    })
    user = (await db.execute(select(User).where(User.email == "usernametest@t.com"))).scalar_one()
    user.username = "zaferhoca"
    await db.commit()

    response = await client.post("/auth/login", json={
        "email": "zaferhoca",  # kullanıcı adı, "email" alanına yazılıyor
        "password": "guvenli1234",
    })
    assert response.status_code == 200
    assert response.json()["role"] == "parent"


# Madde 2026-09-09 (devam): 18+ kendi kaydolan sporcu hesapları admin
# onaylayana kadar giriş yapamaz (Tier A — yaş beyanı riskine karşı).
async def test_login_blocked_while_pending_approval(client, db):
    from sqlalchemy import select
    from chess_api.models import User

    await client.post("/auth/parent/signup", json={
        "email": "pending@t.com",
        "password": "guvenli1234",
        "name": "Onay Bekleyen",
    })
    user = (await db.execute(select(User).where(User.email == "pending@t.com"))).scalar_one()
    user.approval_status = "pending"
    await db.commit()

    response = await client.post("/auth/login", json={
        "email": "pending@t.com",
        "password": "guvenli1234",
    })
    assert response.status_code == 403


async def test_login_default_approval_status_is_approved(client, db):
    """Mevcut/yeni veli-antrenör hesapları ek onay gerekmeden giriş yapabilir."""
    from sqlalchemy import select
    from chess_api.models import User

    await client.post("/auth/parent/signup", json={
        "email": "approved@t.com",
        "password": "guvenli1234",
        "name": "Onaylı",
    })
    user = (await db.execute(select(User).where(User.email == "approved@t.com"))).scalar_one()
    assert user.approval_status == "approved"
