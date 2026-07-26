import pytest
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


async def _make_step(db) -> int:
    """Testler için gerçek bir lesson_step yaratır (FK gereği)."""
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


@pytest.mark.asyncio
async def test_submit_puani_sunucu_hesaplar(client, child_auth, db):
    token, _ = child_auth
    step_id = await _make_step(db)
    r = await client.post(
        f"/practice/steps/{step_id}/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"mode": "suresiz", "correct": 17, "total": 20},
    )
    assert r.status_code == 200
    assert r.json()["score"] == 85
    assert r.json()["best_score"] == 85
    assert r.json()["improved"] is True


@pytest.mark.asyncio
async def test_dusuk_skor_en_iyiyi_dusurmez(client, child_auth, db):
    """En iyi skor kalıcıdır: bir kez 85 alındıysa sonraki kötü oturum kilidi kapatmaz."""
    token, _ = child_auth
    step_id = await _make_step(db)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_id}/submit", headers=h,
                      json={"mode": "suresiz", "correct": 17, "total": 20})
    r = await client.post(f"/practice/steps/{step_id}/submit", headers=h,
                          json={"mode": "suresiz", "correct": 2, "total": 20})
    assert r.status_code == 200
    assert r.json()["score"] == 10
    assert r.json()["best_score"] == 85
    assert r.json()["improved"] is False


@pytest.mark.asyncio
async def test_attempts_count_her_gonderimde_artar(client, child_auth, db):
    token, _ = child_auth
    step_id = await _make_step(db)
    h = {"Authorization": f"Bearer {token}"}
    for _ in range(3):
        await client.post(f"/practice/steps/{step_id}/submit", headers=h,
                          json={"mode": "suresiz", "correct": 10, "total": 20})
    r = await client.get(f"/practice/steps/{step_id}/detail", headers=h)
    assert r.status_code == 200
    assert r.json()["attempts_count"] == 3


@pytest.mark.asyncio
async def test_gecersiz_mod_400(client, child_auth, db):
    token, _ = child_auth
    step_id = await _make_step(db)
    r = await client.post(f"/practice/steps/{step_id}/submit",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"mode": "hizli", "correct": 5, "total": 20})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_correct_total_dan_buyukse_400(client, child_auth, db):
    token, _ = child_auth
    step_id = await _make_step(db)
    r = await client.post(f"/practice/steps/{step_id}/submit",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"mode": "suresiz", "correct": 30, "total": 20})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_olmayan_step_404(client, child_auth):
    token, _ = child_auth
    r = await client.post("/practice/steps/999999/submit",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"mode": "suresiz", "correct": 5, "total": 20})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_tokensiz_401(client, db):
    step_id = await _make_step(db)
    r = await client.post(f"/practice/steps/{step_id}/submit",
                          json={"mode": "suresiz", "correct": 5, "total": 20})
    assert r.status_code == 403 or r.status_code == 401
