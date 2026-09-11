# Madde 2026-09-11 (Görsel Turu Aşama F): antrenöre oyun profili — antrenör
# jetonu child_profile_id taşır, sporcu uçları antrenörde de çalışır.
import pytest
from sqlalchemy import select, func
from chess_api.models import User, UserRole, ChildProfile
from chess_api.services.jwt import decode_token


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.asyncio
async def test_teacher_signup_oyun_profili_acar_ve_jeton_tasir(client, db):
    r = await client.post("/auth/teacher/signup", json={
        "email": "pp1@t.com", "password": "guvenli12345", "name": "Zafer Hoca",
    })
    assert r.status_code == 201
    payload = decode_token(r.json()["access_token"])
    assert payload["role"] == "teacher"
    assert payload.get("child_profile_id")

    profile = await db.get(ChildProfile, payload["child_profile_id"])
    assert profile is not None
    assert profile.parent_user_id == r.json()["user_id"]
    assert profile.display_name == "Zafer Hoca"


@pytest.mark.asyncio
async def test_teacher_register_v2_oyun_profili_acar(client, db):
    r = await client.post("/auth/teacher/register", json={
        "first_name": "Ayşe", "last_name": "Hoca", "email": "pp2@t.com", "username": "aysehoca",
        "password": "guvenli12345", "phone": "05551112233", "province": "Bilecik",
        "lichess_username": "aysehoca", "kvkk_consent": True,
    })
    assert r.status_code == 201, r.text
    payload = decode_token(r.json()["access_token"])
    profile = await db.get(ChildProfile, payload["child_profile_id"])
    assert profile is not None
    assert profile.province == "Bilecik"
    assert profile.athlete_phone == "05551112233"
    assert profile.lichess_username == "aysehoca"


@pytest.mark.asyncio
async def test_antrenor_girisi_profil_yoksa_acar_varsa_tekrar_acmaz(client, db):
    # Eski antrenör: profili YOK (migration öncesi durum simülasyonu).
    from chess_api.services.password import hash_password
    u = User(email="pp3@t.com", password_hash=hash_password("guvenli12345"),
             role=UserRole.teacher, name="Eski Hoca", approval_status="approved")
    db.add(u); await db.commit()

    r1 = await client.post("/auth/login", json={"email": "pp3@t.com", "password": "guvenli12345"})
    assert r1.status_code == 200
    pid1 = decode_token(r1.json()["access_token"])["child_profile_id"]
    r2 = await client.post("/auth/login", json={"email": "pp3@t.com", "password": "guvenli12345"})
    pid2 = decode_token(r2.json()["access_token"])["child_profile_id"]
    assert pid1 == pid2
    n = (await db.execute(
        select(func.count(ChildProfile.id)).where(ChildProfile.parent_user_id == u.id)
    )).scalar_one()
    assert n == 1


@pytest.mark.asyncio
async def test_antrenor_jetonu_sporcu_ucunda_calisir(client, db):
    r = await client.post("/auth/teacher/signup", json={
        "email": "pp4@t.com", "password": "guvenli12345", "name": "Hoca",
    })
    tok = r.json()["access_token"]
    # Sporcu ucu (get_current_child) — eskiden 401 "Child token required" dönerdi.
    n = await client.get("/notifications", headers=auth(tok))
    assert n.status_code == 200
    assert n.json() == {"unread_count": 0, "items": []}
    # Antrenör ucu (get_current_user, role=teacher) AYNI jetonla çalışmaya devam eder.
    c = await client.get("/teacher/classes", headers=auth(tok))
    assert c.status_code == 200


@pytest.mark.asyncio
async def test_veli_jetonu_degismedi(client, db):
    r = await client.post("/auth/parent/signup", json={
        "email": "pp5@t.com", "password": "guvenli12345", "name": "Veli",
    })
    payload = decode_token(r.json()["access_token"])
    assert payload["role"] == "parent"
    assert "child_profile_id" not in payload
    # Veliye oyun profili AÇILMAZ.
    n = (await db.execute(
        select(func.count(ChildProfile.id)).where(ChildProfile.parent_user_id == r.json()["user_id"])
    )).scalar_one()
    assert n == 0
