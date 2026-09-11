# Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" (suresiz) artık
# başarı EŞİĞİYLE değil, havuzdaki sabit N sorunun HEPSİ cevaplanınca
# tamamlanır. Birikimli, kaldığı yerden devam, eşiksiz.
import pytest
from sqlalchemy import select
from chess_api.models import Module, Lesson, LessonStep, LessonStepType
from chess_api.models.practice import ChildOdevProgress


async def _make_step_with_pool(db, count: int = 5, configured: int | None = None, order: int = 1):
    m = Module(order_index=order, name="M", description="d", icon="x")
    db.add(m)
    await db.flush()
    les = Lesson(module_id=m.id, order_index=1, title="Ders")
    db.add(les)
    await db.flush()
    content = {
        "title": "Alt konu",
        "board_exercises": [
            {"type": "click_square", "instruction": f"e{i}", "target_squares": [f"e{i}"]}
            for i in range(1, count + 1)
        ],
    }
    if configured is not None:
        content["question_counts"] = {"board_exercises": configured}
    step = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation, content_json=content)
    db.add(step)
    await db.commit()
    return les.id, step.id


@pytest.mark.asyncio
async def test_suresiz_submit_artik_400(client, child_auth, db):
    """Eski batch /submit "suresiz"i artık kabul etmez — /odev/answer'a yönlendirir."""
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db)
    r = await client.post(f"/practice/steps/{step_id}/submit",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"mode": "suresiz", "correct": 3, "total": 5})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_odev_birikimli_ilerler_ve_tamamlanir(client, child_auth, db):
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=5)
    h = {"Authorization": f"Bearer {token}"}

    # İlk 3 soruyu bugün çöz.
    for i, ok in enumerate([True, False, True]):
        r = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                              json={"question_index": i, "correct": ok})
        assert r.status_code == 200
    body = r.json()
    assert body["total"] == 5
    assert body["answered_count"] == 3
    assert body["completed"] is False
    assert body["per_question_correct"] == [True, False, True, None, None]

    # Kalan 2 soruyu "başka gün" çöz — kaldığı yerden.
    prog = await client.get(f"/practice/steps/{step_id}/odev/progress", headers=h)
    assert prog.json()["answered_count"] == 3  # kayıtlı kaldı

    for i in [3, 4]:
        r = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                              json={"question_index": i, "correct": True})
    assert r.json()["completed"] is True
    assert r.json()["correct_count"] == 4


@pytest.mark.asyncio
async def test_odev_tamamlaninca_tekrar_cozumler_istatistigi_degistirmez(client, child_auth, db):
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=3)
    h = {"Authorization": f"Bearer {token}"}
    for i in [0, 1, 2]:
        await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                          json={"question_index": i, "correct": True})
    # Tamamlandı — correct_count 3.
    p = (await client.get(f"/practice/steps/{step_id}/odev/progress", headers=h)).json()
    assert p["completed"] is True and p["correct_count"] == 3

    # Tekrar çözerken yanlış yapsa bile kayıt DEĞİŞMEZ.
    r = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                          json={"question_index": 0, "correct": False})
    assert r.json()["correct_count"] == 3
    assert r.json()["per_question_correct"] == [True, True, True]


@pytest.mark.asyncio
async def test_odev_set_boyutu_soru_sayisiyla_sinirli(client, child_auth, db):
    """Havuzda 5 soru var ama admin "Soru Sayısı: 2" dediyse ödev 2 sorudur."""
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=5, configured=2)
    h = {"Authorization": f"Bearer {token}"}
    p = (await client.get(f"/practice/steps/{step_id}/odev/progress", headers=h)).json()
    assert p["total"] == 2

    for i in [0, 1]:
        r = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                              json={"question_index": i, "correct": True})
    assert r.json()["completed"] is True


@pytest.mark.asyncio
async def test_odev_tamamlaninca_lesson_scores_suresiz_100(client, child_auth, db):
    """unlock.ts vekili: ödev tamamlanınca lesson_scores'ta suresiz=100 (→ Süreli açılır)."""
    token, _ = child_auth
    lesson_id, step_id = await _make_step_with_pool(db, count=2)
    h = {"Authorization": f"Bearer {token}"}

    before = (await client.get(f"/practice/lessons/{lesson_id}/scores", headers=h)).json()["scores"]
    assert before == []

    for i in [0, 1]:
        await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                          json={"question_index": i, "correct": True})

    after = (await client.get(f"/practice/lessons/{lesson_id}/scores", headers=h)).json()["scores"]
    rows = {(s["step_id"], s["mode"]): s["best_score"] for s in after}
    assert rows[(step_id, "suresiz")] == 100


@pytest.mark.asyncio
async def test_odev_yarim_kalinca_lesson_scores_suresiz_0(client, child_auth, db):
    token, _ = child_auth
    lesson_id, step_id = await _make_step_with_pool(db, count=3)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                      json={"question_index": 0, "correct": True})
    rows = {(s["step_id"], s["mode"]): s["best_score"]
            for s in (await client.get(f"/practice/lessons/{lesson_id}/scores", headers=h)).json()["scores"]}
    assert rows[(step_id, "suresiz")] == 0


@pytest.mark.asyncio
async def test_odev_detail_kismi_ilerleme_gosterir(client, child_auth, db):
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=4)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                      json={"question_index": 0, "correct": True})
    await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                      json={"question_index": 1, "correct": False})
    d = (await client.get(f"/practice/steps/{step_id}/detail", headers=h, params={"mode": "suresiz"})).json()
    assert d["pool_size"] == 4
    assert d["answered_count"] == 2
    assert d["completed"] is False
    assert d["per_question_correct"] == [True, False, None, None]


@pytest.mark.asyncio
async def test_odev_baska_cocuga_sizmaz(client, child_auth, db):
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=2)
    h = {"Authorization": f"Bearer {token}"}
    await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                      json={"question_index": 0, "correct": True})

    r = await client.post("/auth/parent/signup", json={
        "email": "odev2@t.com", "password": "guvenli12345", "name": "P2",
    })
    p2 = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {p2}"},
                          json={"display_name": "V", "age": 9, "pin": "4321"})
    c2 = r.json()["id"]
    await client.post("/auth/device/register", headers={"Authorization": f"Bearer {p2}"},
                      json={"device_fingerprint": "dev2", "name": "D2"})
    t2 = (await client.post("/auth/child/pin", json={
        "child_profile_id": c2, "pin": "4321", "device_fingerprint": "dev2",
    })).json()["access_token"]

    p = (await client.get(f"/practice/steps/{step_id}/odev/progress",
                          headers={"Authorization": f"Bearer {t2}"})).json()
    assert p["answered_count"] == 0


@pytest.mark.asyncio
async def test_odev_olmayan_step_404(client, child_auth):
    token, _ = child_auth
    r = await client.post("/practice/steps/999999/odev/answer",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"question_index": 0, "correct": True})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_soru_bir_kez_cevaplaninca_odev_bitmeden_once_de_uzerine_yazilmaz(client, child_auth, db):
    """Madde 2026-09-11 (Görsel Turu Aşama D / Madde 7): "ilk cevap kazanır"
    kuralı ÖDEVİN TAMAMI bitmeden ÖNCE de soru bazında geçerli — İnceleme
    modunda (veya herhangi bir tekrar-gönderimde) aynı index'e ikinci kez
    gelinse bile ilk cevap SABİT kalır, ne doğru→yanlış ne yanlış→doğru
    değişir; kartın rengi sadece ilk çözümle ilişkilidir."""
    token, _ = child_auth
    _, step_id = await _make_step_with_pool(db, count=5)
    h = {"Authorization": f"Bearer {token}"}

    r = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                          json={"question_index": 0, "correct": False})
    assert r.json()["per_question_correct"][0] is False

    # Ödev HENÜZ tamamlanmadı (sadece 1/5) — aynı soruya "doğru" ile tekrar
    # gelinse bile (İnceleme modu / yeniden gönderim) İLK cevap (yanlış) kalır.
    r2 = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                           json={"question_index": 0, "correct": True})
    assert r2.status_code == 200
    assert r2.json()["per_question_correct"][0] is False
    assert r2.json()["answered_count"] == 1
    assert r2.json()["correct_count"] == 0

    # Ters yön: doğru cevaplanan bir soru da yanlışla EZİLEMEZ.
    r3 = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                           json={"question_index": 1, "correct": True})
    assert r3.json()["per_question_correct"][1] is True
    r4 = await client.post(f"/practice/steps/{step_id}/odev/answer", headers=h,
                           json={"question_index": 1, "correct": False})
    assert r4.json()["per_question_correct"][1] is True
    assert r4.json()["correct_count"] == 1  # sadece index 1 doğru sayılır
