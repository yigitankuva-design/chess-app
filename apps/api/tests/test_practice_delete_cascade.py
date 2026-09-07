"""
KURAL #3 REGRESYON: child_practice_results FK'i, lesson_steps'e bagli oldugu icin
mevcut adim/ders silme endpoint'leri bu tabloyu temizlemeden silme yapmaya
calisirsa IntegrityError -> 500 firlar. Bu, canli ogretmenlerin pratik gecmisi
olan bir alt konuyu silmesini kirar. Bu testler o regresyonu kilitler.
"""
import pytest
from sqlalchemy import select
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType
from chess_api.models.practice import ChildPracticeResult
from chess_api.models import User, UserRole


async def _teacher_token(client, db, email="pdc@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    body = r.json()
    # Madde 2026-09-07 (Antrenör Paneli, 5): _ensure_admin artık
    # role==admin istiyor — bu testler /admin/* uçlarını gerçek
    # yönetici gibi çağırmak istiyor, o yüzden DB'de doğrudan
    # yükseltiyoruz (JWT'nin kendisi hâlâ "teacher" diyor ama
    # get_current_user her zaman DB'deki GÜNCEL role'e bakar).
    user = await db.get(User, body["user_id"])
    user.role = UserRole.admin
    await db.commit()
    return body["access_token"]


async def _lesson_with_step(db, order=1):
    m = Module(order_index=order, name="M", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders", estimated_minutes=10, published=False)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    step = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation,
                      content_json={"title": "Alt Konu", "body": "x"})
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return les, step


@pytest.mark.asyncio
async def test_adim_silme_pratik_sonucu_varken_500_VERMEMELI(client, db):
    les, step = await _lesson_with_step(db, order=60)
    tok = await _teacher_token(client, db, "pdc1@t.com")

    db.add(ChildPracticeResult(
        child_id=1, lesson_step_id=step.id, mode="suresiz",
        best_score=85, best_correct=17, best_total=20, attempts_count=1,
    ))
    await db.commit()

    r = await client.delete(f"/admin/steps/{step.id}", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200

    remaining = (await db.execute(
        select(ChildPracticeResult).where(ChildPracticeResult.lesson_step_id == step.id)
    )).scalars().all()
    assert remaining == []


@pytest.mark.asyncio
async def test_ders_silme_pratik_sonucu_varken_engellenmeli_degil_500(client, db):
    """child_lesson_progress/step_result'taki gibi: pratik geçmişi olan ders
    sessizce/500 ile değil, açık bir 409 ile korunmalı (çocuk emeği korunur)."""
    les, step = await _lesson_with_step(db, order=61)
    tok = await _teacher_token(client, db, "pdc2@t.com")

    db.add(ChildPracticeResult(
        child_id=1, lesson_step_id=step.id, mode="suresiz",
        best_score=85, best_correct=17, best_total=20, attempts_count=1,
    ))
    await db.commit()

    r = await client.delete(f"/admin/lessons/{les.id}", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 409
    assert (await db.get(Lesson, les.id)) is not None
