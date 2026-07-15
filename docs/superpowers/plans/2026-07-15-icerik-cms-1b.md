# İçerik CMS 1b (Adım/İçerik Editörü) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'nın bir dersin içine anlatım (başlık+metin) ve quiz (soru/şık/doğru cevap) adımları ekleyip düzenleyebilmesi, sıralayabilmesi, silebilmesi ve adımı başka derse taşıyabilmesi.

**Architecture:** Admin router'a adım CRUD + reorder + taşıma endpoint'leri eklenir. Editörün ürettiği `content_json`, oynatıcının beklediği şekle birebir uyar (`explanation: {title, body}`, `quiz: {questions:[{prompt, options, correct_index}]}`) ve sunucuda doğrulanır. Adım silinince o adıma ait `child_lesson_step_results` de silinir (ders tamamlama ilerlemesi korunur). Migration yok.

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + pytest; Next.js 15 + React 19 + TS + Tailwind.

---

## File Structure

**Backend (`apps/api`):**
- Modify: `chess_api/schemas/auth.py` — adım request şemaları
- Modify: `chess_api/routers/admin.py` — adım CRUD + reorder + taşıma + `GET /admin/lessons/{id}/steps`
- Create: `tests/test_cms_steps.py` — adım CRUD/doğrulama/silme/taşıma testleri

**Frontend (`apps/web`):**
- Create: `app/admin/content/lesson/[lessonId]/page.tsx` — adım editörü sayfası
- Modify: `app/admin/content/[id]/page.tsx` — ders kartından editöre link

---

## Task 1: Adım şemaları

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 1: Şemaları ekle**

`apps/api/chess_api/schemas/auth.py` sonuna ekle:

```python
class StepCreateRequest(BaseModel):
    type: str
    content_json: dict
    correct_answer_json: dict | None = None


class StepUpdateRequest(BaseModel):
    content_json: dict | None = None
    correct_answer_json: dict | None = None
    lesson_id: int | None = None  # verilirse adım bu derse taşınır


class AdminStepDetail(BaseModel):
    id: int
    lesson_id: int
    order_index: int
    type: str
    content_json: dict
    correct_answer_json: dict | None = None
```

- [ ] **Step 2: Import doğrula**

Run: `cd apps/api && ./.venv/Scripts/python.exe -c "from chess_api.schemas.auth import StepCreateRequest, StepUpdateRequest, AdminStepDetail; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py
git commit -m "feat(api): CMS adım şemaları"
```

---

## Task 2: Adım listeleme + ekleme + içerik doğrulama

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_cms_steps.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_cms_steps.py`:

```python
import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType


async def _teacher_token(client, email="cst@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _lesson(db, order=1, name="M"):
    m = Module(order_index=order, name=name, description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders", estimated_minutes=10, published=False)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    return m, les


@pytest.mark.asyncio
async def test_add_explanation_step(client, db):
    m, les = await _lesson(db, order=20)
    tok = await _teacher_token(client)
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation",
                                "content_json": {"title": "Tahta", "body": "64 kare vardir."}})
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "explanation"
    assert body["content_json"]["title"] == "Tahta"
    assert body["order_index"] == 1


@pytest.mark.asyncio
async def test_add_quiz_step_matches_player_shape(client, db):
    """Oynatıcı {questions:[{prompt, options, correct_index}]} bekliyor — birebir olmalı."""
    m, les = await _lesson(db, order=21)
    tok = await _teacher_token(client, email="cst2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "Kac kare?", "options": ["32", "64"], "correct_index": 1},
                          ]})
    assert r.status_code == 201
    q = r.json()["content_json"]["questions"][0]
    assert q["prompt"] == "Kac kare?"
    assert q["options"] == ["32", "64"]
    assert q["correct_index"] == 1


@pytest.mark.asyncio
async def test_quiz_validation_rejects_bad_correct_index(client, db):
    m, les = await _lesson(db, order=22)
    tok = await _teacher_token(client, email="cst3@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "S", "options": ["a", "b"], "correct_index": 5},
                          ]})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_quiz_validation_rejects_empty_questions(client, db):
    m, les = await _lesson(db, order=23)
    tok = await _teacher_token(client, email="cst4@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": []}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_invalid_step_type_rejected(client, db):
    m, les = await _lesson(db, order=24)
    tok = await _teacher_token(client, email="cst5@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "sarki_soyle", "content_json": {}})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_list_steps(client, db):
    m, les = await _lesson(db, order=25)
    tok = await _teacher_token(client, email="cst6@t.com")
    await client.post(f"/admin/lessons/{les.id}/steps",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"type": "explanation", "content_json": {"title": "A", "body": "b"}})
    r = await client.get(f"/admin/lessons/{les.id}/steps",
                         headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["content_json"]["title"] == "A"


@pytest.mark.asyncio
async def test_step_endpoints_require_teacher(client, db):
    m, les = await _lesson(db, order=26)
    r = await client.post("/auth/parent/signup", json={
        "email": "csp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.get(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {ptok}"})
    assert r2.status_code == 403
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_steps.py -q`
Expected: FAIL (endpoint'ler yok)

- [ ] **Step 3: Doğrulama yardımcısı + listeleme + ekleme endpoint'lerini ekle**

`apps/api/chess_api/routers/admin.py` — şema importuna ekle:

```python
    StepCreateRequest, StepUpdateRequest, AdminStepDetail,
```

Dosyanın sonuna ekle:

```python
def _validate_step_content(step_type: LessonStepType, content: dict) -> None:
    """Editörden gelen içerik oynatıcının beklediği şekle uymalı; uymazsa çocukta bozuk görünür."""
    if step_type == LessonStepType.quiz:
        questions = content.get("questions")
        if not isinstance(questions, list) or not questions:
            raise HTTPException(status_code=400, detail="Quiz için en az bir soru gerekli")
        for q in questions:
            prompt = q.get("prompt")
            options = q.get("options")
            ci = q.get("correct_index")
            if not prompt or not isinstance(options, list) or len(options) < 2:
                raise HTTPException(status_code=400, detail="Her sorunun metni ve en az 2 şıkkı olmalı")
            if not isinstance(ci, int) or ci < 0 or ci >= len(options):
                raise HTTPException(status_code=400, detail="Doğru şık geçersiz")
    elif step_type == LessonStepType.explanation:
        if not content.get("title") and not content.get("body"):
            raise HTTPException(status_code=400, detail="Anlatım için başlık veya metin gerekli")


def _step_out(s: LessonStep) -> dict:
    return {"id": s.id, "lesson_id": s.lesson_id, "order_index": s.order_index,
            "type": s.type.value, "content_json": s.content_json,
            "correct_answer_json": s.correct_answer_json}


@router.get("/lessons/{lesson_id}/steps", response_model=list[AdminStepDetail])
async def list_steps(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    steps = (await db.execute(
        select(LessonStep).where(LessonStep.lesson_id == lesson_id).order_by(LessonStep.order_index)
    )).scalars().all()
    return [AdminStepDetail(**_step_out(s)) for s in steps]


@router.post("/lessons/{lesson_id}/steps", status_code=201)
async def create_step(
    lesson_id: int,
    payload: StepCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    try:
        step_type = LessonStepType(payload.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Geçersiz adım türü: {payload.type}")
    _validate_step_content(step_type, payload.content_json)

    max_order = (await db.execute(
        select(func.max(LessonStep.order_index)).where(LessonStep.lesson_id == lesson_id)
    )).scalar_one_or_none() or 0
    step = LessonStep(lesson_id=lesson_id, order_index=max_order + 1, type=step_type,
                      content_json=payload.content_json,
                      correct_answer_json=payload.correct_answer_json)
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return _step_out(step)
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_steps.py -q`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_cms_steps.py
git commit -m "feat(api): adım listeleme/ekleme + içerik doğrulama"
```

---

## Task 3: Adım düzenleme + taşıma + sıralama + silme

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_cms_steps.py`

- [ ] **Step 1: Failing test ekle**

`apps/api/tests/test_cms_steps.py` sonuna ekle:

```python
@pytest.mark.asyncio
async def test_update_step_content(client, db):
    m, les = await _lesson(db, order=30)
    tok = await _teacher_token(client, email="csu1@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "Eski", "body": "b"}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"content_json": {"title": "Yeni", "body": "guncel"}})
    assert r2.status_code == 200
    assert r2.json()["content_json"]["title"] == "Yeni"


@pytest.mark.asyncio
async def test_update_step_validates_content(client, db):
    m, les = await _lesson(db, order=31)
    tok = await _teacher_token(client, email="csu2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "quiz", "content_json": {"questions": [
                              {"prompt": "S", "options": ["a", "b"], "correct_index": 0}]}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"content_json": {"questions": [
                                {"prompt": "S", "options": ["a", "b"], "correct_index": 9}]}})
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_move_step_to_another_lesson(client, db):
    m1, les1 = await _lesson(db, order=32, name="M32")
    m2, les2 = await _lesson(db, order=33, name="M33")
    tok = await _teacher_token(client, email="csu3@t.com")
    r = await client.post(f"/admin/lessons/{les1.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    sid = r.json()["id"]
    r2 = await client.patch(f"/admin/steps/{sid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"lesson_id": les2.id})
    assert r2.status_code == 200
    assert r2.json()["lesson_id"] == les2.id


@pytest.mark.asyncio
async def test_reorder_steps(client, db):
    m, les = await _lesson(db, order=34)
    tok = await _teacher_token(client, email="csu4@t.com")
    ids = []
    for t in ["A", "B", "C"]:
        r = await client.post(f"/admin/lessons/{les.id}/steps",
                              headers={"Authorization": f"Bearer {tok}"},
                              json={"type": "explanation", "content_json": {"title": t, "body": "b"}})
        ids.append(r.json()["id"])
    rev = list(reversed(ids))
    r = await client.post(f"/admin/lessons/{les.id}/steps/reorder",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"ordered_ids": rev})
    assert r.status_code == 200
    rows = (await db.execute(
        select(LessonStep).where(LessonStep.lesson_id == les.id).order_by(LessonStep.order_index)
    )).scalars().all()
    assert [s.id for s in rows] == rev


@pytest.mark.asyncio
async def test_delete_step_removes_its_results_but_keeps_lesson_progress(client, db):
    """Adım silinince o adımın deneme kayıtları gider; ders tamamlama ilerlemesi KALIR."""
    from chess_api.models import ChildProfile, ChildLessonProgress
    from chess_api.models.progress import LessonStatus, ChildLessonStepResult

    m, les = await _lesson(db, order=35)
    tok = await _teacher_token(client, email="csu5@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    sid = r.json()["id"]

    await client.post("/auth/parent/signup", json={
        "email": "csp2@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu",
    })
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=les.id, status=LessonStatus.completed))
    db.add(ChildLessonStepResult(child_id=child.id, lesson_step_id=sid, time_seconds=5))
    await db.commit()

    r2 = await client.delete(f"/admin/steps/{sid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert r2.json()["results_deleted"] == 1
    # adım gitti
    assert (await db.get(LessonStep, sid)) is None
    # deneme kayıtları gitti
    cnt = (await db.execute(
        select(func.count(ChildLessonStepResult.id)).where(ChildLessonStepResult.lesson_step_id == sid)
    )).scalar_one()
    assert cnt == 0
    # ders ilerlemesi DURUYOR
    prog = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == les.id)
    )).scalar_one()
    assert prog == 1
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_steps.py -k "update or move or reorder or delete" -q`
Expected: FAIL (endpoint'ler yok)

- [ ] **Step 3: Endpoint'leri ekle**

`apps/api/chess_api/routers/admin.py` sonuna ekle:

```python
@router.patch("/steps/{step_id}")
async def update_step(
    step_id: int,
    payload: StepUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    step = await db.get(LessonStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if payload.content_json is not None:
        _validate_step_content(step.type, payload.content_json)
        step.content_json = payload.content_json
    if payload.correct_answer_json is not None:
        step.correct_answer_json = payload.correct_answer_json
    if payload.lesson_id is not None and payload.lesson_id != step.lesson_id:
        target = await db.get(Lesson, payload.lesson_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target lesson not found")
        max_order = (await db.execute(
            select(func.max(LessonStep.order_index)).where(LessonStep.lesson_id == payload.lesson_id)
        )).scalar_one_or_none() or 0
        step.lesson_id = payload.lesson_id
        step.order_index = max_order + 1
    await db.commit()
    await db.refresh(step)
    return _step_out(step)


@router.post("/lessons/{lesson_id}/steps/reorder")
async def reorder_steps(
    lesson_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    steps = (await db.execute(
        select(LessonStep).where(LessonStep.id.in_(payload.ordered_ids),
                                 LessonStep.lesson_id == lesson_id)
    )).scalars().all()
    by_id = {s.id: s for s in steps}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown step id")
    for i, sid in enumerate(payload.ordered_ids):
        by_id[sid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/steps/{step_id}")
async def delete_step(
    step_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adımı ve SADECE o adıma ait deneme kayıtlarını siler.
    Ders tamamlama ilerlemesi (child_lesson_progress) korunur."""
    _ensure_admin(current)
    step = await db.get(LessonStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    results = (await db.execute(
        select(func.count(ChildLessonStepResult.id)).where(
            ChildLessonStepResult.lesson_step_id == step_id
        )
    )).scalar_one()
    await db.execute(
        delete(ChildLessonStepResult).where(ChildLessonStepResult.lesson_step_id == step_id)
    )
    await db.delete(step)
    await db.commit()
    return {"deleted": True, "results_deleted": results}
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_steps.py -q`
Expected: PASS (12 test)

- [ ] **Step 5: Tam suite (regresyon)**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS

- [ ] **Step 6: Commit + push (Railway deploy)**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_cms_steps.py
git commit -m "feat(api): adım düzenleme/taşıma/sıralama/silme"
git push origin main
```

- [ ] **Step 7: Canlı doğrulama**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"st_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "-- mevcut dersin adımları (6 adım gelmeli) --"
curl -s "$API/admin/lessons/42/steps" -H "Authorization: Bearer $TOK" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d),'adım:',[s['type'] for s in d])"
```
Expected: `6 adım: [...]` — mevcut ders adımları okunuyor (hiçbir şey bozulmamış).

---

## Task 4: Frontend — adım editörü sayfası

**Files:**
- Create: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`

- [ ] **Step 1: Editör sayfasını oluştur**

Create `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface QuizQuestion { prompt: string; options: string[]; correct_index: number }
interface StepRow {
  id: number;
  lesson_id: number;
  order_index: number;
  type: string;
  content_json: Record<string, unknown>;
  correct_answer_json: Record<string, unknown> | null;
}

export default function AdminStepEditorPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // anlatım formu
  const [expTitle, setExpTitle] = useState('');
  const [expBody, setExpBody] = useState('');

  // quiz formu
  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '']);
  const [qCorrect, setQCorrect] = useState(0);

  const refresh = useCallback(async () => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setSteps(await r.json());
    setLoading(false);
  }, [lessonId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addExplanation() {
    if (!expTitle.trim() && !expBody.trim()) { setMsg('Başlık veya metin gerekli'); return; }
    setBusy(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'explanation',
        content_json: { title: expTitle.trim(), body: expBody.trim() },
      }),
    });
    if (!r.ok) { setMsg('Anlatım eklenemedi'); setBusy(false); return; }
    setExpTitle(''); setExpBody('');
    await refresh();
    setMsg('Anlatım eklendi');
    setBusy(false);
  }

  async function addQuiz() {
    const opts = qOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!qPrompt.trim() || opts.length < 2) { setMsg('Soru ve en az 2 şık gerekli'); return; }
    if (qCorrect >= opts.length) { setMsg('Doğru şık seçimi geçersiz'); return; }
    setBusy(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'quiz',
        content_json: { questions: [{ prompt: qPrompt.trim(), options: opts, correct_index: qCorrect }] },
      }),
    });
    if (!r.ok) { setMsg('Soru eklenemedi'); setBusy(false); return; }
    setQPrompt(''); setQOptions(['', '']); setQCorrect(0);
    await refresh();
    setMsg('Soru eklendi');
    setBusy(false);
  }

  async function deleteStep(s: StepRow) {
    if (!confirm('Bu adımı silmek istiyor musun? Adıma ait çocuk deneme kayıtları da silinir.')) return;
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { setMsg('Silinemedi'); return; }
    const d = await r.json();
    await refresh();
    setMsg(`Adım silindi (${d.results_deleted} deneme kaydı da silindi)`);
  }

  async function move(s: StepRow, dir: -1 | 1) {
    const idx = steps.findIndex((x) => x.id === s.id);
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const ids = steps.map((x) => x.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ordered_ids: ids }),
    });
    if (!r.ok) { setMsg('Sıralanamadı'); return; }
    await refresh();
  }

  function stepSummary(s: StepRow): string {
    if (s.type === 'explanation') {
      const t = (s.content_json.title as string) || '';
      const b = (s.content_json.body as string) || '';
      return t || b.slice(0, 60) || '(boş)';
    }
    if (s.type === 'quiz') {
      const qs = (s.content_json.questions as QuizQuestion[]) || [];
      return qs.length ? `${qs.length} soru · ${qs[0].prompt}` : '(soru yok)';
    }
    return s.type;
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text">Ders İçeriği</h1>
      {msg && <p className="text-sm n-muted mb-3">{msg}</p>}

      {/* Mevcut adımlar */}
      {steps.length === 0 ? (
        <p className="n-muted mb-6">Bu derste henüz içerik yok. Aşağıdan ekle.</p>
      ) : (
        <div className="grid gap-3 mb-8">
          {steps.map((s, i) => {
            const accent = accents[i % accents.length];
            return (
              <div key={s.id} className={`neon-card ${accent} flex items-center gap-3 p-4`}>
                <span className={`neon-avatar ${accent} w-10 h-10 text-xs shrink-0`}>{s.order_index}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs n-muted uppercase tracking-wide">
                    {s.type === 'explanation' ? 'Anlatım' : s.type === 'quiz' ? 'Soru' : s.type}
                  </p>
                  <p className="font-semibold n-text truncate">{stepSummary(s)}</p>
                </div>
                <button onClick={() => move(s, -1)} disabled={i === 0}
                  aria-label="Yukarı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                <button onClick={() => move(s, 1)} disabled={i === steps.length - 1}
                  aria-label="Aşağı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                <button onClick={() => deleteStep(s)}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors">Sil</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Anlatım ekle */}
      <div className="neon-card neon-cyan p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Anlatım ekle</h2>
        <input value={expTitle} onChange={(e) => setExpTitle(e.target.value)}
          placeholder="Başlık" className="neon-input mb-2" />
        <textarea value={expBody} onChange={(e) => setExpBody(e.target.value)}
          placeholder="Metin" rows={4} className="neon-input mb-3" />
        <button onClick={addExplanation} disabled={busy}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          Anlatım ekle
        </button>
      </div>

      {/* Soru ekle */}
      <div className="neon-card neon-purple p-5">
        <h2 className="font-bold mb-3 n-text">Soru ekle</h2>
        <input value={qPrompt} onChange={(e) => setQPrompt(e.target.value)}
          placeholder="Soru metni" className="neon-input mb-3" />
        <div className="space-y-2 mb-3">
          {qOptions.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={qCorrect === i}
                onChange={() => setQCorrect(i)}
                aria-label={`${i + 1}. şık doğru`}
                className="h-4 w-4 accent-cyan-400"
              />
              <input
                value={o}
                onChange={(e) => setQOptions(qOptions.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. şık`}
                className="neon-input flex-1"
              />
              {qOptions.length > 2 && (
                <button onClick={() => {
                  const next = qOptions.filter((_, j) => j !== i);
                  setQOptions(next);
                  if (qCorrect >= next.length) setQCorrect(0);
                }}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">×</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQOptions([...qOptions, ''])}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-xs transition-colors">
            + Şık ekle
          </button>
          <button onClick={addQuiz} disabled={busy}
            className="px-4 py-2 rounded-lg bg-purple-400/15 text-purple-200 border border-purple-400/50 hover:bg-purple-400/25 disabled:opacity-50 text-sm transition-colors">
            Soru ekle
          </button>
          <span className="text-xs n-muted">Doğru şıkkı soldaki yuvarlakla işaretle</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/admin/content/lesson/[lessonId]/page.tsx"
git commit -m "feat(web): adım (içerik) editörü sayfası"
```

---

## Task 5: Frontend — ders kartından editöre link

**Files:**
- Modify: `apps/web/app/admin/content/[id]/page.tsx`

- [ ] **Step 1: "İçeriği düzenle" butonu ekle**

`apps/web/app/admin/content/[id]/page.tsx` — importlara ekle:

```typescript
import Link from 'next/link';
```

Ders kartındaki `<button onClick={() => togglePublish(les)}` satırının HEMEN ÜSTÜNE ekle:

```tsx
                <Link href={`/admin/content/lesson/${les.id}`}
                  className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-xs transition-colors">
                  İçeriği düzenle
                </Link>
```

- [ ] **Step 2: Tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 3: Commit + push (Vercel deploy)**

```bash
git add "apps/web/app/admin/content/[id]/page.tsx"
git commit -m "feat(web): ders kartından içerik editörüne link"
git push origin main
```

---

## Task 6: Canlı uçtan uca doğrulama

**Files:** yok

- [ ] **Step 1: Kendi test verisiyle tam akış (gerçek içeriğe dokunmadan)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
# Modül 2'ye (Başlangıç, boş) test dersi aç
LID=$(curl -s -X POST "$API/admin/modules/2/lessons" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"title":"E2E Test Ders","estimated_minutes":10}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "ders: $LID"
echo "-- anlatım ekle --"
curl -s -X POST "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d '{"type":"explanation","content_json":{"title":"Tahta","body":"64 kare"}}' \
  -o /dev/null -w "%{http_code}\n"
echo "-- soru ekle --"
curl -s -X POST "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d '{"type":"quiz","content_json":{"questions":[{"prompt":"Kac kare?","options":["32","64"],"correct_index":1}]}}' \
  -o /dev/null -w "%{http_code}\n"
echo "-- bozuk soru (400 beklenir) --"
curl -s -X POST "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d '{"type":"quiz","content_json":{"questions":[{"prompt":"S","options":["a","b"],"correct_index":9}]}}' \
  -o /dev/null -w "%{http_code}\n"
echo "-- adımlar --"
curl -s "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" | python -c "import sys,json;print([(s['order_index'],s['type']) for s in json.load(sys.stdin)])"
echo "-- temizlik --"
curl -s -X DELETE "$API/admin/lessons/$LID" -H "Authorization: Bearer $TOK"
```
Expected: anlatım 201, soru 201, bozuk soru **400**, adım listesi `[(1,'explanation'),(2,'quiz')]`, temizlik `{"deleted":true}`.

- [ ] **Step 2: Tarayıcıda editör doğrulama**

Öğretmen hesabıyla canlı sitede: `/admin/content` → bir düzey → ders → **"İçeriği düzenle"** → anlatım ekle, soru ekle (şık + doğru işaretle), ↑↓ ile sırala, sil. Konsol hatası yok.

- [ ] **Step 3: Mevcut gerçek içerik bozulmadı mı (EN KRİTİK)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
curl -s "$API/modules/1/lessons"
```
Expected: `"Tahta ve Taşlar"` hâlâ yayında ve görünür.

---

## Self-Review Notu

- **Spec kapsamı (1b):** adım listeleme/ekleme (T2), düzenleme/taşıma/sıralama/silme (T3), editör sayfası (T4), ders kartından link (T5), canlı doğrulama (T6) — hepsi karşılandı.
- **Kritik kısıt karşılandı:** editörün ürettiği `content_json` oynatıcının beklediği şekle birebir uyuyor — `explanation: {title, body}`, `quiz: {questions:[{prompt, options, correct_index}]}`. T2'de bunu doğrulayan özel test var (`test_add_quiz_step_matches_player_shape`).
- **Sunucu doğrulaması:** `correct_index` aralık dışı, boş şık listesi, geçersiz tür → 400. Bozuk içerik çocuğa gitmez.
- **Veri güvenliği:** adım silme sadece o adımın `child_lesson_step_results` kayıtlarını siler; `child_lesson_progress` korunur — T3'te bunu kanıtlayan test var.
- **Tip tutarlılığı:** `AdminStepDetail` (T1) alanları `_step_out` (T2) ve frontend `StepRow` (T4) ile birebir: id, lesson_id, order_index, type, content_json, correct_answer_json.
- **Migration yok** → geriye uyumlu. Deploy sırası: backend (T3) → frontend (T5).
