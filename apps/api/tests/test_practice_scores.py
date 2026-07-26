import pytest
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


_module_counter = [0]


async def _make_lesson_with_steps(db, step_count: int = 2):
    """Bir ders ve altında step_count adet alt konu yaratır. (lesson_id, [step_id...]) döner."""
    _module_counter[0] += 1
    m = Module(order_index=_module_counter[0], name="M", description="d", icon="x")
    db.add(m)
    await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Ders")
    db.add(les)
    await db.flush()
    step_ids = []
    for i in range(step_count):
        s = LessonStep(
            lesson_id=les.id, order_index=i + 1,
            type=LessonStepType.explanation, content_json={"title": f"Alt konu {i + 1}"},
        )
        db.add(s)
        await db.flush()
        step_ids.append(s.id)
    await db.commit()
    return les.id, step_ids


@pytest.mark.asyncio
async def test_kayit_yoksa_bos_liste(client, child_auth, db):
    token, _ = child_auth
    lesson_id, _ = await _make_lesson_with_steps(db)
    r = await client.get(f"/practice/lessons/{lesson_id}/scores",
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["scores"] == []


@pytest.mark.asyncio
async def test_dersin_tum_adimlarinin_skorlari_doner(client, child_auth, db):
    token, _ = child_auth
    lesson_id, step_ids = await _make_lesson_with_steps(db, 2)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_ids[0]}/submit", headers=h,
                      json={"mode": "suresiz", "correct": 17, "total": 20})
    await client.post(f"/practice/steps/{step_ids[1]}/submit", headers=h,
                      json={"mode": "suresiz", "correct": 10, "total": 20})

    r = await client.get(f"/practice/lessons/{lesson_id}/scores", headers=h)
    assert r.status_code == 200
    rows = {(s["step_id"], s["mode"]): s["best_score"] for s in r.json()["scores"]}
    assert rows[(step_ids[0], "suresiz")] == 85
    assert rows[(step_ids[1], "suresiz")] == 50


@pytest.mark.asyncio
async def test_baska_dersin_skorlari_sizmaz(client, child_auth, db):
    token, _ = child_auth
    lesson_a, steps_a = await _make_lesson_with_steps(db, 1)
    lesson_b, steps_b = await _make_lesson_with_steps(db, 1)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{steps_b[0]}/submit", headers=h,
                      json={"mode": "suresiz", "correct": 20, "total": 20})

    r = await client.get(f"/practice/lessons/{lesson_a}/scores", headers=h)
    assert r.json()["scores"] == []


@pytest.mark.asyncio
async def test_baska_cocugun_skoru_gorunmez(client, child_auth, db):
    """Bir çocuk başka bir çocuğun ilerlemesini göremez/kullanamaz."""
    token, _ = child_auth
    lesson_id, step_ids = await _make_lesson_with_steps(db, 1)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_ids[0]}/submit", headers=h,
                      json={"mode": "suresiz", "correct": 20, "total": 20})

    # İkinci bir çocuk oluştur ve onun token'ıyla sorgula
    r = await client.post("/auth/parent/signup", json={
        "email": "other@t.com", "password": "guvenli12345", "name": "P2",
    })
    p2 = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {p2}"},
                          json={"display_name": "Veli", "age": 9, "pin": "4321"})
    c2 = r.json()["id"]
    await client.post("/auth/device/register", headers={"Authorization": f"Bearer {p2}"},
                      json={"device_fingerprint": "dev2", "name": "D2"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": c2, "pin": "4321", "device_fingerprint": "dev2",
    })
    t2 = r.json()["access_token"]

    r = await client.get(f"/practice/lessons/{lesson_id}/scores",
                         headers={"Authorization": f"Bearer {t2}"})
    assert r.json()["scores"] == []
