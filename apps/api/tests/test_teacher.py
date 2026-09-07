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
async def test_teacher_views_student_profile_summary_not_enrolled_403(client, child_auth):
    """Madde 2026-09-07 (GRUP B): öğrenci antrenörün sınıfında/kendi öğrencisi
    DEĞİLSE profile-summary 403 döner — kimse görüşünmediği bir sporcunun
    profiline erişemez."""
    _token, child_id = child_auth
    teacher_token = await _teacher_signup(client, "teacher_profile@t.com")

    r = await client.get(
        f"/teacher/students/{child_id}/profile-summary", headers=auth(teacher_token),
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teacher_views_own_students_profile_and_practice_data(client, db):
    """Antrenörün sınıfındaki bir öğrencinin profile-summary, day-summary,
    lesson scores, practice detail, attempts-summary ve attempts uçları —
    hepsi ilgili /gamification, /activity, /practice uçlarıyla AYNI veriyi
    döner (KURAL #3: mevcut uçlar değişmedi, sadece antrenör-taraflı ikizleri
    eklendi)."""
    from tests.test_practice_submit import _make_step

    teacher_token = await _teacher_signup(client, "teacher_view_data@t.com")
    parent_token = await _parent_signup(client, "parent_view_data@t.com")
    child_id = await _create_child(client, parent_token, "Emir")

    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf V"})
    class_id = r.json()["id"]
    join_code = r.json()["join_code"]
    await client.post(
        f"/parent/children/{child_id}/join-class",
        headers=auth(parent_token), params={"join_code": join_code},
    )

    # Çocuk PIN ile giriş yapıp bir pratik sonucu göndersin (gerçek veri).
    await client.post("/auth/device/register", headers=auth(parent_token),
                      json={"device_fingerprint": "devview", "name": "T"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "devview",
    })
    child_token = r.json()["access_token"]
    step_id = await _make_step(db)
    r = await client.post(
        f"/practice/steps/{step_id}/submit", headers=auth(child_token),
        json={"mode": "suresiz", "correct": 18, "total": 20},
    )
    assert r.status_code == 200

    # 1) profile-summary — /gamification/me ile aynı şekil.
    r = await client.get(f"/teacher/students/{child_id}/profile-summary", headers=auth(teacher_token))
    assert r.status_code == 200
    assert "member_since" in r.json()

    # 2) day-summary — /activity/day-summary ile aynı şekil.
    r = await client.get(f"/teacher/students/{child_id}/day-summary", headers=auth(teacher_token))
    assert r.status_code == 200
    assert "week_days" in r.json()

    # 3) lesson scores — az önce gönderilen deneme skoru görünür.
    from chess_api.models import LessonStep
    step = await db.get(LessonStep, step_id)
    r = await client.get(
        f"/teacher/students/{child_id}/practice/lessons/{step.lesson_id}/scores",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    scores = r.json()["scores"]
    assert any(s["step_id"] == step_id and s["best_score"] == 90 for s in scores)

    # 4) practice detail.
    r = await client.get(
        f"/teacher/students/{child_id}/practice/steps/{step_id}/detail?mode=suresiz",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert r.json()["best_score"] == 90

    # 5) attempts-summary.
    r = await client.get(
        f"/teacher/students/{child_id}/practice/steps/{step_id}/attempts-summary?mode=suresiz",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert r.json()["daily"]["total"] == 20

    # 6) attempts.
    r = await client.get(
        f"/teacher/students/{child_id}/practice/steps/{step_id}/attempts?mode=suresiz",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert len(r.json()["attempts"]) == 1


@pytest.mark.asyncio
async def test_teacher_cannot_view_other_teachers_student_profile(client):
    """Antrenör A, kendi sınıfında OLMAYAN bir öğrencinin profilini göremez (403)."""
    teacher_a = await _teacher_signup(client, "teacher_view_a@t.com")
    teacher_b = await _teacher_signup(client, "teacher_view_b@t.com")
    parent_token = await _parent_signup(client, "parent_view_b@t.com")
    child_id = await _create_child(client, parent_token, "Yabancı")

    r = await client.post("/teacher/classes", headers=auth(teacher_b), json={"name": "Sınıf B"})
    join_code = r.json()["join_code"]
    await client.post(
        f"/parent/children/{child_id}/join-class",
        headers=auth(parent_token), params={"join_code": join_code},
    )

    r = await client.get(f"/teacher/students/{child_id}/profile-summary", headers=auth(teacher_a))
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


@pytest.mark.asyncio
async def test_teacher_own_profile_summary(client):
    """Madde 2026-09-07 (Antrenör Paneli, 3): /teacher/me/profile-summary —
    antrenörün KENDİ Profil sayfası (/coach/profile) için — isim ve üyelik
    tarihi gerçek, rütbe/rozet/kimlik-kartı alanları null/0 (antrenör
    hesabında bu sistem yok, ProfileView zaten bunu "bilgi eksik" gösterir)."""
    token = await _teacher_signup(client, "profile_me@t.com")
    r = await client.get("/teacher/me/profile-summary", headers=auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Teacher"
    assert "member_since" in body and body["member_since"]
    assert body["photo_data_url"] is None
    assert body["province"] is None
    assert body["athlete_phone"] is None
    assert body["father_name"] is None
    assert body["mother_name"] is None
    assert body["xp_total"] == 0


@pytest.mark.asyncio
async def test_teacher_own_profile_summary_requires_teacher_role(client):
    """Bir veli (parent) token'ıyla çağrılırsa 403 döner."""
    parent_token = await _parent_signup(client, "not_a_teacher@t.com")
    r = await client.get("/teacher/me/profile-summary", headers=auth(parent_token))
    assert r.status_code == 403


TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
)


@pytest.mark.asyncio
async def test_teacher_uploads_own_photo_and_profile_summary_reflects_it(client):
    """Madde 2026-09-07 (Antrenör Paneli, 4): antrenör kendi fotoğrafını
    yükler — POST /teacher/me/photo, sonra /teacher/me/profile-summary
    bunu döndürür."""
    token = await _teacher_signup(client, "photo_teach@t.com")
    r = await client.post(
        "/teacher/me/photo", headers=auth(token), json={"photo_data_url": TINY_PNG},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r = await client.get("/teacher/me/profile-summary", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["photo_data_url"] == TINY_PNG


@pytest.mark.asyncio
async def test_teacher_photo_upload_rejects_non_image_data_uri(client):
    token = await _teacher_signup(client, "photo_bad@t.com")
    r = await client.post(
        "/teacher/me/photo", headers=auth(token), json={"photo_data_url": "not-an-image"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_teacher_photo_upload_requires_teacher_role(client):
    parent_token = await _parent_signup(client, "photo_parent@t.com")
    r = await client.post(
        "/teacher/me/photo", headers=auth(parent_token), json={"photo_data_url": TINY_PNG},
    )
    assert r.status_code == 403
