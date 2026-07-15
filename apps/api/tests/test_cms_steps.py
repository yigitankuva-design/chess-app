import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType


async def _teacher_token(client, email="cst@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _lesson(db, order=1, name="M"):
    m = Module(order_index=order, name=name, description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders", estimated_minutes=10, published=False)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    return m, les


@pytest.mark.asyncio
async def test_add_explanation_step(client, db):
    m, les = await _lesson(db, order=20)
    tok = await _teacher_token(client)
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation",
                                "content_json": {"title": "Tahta", "body": "64 kare vardir."}})
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "explanation"
    assert body["content_json"]["title"] == "Tahta"
    assert body["order_index"] == 1


@pytest.mark.asyncio
async def test_add_quiz_step_matches_player_shape(client, db):
    """Oynatıcı {questions:[{prompt, options, correct_index}]} bekliyor — birebir olmalı."""
    m, les = await _lesson(db, order=21)
    tok = await _teacher_token(client, email="cst2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "Kac kare?", "options": ["32", "64"], "correct_index": 1},
                          ]}})
    assert r.status_code == 201
    q = r.json()["content_json"]["questions"][0]
    assert q["prompt"] == "Kac kare?"
    assert q["options"] == ["32", "64"]
    assert q["correct_index"] == 1


@pytest.mark.asyncio
async def test_quiz_validation_rejects_bad_correct_index(client, db):
    m, les = await _lesson(db, order=22)
    tok = await _teacher_token(client, email="cst3@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "S", "options": ["a", "b"], "correct_index": 5},
                          ]}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_quiz_validation_rejects_empty_questions(client, db):
    m, les = await _lesson(db, order=23)
    tok = await _teacher_token(client, email="cst4@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": []}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_invalid_step_type_rejected(client, db):
    m, les = await _lesson(db, order=24)
    tok = await _teacher_token(client, email="cst5@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "sarki_soyle", "content_json": {}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_list_steps(client, db):
    m, les = await _lesson(db, order=25)
    tok = await _teacher_token(client, email="cst6@t.com")
    await client.post(f"/admin/lessons/{les.id}/steps",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"type": "explanation", "content_json": {"title": "A", "body": "b"}})
    r = await client.get(f"/admin/lessons/{les.id}/steps",
                         headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["content_json"]["title"] == "A"


@pytest.mark.asyncio
async def test_step_endpoints_require_teacher(client, db):
    m, les = await _lesson(db, order=26)
    r = await client.post("/auth/parent/signup", json={
        "email": "csp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.get(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {ptok}"})
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_update_step_content(client, db):
    m, les = await _lesson(db, order=30)
    tok = await _teacher_token(client, email="csu1@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "Eski", "body": "b"}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"content_json": {"title": "Yeni", "body": "guncel"}})
    assert r2.status_code == 200
    assert r2.json()["content_json"]["title"] == "Yeni"


@pytest.mark.asyncio
async def test_update_step_validates_content(client, db):
    m, les = await _lesson(db, order=31)
    tok = await _teacher_token(client, email="csu2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "S", "options": ["a", "b"], "correct_index": 0}]}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"content_json": {"questions": [
                                {"prompt": "S", "options": ["a", "b"], "correct_index": 9}]}})
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_move_step_to_another_lesson(client, db):
    m1, les1 = await _lesson(db, order=32, name="M32")
    m2, les2 = await _lesson(db, order=33, name="M33")
    tok = await _teacher_token(client, email="csu3@t.com")
    r = await client.post(f"/admin/lessons/{les1.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"lesson_id": les2.id})
    assert r2.status_code == 200
    assert r2.json()["lesson_id"] == les2.id


@pytest.mark.asyncio
async def test_reorder_steps(client, db):
    m, les = await _lesson(db, order=34)
    tok = await _teacher_token(client, email="csu4@t.com")
    ids = []
    for t in ["A", "B", "C"]:
        r = await client.post(f"/admin/lessons/{les.id}/steps",
                              headers={"Authorization": f"Bearer {tok}"},
                              json={"type": "explanation", "content_json": {"title": t, "body": "b"}})
        ids.append(r.json()["id"])
    rev = list(reversed(ids))
    r = await client.post(f"/admin/lessons/{les.id}/steps/reorder",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"ordered_ids": rev})
    assert r.status_code == 200
    rows = (await db.execute(
        select(LessonStep).where(LessonStep.lesson_id == les.id).order_by(LessonStep.order_index)
    )).scalars().all()
    assert [s.id for s in rows] == rev


@pytest.mark.asyncio
async def test_delete_step_removes_its_results_but_keeps_lesson_progress(client, db):
    """Adım silinince o adımın deneme kayıtları gider; ders tamamlama ilerlemesi KALIR."""
    from chess_api.models import ChildProfile, ChildLessonProgress
    from chess_api.models.progress import LessonStatus, ChildLessonStepResult

    m, les = await _lesson(db, order=35)
    tok = await _teacher_token(client, email="csu5@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    sid = r.json()["id"]

    await client.post("/auth/parent/signup", json={
        "email": "csp2@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu",
    })
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=les.id, status=LessonStatus.completed))
    db.add(ChildLessonStepResult(child_id=child.id, lesson_step_id=sid, time_seconds=5))
    await db.commit()

    r2 = await client.delete(f"/admin/steps/{sid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert r2.json()["results_deleted"] == 1
    assert (await db.get(LessonStep, sid)) is None
    cnt = (await db.execute(
        select(func.count(ChildLessonStepResult.id)).where(ChildLessonStepResult.lesson_step_id == sid)
    )).scalar_one()
    assert cnt == 0
    prog = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == les.id)
    )).scalar_one()
    assert prog == 1
