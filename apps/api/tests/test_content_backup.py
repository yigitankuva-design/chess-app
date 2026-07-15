import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType
from chess_api.models import ChildProfile, ChildLessonProgress
from chess_api.models.progress import LessonStatus


async def _teacher_token(client, email="ct@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _seed(db):
    m = Module(order_index=1, name="Temel", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders 1", estimated_minutes=15)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    st = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation,
                    content_json={"text": "merhaba"}, correct_answer_json=None)
    db.add(st)
    await db.commit()
    await db.refresh(st)
    return m, les, st


@pytest.mark.asyncio
async def test_export_returns_tree_with_ids(client, db):
    m, les, st = await _seed(db)
    tok = await _teacher_token(client)
    r = await client.get("/admin/content/export", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    mod = next(x for x in body["modules"] if x["id"] == m.id)
    assert mod["name"] == "Temel"
    lesson = mod["lessons"][0]
    assert lesson["id"] == les.id
    assert lesson["title"] == "Ders 1"
    step = lesson["steps"][0]
    assert step["id"] == st.id
    assert step["content_json"] == {"text": "merhaba"}


@pytest.mark.asyncio
async def test_export_requires_teacher(client, db):
    await _seed(db)
    r = await client.post("/auth/parent/signup", json={
        "email": "cp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.get("/admin/content/export", headers={"Authorization": f"Bearer {ptok}"})
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_import_updates_existing_and_creates_new(client, db):
    m, les, st = await _seed(db)
    tok = await _teacher_token(client, email="ci1@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel GÜNCEL",
            "description": "yeni", "icon": "pawn",
            "lessons": [{
                "id": les.id, "order_index": 1, "title": "Ders 1 GÜNCEL",
                "estimated_minutes": 25,
                "steps": [
                    {"id": st.id, "order_index": 1, "type": "explanation",
                     "content_json": {"text": "guncel"}, "correct_answer_json": None},
                    {"id": None, "order_index": 2, "type": "quiz",
                     "content_json": {"q": "yeni soru"}, "correct_answer_json": {"a": 1}},
                ],
            }],
        }],
    }
    r = await client.post("/admin/content/import",
                          headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 200
    res = r.json()
    assert res["modules_updated"] == 1
    assert res["lessons_updated"] == 1
    assert res["steps_updated"] == 1
    assert res["steps_created"] == 1

    await db.refresh(m)
    await db.refresh(les)
    assert m.name == "Temel GÜNCEL"
    assert les.title == "Ders 1 GÜNCEL"
    assert les.estimated_minutes == 25


@pytest.mark.asyncio
async def test_import_preserves_child_progress(client, db):
    """En kritik test: import sonrası ders ID'si değişmemeli, çocuk ilerlemesi durmalı."""
    m, les, st = await _seed(db)
    r = await client.post("/auth/parent/signup", json={
        "email": "cprog@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu Bir",
    })
    assert r.status_code == 201
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=les.id, status=LessonStatus.completed))
    await db.commit()

    tok = await _teacher_token(client, email="ci2@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel", "description": "d", "icon": "pawn",
            "lessons": [{
                "id": les.id, "order_index": 1, "title": "Ders 1 v2", "estimated_minutes": 20,
                "steps": [],
            }],
        }],
    }
    r2 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r2.status_code == 200
    cnt = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == les.id)
    )).scalar_one()
    assert cnt == 1


@pytest.mark.asyncio
async def test_import_does_not_delete_missing(client, db):
    """JSON'da olmayan mevcut ders silinmemeli."""
    m, les, st = await _seed(db)
    tok = await _teacher_token(client, email="ci3@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel", "description": "d", "icon": "pawn",
            "lessons": [],
        }],
    }
    r = await client.post("/admin/content/import",
                          headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 200
    cnt = (await db.execute(select(func.count(Lesson.id)).where(Lesson.id == les.id))).scalar_one()
    assert cnt == 1


@pytest.mark.asyncio
async def test_import_requires_teacher_and_valid_version(client, db):
    await _seed(db)
    r = await client.post("/auth/parent/signup", json={
        "email": "cip@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {ptok}"},
                           json={"version": 1, "modules": []})
    assert r2.status_code == 403

    tok = await _teacher_token(client, email="ci4@t.com")
    r3 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {tok}"},
                           json={"version": 99, "modules": []})
    assert r3.status_code == 400
