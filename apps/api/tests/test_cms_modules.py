import pytest
from sqlalchemy import select
from chess_api.models.module import Module, Lesson


async def _teacher_token(client, email="cmm@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_create_module(client, db):
    tok = await _teacher_token(client)
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Yeni Duzey", "description": "aciklama", "icon": "star"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Yeni Duzey"
    assert body["order_index"] >= 1


@pytest.mark.asyncio
async def test_update_module(client, db):
    tok = await _teacher_token(client, email="cmm2@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Eski", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    r2 = await client.patch(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"},
                            json={"name": "Guncel"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Guncel"


@pytest.mark.asyncio
async def test_reorder_modules_no_unique_clash(client, db):
    """modules.order_index UNIQUE — sıralama iki aşamalı olmalı, çakışmamalı."""
    tok = await _teacher_token(client, email="cmm3@t.com")
    ids = []
    for n in ["A", "B", "C"]:
        r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                              json={"name": n, "description": "d", "icon": "pawn"})
        ids.append(r.json()["id"])
    reversed_ids = list(reversed(ids))
    r = await client.post("/admin/modules/reorder", headers={"Authorization": f"Bearer {tok}"},
                          json={"ordered_ids": reversed_ids})
    assert r.status_code == 200
    rows = (await db.execute(
        select(Module).where(Module.id.in_(ids)).order_by(Module.order_index)
    )).scalars().all()
    assert [m.id for m in rows] == reversed_ids


@pytest.mark.asyncio
async def test_delete_module_blocked_when_has_lessons(client, db):
    tok = await _teacher_token(client, email="cmm4@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Dolu", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    db.add(Lesson(module_id=mid, order_index=1, title="Ders", estimated_minutes=10))
    await db.commit()
    r2 = await client.delete(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_delete_empty_module_ok(client, db):
    tok = await _teacher_token(client, email="cmm5@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Bos", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    r2 = await client.delete(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert (await db.get(Module, mid)) is None


@pytest.mark.asyncio
async def test_module_endpoints_require_teacher(client, db):
    r = await client.post("/auth/parent/signup", json={
        "email": "cmp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.post("/admin/modules", headers={"Authorization": f"Bearer {ptok}"},
                           json={"name": "X", "description": "d", "icon": "pawn"})
    assert r2.status_code == 403
