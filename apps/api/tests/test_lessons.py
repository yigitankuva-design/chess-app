import pytest_asyncio
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


@pytest_asyncio.fixture
async def seeded_lesson(db):
    """Seed one module + one lesson with 3 steps (1 explanation, 2 exercises)."""
    module = Module(order_index=1, name="Test Modül", description="d", topics="Tahta ve Taşlar", icon="pawn")
    db.add(module)
    await db.flush()

    lesson = Lesson(module_id=module.id, order_index=1, title="Test Ders", estimated_minutes=8)
    db.add(lesson)
    await db.flush()

    steps = [
        LessonStep(lesson_id=lesson.id, order_index=1, type=LessonStepType.explanation,
                   content_json={"title": "Açıklama", "body": "metin"}, correct_answer_json=None),
        LessonStep(lesson_id=lesson.id, order_index=2, type=LessonStepType.inline_exercise,
                   content_json={"title": "Dene", "task_type": "click_square"},
                   correct_answer_json={"square": "e4"}),
        LessonStep(lesson_id=lesson.id, order_index=3, type=LessonStepType.inline_exercise,
                   content_json={"title": "Dene2", "task_type": "click_square"},
                   correct_answer_json={"square": "c6"}),
    ]
    db.add_all(steps)
    await db.commit()
    return {"module_id": module.id, "lesson_id": lesson.id,
            "step_ids": [s.id for s in steps]}


async def test_list_modules(client, seeded_lesson):
    response = await client.get("/modules")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Modül"
    assert data[0]["lessons_count"] == 1
    # Madde 2026-09-07 (2): başlığın 3. satırı — konu özeti.
    assert data[0]["topics"] == "Tahta ve Taşlar"


async def test_get_lesson_detail_omits_answers(client, seeded_lesson):
    lid = seeded_lesson["lesson_id"]
    response = await client.get(f"/lessons/{lid}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["steps"]) == 3
    # correct_answer must NOT be exposed
    assert all("correct_answer_json" not in s for s in data["steps"])


async def test_get_lesson_404(client):
    response = await client.get("/lessons/99999")
    assert response.status_code == 404


async def test_submit_correct_answer(client, seeded_lesson):
    lid = seeded_lesson["lesson_id"]
    step_id = seeded_lesson["step_ids"][1]  # the e4 exercise
    response = await client.post(
        f"/lessons/{lid}/step/{step_id}/answer",
        json={"answer_json": {"square": "e4"}, "time_seconds": 5},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True


async def test_submit_wrong_answer(client, seeded_lesson):
    lid = seeded_lesson["lesson_id"]
    step_id = seeded_lesson["step_ids"][1]
    response = await client.post(
        f"/lessons/{lid}/step/{step_id}/answer",
        json={"answer_json": {"square": "d5"}, "time_seconds": 5},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is False


async def test_explanation_step_always_correct(client, seeded_lesson):
    lid = seeded_lesson["lesson_id"]
    step_id = seeded_lesson["step_ids"][0]  # explanation
    response = await client.post(
        f"/lessons/{lid}/step/{step_id}/answer",
        json={"answer_json": {}, "time_seconds": 2},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True
