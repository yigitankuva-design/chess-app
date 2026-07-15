import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType


async def _teacher_token(client, email="cmst@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _module(db, order=1, name="Temel"):
    m = Module(order_index=order, name=name, description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@pytest.mark.asyncio
async def test_child_endpoint_hides_draft_lessons(client, db):
    m = await _module(db)
    pub = Lesson(module_id=m.id, order_index=1, title="Yayinda", estimated_minutes=10, published=True)
    draft = Lesson(module_id=m.id, order_index=2, title="Taslak", estimated_minutes=10, published=False)
    db.add_all([pub, draft])
    await db.commit()

    r = await client.get(f"/modules/{m.id}/lessons")
    assert r.status_code == 200
    titles = [x["title"] for x in r.json()]
    assert "Yayinda" in titles
    assert "Taslak" not in titles


@pytest.mark.asyncio
async def test_existing_lessons_default_published(db):
    """server_default='true' → published verilmeden eklenen ders yayında olmalı."""
    m = await _module(db, order=2, name="Orta")
    les = Lesson(module_id=m.id, order_index=1, title="Varsayilan", estimated_minutes=10)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    assert les.published is True


@pytest.mark.asyncio
async def test_create_lesson_starts_as_draft(client, db):
    m = await _module(db, order=10, name="M10")
    tok = await _teacher_token(client, email="cl1@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Yeni Ders", "estimated_minutes": 12})
    assert r.status_code == 201
    body = r.json()
    assert body["published"] is False
    assert body["title"] == "Yeni Ders"


@pytest.mark.asyncio
async def test_publish_and_unpublish_lesson(client, db):
    m = await _module(db, order=11, name="M11")
    tok = await _teacher_token(client, email="cl2@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "D", "estimated_minutes": 10})
    lid = r.json()["id"]
    r2 = await client.post(f"/admin/lessons/{lid}/publish",
                           headers={"Authorization": f"Bearer {tok}"}, json={"published": True})
    assert r2.status_code == 200
    assert r2.json()["published"] is True
    r3 = await client.get(f"/modules/{m.id}/lessons")
    assert any(x["id"] == lid for x in r3.json())
    await client.post(f"/admin/lessons/{lid}/publish",
                      headers={"Authorization": f"Bearer {tok}"}, json={"published": False})
    r4 = await client.get(f"/modules/{m.id}/lessons")
    assert not any(x["id"] == lid for x in r4.json())


@pytest.mark.asyncio
async def test_move_lesson_to_another_module(client, db):
    m1 = await _module(db, order=12, name="M12")
    m2 = await _module(db, order=13, name="M13")
    tok = await _teacher_token(client, email="cl3@t.com")
    r = await client.post(f"/admin/modules/{m1.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Tasinacak", "estimated_minutes": 10})
    lid = r.json()["id"]
    r2 = await client.patch(f"/admin/lessons/{lid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"module_id": m2.id})
    assert r2.status_code == 200
    assert r2.json()["module_id"] == m2.id


@pytest.mark.asyncio
async def test_delete_lesson_blocked_when_progress_exists(client, db):
    from chess_api.models import ChildProfile, ChildLessonProgress
    from chess_api.models.progress import LessonStatus

    m = await _module(db, order=14, name="M14")
    tok = await _teacher_token(client, email="cl4@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Ilerlemeli", "estimated_minutes": 10})
    lid = r.json()["id"]
    await client.post("/auth/parent/signup", json={
        "email": "clp@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu",
    })
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=lid, status=LessonStatus.completed))
    await db.commit()

    r2 = await client.delete(f"/admin/lessons/{lid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 409
    assert (await db.get(Lesson, lid)) is not None


@pytest.mark.asyncio
async def test_delete_lesson_without_progress_ok(client, db):
    m = await _module(db, order=15, name="M15")
    tok = await _teacher_token(client, email="cl5@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Bos Ders", "estimated_minutes": 10})
    lid = r.json()["id"]
    db.add(LessonStep(lesson_id=lid, order_index=1, type=LessonStepType.explanation,
                      content_json={"title": "t", "body": "b"}))
    await db.commit()
    r2 = await client.delete(f"/admin/lessons/{lid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert (await db.get(Lesson, lid)) is None
    cnt = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lid)
    )).scalar_one()
    assert cnt == 0


@pytest.mark.asyncio
async def test_admin_lessons_list_shows_drafts(client, db):
    m = await _module(db, order=16, name="M16")
    tok = await _teacher_token(client, email="cl6@t.com")
    await client.post(f"/admin/modules/{m.id}/lessons",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"title": "Taslak Ders", "estimated_minutes": 10})
    r = await client.get(f"/admin/modules/{m.id}/lessons",
                         headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert any(x["title"] == "Taslak Ders" for x in r.json())
