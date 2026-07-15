# İçerik Güvenliği (Parça 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'nın gireceği içeriğin kaybolmamasını sağlamak: tek tuşla JSON dışa aktarma, ilerlemeyi bozmayan (upsert) geri yükleme ve müfredatı silen migration'ları CI'da engelleyen koruma testi.

**Architecture:** Backend'e admin-only `GET /admin/content/export` ve `POST /admin/content/import` eklenir. Import ID koruyarak upsert yapar (asla silmez) — böylece `child_lesson_progress.lesson_id` FK'leri ve çocuk ilerlemesi bozulmaz. Ayrıca alembic dosyalarını tarayıp içerik tablosunda TRUNCATE/DELETE arayan bir pytest guard eklenir. Migration yok.

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + pytest; Next.js 15 + React 19 + TS + Tailwind.

---

## File Structure

**Backend (`apps/api`):**
- Modify: `chess_api/schemas/auth.py` — export/import Pydantic şemaları
- Modify: `chess_api/routers/admin.py` — `content_export`, `content_import` endpoint'leri
- Create: `tests/test_content_backup.py` — export/import + ilerleme koruma testleri
- Create: `tests/test_migration_guard.py` — TRUNCATE koruma testi

**Frontend (`apps/web`):**
- Modify: `app/admin/content/page.tsx` — "İçeriği indir" + "İçerik yükle" butonları

**Docs:**
- Modify: `C:/Users/muham/CLAUDE.md` — TRUNCATE yasağı kuralı

---

## Task 1: Backend — export/import şemaları

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 1: Şemaları ekle**

`apps/api/chess_api/schemas/auth.py` dosyasının sonuna ekle:

```python
class ContentStepIO(BaseModel):
    id: int | None = None
    order_index: int
    type: str
    content_json: dict
    correct_answer_json: dict | None = None


class ContentLessonIO(BaseModel):
    id: int | None = None
    order_index: int
    title: str = Field(min_length=1, max_length=160)
    estimated_minutes: int = 10
    steps: list[ContentStepIO] = []


class ContentModuleIO(BaseModel):
    id: int | None = None
    order_index: int
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    icon: str = "default"
    lessons: list[ContentLessonIO] = []


class ContentExport(BaseModel):
    exported_at: datetime
    version: int = 1
    modules: list[ContentModuleIO]


class ContentImportRequest(BaseModel):
    version: int
    modules: list[ContentModuleIO]


class ContentImportResult(BaseModel):
    modules_updated: int
    modules_created: int
    lessons_updated: int
    lessons_created: int
    steps_updated: int
    steps_created: int
```

- [ ] **Step 2: Import doğrula**

Run: `cd apps/api && ./.venv/Scripts/python.exe -c "from chess_api.schemas.auth import ContentExport, ContentImportRequest, ContentImportResult; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py
git commit -m "feat(api): içerik export/import şemaları"
```

---

## Task 2: Backend — export endpoint

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_content_backup.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_content_backup.py`:

```python
import pytest
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType


async def _teacher_token(client, email="ct@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _seed(db):
    m = Module(order_index=1, name="Temel", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders 1", estimated_minutes=15)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    st = LessonStep(lesson_id=les.id, order_index=1, type=LessonStepType.explanation,
                    content_json={"text": "merhaba"}, correct_answer_json=None)
    db.add(st)
    await db.commit()
    await db.refresh(st)
    return m, les, st


@pytest.mark.asyncio
async def test_export_returns_tree_with_ids(client, db):
    m, les, st = await _seed(db)
    tok = await _teacher_token(client)
    r = await client.get("/admin/content/export", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    mod = next(x for x in body["modules"] if x["id"] == m.id)
    assert mod["name"] == "Temel"
    lesson = mod["lessons"][0]
    assert lesson["id"] == les.id
    assert lesson["title"] == "Ders 1"
    step = lesson["steps"][0]
    assert step["id"] == st.id
    assert step["content_json"] == {"text": "merhaba"}


@pytest.mark.asyncio
async def test_export_requires_teacher(client, db):
    await _seed(db)
    r = await client.post("/auth/parent/signup", json={
        "email": "cp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.get("/admin/content/export", headers={"Authorization": f"Bearer {ptok}"})
    assert r2.status_code == 403
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_content_backup.py -v`
Expected: FAIL (404 — endpoint yok)

- [ ] **Step 3: export endpoint'ini ekle**

`apps/api/chess_api/routers/admin.py` — import bloğuna ekle (mevcut `from chess_api.schemas.auth import (...)` içine):

```python
    ContentExport, ContentModuleIO, ContentLessonIO, ContentStepIO,
    ContentImportRequest, ContentImportResult,
```

Ayrıca dosya başına ekle:

```python
from datetime import datetime
from chess_api.models.module import LessonStep, LessonStepType
```

Not: `Module`, `Lesson` zaten import edilmiş durumda (`from chess_api.models.module import Module, Lesson, LessonStep`). Import satırında `LessonStep` yoksa ekle.

Dosyanın sonuna ekle:

```python
@router.get("/content/export", response_model=ContentExport)
async def content_export(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    modules = (await db.execute(select(Module).order_by(Module.order_index))).scalars().all()
    out_modules = []
    for m in modules:
        lessons = (await db.execute(
            select(Lesson).where(Lesson.module_id == m.id).order_by(Lesson.order_index)
        )).scalars().all()
        out_lessons = []
        for les in lessons:
            steps = (await db.execute(
                select(LessonStep).where(LessonStep.lesson_id == les.id).order_by(LessonStep.order_index)
            )).scalars().all()
            out_lessons.append(ContentLessonIO(
                id=les.id, order_index=les.order_index, title=les.title,
                estimated_minutes=les.estimated_minutes,
                steps=[
                    ContentStepIO(
                        id=s.id, order_index=s.order_index, type=s.type.value,
                        content_json=s.content_json, correct_answer_json=s.correct_answer_json,
                    ) for s in steps
                ],
            ))
        out_modules.append(ContentModuleIO(
            id=m.id, order_index=m.order_index, name=m.name,
            description=m.description, icon=m.icon, lessons=out_lessons,
        ))
    return ContentExport(exported_at=datetime.utcnow(), version=1, modules=out_modules)
```

- [ ] **Step 4: Testi çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_content_backup.py -v`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_content_backup.py
git commit -m "feat(api): içerik dışa aktarma endpoint"
```

---

## Task 3: Backend — import endpoint (upsert, asla silmez)

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_content_backup.py`

- [ ] **Step 1: Failing test ekle**

`apps/api/tests/test_content_backup.py` sonuna ekle:

```python
from sqlalchemy import select, func
from chess_api.models import ChildProfile, ChildLessonProgress
from chess_api.models.progress import LessonStatus


@pytest.mark.asyncio
async def test_import_updates_existing_and_creates_new(client, db):
    m, les, st = await _seed(db)
    tok = await _teacher_token(client, email="ci1@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel GÜNCEL",
            "description": "yeni", "icon": "pawn",
            "lessons": [{
                "id": les.id, "order_index": 1, "title": "Ders 1 GÜNCEL",
                "estimated_minutes": 25,
                "steps": [
                    {"id": st.id, "order_index": 1, "type": "explanation",
                     "content_json": {"text": "guncel"}, "correct_answer_json": None},
                    {"id": None, "order_index": 2, "type": "quiz",
                     "content_json": {"q": "yeni soru"}, "correct_answer_json": {"a": 1}},
                ],
            }],
        }],
    }
    r = await client.post("/admin/content/import",
                          headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 200
    res = r.json()
    assert res["modules_updated"] == 1
    assert res["lessons_updated"] == 1
    assert res["steps_updated"] == 1
    assert res["steps_created"] == 1

    await db.refresh(m); await db.refresh(les)
    assert m.name == "Temel GÜNCEL"
    assert les.title == "Ders 1 GÜNCEL"
    assert les.estimated_minutes == 25


@pytest.mark.asyncio
async def test_import_preserves_child_progress(client, db):
    """En kritik test: import sonrası ders ID'si değişmemeli, çocuk ilerlemesi durmalı."""
    m, les, st = await _seed(db)
    # Çocuk + ilerleme oluştur
    r = await client.post("/auth/parent/signup", json={
        "email": "cprog@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu Bir",
    })
    ptok = r.json()["access_token"]
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=les.id, status=LessonStatus.completed))
    await db.commit()

    tok = await _teacher_token(client, email="ci2@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel", "description": "d", "icon": "pawn",
            "lessons": [{
                "id": les.id, "order_index": 1, "title": "Ders 1 v2", "estimated_minutes": 20,
                "steps": [],
            }],
        }],
    }
    r2 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r2.status_code == 200
    # İlerleme hâlâ duruyor ve aynı lesson_id'ye bağlı
    cnt = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == les.id)
    )).scalar_one()
    assert cnt == 1


@pytest.mark.asyncio
async def test_import_does_not_delete_missing(client, db):
    """JSON'da olmayan mevcut ders silinmemeli."""
    m, les, st = await _seed(db)
    tok = await _teacher_token(client, email="ci3@t.com")
    payload = {
        "version": 1,
        "modules": [{
            "id": m.id, "order_index": 1, "name": "Temel", "description": "d", "icon": "pawn",
            "lessons": [],  # ders JSON'da yok
        }],
    }
    r = await client.post("/admin/content/import",
                          headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 200
    cnt = (await db.execute(select(func.count(Lesson.id)).where(Lesson.id == les.id))).scalar_one()
    assert cnt == 1  # silinmedi


@pytest.mark.asyncio
async def test_import_requires_teacher_and_valid_version(client, db):
    await _seed(db)
    r = await client.post("/auth/parent/signup", json={
        "email": "cip@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {ptok}"},
                           json={"version": 1, "modules": []})
    assert r2.status_code == 403

    tok = await _teacher_token(client, email="ci4@t.com")
    r3 = await client.post("/admin/content/import",
                           headers={"Authorization": f"Bearer {tok}"},
                           json={"version": 99, "modules": []})
    assert r3.status_code == 400
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_content_backup.py -k import -v`
Expected: FAIL (404/405 — endpoint yok)

- [ ] **Step 3: import endpoint'ini ekle**

`apps/api/chess_api/routers/admin.py` sonuna ekle:

```python
@router.post("/content/import", response_model=ContentImportResult)
async def content_import(
    payload: ContentImportRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """İçeriği JSON'dan geri yükler. UPSERT — asla silmez.

    ID'ler korunur; böylece child_lesson_progress FK'leri ve çocuk ilerlemesi bozulmaz.
    """
    _ensure_admin(current)
    if payload.version != 1:
        raise HTTPException(status_code=400, detail="Unsupported version")

    counts = {"modules_updated": 0, "modules_created": 0,
              "lessons_updated": 0, "lessons_created": 0,
              "steps_updated": 0, "steps_created": 0}

    for m_io in payload.modules:
        module = await db.get(Module, m_io.id) if m_io.id else None
        if module:
            module.order_index = m_io.order_index
            module.name = m_io.name
            module.description = m_io.description
            module.icon = m_io.icon
            counts["modules_updated"] += 1
        else:
            module = Module(order_index=m_io.order_index, name=m_io.name,
                            description=m_io.description, icon=m_io.icon)
            db.add(module)
            counts["modules_created"] += 1
        await db.flush()

        for l_io in m_io.lessons:
            lesson = await db.get(Lesson, l_io.id) if l_io.id else None
            if lesson:
                lesson.module_id = module.id
                lesson.order_index = l_io.order_index
                lesson.title = l_io.title
                lesson.estimated_minutes = l_io.estimated_minutes
                counts["lessons_updated"] += 1
            else:
                lesson = Lesson(module_id=module.id, order_index=l_io.order_index,
                                title=l_io.title, estimated_minutes=l_io.estimated_minutes)
                db.add(lesson)
                counts["lessons_created"] += 1
            await db.flush()

            for s_io in l_io.steps:
                try:
                    step_type = LessonStepType(s_io.type)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid step type: {s_io.type}")
                step = await db.get(LessonStep, s_io.id) if s_io.id else None
                if step:
                    step.lesson_id = lesson.id
                    step.order_index = s_io.order_index
                    step.type = step_type
                    step.content_json = s_io.content_json
                    step.correct_answer_json = s_io.correct_answer_json
                    counts["steps_updated"] += 1
                else:
                    step = LessonStep(lesson_id=lesson.id, order_index=s_io.order_index,
                                      type=step_type, content_json=s_io.content_json,
                                      correct_answer_json=s_io.correct_answer_json)
                    db.add(step)
                    counts["steps_created"] += 1
                await db.flush()

    await db.commit()
    return ContentImportResult(**counts)
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_content_backup.py -v`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_content_backup.py
git commit -m "feat(api): içerik geri yükleme (upsert, ilerlemeyi korur)"
```

---

## Task 4: Backend — TRUNCATE koruma testi

**Files:**
- Create: `apps/api/tests/test_migration_guard.py`
- Modify: `C:/Users/muham/CLAUDE.md`

- [ ] **Step 1: Guard testini yaz**

Create `apps/api/tests/test_migration_guard.py`:

```python
"""Müfredat içeriğini silen migration yazılmasını engelleyen koruma testi.

İçerik artık Zafer hoca'nın panelden girdiği KULLANICI VERİSİ — seed değil.
Bir migration bu tabloları toplu silerse aylarca emek ve çocuk ilerlemesi gider.
"""
import re
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

CONTENT_TABLES = [
    "modules",
    "lessons",
    "lesson_steps",
    "child_lesson_progress",
    "child_lesson_step_results",
]

# Tarihsel dosyalar — zaten çalıştı, alembic zinciri bozulmasın diye silinmiyor.
ALLOWLIST = {
    "20260529_ResetCurriculum_clear_lessons_set_4_modules.py",
    "20260529_ResetCurriculum3_remove_old_seed_modules.py",
    "20260529_Lesson1_TahtaVeTaslar.py",
}


def _destructive_hits(text: str) -> list[str]:
    hits = []
    for table in CONTENT_TABLES:
        if re.search(rf"TRUNCATE\s+TABLE\s+{table}\b", text, re.IGNORECASE):
            hits.append(f"TRUNCATE {table}")
        if re.search(rf"DELETE\s+FROM\s+{table}\b", text, re.IGNORECASE):
            hits.append(f"DELETE FROM {table}")
    return hits


def test_no_new_migration_destroys_content():
    offenders = {}
    for path in VERSIONS_DIR.glob("*.py"):
        if path.name in ALLOWLIST:
            continue
        hits = _destructive_hits(path.read_text(encoding="utf-8"))
        if hits:
            offenders[path.name] = hits
    assert not offenders, (
        "İçerik tablolarını silen migration bulundu. İçerik kullanıcı verisidir, "
        f"migration'la silinemez: {offenders}"
    )


def test_allowlist_files_still_exist():
    """İzin listesi güncel kalsın — dosya silinmişse listeden de çıkarılmalı."""
    for name in ALLOWLIST:
        assert (VERSIONS_DIR / name).exists(), f"İzin listesindeki dosya yok: {name}"
```

- [ ] **Step 2: Testi çalıştır, geçmeli**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_migration_guard.py -v`
Expected: PASS (2 test) — mevcut ihlaller izin listesinde olduğu için

- [ ] **Step 3: Guard'ın gerçekten çalıştığını kanıtla**

Geçici bir ihlal dosyası oluştur:

```bash
cd apps/api
printf 'def upgrade():\n    op.execute("TRUNCATE TABLE lessons RESTART IDENTITY CASCADE")\n' > alembic/versions/zz_temp_bad.py
./.venv/Scripts/python.exe -m pytest tests/test_migration_guard.py::test_no_new_migration_destroys_content -v
```
Expected: **FAIL** (guard yakaladı)

Sonra sil:

```bash
rm alembic/versions/zz_temp_bad.py
./.venv/Scripts/python.exe -m pytest tests/test_migration_guard.py -v
```
Expected: PASS

- [ ] **Step 4: CLAUDE.md'ye kuralı ekle**

`C:/Users/muham/CLAUDE.md` dosyasında "## Proje Bağlamı" başlığının hemen ÜSTÜNE ekle:

```markdown
## KURAL #4 — MÜFREDAT İÇERİĞİ KULLANICI VERİSİDİR

Satranç uygulamasında modül/ders/ders adımı içeriği artık hocanın panelden girdiği
**kullanıcı verisidir**, seed değil.

- `modules`, `lessons`, `lesson_steps`, `child_lesson_progress`, `child_lesson_step_results`
  tablolarını toplu silen (TRUNCATE / DELETE FROM) migration **YAZILMAZ**.
- İçerik değişikliği panelden veya import endpoint'inden yapılır.
- `apps/api/tests/test_migration_guard.py` bunu CI'da zorlar.
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_migration_guard.py
git commit -m "test(api): müfredatı silen migration'ları engelleyen koruma testi"
```

Not: `CLAUDE.md` repo dışında (`C:/Users/muham/CLAUDE.md`), commit edilmez — sadece düzenlenir.

---

## Task 5: Backend — tam suite + deploy

**Files:** yok

- [ ] **Step 1: Tam backend suite**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS (mevcut 120 + yeni 8)

- [ ] **Step 2: Push (Railway deploy)**

```bash
git push origin main
```

- [ ] **Step 3: Canlı doğrulama**

Railway deploy sonrası:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://chess-app-production-1dab.up.railway.app/admin/content/export
```
Expected: `403` (auth yok → endpoint mevcut ve korumalı)

---

## Task 6: Frontend — indir/yükle butonları

**Files:**
- Modify: `apps/web/app/admin/content/page.tsx`

- [ ] **Step 1: Butonları ve mantığı ekle**

`apps/web/app/admin/content/page.tsx` — mevcut `export default function AdminContentPage()` içinde, `const accents = ...` satırından ÖNCE şu state ve fonksiyonları ekle:

```typescript
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadContent() {
    setMsg(null);
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/admin/content/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setMsg('İndirme başarısız'); setBusy(false); return; }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agep-icerik-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('İçerik indirildi');
    } catch {
      setMsg('İndirme başarısız');
    }
    setBusy(false);
  }

  async function uploadContent(file: File) {
    setMsg(null);
    if (!confirm('Bu işlem mevcut içeriği günceller (hiçbir şey silinmez). Devam?')) return;
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const token = getToken();
      const res = await fetch(`${API_BASE}/admin/content/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: json.version, modules: json.modules }),
      });
      if (!res.ok) { setMsg('Yükleme başarısız'); setBusy(false); return; }
      const r = await res.json();
      setMsg(
        `${r.modules_updated} modül güncellendi, ${r.modules_created} eklendi · ` +
        `${r.lessons_updated} ders güncellendi, ${r.lessons_created} eklendi · ` +
        `${r.steps_updated} adım güncellendi, ${r.steps_created} eklendi`
      );
      // listeyi tazele
      const fresh = await fetch(`${API_BASE}/admin/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fresh.ok) setRows(await fresh.json());
    } catch {
      setMsg('Yükleme başarısız (dosya geçersiz olabilir)');
    }
    setBusy(false);
  }
```

- [ ] **Step 2: Butonları render et**

Aynı dosyada, `<h1 className="text-2xl font-bold mb-6 n-text">İçerik (Modüller)</h1>` satırının HEMEN ALTINA ekle:

```tsx
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={downloadContent} disabled={busy}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          İçeriği indir
        </button>
        <label className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 transition-colors text-sm cursor-pointer">
          İçerik yükle
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadContent(f);
              e.target.value = '';
            }}
          />
        </label>
        {msg && <span className="text-sm n-muted">{msg}</span>}
      </div>
```

- [ ] **Step 3: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 4: Commit + push (Vercel deploy)**

```bash
git add apps/web/app/admin/content/page.tsx
git commit -m "feat(web): admin içerik indir/yükle butonları"
git push origin main
```

---

## Task 7: Canlı uçtan uca doğrulama

**Files:** yok

- [ ] **Step 1: Export canlıda çalışıyor mu (gerçek öğretmen token'ıyla)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"exp_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$API/admin/content/export" -H "Authorization: Bearer $TOK" | head -c 300
```
Expected: `{"exported_at":...,"version":1,"modules":[{"id":1,...` — gerçek müfredat gelir.

- [ ] **Step 2: Import canlıda çalışıyor mu (zararsız no-op)**

Export'u alıp aynen geri yükle — hiçbir şey değişmemeli, sadece "updated" sayıları artmalı:

```bash
API="https://chess-app-production-1dab.up.railway.app"
curl -s "$API/admin/content/export" -H "Authorization: Bearer $TOK" > /tmp/exp.json
python -c "
import json
d = json.load(open('/tmp/exp.json'))
json.dump({'version': d['version'], 'modules': d['modules']}, open('/tmp/imp.json','w'))
"
curl -s -X POST "$API/admin/content/import" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d @/tmp/imp.json
```
Expected: `{"modules_updated":4,...,"modules_created":0,...}` — created değerleri 0 olmalı (hiçbir şey eklenmedi, hiçbir şey silinmedi).

- [ ] **Step 3: Tarayıcıda buton doğrulama**

Öğretmen hesabıyla canlı sitede `/admin/content` → "İçeriği indir" tıkla → JSON iner. Konsol hatası yok.

---

## Self-Review Notu

- **Spec kapsamı:** export (T2), import upsert + ilerleme koruma (T3), TRUNCATE guard + CLAUDE.md kuralı (T4), frontend butonlar (T6), canlı doğrulama (T5,T7) — hepsi karşılandı.
- **Kritik kısıt karşılandı:** import ID koruyarak upsert yapar, silme yok → `child_lesson_progress` FK'leri sağlam. T3'te bunu doğrulayan özel test var (`test_import_preserves_child_progress`).
- **Tip tutarlılığı:** `ContentModuleIO/ContentLessonIO/ContentStepIO/ContentExport/ContentImportRequest/ContentImportResult` T1'de tanımlandı, T2/T3'te aynı adlarla kullanıldı. Frontend `modules_updated` vb. alan adları backend `ContentImportResult` ile birebir.
- **Guard'ın kanıtı:** T4 Step 3 guard'ı geçici ihlal dosyasıyla test eder (sadece "yazdım geçti" demez).
- **Migration yok**, mevcut endpoint/sayfa silinmiyor → geriye uyumlu.
- **Deploy sırası:** backend (T5) → frontend (T6).
