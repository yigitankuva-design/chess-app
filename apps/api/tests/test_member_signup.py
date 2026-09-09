# Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 2): yeni "Kayıt Ol"
# formunun backend uçları — /auth/member/signup (Üye/Sporcu, yaşa göre
# dallanan) ve /auth/teacher/register (Antrenör).
#
# Madde 2026-09-09 (devam 4): Zafer'in kararıyla Tier A onay gereksinimi
# (admin onaylayana kadar giriş yapılamaz) SPORCUDAN antrenöre taşındı —
# çocuklarla doğrudan çalışacak rol antrenör olduğu için. Sporcu (18+ de
# olsa) artık HEMEN aktif; antrenör admin onayı bekler.
from datetime import date
from sqlalchemy import select
from chess_api.models import User, ChildProfile


def _adult_birth_date() -> str:
    d = date.today()
    return date(d.year - 20, d.month, min(d.day, 28)).isoformat()


def _minor_birth_date() -> str:
    d = date.today()
    return date(d.year - 12, d.month, min(d.day, 28)).isoformat()


def _member_payload(**overrides):
    base = {
        "first_name": "Ali", "last_name": "Yılmaz",
        "phone": "5551112233", "email": "ali@test.com",
        "province": "Bilecik", "username": "aliyilmaz",
        "password": "guvenli1234",
        "birth_date": _adult_birth_date(),
        "mother_name": "Ayşe Yılmaz", "mother_phone": "5551112244", "mother_email": "ayse@test.com",
        "kvkk_consent": True,
    }
    base.update(overrides)
    return base


def _teacher_payload(**overrides):
    base = {
        "first_name": "Zeynep", "last_name": "Kara",
        "phone": "5551234567", "email": "zeynep@test.com",
        "province": "Bilecik", "username": "zeynepkara",
        "password": "guvenli1234", "kvkk_consent": True,
    }
    base.update(overrides)
    return base


# ── /auth/member/signup — 18 yaş üstü: sporcu KENDİ hesabını açar, ONAY BEKLEMEZ ──

async def test_member_signup_18_plus_creates_approved_athlete(client, db):
    r = await client.post("/auth/member/signup", json=_member_payload())
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "athlete"
    assert data["approval_status"] == "approved"

    user = (await db.execute(select(User).where(User.email == "ali@test.com"))).scalar_one()
    assert user.name == "Ali Yılmaz"
    assert user.username == "aliyilmaz"
    assert user.phone == "5551112233"
    assert user.province == "Bilecik"
    assert user.mother_name == "Ayşe Yılmaz"
    assert user.approval_status == "approved"
    assert user.kvkk_consent_at is not None

    children = (await db.execute(select(ChildProfile))).scalars().all()
    assert children == []


async def test_member_signup_18_plus_can_login_immediately(client):
    await client.post("/auth/member/signup", json=_member_payload(email="hemenaktif@test.com", username="hemenaktif"))
    r = await client.post("/auth/login", json={"email": "hemenaktif@test.com", "password": "guvenli1234"})
    assert r.status_code == 200


# ── /auth/member/signup — 18 yaş altı: veli hesabı açar, sporcu ChildProfile olur ──

async def test_member_signup_under_18_creates_parent_and_child(client, db):
    payload = _member_payload(email="veli1@test.com", username="veli1", birth_date=_minor_birth_date())
    r = await client.post("/auth/member/signup", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "parent"
    assert data["approval_status"] == "approved"

    user = (await db.execute(select(User).where(User.email == "veli1@test.com"))).scalar_one()
    assert user.role.value == "parent"

    child = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == user.id)
    )).scalar_one()
    assert child.display_name == "Ali Yılmaz"
    assert child.province == "Bilecik"
    assert child.athlete_phone == "5551112233"
    assert child.athlete_email == "veli1@test.com"
    assert child.mother_name == "Ayşe Yılmaz"


async def test_member_signup_under_18_can_login_immediately(client):
    payload = _member_payload(email="veli2@test.com", username="veli2", birth_date=_minor_birth_date())
    await client.post("/auth/member/signup", json=payload)
    r = await client.post("/auth/login", json={"email": "veli2@test.com", "password": "guvenli1234"})
    assert r.status_code == 200


# ── Ortak doğrulama kuralları ──

async def test_member_signup_requires_at_least_one_parent_block(client):
    payload = _member_payload(
        email="noveli@test.com", username="noveli",
        mother_name=None, mother_phone=None, mother_email=None,
    )
    r = await client.post("/auth/member/signup", json=payload)
    assert r.status_code == 422


async def test_member_signup_father_only_is_accepted(client):
    payload = _member_payload(
        email="babaonly@test.com", username="babaonly",
        mother_name=None, mother_phone=None, mother_email=None,
        father_name="Mehmet Yılmaz", father_phone="5559998877", father_email="mehmet@test.com",
    )
    r = await client.post("/auth/member/signup", json=payload)
    assert r.status_code == 201


async def test_member_signup_requires_kvkk_consent(client):
    payload = _member_payload(email="kvkkyok@test.com", username="kvkkyok", kvkk_consent=False)
    r = await client.post("/auth/member/signup", json=payload)
    assert r.status_code == 422


async def test_member_signup_duplicate_email_rejected(client):
    await client.post("/auth/member/signup", json=_member_payload(email="dup@test.com", username="dupuser1"))
    r = await client.post("/auth/member/signup", json=_member_payload(email="dup@test.com", username="dupuser2"))
    assert r.status_code == 409


async def test_member_signup_duplicate_username_rejected(client):
    await client.post("/auth/member/signup", json=_member_payload(email="dupuser1@test.com", username="ayniisim"))
    r = await client.post("/auth/member/signup", json=_member_payload(email="dupuser2@test.com", username="ayniisim"))
    assert r.status_code == 409


# ── /auth/teacher/register — Antrenör, ADMIN ONAYI BEKLER (madde: mevcut /auth/teacher/signup'a DOKUNULMADI) ──

async def test_teacher_register_creates_pending_teacher(client, db):
    r = await client.post("/auth/teacher/register", json=_teacher_payload())
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "teacher"
    assert data["approval_status"] == "pending"

    user = (await db.execute(select(User).where(User.email == "zeynep@test.com"))).scalar_one()
    assert user.name == "Zeynep Kara"
    assert user.province == "Bilecik"
    assert user.phone == "5551234567"
    assert user.approval_status == "pending"


async def test_teacher_register_cannot_login_until_approved(client):
    await client.post("/auth/teacher/register", json=_teacher_payload(email="ogretmen@test.com", username="ogretmen1"))
    r = await client.post("/auth/login", json={"email": "ogretmen@test.com", "password": "guvenli1234"})
    assert r.status_code == 403
    assert r.json()["detail"] == "Hesabınız onay bekliyor"


async def test_teacher_register_missing_kvkk_rejected(client):
    r = await client.post("/auth/teacher/register", json=_teacher_payload(
        email="kvkkyokogretmen@test.com", username="kvkkyokogretmen", kvkk_consent=False,
    ))
    assert r.status_code == 422
