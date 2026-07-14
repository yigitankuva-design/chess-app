import pytest
from sqlalchemy import select, func
from chess_api.models import ChildProfile, ChildLessonProgress, Device
from chess_api.models.progress import LessonStatus


async def _teacher_token(client, email="teach@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _parent_with_child(client, email="par@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli Bir",
    })
    ptok = r.json()["access_token"]
    pid = r.json()["user_id"]
    await client.post("/children", headers={"Authorization": f"Bearer {ptok}"},
                      json={"display_name": "Ali", "age": 10, "pin": "1234"})
    return ptok, pid


@pytest.mark.asyncio
async def test_admin_parents_requires_teacher(client):
    ptok, _ = await _parent_with_child(client)
    r = await client.get("/admin/parents", headers={"Authorization": f"Bearer {ptok}"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_lists_parents_with_child_count(client):
    await _parent_with_child(client, email="p1@t.com")
    ttok = await _teacher_token(client)
    r = await client.get("/admin/parents", headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    rows = r.json()
    row = next(x for x in rows if x["email"] == "p1@t.com")
    assert row["child_count"] == 1
    assert row["name"] == "Veli Bir"


@pytest.mark.asyncio
async def test_admin_overview_counts(client):
    await _parent_with_child(client, email="p2@t.com")
    ttok = await _teacher_token(client, email="t2@t.com")
    r = await client.get("/admin/overview", headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_parents"] >= 1
    assert body["total_children"] >= 1
    assert body["total_teachers"] >= 1


@pytest.mark.asyncio
async def test_admin_reset_password_then_login(client):
    _, pid = await _parent_with_child(client, email="reset@t.com")
    ttok = await _teacher_token(client, email="t3@t.com")
    r = await client.post(f"/admin/parents/{pid}/reset-password",
                          headers={"Authorization": f"Bearer {ttok}"},
                          json={"new_password": "yeniSifre123"})
    assert r.status_code == 200
    # Eski şifre artık geçmez
    r = await client.post("/auth/login", json={"email": "reset@t.com", "password": "guvenli12345"})
    assert r.status_code == 401
    # Yeni şifre geçer
    r = await client.post("/auth/login", json={"email": "reset@t.com", "password": "yeniSifre123"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_delete_parent(client):
    _, pid = await _parent_with_child(client, email="del@t.com")
    ttok = await _teacher_token(client, email="t4@t.com")
    r = await client.delete(f"/admin/parents/{pid}",
                            headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    # Silinen veli login olamaz
    r = await client.post("/auth/login", json={"email": "del@t.com", "password": "guvenli12345"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_delete_parent_with_dependent_records(client, db):
    """Gerçek veri senaryosu: çocuğun ilerleme kaydı + veli cihazı varken silme
    FK-güvenli olmalı ve bağımlı satırlar da silinmeli."""
    _, pid = await _parent_with_child(client, email="deps@t.com")
    # Çocuğu bul, ilerleme + cihaz ekle
    child = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == pid)
    )).scalar_one()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=1, status=LessonStatus.completed))
    db.add(Device(parent_user_id=pid, device_fingerprint="dep-dev", name="D"))
    await db.commit()

    ttok = await _teacher_token(client, email="tdeps@t.com")
    r = await client.delete(f"/admin/parents/{pid}",
                            headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    # Bağımlı kayıtlar da gitmiş olmalı
    prog = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.child_id == child.id)
    )).scalar_one()
    devs = (await db.execute(
        select(func.count(Device.id)).where(Device.parent_user_id == pid)
    )).scalar_one()
    kids = (await db.execute(
        select(func.count(ChildProfile.id)).where(ChildProfile.parent_user_id == pid)
    )).scalar_one()
    assert prog == 0
    assert devs == 0
    assert kids == 0


@pytest.mark.asyncio
async def test_admin_module_lessons(client):
    ttok = await _teacher_token(client, email="tlessons@t.com")
    # Bilinmeyen modül 404
    r = await client.get("/admin/modules/999999/lessons",
                         headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 404

    # Yetki: parent erişemez
    r2 = await client.post("/auth/parent/signup", json={
        "email": "ml_parent@t.com", "password": "guvenli12345", "name": "Pp",
    })
    pt = r2.json()["access_token"]
    r3 = await client.get("/admin/modules/999999/lessons",
                          headers={"Authorization": f"Bearer {pt}"})
    assert r3.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_delete_teacher(client):
    ttok = await _teacher_token(client, email="t5@t.com")
    # Başka bir teacher hedefle
    r = await client.post("/auth/teacher/signup", json={
        "email": "victim@t.com", "password": "guvenli12345", "name": "Vv",
    })
    victim_id = r.json()["user_id"]
    r = await client.delete(f"/admin/parents/{victim_id}",
                            headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 404
