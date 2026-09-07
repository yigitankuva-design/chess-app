"""GRUP D (madde 2026-09-07): "Ödev Gönder" → Alt Konu (lesson_step) bazlı
ödev ataması + sporcunun bunu görebildiği /assignments/my-active-step-ids."""
import pytest
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


async def _make_step(db) -> int:
    m = Module(order_index=1, name="M", description="d", icon="x")
    db.add(m)
    await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Ders")
    db.add(les)
    await db.flush()
    step = LessonStep(
        lesson_id=les.id, order_index=1,
        type=LessonStepType.explanation, content_json={"title": "Alt konu"},
    )
    db.add(step)
    await db.commit()
    return step.id


async def _teacher_signup(client, email="teacher_assign_step@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "teacherpass123", "name": "Antrenör",
    })
    return r.json()["access_token"]


async def _parent_signup(client, email="parent_assign_step@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "parentpass123", "name": "Veli",
    })
    return r.json()["access_token"]


async def _create_child(client, parent_token, name="Sporcu"):
    r = await client.post(
        "/children", headers={"Authorization": f"Bearer {parent_token}"},
        json={"display_name": name, "age": 9, "pin": "1234"},
    )
    return r.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_teacher_assigns_lesson_step_to_class(client, db):
    """Antrenör bir Alt Konu'yu (lesson_step) hedefleyerek sınıfa ödev
    verebilir — sınıftaki sporcu bunu my-active-step-ids'de görür."""
    step_id = await _make_step(db)
    teacher_token = await _teacher_signup(client)
    parent_token = await _parent_signup(client)
    child_id = await _create_child(client, parent_token)

    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf Ödev"})
    class_id = r.json()["id"]
    join_code = r.json()["join_code"]
    await client.post(
        f"/parent/children/{child_id}/join-class",
        headers=auth(parent_token), params={"join_code": join_code},
    )

    r = await client.post(
        f"/teacher/classes/{class_id}/assignments", headers=auth(teacher_token),
        json={"title": "Merkez Kavramı Ödevi", "target_lesson_step_id": step_id},
    )
    assert r.status_code == 201, r.text

    # Sporcu PIN ile girip kendi aktif Alt Konu ödevlerini görür.
    await client.post("/auth/device/register", headers=auth(parent_token),
                      json={"device_fingerprint": "devassign", "name": "T"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "devassign",
    })
    child_token = r.json()["access_token"]
    r = await client.get("/assignments/my-active-step-ids", headers=auth(child_token))
    assert r.status_code == 200
    assert r.json()["step_ids"] == [step_id]


@pytest.mark.asyncio
async def test_teacher_assigns_lesson_step_to_individual_student(client, db):
    step_id = await _make_step(db)
    teacher_token = await _teacher_signup(client, "teacher_indiv_step@t.com")
    parent_token = await _parent_signup(client, "parent_indiv_step@t.com")
    child_id = await _create_child(client, parent_token, "Bireysel Sporcu")

    r = await client.post(
        f"/teacher/students/{child_id}/assignments", headers=auth(teacher_token),
        json={"title": "Bireysel Alt Konu Ödevi", "target_lesson_step_id": step_id},
    )
    assert r.status_code == 201, r.text

    await client.post("/auth/device/register", headers=auth(parent_token),
                      json={"device_fingerprint": "devindiv", "name": "T"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "devindiv",
    })
    child_token = r.json()["access_token"]
    r = await client.get("/assignments/my-active-step-ids", headers=auth(child_token))
    assert r.json()["step_ids"] == [step_id]


@pytest.mark.asyncio
async def test_student_not_assigned_sees_empty_list(client, child_auth):
    token, _ = child_auth
    r = await client.get("/assignments/my-active-step-ids", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["step_ids"] == []


@pytest.mark.asyncio
async def test_assignment_still_requires_a_target(client):
    """Madde 2026-09-05/07: hiçbir hedef (modül/ders/Alt Konu) verilmezse 422."""
    teacher_token = await _teacher_signup(client, "teacher_no_target_step@t.com")
    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf X"})
    class_id = r.json()["id"]
    r = await client.post(
        f"/teacher/classes/{class_id}/assignments", headers=auth(teacher_token),
        json={"title": "Hedefsiz"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_students_in_other_class_dont_see_assignment(client, db):
    """Bir sınıfa verilen Alt Konu ödevi, O SINIFTA OLMAYAN bir sporcunun
    listesinde görünmez."""
    step_id = await _make_step(db)
    teacher_token = await _teacher_signup(client, "teacher_other_class@t.com")
    parent_a = await _parent_signup(client, "parent_other_class_a@t.com")
    parent_b = await _parent_signup(client, "parent_other_class_b@t.com")
    child_a = await _create_child(client, parent_a, "A")
    child_b = await _create_child(client, parent_b, "B")

    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf Only A"})
    class_id = r.json()["id"]
    join_code = r.json()["join_code"]
    await client.post(f"/parent/children/{child_a}/join-class", headers=auth(parent_a),
                      params={"join_code": join_code})

    await client.post(
        f"/teacher/classes/{class_id}/assignments", headers=auth(teacher_token),
        json={"title": "Sadece A Sınıfı", "target_lesson_step_id": step_id},
    )

    await client.post("/auth/device/register", headers=auth(parent_b),
                      json={"device_fingerprint": "devb", "name": "T"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_b, "pin": "1234", "device_fingerprint": "devb",
    })
    token_b = r.json()["access_token"]
    r = await client.get("/assignments/my-active-step-ids", headers=auth(token_b))
    assert r.json()["step_ids"] == []
