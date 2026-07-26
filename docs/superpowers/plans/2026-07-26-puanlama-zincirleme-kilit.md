# P6 — Puanlama ve Zincirleme Kilit Açma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğrenci pratiği bitirince puan ve sonuç ekranı görsün; 85+ aldıkça Süreli Pratik → Kendini Test Et → sonraki alt konu zinciri açılsın ve bu kalıcı olsun.

**Architecture:** Backend saf bir skor deposudur (yeni `child_practice_results` tablosu + iki endpoint); puanı **sunucu** hesaplar. Kilit kararı, sıralı alt konu listesini zaten bilen frontend'de saf ve test edilebilir bir modülde (`lib/practice/unlock.ts`) verilir. Token yoksa kilit sistemi tamamen devre dışı kalır ve mevcut davranış birebir korunur.

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic + pytest (backend); Next.js 15 + React 19 + TypeScript + vitest + @testing-library/react (frontend).

**Spec:** `docs/superpowers/specs/2026-07-26-puanlama-zincirleme-kilit-design.md`

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/practice/scoring.ts` (YENİ) | Yüzde hesabı + eşik mesajı. Saf, DOM'suz. |
| `apps/web/lib/practice/unlock.ts` (YENİ) | Kilit zinciri kuralları. Saf, ağ çağrısı yok. |
| `apps/web/lib/practice/practiceApi.ts` (YENİ) | Backend çağrıları. Token yoksa `null` döner. |
| `apps/web/components/practice/PracticeResult.tsx` (YENİ) | Sonuç ekranı (sunum, mantık yok). |
| `apps/api/chess_api/models/practice.py` (YENİ) | `ChildPracticeResult` tablosu. |
| `apps/api/chess_api/routers/practice.py` (YENİ) | `POST .../submit`, `GET .../scores`. |
| `apps/api/alembic/versions/20260726_PracticeResults_create.py` (YENİ) | Sadece `CREATE TABLE`. |
| `apps/web/components/lesson-steps/BoardExercise.tsx` (DEĞİŞİKLİK) | `onFinish` callback'i. |
| `apps/web/app/(child)/pratik/[mode]/page.tsx` (DEĞİŞİKLİK) | Sonuç ekranı + kilit kontrolü. |
| `apps/web/app/(child)/home/page.tsx` (DEĞİŞİKLİK) | Kilitli mod/alt konu görünümü. |

**Sıra mantığı:** Önce saf mantık (Task 1–2), sonra backend (3–5), sonra frontend entegrasyonu (6–10). Her task kendi başına commit edilebilir; canlıya çıkan hiçbir ara adım bozuk davranış üretmez (backend eklenmesi tek başına hiçbir şeyi değiştirmez, kilit UI'ı en sonda gelir).

---

## Task 1: `scoring.ts` — puan yüzdesi ve eşik mesajı

**Files:**
- Create: `apps/web/lib/practice/scoring.ts`
- Test: `apps/web/tests/practice-scoring.test.ts`

**Not (KURAL #1):** Eşik metinleri, kullanıcının verdiği ifadelerin birebir kendisidir.
Kullanıcı üç noktalı ("İyi Gidiyorsun…") yazdığı için cümlenin devamı **bilinmiyor**;
uydurulmadı, verilen kısım aynen kullanıldı. Zafer Hoca daha uzun cümle isterse bu
tek dosyada tek satırlık değişikliktir.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/practice-scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scorePercent, thresholdMessage } from '@/lib/practice/scoring';

describe('scorePercent', () => {
  it('20 soruda 20 doğru = 100', () => expect(scorePercent(20, 20)).toBe(100));
  it('20 soruda 17 doğru = 85', () => expect(scorePercent(17, 20)).toBe(85));
  it('20 soruda 0 doğru = 0', () => expect(scorePercent(0, 20)).toBe(0));
  it('yuvarlama: 7/9 = 78', () => expect(scorePercent(7, 9)).toBe(78));
  it('total 0 ise 0 döner (sıfıra bölme koruması)', () => expect(scorePercent(0, 0)).toBe(0));
  it('total negatifse 0 döner', () => expect(scorePercent(5, -1)).toBe(0));
  it('correct total u aşarsa 100 ile sınırlanır', () => expect(scorePercent(30, 20)).toBe(100));
});

describe('thresholdMessage', () => {
  it('49 → daha fazla pratik', () => expect(thresholdMessage(49)).toBe('Çok Daha Fazla Pratik Yapmalısın'));
  it('0 → daha fazla pratik', () => expect(thresholdMessage(0)).toBe('Çok Daha Fazla Pratik Yapmalısın'));
  it('50 → iyi gidiyorsun (alt sınır dahil)', () => expect(thresholdMessage(50)).toBe('İyi Gidiyorsun'));
  it('80 → iyi gidiyorsun (üst sınır dahil)', () => expect(thresholdMessage(80)).toBe('İyi Gidiyorsun'));
  it('81 → tebrikler', () => expect(thresholdMessage(81)).toBe('Tebrikler'));
  it('85 → tebrikler', () => expect(thresholdMessage(85)).toBe('Tebrikler'));
  it('100 → tebrikler', () => expect(thresholdMessage(100)).toBe('Tebrikler'));
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-scoring.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/practice/scoring"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/practice/scoring.ts`:

```ts
/**
 * Pratik oturumu puanlaması — saf mantık, DOM/ağ bağımlılığı yok.
 *
 * Doğru cevap 5 puan, yanlış 0 puan (d8). Süresiz modda oturum 20 soru olduğu için
 * ham puan (doğru×5) ile yüzde çakışır. Süreli/Test modlarında havuzun tamamı
 * kullanıldığından soru sayısı değişir — bu yüzden eşik kontrolü HER ZAMAN yüzde
 * üzerinden yapılır, ham puan üzerinden değil.
 */

/** 0–100 arası tam sayı puan. total geçersizse 0 döner (sıfıra bölme koruması). */
export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (correct / total) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/**
 * Öğrenciye gösterilecek eşik mesajı.
 * NOT: 85 puanlık KİLİT AÇMA eşiği bundan bağımsızdır (bkz. unlock.ts) — bu
 * fonksiyon yalnızca motive edici metni üretir, kilit kararı vermez.
 */
export function thresholdMessage(score: number): string {
  if (score < 50) return 'Çok Daha Fazla Pratik Yapmalısın';
  if (score <= 80) return 'İyi Gidiyorsun';
  return 'Tebrikler';
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-scoring.test.ts`
Beklenen: PASS — 14 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice/scoring.ts apps/web/tests/practice-scoring.test.ts
git commit -m "feat: pratik puanlama saf mantigi (yuzde + esik mesaji)"
```

---

## Task 2: `unlock.ts` — kilit zinciri kuralları

**Files:**
- Create: `apps/web/lib/practice/unlock.ts`
- Test: `apps/web/tests/practice-unlock.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/practice-unlock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  UNLOCK_THRESHOLD, bestScore, isSubtopicUnlocked, isModeUnlocked, unlockedLabel,
} from '@/lib/practice/unlock';
import type { ScoreMap } from '@/lib/practice/unlock';

const STEPS = [10, 20, 30]; // sıralı alt konu (lesson_step) id'leri

describe('bestScore', () => {
  it('kayıt yoksa 0 döner', () => expect(bestScore({}, 10, 'suresiz')).toBe(0));
  it('kayıt varsa değeri döner', () => expect(bestScore({ 10: { suresiz: 72 } }, 10, 'suresiz')).toBe(72));
  it('başka mod sorulursa 0 döner', () => expect(bestScore({ 10: { suresiz: 72 } }, 10, 'sureli')).toBe(0));
});

describe('isSubtopicUnlocked', () => {
  it('ilk alt konu her zaman açık', () => expect(isSubtopicUnlocked(STEPS, 10, {})).toBe(true));
  it('ikinci alt konu, birincinin testi 85 altındaysa kilitli', () => {
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 84 } })).toBe(false);
  });
  it('ikinci alt konu, birincinin testi tam 85 ise açık', () => {
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 85 } })).toBe(true);
  });
  it('üçüncü alt konu, ikinci bitmediyse kilitli (atlama yok)', () => {
    expect(isSubtopicUnlocked(STEPS, 30, { 10: { test: 100 } })).toBe(false);
  });
  it('listede olmayan step açık sayılır (bozuk veri kilitlemez)', () => {
    expect(isSubtopicUnlocked(STEPS, 99, {})).toBe(true);
  });
});

describe('isModeUnlocked', () => {
  it('açık alt konuda suresiz her zaman açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'suresiz', {})).toBe(true);
  });
  it('sureli, suresiz 84 iken kilitli', () => {
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 84 } })).toBe(false);
  });
  it('sureli, suresiz 85 iken açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 85 } })).toBe(true);
  });
  it('test, sureli 85 iken açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 85 } })).toBe(true);
  });
  it('test, sureli 40 iken kilitli', () => {
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 40 } })).toBe(false);
  });
  it('KİLİTLİ ALT KONUDA hiçbir mod açılmaz', () => {
    const scores: ScoreMap = { 20: { suresiz: 100 } }; // 20 kilitli ama skoru var
    expect(isModeUnlocked(STEPS, 20, 'suresiz', scores)).toBe(false);
    expect(isModeUnlocked(STEPS, 20, 'sureli', scores)).toBe(false);
  });
});

describe('unlockedLabel', () => {
  it('suresiz 85+ → Süreli Pratik açılır', () => expect(unlockedLabel('suresiz')).toBe('Süreli Pratik'));
  it('sureli 85+ → Kendini Test Et açılır', () => expect(unlockedLabel('sureli')).toBe('Kendini Test Et'));
  it('test 85+ → sonraki alt konu açılır', () => expect(unlockedLabel('test')).toBe('Sonraki alt konu'));
});

describe('UNLOCK_THRESHOLD', () => {
  it('85tir', () => expect(UNLOCK_THRESHOLD).toBe(85));
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-unlock.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/practice/unlock"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/practice/unlock.ts`:

```ts
/**
 * Zincirleme kilit açma kuralları — saf mantık, ağ/DOM bağımlılığı yok.
 *
 * Zincir bir ALT KONU (lesson_step) içindedir:
 *   Süresiz → (85+) → Süreli → (85+) → Kendini Test Et → (85+) → sonraki alt konu
 *
 * Kilitler pedagojik yönlendirmedir, güvenlik sınırı DEĞİLDİR: URL'yi elle yazan
 * biri kilitli moda girebilir. Skorun kendisi sunucuda hesaplanır.
 */

export const UNLOCK_THRESHOLD = 85;

export type PracticeMode = 'suresiz' | 'sureli' | 'test';

/** stepId → mod → o çocuğun o moddaki EN YÜKSEK skoru (0–100). */
export type ScoreMap = Record<number, Partial<Record<PracticeMode, number>>>;

/** Kayıt yoksa 0 — hiç oynanmamış mod, 85 eşiğini geçemez. */
export function bestScore(scores: ScoreMap, stepId: number, mode: PracticeMode): number {
  return scores[stepId]?.[mode] ?? 0;
}

/**
 * Alt konu açık mı? İlk alt konu her zaman açıktır; sonrakiler bir önceki alt
 * konunun "test" modunda 85+ gerektirir.
 *
 * Listede olmayan stepId AÇIK sayılır: eksik/bozuk veri yüzünden öğrenciyi
 * dışarıda bırakmak, gereğinden fazla erişim vermekten daha kötüdür (KURAL #3).
 */
export function isSubtopicUnlocked(
  orderedStepIds: number[], stepId: number, scores: ScoreMap,
): boolean {
  const idx = orderedStepIds.indexOf(stepId);
  if (idx === -1) return true; // listede yok → kilitleme
  if (idx === 0) return true;  // ilk alt konu
  return bestScore(scores, orderedStepIds[idx - 1], 'test') >= UNLOCK_THRESHOLD;
}

/** Bir alt konunun belirli bir pratik modu açık mı? */
export function isModeUnlocked(
  orderedStepIds: number[], stepId: number, mode: PracticeMode, scores: ScoreMap,
): boolean {
  if (!isSubtopicUnlocked(orderedStepIds, stepId, scores)) return false;
  if (mode === 'suresiz') return true;
  if (mode === 'sureli') return bestScore(scores, stepId, 'suresiz') >= UNLOCK_THRESHOLD;
  return bestScore(scores, stepId, 'sureli') >= UNLOCK_THRESHOLD;
}

/** Bu modda 85+ alınırsa NE açılır — sonuç ekranındaki kutlama satırı için. */
export function unlockedLabel(mode: PracticeMode): string {
  if (mode === 'suresiz') return 'Süreli Pratik';
  if (mode === 'sureli') return 'Kendini Test Et';
  return 'Sonraki alt konu';
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-unlock.test.ts`
Beklenen: PASS — 18 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice/unlock.ts apps/web/tests/practice-unlock.test.ts
git commit -m "feat: zincirleme kilit acma saf mantigi (alt konu bazli)"
```

---

## Task 3: Backend modeli ve migration

**Files:**
- Create: `apps/api/chess_api/models/practice.py`
- Modify: `apps/api/chess_api/models/__init__.py`
- Create: `apps/api/alembic/versions/20260726_PracticeResults_create.py`
- Test: `apps/api/tests/test_practice_model.py`

**KURAL #4 uyarısı:** Bu migration YALNIZCA `CREATE TABLE` içerir. Hiçbir
`DROP`/`TRUNCATE`/`DELETE` ifadesi eklenmeyecek; müfredat tablolarına dokunulmayacak.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_practice_model.py`:

```python
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
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_model.py -q`
Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.models.practice'`

- [ ] **Step 3: Modeli yaz**

`apps/api/chess_api/models/practice.py`:

```python
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildPracticeResult(Base):
    """Bir çocuğun bir ALT KONU (lesson_step) × pratik modundaki en iyi sonucu.

    child_lesson_progress'ten ayrı bir tablodur: o tablo ders bazlı adım ilerlemesi
    tutar, burada ihtiyaç duyulan ise alt konu × mod bazlı en yüksek skordur.
    Ayrı tablo, mevcut satırları ve mevcut kodu hiç etkilemez (KURAL #3).
    """

    __tablename__ = "child_practice_results"
    __table_args__ = (
        UniqueConstraint("child_id", "lesson_step_id", "mode", name="uq_practice_child_step_mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16))  # suresiz | sureli | test
    best_score: Mapped[int] = mapped_column(Integer, default=0)  # 0..100
    best_correct: Mapped[int] = mapped_column(Integer, default=0)
    best_total: Mapped[int] = mapped_column(Integer, default=0)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 4: Modeli `__init__.py`'ye ekle**

`apps/api/chess_api/models/__init__.py` içinde, `from chess_api.models.app_settings import AppSettings` satırının hemen ALTINA ekle:

```python
from chess_api.models.practice import ChildPracticeResult
```

Aynı dosyada `__all__` listesinde `"AppSettings",` satırının hemen ALTINA ekle:

```python
    "ChildPracticeResult",
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_model.py -q`
Beklenen: PASS — 2 test

- [ ] **Step 6: Migration yaz**

`apps/api/alembic/versions/20260726_PracticeResults_create.py`:

```python
"""create child_practice_results

Revision ID: PracticeResults
Revises: AppSettings
Create Date: 2026-07-26 00:00:00.000000

SADECE CREATE TABLE. Mevcut hicbir tabloya dokunulmaz; mufredat tablolari
(modules, lessons, lesson_steps, child_lesson_progress, child_lesson_step_results)
etkilenmez — KURAL #4.
"""
import sqlalchemy as sa
from alembic import op

revision = 'PracticeResults'
down_revision = 'AppSettings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'child_practice_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('child_id', sa.Integer(), nullable=False),
        sa.Column('lesson_step_id', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(length=16), nullable=False),
        sa.Column('best_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_correct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('attempts_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_played_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['child_profiles.id']),
        sa.ForeignKeyConstraint(['lesson_step_id'], ['lesson_steps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('child_id', 'lesson_step_id', 'mode', name='uq_practice_child_step_mode'),
    )
    op.create_index('ix_child_practice_results_child_id', 'child_practice_results', ['child_id'])
    op.create_index('ix_child_practice_results_lesson_step_id', 'child_practice_results', ['lesson_step_id'])


def downgrade() -> None:
    op.drop_index('ix_child_practice_results_lesson_step_id', table_name='child_practice_results')
    op.drop_index('ix_child_practice_results_child_id', table_name='child_practice_results')
    op.drop_table('child_practice_results')
```

- [ ] **Step 7: Migration zincirinin tek başlı olduğunu doğrula**

Çalıştır: `cd apps/api && python -m alembic heads`
Beklenen: Tek satır — `PracticeResults (head)`. Birden fazla head görünürse DUR ve bildir.

- [ ] **Step 8: Migration guard testinin hâlâ geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_migration_guard.py -q`
Beklenen: PASS (bu test müfredat tablolarını silen migration'ları yasaklar — KURAL #4)

- [ ] **Step 9: Commit**

```bash
git add apps/api/chess_api/models/practice.py apps/api/chess_api/models/__init__.py apps/api/alembic/versions/20260726_PracticeResults_create.py apps/api/tests/test_practice_model.py
git commit -m "feat: child_practice_results tablosu + migration (sadece create)"
```

---

## Task 4: `POST /practice/steps/{step_id}/submit`

**Files:**
- Create: `apps/api/chess_api/routers/practice.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_practice_submit.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_practice_submit.py`:

```python
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
```

**Not:** Son testte hem 401 hem 403 kabul ediliyor çünkü `HTTPBearer` header
hiç yokken FastAPI varsayılan olarak 403 döndürür; bu mevcut davranıştır ve
değiştirilmeyecektir.

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_submit.py -q`
Beklenen: FAIL — tüm testler 404 (router henüz yok)

- [ ] **Step 3: Router'ı yaz**

`apps/api/chess_api/routers/practice.py`:

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, LessonStep
from chess_api.models.practice import ChildPracticeResult

VALID_MODES = {"suresiz", "sureli", "test"}

router = APIRouter(prefix="/practice", tags=["practice"])


class SubmitRequest(BaseModel):
    mode: str
    correct: int = Field(ge=0)
    total: int = Field(gt=0)


class SubmitResponse(BaseModel):
    score: int
    best_score: int
    improved: bool


class DetailResponse(BaseModel):
    best_score: int
    best_correct: int
    best_total: int
    attempts_count: int


async def _get_row(db: AsyncSession, child_id: int, step_id: int, mode: str):
    q = select(ChildPracticeResult).where(
        ChildPracticeResult.child_id == child_id,
        ChildPracticeResult.lesson_step_id == step_id,
        ChildPracticeResult.mode == mode,
    )
    return (await db.execute(q)).scalar_one_or_none()


@router.post("/steps/{step_id}/submit", response_model=SubmitResponse)
async def submit_practice(
    step_id: int,
    payload: SubmitRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bir pratik oturumunun sonucunu kaydeder ve en iyi skoru günceller.

    Puan İSTEMCİDEN ALINMAZ, burada hesaplanır — istemciye güvenilmez.
    """
    if payload.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    if payload.correct > payload.total:
        raise HTTPException(status_code=400, detail="correct cannot exceed total")

    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")

    score = round(payload.correct / payload.total * 100)
    row = await _get_row(db, child.id, step_id, payload.mode)

    if row is None:
        row = ChildPracticeResult(
            child_id=child.id, lesson_step_id=step_id, mode=payload.mode,
            best_score=score, best_correct=payload.correct, best_total=payload.total,
            attempts_count=1, last_played_at=datetime.utcnow(),
        )
        db.add(row)
        improved = True
    else:
        row.attempts_count += 1
        row.last_played_at = datetime.utcnow()
        improved = score > row.best_score
        if improved:
            row.best_score = score
            row.best_correct = payload.correct
            row.best_total = payload.total

    await db.commit()
    return SubmitResponse(score=score, best_score=row.best_score, improved=improved)


@router.get("/steps/{step_id}/detail", response_model=DetailResponse)
async def practice_detail(
    step_id: int,
    mode: str = "suresiz",
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Tek bir alt konu+mod için en iyi sonuç. Kayıt yoksa sıfırlarla döner."""
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    row = await _get_row(db, child.id, step_id, mode)
    if row is None:
        return DetailResponse(best_score=0, best_correct=0, best_total=0, attempts_count=0)
    return DetailResponse(
        best_score=row.best_score, best_correct=row.best_correct,
        best_total=row.best_total, attempts_count=row.attempts_count,
    )
```

- [ ] **Step 4: Router'ı `main.py`'ye kaydet**

`apps/api/chess_api/main.py` satır 5'teki import listesinin SONUNA ekle
(`settings as settings_router` ifadesinden sonra, aynı satırda):

```python
, practice as practice_router
```

Ve satır 39'daki `app.include_router(settings_router.router)` satırının hemen ALTINA ekle:

```python
    app.include_router(practice_router.router)
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_submit.py -q`
Beklenen: PASS — 7 test

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/practice.py apps/api/chess_api/main.py apps/api/tests/test_practice_submit.py
git commit -m "feat: POST /practice/steps/{id}/submit — sunucu tarafi puanlama + en iyi skor"
```

---

## Task 5: `GET /practice/lessons/{lesson_id}/scores`

**Files:**
- Modify: `apps/api/chess_api/routers/practice.py`
- Test: `apps/api/tests/test_practice_scores.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_practice_scores.py`:

```python
import pytest
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


async def _make_lesson_with_steps(db, step_count: int = 2):
    """Bir ders ve altında step_count adet alt konu yaratır. (lesson_id, [step_id...]) döner."""
    m = Module(order_index=1, name="M", description="d", icon="x")
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
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_scores.py -q`
Beklenen: FAIL — 404 (endpoint yok)

- [ ] **Step 3: Endpoint'i ekle**

`apps/api/chess_api/routers/practice.py` dosyasının SONUNA ekle:

```python
class ScoreRow(BaseModel):
    step_id: int
    mode: str
    best_score: int


class ScoresResponse(BaseModel):
    scores: list[ScoreRow]


@router.get("/lessons/{lesson_id}/scores", response_model=ScoresResponse)
async def lesson_scores(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bu çocuğun, bu dersin tüm alt konularındaki en iyi skorları.

    Frontend bunu ScoreMap'e çevirip kilitleri hesaplar (bkz. lib/practice/unlock.ts).
    """
    q = (
        select(ChildPracticeResult)
        .join(LessonStep, ChildPracticeResult.lesson_step_id == LessonStep.id)
        .where(
            LessonStep.lesson_id == lesson_id,
            ChildPracticeResult.child_id == child.id,
        )
    )
    rows = (await db.execute(q)).scalars().all()
    return ScoresResponse(scores=[
        ScoreRow(step_id=r.lesson_step_id, mode=r.mode, best_score=r.best_score)
        for r in rows
    ])
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_practice_scores.py -q`
Beklenen: PASS — 4 test

- [ ] **Step 5: Tüm backend testlerinin geçtiğini doğrula (regresyon)**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: Tüm testler PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/practice.py apps/api/tests/test_practice_scores.py
git commit -m "feat: GET /practice/lessons/{id}/scores — kilit hesabi icin skor haritasi"
```

---

## Task 6: `BoardExercise` — `onFinish` callback'i

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-onfinish.test.tsx`

**Neden gerekli:** Bugün `onCorrect` yalnızca TÜM sorular doğru bitince bir kez
çağrılıyor (`BoardExercise.tsx:184-185`). Pratik sayfası bunu "+1 doğru" sanıp
`solved` sayacını artırıyor (`pratik/[mode]/page.tsx:170`) — yani "Puan: X / N"
göstergesi bugün **hatalı**, en fazla 1 gösterebiliyor. `onFinish` hem puanlama
için gerekli veriyi verir hem bu hatayı düzeltir.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/board-exercise-onfinish.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const q = (instruction: string, target: string): BoardExerciseConfig => ({
  type: 'click_square',
  instruction,
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  target_squares: [target],
});

const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-square="${sq}"]`)!);

describe('BoardExercise onFinish', () => {
  it('hepsi doğruysa correct=total ile çağrılır', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'e2');
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    click(container, 'e2');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ correct: 2, total: 2 });
  });

  it('YANLIŞ cevaplar doğru sayılmaz (puanlamanın temeli)', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'a1'); // 1. soru YANLIŞ
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    click(container, 'e2'); // 2. soru doğru
    expect(onFinish).toHaveBeenCalledWith({ correct: 1, total: 2 });
  });

  it('son soru yanlışsa da çağrılır (oturum yine biter)', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'a1');
    expect(onFinish).toHaveBeenCalledWith({ correct: 0, total: 1 });
  });

  it('oturum bitmeden çağrılmaz', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'e2'); // sadece 1. soru
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('REGRESYON: onFinish verilmese de çökmez (opsiyonel prop)', () => {
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2')]} done={false} onCorrect={vi.fn()} />,
    );
    expect(() => click(container, 'e2')).not.toThrow();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/board-exercise-onfinish.test.tsx`
Beklenen: FAIL — `onFinish` prop'u tipte yok / hiç çağrılmıyor

- [ ] **Step 3: Prop'u ekle**

`apps/web/components/lesson-steps/BoardExercise.tsx` içinde `interface Props`
(satır ~98-102) şu hale gelsin:

```ts
interface Props {
  exercises: BoardExerciseConfig[];
  done: boolean;
  onCorrect: () => void;
  /** Oturum bitince (son soru cevaplanınca) bir kez çağrılır — puanlama için. */
  onFinish?: (result: { correct: number; total: number }) => void;
}
```

Ve bileşen imzası (satır ~148):

```ts
export function BoardExercise({ exercises, done, onCorrect, onFinish }: Props) {
```

- [ ] **Step 4: `succeed` ve `failNoRetry` içinde çağır**

`succeed` fonksiyonundaki `if (!isLastQuestion) { ... }` bloğu şu hale gelsin:

```ts
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — doğru sayısı `next` (bu soru dahil).
      onFinish?.({ correct: next, total });
      if (next >= total) {
        if (!done) onCorrect();
      } else {
        setAllAttempted(true);
      }
    }
```

`failNoRetry` fonksiyonundaki blok şu hale gelsin:

```ts
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — bu soru YANLIŞ olduğu için doneCount artmadı.
      onFinish?.({ correct: doneCount, total });
      setAllAttempted(true);
    }
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/board-exercise-onfinish.test.tsx`
Beklenen: PASS — 5 test

- [ ] **Step 6: BoardExercise regresyon testlerinin bozulmadığını doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/board-exercise-question-reset.test.tsx tests/board-exercise-move-piece-placeholder.test.tsx`
Beklenen: Tümü PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-onfinish.test.tsx
git commit -m "feat: BoardExercise onFinish — oturum sonu dogru/toplam bildirimi"
```

---

## Task 7: `PracticeResult` sonuç ekranı bileşeni

**Files:**
- Create: `apps/web/components/practice/PracticeResult.tsx`
- Test: `apps/web/tests/practice-result.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/practice-result.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeResult } from '@/components/practice/PracticeResult';

describe('PracticeResult', () => {
  it('doğru sayısını ve puanı gösterir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText(/17 \/ 20/)).toBeInTheDocument();
    expect(screen.getByText(/85 \/ 100/)).toBeInTheDocument();
  });

  it('düşük puanda daha fazla pratik mesajı', () => {
    render(<PracticeResult correct={4} total={20} score={20} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Çok Daha Fazla Pratik Yapmalısın')).toBeInTheDocument();
  });

  it('orta puanda iyi gidiyorsun mesajı', () => {
    render(<PracticeResult correct={12} total={20} score={60} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('İyi Gidiyorsun')).toBeInTheDocument();
  });

  it('yüksek puanda tebrikler mesajı', () => {
    render(<PracticeResult correct={18} total={20} score={90} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Tebrikler')).toBeInTheDocument();
  });

  it('kilit açıldıysa kutlama satırı gösterilir', () => {
    render(<PracticeResult correct={17} total={20} score={85} unlocked="Süreli Pratik" onRetry={vi.fn()} />);
    expect(screen.getByText(/Süreli Pratik açıldı/)).toBeInTheDocument();
  });

  it('kilit açılmadıysa kutlama satırı YOK', () => {
    render(<PracticeResult correct={16} total={20} score={80} unlocked={null} onRetry={vi.fn()} />);
    expect(screen.queryByText(/açıldı/)).not.toBeInTheDocument();
  });

  it('Tekrar Dene butonu onRetry çağırır', () => {
    const onRetry = vi.fn();
    render(<PracticeResult correct={10} total={20} score={50} unlocked={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Tekrar Dene'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-result.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/practice/PracticeResult"`

- [ ] **Step 3: Bileşeni yaz**

`apps/web/components/practice/PracticeResult.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { thresholdMessage } from '@/lib/practice/scoring';

interface Props {
  correct: number;
  total: number;
  /** 0–100. Sunucu hesaplar; sunucuya ulaşılamazsa yerel scorePercent kullanılır. */
  score: number;
  /** Bu oturumda açılan kilidin adı, yoksa null. */
  unlocked: string | null;
  onRetry: () => void;
}

/** Oturum sonu dökümü. Saf sunum — puanlama/kilit kararı vermez. */
export function PracticeResult({ correct, total, score, unlocked, onRetry }: Props) {
  return (
    <div className="t-card-i p-5 text-center rounded-xl">
      <p className="text-3xl mb-2">🏁</p>
      <p className="font-extrabold text-base mb-1">{thresholdMessage(score)}</p>

      <p className="text-sm mb-1">
        <b style={{ color: 'var(--t-accent)' }}>{correct} / {total}</b> doğru
      </p>
      <p className="text-sm mb-3">
        Puanın: <b style={{ color: 'var(--t-accent)' }}>{score} / 100</b>
      </p>

      {unlocked && (
        <p className="text-sm font-bold mb-3 py-2 px-3 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
            border: '1px solid var(--t-accent)',
          }}>
          🔓 {unlocked} açıldı!
        </p>
      )}

      <div className="flex gap-2 justify-center">
        <button type="button" onClick={onRetry} className="t-btn px-5 py-2.5 text-sm">
          Tekrar Dene
        </button>
        <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-result.test.tsx`
Beklenen: PASS — 7 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/practice/PracticeResult.tsx apps/web/tests/practice-result.test.tsx
git commit -m "feat: PracticeResult sonuc ekrani bileseni"
```

---

## Task 8: `practiceApi.ts` — backend istemcisi

**Files:**
- Create: `apps/web/lib/practice/practiceApi.ts`
- Test: `apps/web/tests/practice-api.test.ts`

**Kritik davranış:** Token yoksa veya çağrı hata verirse `null` döner. Çağıran taraf
`null` gördüğünde kilit sistemini uygulamaz — "token'sız kullanıcıda her şey açık"
kararı ve "ağ hatası oturumu kaybettirmez" kuralı burada uygulanır.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/practice-api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLessonScores, submitPracticeResult } from '@/lib/practice/practiceApi';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchLessonScores', () => {
  it('token yoksa null döner ve ağa çıkmaz', async () => {
    expect(await fetchLessonScores(1)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('token varsa skorları ScoreMap e çevirir', async () => {
    localStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ scores: [
        { step_id: 10, mode: 'suresiz', best_score: 85 },
        { step_id: 10, mode: 'sureli', best_score: 40 },
        { step_id: 20, mode: 'suresiz', best_score: 60 },
      ] }),
    });
    expect(await fetchLessonScores(1)).toEqual({
      10: { suresiz: 85, sureli: 40 },
      20: { suresiz: 60 },
    });
  });

  it('sunucu hata verirse null döner (kilit uygulanmaz)', async () => {
    localStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchLessonScores(1)).toBeNull();
  });

  it('ağ patlarsa null döner, hata fırlatmaz', async () => {
    localStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    expect(await fetchLessonScores(1)).toBeNull();
  });
});

describe('submitPracticeResult', () => {
  it('token yoksa null döner ve ağa çıkmaz', async () => {
    expect(await submitPracticeResult(5, 'suresiz', 17, 20)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('token varsa sunucu yanıtını döner', async () => {
    localStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ score: 85, best_score: 85, improved: true }),
    });
    expect(await submitPracticeResult(5, 'suresiz', 17, 20))
      .toEqual({ score: 85, best_score: 85, improved: true });
  });

  it('ağ patlarsa null döner (oturum sonucu yine gösterilebilsin)', async () => {
    localStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    expect(await submitPracticeResult(5, 'suresiz', 17, 20)).toBeNull();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-api.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/practice/practiceApi"`

- [ ] **Step 3: İstemciyi yaz**

`apps/web/lib/practice/practiceApi.ts`:

```ts
import { getToken } from '@/lib/auth-storage';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ScoreRow { step_id: number; mode: string; best_score: number }
export interface SubmitResult { score: number; best_score: number; improved: boolean }

/**
 * Dersin tüm alt konuları için en iyi skorlar.
 * null = "kilit sistemi uygulanamaz" (token yok / sunucu erişilemiyor) →
 * çağıran taraf her şeyi AÇIK kabul eder (KURAL #3: kimse dışarıda kalmaz).
 */
export async function fetchLessonScores(lessonId: number): Promise<ScoreMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/lessons/${lessonId}/scores`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const map: ScoreMap = {};
    for (const row of (data.scores ?? []) as ScoreRow[]) {
      (map[row.step_id] ??= {})[row.mode as PracticeMode] = row.best_score;
    }
    return map;
  } catch {
    return null;
  }
}

/**
 * Oturum sonucunu kaydeder. null = kaydedilemedi (token yok / ağ hatası) —
 * sonuç ekranı yine gösterilir, sadece kalıcı kayıt ve kilit açma atlanır.
 */
export async function submitPracticeResult(
  stepId: number, mode: PracticeMode, correct: number, total: number,
): Promise<SubmitResult | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/steps/${stepId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode, correct, total }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/practice-api.test.ts`
Beklenen: PASS — 7 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice/practiceApi.ts apps/web/tests/practice-api.test.ts
git commit -m "feat: practiceApi — skor okuma/yazma, tokensizda sessiz devre disi"
```

---

## Task 9: Pratik sayfası entegrasyonu (sonuç ekranı + kilit kontrolü)

**Files:**
- Modify: `apps/web/app/(child)/pratik/[mode]/page.tsx`

**Not:** Bu sayfa `useSearchParams` ve dinamik route kullandığı için birim testi
kırılgan olur; doğrulaması Task 12'deki canlı tarayıcı sürüşüyle yapılır (KURAL #6).
Bu tasarımın mantık kısmı zaten Task 1, 2, 8'de saf modüllerde test edilmiştir.

- [ ] **Step 1: Import'ları ekle**

`apps/web/app/(child)/pratik/[mode]/page.tsx` dosyasının başındaki import
bloğunun sonuna (satır ~8, `assignExerciseCodes` import'undan sonra) ekle:

```ts
import { PracticeResult } from '@/components/practice/PracticeResult';
import { scorePercent } from '@/lib/practice/scoring';
import { isModeUnlocked, unlockedLabel, UNLOCK_THRESHOLD } from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';
import { fetchLessonScores, submitPracticeResult } from '@/lib/practice/practiceApi';
```

- [ ] **Step 2: Yeni state'leri ekle**

`const [timeUp, setTimeUp] = useState(false);` satırının (satır ~60) ALTINA ekle:

```ts
  /** null = kilit sistemi uygulanmıyor (token yok / sunucuya ulaşılamadı). */
  const [scores, setScores] = useState<ScoreMap | null>(null);
  const [orderedStepIds, setOrderedStepIds] = useState<number[]>([]);
  const [finished, setFinished] = useState<{ correct: number; total: number; score: number } | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<string | null>(null);
  /** Tekrar Dene: BoardExercise'ı sıfırdan kurmak için artan sayaç. */
  const [runId, setRunId] = useState(0);
```

- [ ] **Step 3: Soru çekme effect'ine alt konu sırasını ve skorları ekle**

Mevcut `useEffect` (satır 63-82) içindeki `.then((d) => { ... })` bloğunda,
`setPoolSize(rawPool.length);` satırının ALTINA ekle:

```ts
        // Alt konu sırası: başlıklı explanation adımları — home/page.tsx:270 ile aynı kural.
        const ordered = (d.steps as StepRow[] | undefined ?? [])
          .filter((s) => s.type === 'explanation' && (s.content_json as { title?: string } | undefined)?.title)
          .map((s) => s.id);
        setOrderedStepIds(ordered);
```

Ardından, bu `useEffect` bloğunun tamamının hemen ALTINA **ayrı bir effect** ekle
(skorlar sorulardan bağımsız çekilir):

```ts
  // Kilit durumu (token yoksa null döner → kilit uygulanmaz)
  useEffect(() => {
    if (!lessonId) return;
    let alive = true;
    fetchLessonScores(lessonId).then((m) => { if (alive) setScores(m); });
    return () => { alive = false; };
  }, [lessonId]);
```

- [ ] **Step 4: Oturum bitişi işleyicisini ekle**

`const header = (` satırından (satır ~96) ÖNCE ekle:

```ts
  const modeKey = slug as PracticeMode;

  /** Oturum bitti: puanı sunucuya yaz, sonuç ekranını hazırla. */
  async function handleFinish(r: { correct: number; total: number }) {
    const localScore = scorePercent(r.correct, r.total);
    const before = scores?.[stepId]?.[modeKey] ?? 0;

    const saved = await submitPracticeResult(stepId, modeKey, r.correct, r.total);
    const score = saved?.score ?? localScore;

    // Kilit YALNIZCA sunucuya yazılabildiyse açılmış sayılır — aksi halde
    // öğrenciye açıldı deyip yenilemede kapalı bulmasına yol açardık.
    const opened = saved !== null && before < UNLOCK_THRESHOLD && score >= UNLOCK_THRESHOLD;
    setUnlockedNow(opened ? unlockedLabel(modeKey) : null);

    if (saved !== null) {
      setScores((prev) => ({
        ...(prev ?? {}),
        [stepId]: { ...(prev?.[stepId] ?? {}), [modeKey]: saved.best_score },
      }));
    }
    setFinished({ correct: r.correct, total: r.total, score });
  }

  function handleRetry() {
    setFinished(null);
    setUnlockedNow(null);
    setSolved(0);
    setLeft(TIMED_SECONDS);
    setTimeUp(false);
    setRunId((n) => n + 1);
  }

  /** Kilit yalnızca skor haritası GERÇEKTEN alındıysa uygulanır. */
  const locked = scores !== null && !isModeUnlocked(orderedStepIds, stepId, modeKey, scores);
```

- [ ] **Step 5: Kilitli ekranı ve sonuç ekranını render et**

Mevcut `{!loading && exercises && exercises.length > 0 && !timeUp && (` bloğunun
(satır ~154) ÜSTÜNE ekle:

```tsx
      {!loading && locked && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">🔒</p>
          <p className="font-bold text-sm mb-1">Bu bölüm henüz kilitli</p>
          <p className="text-xs t-muted mb-4">
            {modeKey === 'sureli'
              ? 'Önce “Süresiz Pratik Yap”ta 85 puan ve üzeri al.'
              : modeKey === 'test'
                ? 'Önce “Süreli Pratik Yap”ta 85 puan ve üzeri al.'
                : 'Önce bir önceki alt konuyu tamamla.'}
          </p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && !locked && finished && (
        <PracticeResult
          correct={finished.correct}
          total={finished.total}
          score={finished.score}
          unlocked={unlockedNow}
          onRetry={handleRetry}
        />
      )}
```

- [ ] **Step 6: Soru bloğunun koşulunu güncelle ve `onFinish`'i bağla**

Satır ~154'teki koşulu şu hale getir:

```tsx
      {!loading && !locked && !finished && exercises && exercises.length > 0 && !timeUp && (
```

Aynı blok içindeki `<BoardExercise ... />` çağrısını şu hale getir:

```tsx
          <BoardExercise
            key={runId}
            exercises={exercises}
            done={false}
            onCorrect={() => setSolved((s) => Math.min(s + 1, exercises.length))}
            onFinish={handleFinish}
          />
```

Ayrıca satır ~145'teki süre dolumu bloğunun koşulunu şu hale getir (kilitliyken
"süre doldu" gösterilmesin):

```tsx
      {!loading && !locked && !finished && exercises && exercises.length > 0 && timeUp && (
```

- [ ] **Step 7: Süre dolunca da sonucu kaydet**

Süreli mod sayacı effect'ine DOKUNMA. Onun yerine, o effect'in hemen ALTINA
yeni bir effect ekle:

```ts
  // Süre dolunca oturum biter — o ana kadarki doğrular puanlanır.
  // Kasten yalnızca `timeUp`e bağlı: diğer değerler değiştiğinde tekrar
  // tetiklenirse aynı oturum iki kez kaydedilir.
  useEffect(() => {
    if (!timeUp || finished) return;
    void handleFinish({ correct: solved, total: exercises?.length ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);
```

**Not:** `eslint-disable` satırı zorunludur; onsuz `react-hooks/exhaustive-deps`
uyarı üretir ve Step 8'deki lint beklentisi tutmaz.

- [ ] **Step 8: Tip kontrolü ve derleme**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint`
Beklenen: tsc hatasız; lint yalnızca mevcut `boardSkin.tsx` `<img>` uyarısını verir.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(child\)/pratik/\[mode\]/page.tsx
git commit -m "feat: pratik sayfasi — sonuc ekrani, puan kaydi ve kilit kontrolu"
```

---

## Task 10: Ana sayfada kilitli mod/alt konu görünümü

**Files:**
- Modify: `apps/web/app/(child)/home/page.tsx`

- [ ] **Step 1: Import'ları ekle**

`apps/web/app/(child)/home/page.tsx` import bloğunun sonuna ekle:

```ts
import { isModeUnlocked, isSubtopicUnlocked } from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';
import { fetchLessonScores } from '@/lib/practice/practiceApi';
```

- [ ] **Step 2: Skor state'ini ekle**

`const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});`
satırının (satır ~220) ALTINA ekle:

```ts
  /** lessonId → skor haritası. null değer = kilit uygulanmaz (token yok). */
  const [scoresByLesson, setScoresByLesson] = useState<Record<number, ScoreMap | null>>({});
```

- [ ] **Step 3: Alt konular yüklenirken skorları da çek**

`loadSubtopics` fonksiyonunda (satır 265-276) `setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));`
satırının ALTINA ekle:

```ts
      const scoreMap = await fetchLessonScores(lessonId);
      setScoresByLesson((prev) => ({ ...prev, [lessonId]: scoreMap }));
```

- [ ] **Step 4: Kilit yardımcılarını render'dan önce tanımla**

`const subs = subtopicsByLesson[les.id];` satırının (satır ~595) ALTINA ekle:

```tsx
                        const lessonScores = scoresByLesson[les.id];
                        const orderedStepIds = (subs ?? []).map((s) => s.stepId);
                        /** Kilit YALNIZCA skor haritası gerçekten alındıysa uygulanır. */
                        const subLocked = (stepId: number) =>
                          lessonScores != null && !isSubtopicUnlocked(orderedStepIds, stepId, lessonScores);
                        const modeLocked = (stepId: number, slug: string) =>
                          lessonScores != null &&
                          !isModeUnlocked(orderedStepIds, stepId, slug as PracticeMode, lessonScores);
```

- [ ] **Step 5: Kilitli alt konu düğümünü soluklaştır**

`<PathNode` çağrısında (satır ~614-620, alt konu düğümü) `label={sub.title}`
satırını şu hale getir:

```tsx
                                        label={subLocked(sub.stepId) ? `🔒 ${sub.title}` : sub.title}
```

- [ ] **Step 6: Kilitli mod kartını tıklanamaz yap**

`{PRACTICE_MODES.map((m, idx) => (` bloğundaki (satır ~625-645) `<Link ...>...</Link>`
tamamını şu hale getir:

```tsx
                                            {PRACTICE_MODES.map((m, idx) => {
                                              const isLocked = modeLocked(sub.stepId, m.slug);
                                              const boxStyle = {
                                                ...raised(14),
                                                padding: '0.85rem 0.5rem',
                                                display: 'flex',
                                                flexDirection: 'column' as const,
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                textDecoration: 'none',
                                                gridColumn: idx === PRACTICE_MODES.length - 1 ? '1 / -1' : undefined,
                                                opacity: isLocked ? 0.45 : 1,
                                              };
                                              const inner = (
                                                <>
                                                  <span className="text-2xl leading-none">
                                                    {isLocked ? '🔒' : m.emoji}
                                                  </span>
                                                  <span className="text-[0.68rem] font-bold text-center leading-tight"
                                                    style={{ color: m.color }}>
                                                    {m.label}
                                                  </span>
                                                </>
                                              );
                                              // Kilitliyken Link YOK — tıklama tamamen devre dışı.
                                              return isLocked ? (
                                                <div key={m.slug} style={boxStyle} aria-disabled="true">{inner}</div>
                                              ) : (
                                                <Link
                                                  key={m.slug}
                                                  href={`/pratik/${m.slug}?konu=${encodeURIComponent(sub.title)}&step=${sub.stepId}&ders=${les.id}`}
                                                  style={boxStyle}
                                                >
                                                  {inner}
                                                </Link>
                                              );
                                            })}
```

- [ ] **Step 7: Tip kontrolü ve derleme**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint`
Beklenen: tsc hatasız; lint yalnızca mevcut `boardSkin.tsx` uyarısı.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(child\)/home/page.tsx
git commit -m "feat: ana sayfada kilitli alt konu ve mod gorunumu"
```

---

## Task 11: Tam test kapısı

**Files:** (değişiklik yok — yalnızca doğrulama)

- [ ] **Step 1: Frontend kapısı**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Beklenen: tsc hatasız; lint yalnızca mevcut `boardSkin.tsx` `<img>` uyarısı;
tüm vitest testleri PASS (P5 sonunda 167 idi; bu plan ~51 test ekler).

- [ ] **Step 2: Production build**

Çalıştır: `cd apps/web && npm run build`
Beklenen: Başarılı build, hata yok.

- [ ] **Step 3: Backend kapısı**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: Tüm testler PASS.

- [ ] **Step 4: Migration zinciri tek başlı**

Çalıştır: `cd apps/api && python -m alembic heads`
Beklenen: Tek head — `PracticeResults (head)`.

- [ ] **Step 5: Herhangi bir kapı kalırsa DUR**

Kırmızı varsa düzelt ve Step 1'den tekrar başla. Kapı geçmeden "bitti" denmez.

---

## Task 12: Canlı doğrulama (KURAL #6)

**Files:** (değişiklik yok — yalnızca doğrulama)

**Kural:** Kullanıcıya "sen dene" DENMEZ. Gerçek tarayıcıda sürülür ve ne
doğrulandığı/doğrulanamadığı açıkça raporlanır.

- [ ] **Step 1: Yerel ortamı hazırla**

`apps/web/.env.local` oluştur:

```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```

**UYARI:** Bu dosya asla commit edilmez ve doğrulama bitince silinir.
Dev sunucusu `preview_start` ile başlatılır, Bash ile DEĞİL.

- [ ] **Step 2: Prod test verisi oluştur**

Bir öğretmen hesabı aç, bir modül + ders + iki alt konu (`explanation`, başlıklı)
oluştur. Birinci alt konuya `board_exercises` (Süresiz) altına en az 2 soru,
`board_exercises_timed` altına en az 1 soru yaz. Oluşturulan
`MODID / LESID / STEP1 / STEP2` değerlerini not et — Step 8'de silinecek.

- [ ] **Step 3: Kilidin başlangıçta kapalı olduğunu doğrula**

Tarayıcıda `/home` → modül → ders → 1. alt konu aç.
Beklenen: "Süresiz Pratik Yap" açık; "Süreli Pratik Yap" ve "Kendini Test Et"
🔒 ile soluk ve **tıklanamaz**; 2. alt konu `🔒` ile işaretli.

- [ ] **Step 4: Düşük puanın kilidi AÇMADIĞINI doğrula**

Süresiz Pratik'i aç, soruların çoğunu bilerek YANLIŞ cevapla (85 altı kal).
Beklenen: Sonuç ekranı çıkar, puan ve eşik mesajı doğru; "açıldı" satırı YOK.
`/home`'a dön: Süreli Pratik hâlâ 🔒.

- [ ] **Step 5: 85+ puanın kilidi AÇTIĞINI doğrula**

Süresiz Pratik'i tekrar oyna, tüm soruları doğru cevapla.
Beklenen: Sonuç ekranında "Puanın: 100 / 100", "Tebrikler" ve
"🔓 Süreli Pratik açıldı!" satırı.
`/home`'a dön: Süreli Pratik artık açık ve tıklanabilir.

- [ ] **Step 6: Kalıcılığı doğrula (en kritik adım)**

Sayfayı tam yenile (`location.reload()`), `/home` → aynı alt konu.
Beklenen: Süreli Pratik **hâlâ açık** — yani kilit backend'den geliyor,
React state'inden değil.

- [ ] **Step 7: Düşük skorun kilidi KAPATMADIĞINI doğrula**

Süresiz Pratik'i tekrar oyna ve bu sefer kasten düşük puan al.
Beklenen: Sonuç ekranı düşük puanı gösterir ama Süreli Pratik **açık kalır**
(en iyi skor korunur).

- [ ] **Step 8: Temizlik**

- Prod test verisini sil: ders ve modülü `DELETE /admin/lessons/{LESID}` ve
  `DELETE /admin/modules/{MODID}` ile kaldır, silindiğini `GET /modules` ile doğrula.
- `apps/web/.env.local` dosyasını sil.
- Dev sunucusunu `preview_stop` ile durdur.

- [ ] **Step 9: Dürüst rapor**

Şunları açıkça yaz: hangi adımlar tarayıcıda gerçekten doğrulandı, hangileri
doğrulanamadı ve neden. Doğrulanmamış hiçbir şey "çalışıyor" diye sunulmaz (KURAL #1).

---

## Notlar

- **KURAL #3 (canlı kullanıcılar):** Task 3–5 tek başına canlıya çıksa bile hiçbir
  davranış değişmez (yeni tablo + yeni endpoint, kimse çağırmıyor). Görünür
  davranış değişikliği ilk kez Task 9–10 ile gelir. Kilit yalnızca skor haritası
  gerçekten alındığında uygulanır; token yoksa veya sunucuya ulaşılamıyorsa her
  şey eskisi gibi açık kalır.
- **KURAL #4 (müfredat verisi):** Migration yalnızca `CREATE TABLE` içerir;
  `test_migration_guard.py` Task 3 Step 8'de ayrıca çalıştırılır.
- **P6 kapsamı dışında:** Rozet entegrasyonu, öğretmen skor raporu, oturumun
  yarıda kalıp devam ettirilmesi, modül/ders seviyesinde genel kilit sistemi.
