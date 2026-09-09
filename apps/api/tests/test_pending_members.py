# Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 3): admin "Onay
# Bekleyenler" ekranının backend uçları — GET/approve/reject.
#
# Madde 2026-09-09 (devam 4): Zafer'in kararıyla bu ekran SADECE antrenör
# başvuruları için — sporcu (18+ dahil) artık onay beklemiyor.
from sqlalchemy import select
from chess_api.models import User, UserRole


async def _admin_token(client, db, email="admin@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Admin",
    })
    body = r.json()
    user = await db.get(User, body["user_id"])
    user.role = UserRole.admin
    await db.commit()
    return body["access_token"]


def _pending_teacher_payload(**overrides):
    base = {
        "first_name": "Zeynep", "last_name": "Kara",
        "phone": "5551234567", "email": "pendogretmen@test.com",
        "province": "Bilecik", "lichess_username": "zeynepchess",
        "username": "pendogretmen", "password": "guvenli1234",
        "kvkk_consent": True,
    }
    base.update(overrides)
    return base


async def test_pending_members_requires_admin(client):
    r = await client.post("/auth/teacher/register", json=_pending_teacher_payload())
    tok = r.json()["access_token"]
    r2 = await client.get("/admin/pending-members", headers={"Authorization": f"Bearer {tok}"})
    # 403: onay bekleyen hesabın kendi token'ı zaten hiçbir korumalı uca giremez.
    assert r2.status_code == 403


async def test_pending_members_lists_pending_teacher(client, db):
    await client.post("/auth/teacher/register", json=_pending_teacher_payload())
    atok = await _admin_token(client, db)
    r = await client.get("/admin/pending-members", headers={"Authorization": f"Bearer {atok}"})
    assert r.status_code == 200
    rows = r.json()
    row = next(x for x in rows if x["email"] == "pendogretmen@test.com")
    assert row["name"] == "Zeynep Kara"
    assert row["username"] == "pendogretmen"
    assert row["province"] == "Bilecik"
    assert row["phone"] == "5551234567"
    assert row["lichess_username"] == "zeynepchess"


async def test_pending_members_excludes_approved(client, db):
    await client.post("/auth/teacher/register", json=_pending_teacher_payload(
        email="onayli@test.com", username="onayli",
    ))
    user = (await db.execute(select(User).where(User.email == "onayli@test.com"))).scalar_one()
    user.approval_status = "approved"
    await db.commit()

    atok = await _admin_token(client, db)
    r2 = await client.get("/admin/pending-members", headers={"Authorization": f"Bearer {atok}"})
    emails = [row["email"] for row in r2.json()]
    assert "onayli@test.com" not in emails


async def test_pending_members_excludes_athletes(client, db):
    """Madde (devam 4): sporcu kaydı ARTIK 'pending' olmuyor — listede hiç görünmez."""
    await client.post("/auth/member/signup", json={
        "first_name": "Ali", "last_name": "Yılmaz",
        "phone": "5551112233", "email": "sporcu@test.com",
        "province": "Bilecik", "username": "sporcutest",
        "password": "guvenli1234", "birth_date": "2000-01-01",
        "mother_name": "Ayşe Yılmaz", "mother_phone": "5551112244", "mother_email": "ayse@test.com",
        "kvkk_consent": True,
    })
    atok = await _admin_token(client, db)
    r = await client.get("/admin/pending-members", headers={"Authorization": f"Bearer {atok}"})
    emails = [row["email"] for row in r.json()]
    assert "sporcu@test.com" not in emails


async def test_approve_pending_teacher_allows_login_by_email_and_username(client, db):
    await client.post("/auth/teacher/register", json=_pending_teacher_payload(
        email="onaylanacak2@test.com", username="onaylanacak2",
    ))
    atok = await _admin_token(client, db)
    user = (await db.execute(select(User).where(User.email == "onaylanacak2@test.com"))).scalar_one()

    r = await client.post(f"/admin/pending-members/{user.id}/approve", headers={"Authorization": f"Bearer {atok}"})
    assert r.status_code == 200

    login_r = await client.post("/auth/login", json={"email": "onaylanacak2@test.com", "password": "guvenli1234"})
    assert login_r.status_code == 200

    login_r2 = await client.post("/auth/login", json={"email": "onaylanacak2", "password": "guvenli1234"})
    assert login_r2.status_code == 200


async def test_reject_pending_teacher_blocks_login(client, db):
    await client.post("/auth/teacher/register", json=_pending_teacher_payload(
        email="reddedilecek@test.com", username="reddedilecek",
    ))
    atok = await _admin_token(client, db)
    user = (await db.execute(select(User).where(User.email == "reddedilecek@test.com"))).scalar_one()

    r = await client.post(f"/admin/pending-members/{user.id}/reject", headers={"Authorization": f"Bearer {atok}"})
    assert r.status_code == 200

    login_r = await client.post("/auth/login", json={"email": "reddedilecek@test.com", "password": "guvenli1234"})
    assert login_r.status_code == 403
    assert login_r.json()["detail"] == "Hesabınız reddedildi"


async def test_pending_members_requires_admin_not_teacher(client, db):
    tok = await _admin_token(client, db, email="justteacher@t.com")
    user = (await db.execute(select(User).where(User.email == "justteacher@t.com"))).scalar_one()
    user.role = UserRole.teacher  # admin DEĞİL, sıradan antrenör
    await db.commit()

    r = await client.get("/admin/pending-members", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
