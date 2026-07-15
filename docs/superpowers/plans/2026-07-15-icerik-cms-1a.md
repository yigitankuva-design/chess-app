# İçerik CMS 1a (Düzey/Ders Yönetimi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'nın panelden düzey (modül) ve ders başlığı ekleyip düzenleyebilmesi, dersi yayınlayıp taslağa alabilmesi, dersi başka düzeye taşıyabilmesi ve sıralayabilmesi.

**Architecture:** `lessons.published` kolonu eklenir (`server_default='true'` → mevcut dersler yayında kalır). Çocuk tarafı endpoint'i taslakları filtreler. Admin router'a düzey/ders CRUD + reorder + publish + taşıma endpoint'leri eklenir. `modules.order_index` UNIQUE olduğu için sıralama iki aşamalı yazılır. İlerlemesi olan ders silinmez (409).

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + Alembic + pytest; Next.js 15 + React 19 + TS + Tailwind.

---

## File Structure

**Backend (`apps/api`):**
- Create: `alembic/versions/20260715_LessonPublished_add_published_to_lessons.py` — migration
- Modify: `chess_api/models/module.py` — `Lesson.published`
- Modify: `chess_api/routers/lessons.py` — çocuk tarafı `published` filtresi
- Modify: `chess_api/schemas/auth.py` — CMS request/response şemaları
- Modify: `chess_api/routers/admin.py` — düzey/ders CRUD endpoint'leri
- Create: `tests/test_cms_modules.py` — düzey CRUD + sıralama testleri
- Create: `tests/test_cms_lessons.py` — ders CRUD + publish + taşıma + silme testleri

**Frontend (`apps/web`):**
- Modify: `app/admin/content/page.tsx` — Düzey ekle/düzenle/sil
- Modify: `app/admin/content/[id]/page.tsx` — Ders ekle/düzenle/yayınla/taşı/sil

---

## Task 1: Migration — lessons.published

**Files:**
- Create: `apps/api/alembic/versions/20260715_LessonPublished_add_published_to_lessons.py`
- Modify: `apps/api/chess_api/models/module.py`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `apps/api/alembic/versions/20260715_LessonPublished_add_published_to_lessons.py`:

```python
"""add published to lessons

Revision ID: LessonPublished
Revises: Lesson1_Add10Exercises
Create Date: 2026-07-15 00:00:00.000000

server_default='true' KRİTİK: mevcut dersler yayında kalır, çocuklar erişimini kaybetmez.
"""
import sqlalchemy as sa
from alembic import op

revision = 'LessonPublished'
down_revision = 'Lesson1_Add10Exercises'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'lessons',
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('lessons', 'published')
```

- [ ] **Step 2: Modele alanı ekle**

`apps/api/chess_api/models/module.py` — `Lesson` sınıfını bul:

```python
class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10)
```

Şununla değiştir:

```python
class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10)
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa_true(), default=True)
```

Dosyanın başındaki import satırını bul:

```python
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, Enum
```

Şununla değiştir:

```python
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, Enum, Boolean, true as sa_true
```

- [ ] **Step 3: Migration guard'ı çalıştır (yeni migration'ı engellememeli)**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_migration_guard.py -q`
Expected: PASS (add_column TRUNCATE değil)

- [ ] **Step 4: Mevcut testler kırılmadı mı**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS (128)

- [ ] **Step 5: Commit**

```bash
git add apps/api/alembic/versions/20260715_LessonPublished_add_published_to_lessons.py apps/api/chess_api/models/module.py
git commit -m "feat(api): lessons.published kolonu (mevcut dersler yayında kalır)"
```

---

## Task 2: Çocuk tarafı — taslak dersleri gizle

**Files:**
- Modify: `apps/api/chess_api/routers/lessons.py`
- Test: `apps/api/tests/test_cms_lessons.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_cms_lessons.py`:

```python
import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType


async def _teacher_token(client, email="cmst@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _module(db, order=1, name="Temel"):
    m = Module(order_index=order, name=name, description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@pytest.mark.asyncio
async def test_child_endpoint_hides_draft_lessons(client, db):
    m = await _module(db)
    pub = Lesson(module_id=m.id, order_index=1, title="Yayinda", estimated_minutes=10, published=True)
    draft = Lesson(module_id=m.id, order_index=2, title="Taslak", estimated_minutes=10, published=False)
    db.add_all([pub, draft])
    await db.commit()

    r = await client.get(f"/modules/{m.id}/lessons")
    assert r.status_code == 200
    titles = [x["title"] for x in r.json()]
    assert "Yayinda" in titles
    assert "Taslak" not in titles


@pytest.mark.asyncio
async def test_existing_lessons_default_published(db):
    """server_default='true' → published verilmeden eklenen ders yayında olmalı."""
    m = await _module(db, order=2, name="Orta")
    les = Lesson(module_id=m.id, order_index=1, title="Varsayilan", estimated_minutes=10)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    assert les.published is True
```

- [ ] **Step 2: Testi çalıştır, ilk test fail görmeli**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_lessons.py -q`
Expected: `test_child_endpoint_hides_draft_lessons` FAIL (taslak da dönüyor)

- [ ] **Step 3: Çocuk endpoint'ine filtre ekle**

`apps/api/chess_api/routers/lessons.py` — `module_lessons` fonksiyonunu bul:

```python
@router.get("/modules/{module_id}/lessons", response_model=list[dict])
async def module_lessons(module_id: int, db: AsyncSession = Depends(get_db)):
    lessons = (await db.execute(
        select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.order_index)
    )).scalars().all()
```

Şununla değiştir:

```python
@router.get("/modules/{module_id}/lessons", response_model=list[dict])
async def module_lessons(module_id: int, db: AsyncSession = Depends(get_db)):
    lessons = (await db.execute(
        select(Lesson)
        .where(Lesson.module_id == module_id, Lesson.published.is_(True))
        .order_by(Lesson.order_index)
    )).scalars().all()
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_lessons.py -q`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/lessons.py apps/api/tests/test_cms_lessons.py
git commit -m "feat(api): çocuk tarafında taslak dersler gizlenir"
```

---

## Task 3: CMS şemaları

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 1: Şemaları ekle**

`apps/api/chess_api/schemas/auth.py` sonuna ekle:

```python
class ModuleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    icon: str = "default"


class ModuleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    icon: str | None = None


class ReorderRequest(BaseModel):
    ordered_ids: list[int]


class LessonCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    estimated_minutes: int = 10


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    estimated_minutes: int | None = None
    module_id: int | None = None  # verilirse ders bu düzeye taşınır


class LessonPublishRequest(BaseModel):
    published: bool


class AdminLessonDetail(BaseModel):
    id: int
    module_id: int
    order_index: int
    title: str
    estimated_minutes: int
    published: bool
    step_count: int
```

- [ ] **Step 2: Import doğrula**

Run: `cd apps/api && ./.venv/Scripts/python.exe -c "from chess_api.schemas.auth import ModuleCreateRequest, ModuleUpdateRequest, ReorderRequest, LessonCreateRequest, LessonUpdateRequest, LessonPublishRequest, AdminLessonDetail; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py
git commit -m "feat(api): CMS düzey/ders şemaları"
```

---

## Task 4: Düzey (Modül) CRUD + sıralama

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_cms_modules.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_cms_modules.py`:

```python
import pytest
from sqlalchemy import select
from chess_api.models.module import Module, Lesson


async def _teacher_token(client, email="cmm@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_create_module(client, db):
    tok = await _teacher_token(client)
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Yeni Duzey", "description": "aciklama", "icon": "star"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Yeni Duzey"
    assert body["order_index"] >= 1


@pytest.mark.asyncio
async def test_update_module(client, db):
    tok = await _teacher_token(client, email="cmm2@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Eski", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    r2 = await client.patch(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"},
                            json={"name": "Guncel"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Guncel"


@pytest.mark.asyncio
async def test_reorder_modules_no_unique_clash(client, db):
    """modules.order_index UNIQUE — sıralama iki aşamalı olmalı, çakışmamalı."""
    tok = await _teacher_token(client, email="cmm3@t.com")
    ids = []
    for n in ["A", "B", "C"]:
        r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                              json={"name": n, "description": "d", "icon": "pawn"})
        ids.append(r.json()["id"])
    reversed_ids = list(reversed(ids))
    r = await client.post("/admin/modules/reorder", headers={"Authorization": f"Bearer {tok}"},
                          json={"ordered_ids": reversed_ids})
    assert r.status_code == 200
    rows = (await db.execute(select(Module).where(Module.id.in_(ids)).order_by(Module.order_index))).scalars().all()
    assert [m.id for m in rows] == reversed_ids


@pytest.mark.asyncio
async def test_delete_module_blocked_when_has_lessons(client, db):
    tok = await _teacher_token(client, email="cmm4@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Dolu", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    db.add(Lesson(module_id=mid, order_index=1, title="Ders", estimated_minutes=10))
    await db.commit()
    r2 = await client.delete(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_delete_empty_module_ok(client, db):
    tok = await _teacher_token(client, email="cmm5@t.com")
    r = await client.post("/admin/modules", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Bos", "description": "d", "icon": "pawn"})
    mid = r.json()["id"]
    r2 = await client.delete(f"/admin/modules/{mid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert (await db.get(Module, mid)) is None


@pytest.mark.asyncio
async def test_module_endpoints_require_teacher(client, db):
    r = await client.post("/auth/parent/signup", json={
        "email": "cmp@t.com", "password": "guvenli12345", "name": "Veli",
    })
    ptok = r.json()["access_token"]
    r2 = await client.post("/admin/modules", headers={"Authorization": f"Bearer {ptok}"},
                           json={"name": "X", "description": "d", "icon": "pawn"})
    assert r2.status_code == 403
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_modules.py -q`
Expected: FAIL (endpoint'ler yok)

- [ ] **Step 3: Endpoint'leri ekle**

`apps/api/chess_api/routers/admin.py` — şema importuna ekle:

```python
    ModuleCreateRequest, ModuleUpdateRequest, ReorderRequest,
    LessonCreateRequest, LessonUpdateRequest, LessonPublishRequest, AdminLessonDetail,
```

Dosyanın sonuna ekle:

```python
@router.post("/modules", status_code=201)
async def create_module(
    payload: ModuleCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    max_order = (await db.execute(select(func.max(Module.order_index)))).scalar_one_or_none() or 0
    module = Module(order_index=max_order + 1, name=payload.name,
                    description=payload.description, icon=payload.icon)
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return {"id": module.id, "order_index": module.order_index, "name": module.name,
            "description": module.description, "icon": module.icon}


@router.patch("/modules/{module_id}")
async def update_module(
    module_id: int,
    payload: ModuleUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if payload.name is not None:
        module.name = payload.name
    if payload.description is not None:
        module.description = payload.description
    if payload.icon is not None:
        module.icon = payload.icon
    await db.commit()
    await db.refresh(module)
    return {"id": module.id, "order_index": module.order_index, "name": module.name,
            "description": module.description, "icon": module.icon}


@router.post("/modules/reorder")
async def reorder_modules(
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """modules.order_index UNIQUE olduğu için İKİ AŞAMALI yazılır:
    önce geçici negatif değerler, sonra kesin değerler. Yoksa unique çakışır."""
    _ensure_admin(current)
    modules = (await db.execute(
        select(Module).where(Module.id.in_(payload.ordered_ids))
    )).scalars().all()
    by_id = {m.id: m for m in modules}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown module id")

    # 1. aşama: geçici negatif değerler (çakışmayı önler)
    for i, mid in enumerate(payload.ordered_ids):
        by_id[mid].order_index = -(i + 1)
    await db.flush()
    # 2. aşama: kesin değerler
    for i, mid in enumerate(payload.ordered_ids):
        by_id[mid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson_count = (await db.execute(
        select(func.count(Lesson.id)).where(Lesson.module_id == module_id)
    )).scalar_one()
    if lesson_count:
        raise HTTPException(status_code=409, detail="Bu düzeyde ders var. Önce dersleri taşıyın veya silin.")
    await db.delete(module)
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_modules.py -q`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_cms_modules.py
git commit -m "feat(api): düzey (modül) CRUD + iki aşamalı sıralama"
```

---

## Task 5: Ders CRUD + publish + taşıma + silme koruması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_cms_lessons.py`

- [ ] **Step 1: Failing test ekle**

`apps/api/tests/test_cms_lessons.py` sonuna ekle:

```python
from chess_api.models import ChildProfile, ChildLessonProgress
from chess_api.models.progress import LessonStatus


@pytest.mark.asyncio
async def test_create_lesson_starts_as_draft(client, db):
    m = await _module(db, order=10, name="M10")
    tok = await _teacher_token(client, email="cl1@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Yeni Ders", "estimated_minutes": 12})
    assert r.status_code == 201
    body = r.json()
    assert body["published"] is False  # panelden açılan ders taslak başlar
    assert body["title"] == "Yeni Ders"


@pytest.mark.asyncio
async def test_publish_and_unpublish_lesson(client, db):
    m = await _module(db, order=11, name="M11")
    tok = await _teacher_token(client, email="cl2@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "D", "estimated_minutes": 10})
    lid = r.json()["id"]
    r2 = await client.post(f"/admin/lessons/{lid}/publish",
                           headers={"Authorization": f"Bearer {tok}"}, json={"published": True})
    assert r2.status_code == 200
    assert r2.json()["published"] is True
    # çocuk artık görüyor
    r3 = await client.get(f"/modules/{m.id}/lessons")
    assert any(x["id"] == lid for x in r3.json())
    # taslağa al
    await client.post(f"/admin/lessons/{lid}/publish",
                      headers={"Authorization": f"Bearer {tok}"}, json={"published": False})
    r4 = await client.get(f"/modules/{m.id}/lessons")
    assert not any(x["id"] == lid for x in r4.json())


@pytest.mark.asyncio
async def test_move_lesson_to_another_module(client, db):
    m1 = await _module(db, order=12, name="M12")
    m2 = await _module(db, order=13, name="M13")
    tok = await _teacher_token(client, email="cl3@t.com")
    r = await client.post(f"/admin/modules/{m1.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Tasinacak", "estimated_minutes": 10})
    lid = r.json()["id"]
    r2 = await client.patch(f"/admin/lessons/{lid}",
                            headers={"Authorization": f"Bearer {tok}"},
                            json={"module_id": m2.id})
    assert r2.status_code == 200
    assert r2.json()["module_id"] == m2.id


@pytest.mark.asyncio
async def test_delete_lesson_blocked_when_progress_exists(client, db):
    m = await _module(db, order=14, name="M14")
    tok = await _teacher_token(client, email="cl4@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Ilerlemeli", "estimated_minutes": 10})
    lid = r.json()["id"]
    # çocuk + ilerleme
    await client.post("/auth/parent/signup", json={
        "email": "clp@t.com", "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu",
    })
    child = (await db.execute(select(ChildProfile))).scalars().first()
    db.add(ChildLessonProgress(child_id=child.id, lesson_id=lid, status=LessonStatus.completed))
    await db.commit()

    r2 = await client.delete(f"/admin/lessons/{lid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 409
    assert (await db.get(Lesson, lid)) is not None  # silinmedi


@pytest.mark.asyncio
async def test_delete_lesson_without_progress_ok(client, db):
    m = await _module(db, order=15, name="M15")
    tok = await _teacher_token(client, email="cl5@t.com")
    r = await client.post(f"/admin/modules/{m.id}/lessons",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"title": "Bos Ders", "estimated_minutes": 10})
    lid = r.json()["id"]
    db.add(LessonStep(lesson_id=lid, order_index=1, type=LessonStepType.explanation,
                      content_json={"title": "t", "body": "b"}))
    await db.commit()
    r2 = await client.delete(f"/admin/lessons/{lid}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert (await db.get(Lesson, lid)) is None
    # adımları da gitti
    cnt = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lid)
    )).scalar_one()
    assert cnt == 0


@pytest.mark.asyncio
async def test_admin_lessons_list_shows_drafts(client, db):
    m = await _module(db, order=16, name="M16")
    tok = await _teacher_token(client, email="cl6@t.com")
    await client.post(f"/admin/modules/{m.id}/lessons",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"title": "Taslak Ders", "estimated_minutes": 10})
    r = await client.get(f"/admin/modules/{m.id}/lessons",
                         headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert any(x["title"] == "Taslak Ders" for x in r.json())
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_lessons.py -q`
Expected: FAIL (endpoint'ler yok)

- [ ] **Step 3: Ders endpoint'lerini ekle**

`apps/api/chess_api/routers/admin.py` — import bloğuna ekle (models):

```python
from chess_api.models.progress import ChildLessonProgress, LessonStatus, ChildLessonStepResult
```

Not: `ChildLessonProgress` ve `LessonStatus` zaten import edilmiş; sadece `ChildLessonStepResult` eklenir.

Dosyanın sonuna ekle:

```python
def _lesson_out(les: Lesson, step_count: int) -> dict:
    return {"id": les.id, "module_id": les.module_id, "order_index": les.order_index,
            "title": les.title, "estimated_minutes": les.estimated_minutes,
            "published": les.published, "step_count": step_count}


@router.post("/modules/{module_id}/lessons", status_code=201)
async def create_lesson(
    module_id: int,
    payload: LessonCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    max_order = (await db.execute(
        select(func.max(Lesson.order_index)).where(Lesson.module_id == module_id)
    )).scalar_one_or_none() or 0
    lesson = Lesson(module_id=module_id, order_index=max_order + 1, title=payload.title,
                    estimated_minutes=payload.estimated_minutes, published=False)
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson, 0)


@router.patch("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: int,
    payload: LessonUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if payload.title is not None:
        lesson.title = payload.title
    if payload.estimated_minutes is not None:
        lesson.estimated_minutes = payload.estimated_minutes
    if payload.module_id is not None and payload.module_id != lesson.module_id:
        target = await db.get(Module, payload.module_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target module not found")
        max_order = (await db.execute(
            select(func.max(Lesson.order_index)).where(Lesson.module_id == payload.module_id)
        )).scalar_one_or_none() or 0
        lesson.module_id = payload.module_id
        lesson.order_index = max_order + 1
    await db.commit()
    await db.refresh(lesson)
    sc = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lesson.id)
    )).scalar_one()
    return _lesson_out(lesson, sc)


@router.post("/lessons/{lesson_id}/publish")
async def publish_lesson(
    lesson_id: int,
    payload: LessonPublishRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.published = payload.published
    await db.commit()
    await db.refresh(lesson)
    sc = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lesson.id)
    )).scalar_one()
    return _lesson_out(lesson, sc)


@router.post("/modules/{module_id}/lessons/reorder")
async def reorder_lessons(
    module_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lessons = (await db.execute(
        select(Lesson).where(Lesson.id.in_(payload.ordered_ids), Lesson.module_id == module_id)
    )).scalars().all()
    by_id = {l.id: l for l in lessons}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown lesson id")
    for i, lid in enumerate(payload.ordered_ids):
        by_id[lid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """İlerlemesi olan ders SİLİNMEZ — yayından kaldırılır. Çocuk emeği korunur."""
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    prog = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == lesson_id)
    )).scalar_one()
    step_ids = (await db.execute(
        select(LessonStep.id).where(LessonStep.lesson_id == lesson_id)
    )).scalars().all()
    results = 0
    if step_ids:
        results = (await db.execute(
            select(func.count(ChildLessonStepResult.id)).where(
                ChildLessonStepResult.lesson_step_id.in_(step_ids)
            )
        )).scalar_one()
    if prog or results:
        raise HTTPException(
            status_code=409,
            detail="Bu derse ait çocuk ilerlemesi var. Silmek yerine yayından kaldırabilirsiniz.",
        )

    await db.execute(delete(LessonStep).where(LessonStep.lesson_id == lesson_id))
    await db.delete(lesson)
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 4: Admin ders listesi `published` döndürsün**

Aynı dosyada mevcut `module_lessons` (admin) fonksiyonunu bul:

```python
        out.append(AdminLessonSummary(
            id=les.id, order_index=les.order_index, title=les.title,
            estimated_minutes=les.estimated_minutes, step_count=sc,
        ))
```

Bu satırların bulunduğu fonksiyonun tamamını şununla değiştir (response_model değişiyor):

```python
@router.get("/modules/{module_id}/lessons", response_model=list[AdminLessonDetail])
async def module_lessons(
    module_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    lessons = (await db.execute(
        select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.order_index)
    )).scalars().all()
    out = []
    for les in lessons:
        sc = (await db.execute(
            select(func.count(LessonStep.id)).where(LessonStep.lesson_id == les.id)
        )).scalar_one()
        out.append(AdminLessonDetail(
            id=les.id, module_id=les.module_id, order_index=les.order_index, title=les.title,
            estimated_minutes=les.estimated_minutes, published=les.published, step_count=sc,
        ))
    return out
```

- [ ] **Step 5: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_cms_lessons.py -q`
Expected: PASS (8 test)

- [ ] **Step 6: Tam suite (regresyon — özellikle Parça 0 export/import)**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS

- [ ] **Step 7: Commit + push (Railway deploy + migration)**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_cms_lessons.py
git commit -m "feat(api): ders CRUD + publish + düzey taşıma + silme koruması"
git push origin main
```

- [ ] **Step 8: Canlı doğrulama (migration çalıştı mı, mevcut ders yayında mı)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"cms_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "-- admin ders listesi (published alanı gelmeli) --"
curl -s "$API/admin/modules/1/lessons" -H "Authorization: Bearer $TOK"
echo
echo "-- çocuk tarafı (mevcut ders HÂLÂ görünmeli) --"
curl -s "$API/modules/1/lessons"
```
Expected: admin yanıtında `"published":true`; çocuk yanıtında mevcut "Tahta ve Taşlar" dersi **hâlâ var** (server_default çalıştı).

---

## Task 6: Frontend — Düzey yönetimi

**Files:**
- Modify: `apps/web/app/admin/content/page.tsx`

- [ ] **Step 1: Düzey ekleme formu ve silme ekle**

`apps/web/app/admin/content/page.tsx` — mevcut state'lerin altına ekle:

```typescript
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setRows(await r.json());
  }

  async function addModule() {
    if (newName.trim().length < 1) return;
    setAdding(true);
    setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), description: '', icon: 'default' }),
      });
      if (!r.ok) { setMsg('Düzey eklenemedi'); setAdding(false); return; }
      setNewName('');
      await refresh();
      setMsg('Düzey eklendi');
    } catch {
      setMsg('Düzey eklenemedi');
    }
    setAdding(false);
  }

  async function deleteModule(id: number, name: string) {
    if (!confirm(`"${name}" düzeyini silmek istiyor musun?`)) return;
    setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 409) { setMsg('Bu düzeyde ders var. Önce dersleri taşıyın veya silin.'); return; }
      if (!r.ok) { setMsg('Silinemedi'); return; }
      await refresh();
      setMsg('Düzey silindi');
    } catch {
      setMsg('Silinemedi');
    }
  }
```

- [ ] **Step 2: Formu ve sil butonunu render et**

Mevcut indir/yükle butonlarının bulunduğu `<div className="flex flex-wrap items-center gap-3 mb-5">` bloğunun HEMEN ALTINA ekle:

```tsx
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yeni düzey adı (örn. İleri Düzey)"
          className="neon-input max-w-xs"
        />
        <button onClick={addModule} disabled={adding || newName.trim().length < 1}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          {adding ? 'Ekleniyor...' : 'Düzey ekle'}
        </button>
      </div>
```

Mevcut modül kartındaki `<span className={`neon-pill ${accent}`}>{m.lesson_count} ders →</span>` satırını şununla değiştir:

```tsx
                <span className={`neon-pill ${accent}`}>{m.lesson_count} ders →</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteModule(m.id, m.name); }}
                  aria-label={`${m.name} düzeyini sil`}
                  className="ml-2 px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors"
                >
                  Sil
                </button>
```

- [ ] **Step 3: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/content/page.tsx
git commit -m "feat(web): admin düzey ekle/sil"
```

---

## Task 7: Frontend — Ders yönetimi

**Files:**
- Modify: `apps/web/app/admin/content/[id]/page.tsx`

- [ ] **Step 1: Sayfayı ders yönetimiyle güncelle**

`apps/web/app/admin/content/[id]/page.tsx` dosyasını tamamen şununla değiştir:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LessonRow {
  id: number;
  module_id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
  published: boolean;
  step_count: number;
}

interface ModuleRow { id: number; order_index: number; name: string; lesson_count: number; }

export default function AdminModuleLessonsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/modules/${id}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) { setNotFound(true); setLoading(false); return; }
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const token = getToken();
    fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setModules(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [refresh]);

  async function addLesson() {
    if (newTitle.trim().length < 1) return;
    setBusy(true); setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules/${id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim(), estimated_minutes: 10 }),
      });
      if (!r.ok) { setMsg('Ders eklenemedi'); setBusy(false); return; }
      setNewTitle('');
      await refresh();
      setMsg('Ders eklendi (taslak)');
    } catch { setMsg('Ders eklenemedi'); }
    setBusy(false);
  }

  async function togglePublish(les: LessonRow) {
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ published: !les.published }),
    });
    if (!r.ok) { setMsg('İşlem başarısız'); return; }
    await refresh();
  }

  async function moveLesson(les: LessonRow, moduleId: number) {
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ module_id: moduleId }),
    });
    if (!r.ok) { setMsg('Taşınamadı'); return; }
    await refresh();
    setMsg('Ders taşındı');
  }

  async function deleteLesson(les: LessonRow) {
    if (!confirm(`"${les.title}" dersini silmek istiyor musun?`)) return;
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 409) {
      setMsg('Bu derse ait çocuk ilerlemesi var. Silinemez — yayından kaldırabilirsin.');
      return;
    }
    if (!r.ok) { setMsg('Silinemedi'); return; }
    await refresh();
    setMsg('Ders silindi');
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;
  if (notFound) return <p className="text-rose-400">Düzey bulunamadı.</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text">Dersler</h1>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Yeni ders başlığı"
          className="neon-input max-w-xs"
        />
        <button onClick={addLesson} disabled={busy || newTitle.trim().length < 1}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          Ders ekle
        </button>
        {msg && <span className="text-sm n-muted">{msg}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="n-muted">Bu düzeyde henüz ders yok.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((les, i) => {
            const accent = accents[i % accents.length];
            return (
              <div key={les.id} className={`neon-card ${accent} flex flex-wrap items-center gap-3 p-4`}>
                <span className={`neon-avatar ${accent} w-11 h-11 text-sm shrink-0`}>{les.order_index}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text truncate">{les.title}</p>
                  <p className="text-xs n-muted">{les.estimated_minutes} dk · {les.step_count} adım</p>
                </div>
                <span className={les.published
                  ? 'neon-pill neon-green'
                  : 'neon-pill neon-amber'}>
                  {les.published ? 'Yayında' : 'Taslak'}
                </span>
                <button onClick={() => togglePublish(les)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-xs transition-colors">
                  {les.published ? 'Yayından kaldır' : 'Yayınla'}
                </button>
                <select
                  value={les.module_id}
                  onChange={(e) => moveLesson(les, Number(e.target.value))}
                  aria-label={`${les.title} dersini taşı`}
                  className="neon-input py-1.5 text-xs max-w-[10rem]"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button onClick={() => deleteLesson(les)}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors">
                  Sil
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 3: Commit + push (Vercel deploy)**

```bash
git add "apps/web/app/admin/content/[id]/page.tsx"
git commit -m "feat(web): admin ders ekle/yayınla/taşı/sil"
git push origin main
```

---

## Task 8: Canlı uçtan uca doğrulama

**Files:** yok

- [ ] **Step 1: Mevcut içerik bozulmadı mı (EN KRİTİK)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
echo "-- çocuk tarafı: mevcut 'Tahta ve Taşlar' dersi hâlâ görünüyor mu --"
curl -s "$API/modules/1/lessons"
```
Expected: `[{"id":42,"order_index":1,"title":"Tahta ve Taşlar",...}]` — migration mevcut dersi yayında bıraktı.

- [ ] **Step 2: Yeni ders taslak başlıyor ve çocukta görünmüyor**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"cmsx_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
LID=$(curl -s -X POST "$API/admin/modules/2/lessons" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"title":"Test Taslak","estimated_minutes":10}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "-- çocuk tarafı (Test Taslak GÖRÜNMEMELİ) --"
curl -s "$API/modules/2/lessons"
echo
echo "-- yayınla --"
curl -s -X POST "$API/admin/lessons/$LID/publish" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"published":true}' -o /dev/null -w "%{http_code}\n"
echo "-- çocuk tarafı (artık GÖRÜNMELİ) --"
curl -s "$API/modules/2/lessons"
echo
echo "-- temizlik: test dersini sil --"
curl -s -X DELETE "$API/admin/lessons/$LID" -H "Authorization: Bearer $TOK"
```
Expected: taslakken liste boş `[]`; yayınlandıktan sonra "Test Taslak" görünür; silme `{"deleted":true}`.

- [ ] **Step 3: Tarayıcıda panel doğrulama**

Öğretmen hesabıyla canlı sitede `/admin/content` → "Düzey ekle" çalışıyor; bir düzeye girip "Ders ekle" → ders **Taslak** rozetiyle geliyor; "Yayınla" tıklanınca **Yayında** oluyor; taşıma açılır menüsü dersi başka düzeye taşıyor. Konsol hatası yok.

---

## Self-Review Notu

- **Spec kapsamı (1a):** migration + server_default (T1), çocuk tarafı filtresi (T2), şemalar (T3), Düzey CRUD + iki aşamalı sıralama (T4), Ders CRUD/publish/taşıma/silme koruması (T5), frontend düzey (T6) + ders (T7), canlı doğrulama (T8) — hepsi karşılandı. Adım editörü bilinçli olarak 1b'de.
- **Kritik kısıtlar karşılandı:** `modules.order_index` UNIQUE → T4'te iki aşamalı yazım + bunu doğrulayan test. İlerlemesi olan ders → T5'te 409 + test. `server_default='true'` → T2'de test + T8'de canlı doğrulama.
- **Tip tutarlılığı:** `AdminLessonDetail` (T3) alanları `_lesson_out` (T5) ve frontend `LessonRow` (T7) ile birebir: id, module_id, order_index, title, estimated_minutes, published, step_count.
- **Çakışma kontrolü:** T5 Step 4, mevcut admin `module_lessons` fonksiyonunu (`AdminLessonSummary` döndüren) `AdminLessonDetail` döndürecek şekilde değiştiriyor. Bu, T7 frontend'inin beklediği şekil.
- **Migration guard uyumlu:** add_column TRUNCATE/DELETE içermiyor → T1 Step 3 bunu doğrular.
- **Deploy sırası:** backend+migration (T5 Step 7) → frontend (T7 Step 3).
