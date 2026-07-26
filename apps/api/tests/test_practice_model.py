import pytest
from sqlalchemy import select
from chess_api.models.practice import ChildPracticeResult


@pytest.mark.asyncio
async def test_practice_result_kaydedilir(db):
    row = ChildPracticeResult(
        child_id=1, lesson_step_id=5, mode="suresiz",
        best_score=85, best_correct=17, best_total=20, attempts_count=1,
    )
    db.add(row)
    await db.commit()

    found = (await db.execute(select(ChildPracticeResult))).scalars().all()
    assert len(found) == 1
    assert found[0].best_score == 85
    assert found[0].mode == "suresiz"
    assert found[0].last_played_at is not None


@pytest.mark.asyncio
async def test_ayni_cocuk_step_mod_ikinci_kez_eklenemez(db):
    """UniqueConstraint: aynı (child, step, mode) için tek satır olmalı —
    yoksa 'en iyi skor' iki satıra bölünür ve kilit yanlış hesaplanır."""
    for _ in range(2):
        db.add(ChildPracticeResult(
            child_id=1, lesson_step_id=5, mode="suresiz",
            best_score=50, best_correct=10, best_total=20, attempts_count=1,
        ))
    with pytest.raises(Exception):
        await db.commit()
