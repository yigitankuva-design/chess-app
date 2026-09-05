"""Tests for teacher endpoints (Task 2: Teacher Routes)."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _teacher_signup(client: AsyncClient, email: str = "teacher@t.com") -> str:
    """Sign up a teacher and return access_token."""
    r = await client.post("/auth/teacher/signup", json={
        "email": email,
        "password": "teacherpass123",
        "name": "Teacher",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def _parent_signup(client: AsyncClient, email: str = "parent2@t.com") -> str:
    """Sign up a parent and return access_token."""
    r = await client.post("/auth/parent/signup", json={
        "email": email,
        "password": "parentpass123",
        "name": "Parent",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def _create_child(client: AsyncClient, parent_token: str, name: str = "Ali") -> int:
    r = await client.post(
        "/children",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"display_name": name, "age": 9, "pin": "1234"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_teacher_create_class(client):
    """Teacher can create a class and gets back id, name, join_code."""
    token = await _teacher_signup(client)
    r = await client.post("/teacher/classes", headers=auth(token), json={"name": "Satranç A"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Satranç A"
    assert "id" in data
    assert "join_code" in data
    assert len(data["join_code"]) == 8


@pytest.mark.asyncio
async def test_teacher_list_classes(client):
    """Teacher can list their classes."""
    token = await _teacher_signup(client, "teacher_list@t.com")
    await client.post("/teacher/classes", headers=auth(token), json={"name": "Sınıf 1"})
    await client.post("/teacher/classes", headers=auth(token), json={"name": "Sınıf 2"})

    r = await client.get("/teacher/classes", headers=auth(token))
    assert r.status_code == 200
    classes = r.json()
    assert len(classes) == 2
    names = {c["name"] for c in classes}
    assert names == {"Sınıf 1", "Sınıf 2"}


@pytest.mark.asyncio
async def test_teacher_create_assignment(client):
    """Teacher can create an assignment for their class."""
    token = await _teacher_signup(client, "teacher_assign@t.com")
    # Create class
    r = await client.post("/teacher/classes", headers=auth(token), json={"name": "Sınıf A"})
    class_id = r.json()["id"]

    # Create assignment — madde 2026-09-05: bir modül/ders hedeflemeli.
    r = await client.post(
        f"/teacher/classes/{class_id}/assignments",
        headers=auth(token),
        json={
            "title": "Hafta 1 Ödevi", "description": "Temel hareketler",
            "due_date": "2026-06-01", "target_module_id": 1,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert "id" in data


@pytest.mark.asyncio
async def test_teacher_create_assignment_requires_target(client):
    """Madde 2026-09-05: ödev bir modül veya ders hedeflemeli — ikisi de
    eksikse 422 döner."""
    token = await _teacher_signup(client, "teacher_notarget@t.com")
    r = await client.post("/teacher/classes", headers=auth(token), json={"name": "Sınıf T"})
    class_id = r.json()["id"]

    r = await client.post(
        f"/teacher/classes/{class_id}/assignments",
        headers=auth(token),
        json={"title": "Hedefsiz Ödev"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_teacher_create_individual_assignment(client, db):
    """Madde 2026-09-05: öğretmen sınıf yerine TEK bir sporcuya doğrudan
    ödev atayabilir."""
    from chess_api.models import Module, Lesson

    module = Module(order_index=1, name="M", description="d", icon="i")
    db.add(module); await db.flush()
    lesson = Lesson(module_id=module.id, order_index=1, title="L", estimated_minutes=8)
    db.add(lesson); await db.commit()

    teacher_token = await _teacher_signup(client, "teacher_indiv@t.com")
    parent_token = await _parent_signup(client, "parent_indiv@t.com")
    child_id = await _create_child(client, parent_token, "Elif")

    r = await client.post(
        f"/teacher/students/{child_id}/assignments",
        headers=auth(teacher_token),
        json={"title": "Bireysel Ödev", "target_lesson_id": lesson.id},
    )
    assert r.status_code == 201, r.text
    assert "id" in r.json()


@pytest.mark.asyncio
async def test_teacher_create_individual_assignment_unknown_child_404(client):
    token = await _teacher_signup(client, "teacher_indiv404@t.com")
    r = await client.post(
        "/teacher/students/999999/assignments",
        headers=auth(token),
        json={"title": "Ödev", "target_module_id": 1},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_teacher_list_assignments(client, db):
    """Madde 2026-09-05: öğretmen verdiği TÜM ödevleri (sınıf + bireysel)
    tek uçtan görebilir; sınıf/öğrenci adları çözülmüş gelir."""
    from chess_api.models import Module

    module = Module(order_index=1, name="M", description="d", icon="i")
    db.add(module); await db.commit()

    teacher_token = await _teacher_signup(client, "teacher_list_assign@t.com")
    parent_token = await _parent_signup(client, "parent_list_assign@t.com")
    child_id = await _create_child(client, parent_token, "Can")

    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf L"})
    class_id = r.json()["id"]
    await client.post(
        f"/teacher/classes/{class_id}/assignments", headers=auth(teacher_token),
        json={"title": "Sınıf Ödevi", "target_module_id": module.id},
    )
    await client.post(
        f"/teacher/students/{child_id}/assignments", headers=auth(teacher_token),
        json={"title": "Bireysel Ödev", "target_module_id": module.id},
    )

    r = await client.get("/teacher/assignments", headers=auth(teacher_token))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    by_title = {a["title"]: a for a in data}
    assert by_title["Sınıf Ödevi"]["class_name"] == "Sınıf L"
    assert by_title["Bireysel Ödev"]["target_child_name"] == "Can"


@pytest.mark.asyncio
async def test_teacher_view_students(client):
    """Teacher can see students enrolled in their class."""
    teacher_token = await _teacher_signup(client, "teacher_students@t.com")
    parent_token = await _parent_signup(client, "parent_students@t.com")

    # Teacher creates class
    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf S"})
    class_id = r.json()["id"]
    join_code = r.json()["join_code"]

    # Parent creates child and joins class
    child_id = await _create_child(client, parent_token, "Zeynep")
    r = await client.post(
        f"/parent/children/{child_id}/join-class",
        headers=auth(parent_token),
        params={"join_code": join_code},
    )
    assert r.status_code == 200

    # Teacher views students
    r = await client.get(f"/teacher/classes/{class_id}/students", headers=auth(teacher_token))
    assert r.status_code == 200
    students = r.json()
    assert len(students) == 1
    assert students[0]["display_name"] == "Zeynep"


@pytest.mark.asyncio
async def test_teacher_view_leaderboard(client):
    """Teacher can view leaderboard for their class (empty list when no students)."""
    token = await _teacher_signup(client, "teacher_lb@t.com")
    r = await client.post("/teacher/classes", headers=auth(token), json={"name": "Liderlik Sınıfı"})
    class_id = r.json()["id"]

    r = await client.get(f"/teacher/classes/{class_id}/leaderboard", headers=auth(token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_teacher_create_survey(client):
    """Teacher can create a survey."""
    token = await _teacher_signup(client, "teacher_survey@t.com")
    r = await client.post(
        "/teacher/surveys",
        headers=auth(token),
        json={
            "title": "Haftalık Anket",
            "questions": [{"q": "Çocuğunuz memnun mu?", "type": "yesno"}],
        },
    )
    assert r.status_code == 201
    assert "id" in r.json()


@pytest.mark.asyncio
async def test_parent_join_class(client):
    """Parent can join a child to a class using join_code."""
    teacher_token = await _teacher_signup(client, "teacher_join@t.com")
    parent_token = await _parent_signup(client, "parent_join@t.com")

    # Teacher creates class
    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf J"})
    join_code = r.json()["join_code"]

    # Parent creates child
    child_id = await _create_child(client, parent_token, "Mehmet")

    # Parent joins child to class
    r = await client.post(
        f"/parent/children/{child_id}/join-class",
        headers=auth(parent_token),
        params={"join_code": join_code},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["joined"] is True
    assert data["class_name"] == "Sınıf J"


@pytest.mark.asyncio
async def test_non_teacher_cannot_create_class(client):
    """A parent (non-teacher) gets 403 when trying to create a class."""
    parent_token = await _parent_signup(client, "parent_403@t.com")
    r = await client.post("/teacher/classes", headers=auth(parent_token), json={"name": "Yasak"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teacher_cannot_access_other_teachers_class(client):
    """Teacher A cannot access Teacher B's class."""
    token_a = await _teacher_signup(client, "teacher_a@t.com")
    token_b = await _teacher_signup(client, "teacher_b@t.com")

    # Teacher A creates a class
    r = await client.post("/teacher/classes", headers=auth(token_a), json={"name": "Sınıf A"})
    class_id = r.json()["id"]

    # Teacher B tries to access Teacher A's class students
    r = await client.get(f"/teacher/classes/{class_id}/students", headers=auth(token_b))
    assert r.status_code == 403

    # Teacher B tries to create assignment in Teacher A's class
    r = await client.post(
        f"/teacher/classes/{class_id}/assignments",
        headers=auth(token_b),
        json={"title": "Izinsiz Ödev"},
    )
    assert r.status_code == 403

    # Teacher B tries to access leaderboard of Teacher A's class
    r = await client.get(f"/teacher/classes/{class_id}/leaderboard", headers=auth(token_b))
    assert r.status_code == 403
