# Özel Sekme Oluşturucu (B Grubu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'nın panelden sınırsız sayıda yeni sekme oluşturabildiği, her sekmenin başlık+yazı+görsel bölümlerinden oluşan kendi sayfasının olduğu, sporcu ana sayfasında bu sekmelerin kart olarak görünüp kendi sayfasına yönlendirdiği bir sistem kurmak — eski "hazır sayfaya kısayol" özelliğinin tamamen yerine.

**Architecture:** Backend'de iki yeni tablo (`custom_tabs`, `custom_tab_sections`) ve bunlara karşılık gelen bir herkese-açık okuma router'ı (`custom_tabs.py`, `pool_images.py`/`openings.py` ile aynı desen) + `admin.py` içinde admin CRUD uç noktaları. Frontend'de admin tarafında sekme listesi + ekle (`admin/settings/tabs/page.tsx` güncellemesi) ve bölüm yönetimi (`admin/custom-tabs/[id]/page.tsx`, yeni), sporcu tarafında ana sayfa kartı (`(child)/home/page.tsx` güncellemesi) ve görüntüleme sayfası (`(child)/custom/[id]/page.tsx`, yeni).

**Tech Stack:** Next.js 15 (apps/web), FastAPI + SQLAlchemy async + Alembic (apps/api), Vitest + Testing Library, pytest + httpx AsyncClient.

---

### Task 1: Backend modelleri — `CustomTab`, `CustomTabSection`

**Files:**
- Create: `apps/api/chess_api/models/custom_tab.py`
- Modify: `apps/api/chess_api/models/__init__.py`
- Test: `apps/api/tests/test_custom_tabs.py` (yeni dosya, bu plandaki tüm backend testleri burada toplanır)

- [ ] **Step 1: Write the failing test**

```python
def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images"}
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/api`): `python -m pytest tests/test_custom_tabs.py -v`
Expected: FAIL — `CustomTab` `chess_api.models`'da yok (ImportError)

- [ ] **Step 3: Write minimal implementation**

`apps/api/chess_api/models/custom_tab.py`:

```python
from sqlalchemy import String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class CustomTab(Base):
    """Zafer hoca'nin ekledigi ozel sekme — kendi sayfasi olan sinirsiz-sayida
    sekme (B grubu). Eski "hazir sayfaya kisayol" ozelliginin yerine gecer."""

    __tablename__ = "custom_tabs"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(60))
    emoji: Mapped[str] = mapped_column(String(10))


class CustomTabSection(Base):
    """Bir ozel sekmenin sayfasindaki tek bir bolum — baslik + yazi + gorseller."""

    __tablename__ = "custom_tab_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    custom_tab_id: Mapped[int] = mapped_column(ForeignKey("custom_tabs.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
```

`apps/api/chess_api/models/__init__.py`'a ekle (mevcut `from chess_api.models.opening import Opening` satırının altına):

```python
from chess_api.models.custom_tab import CustomTab, CustomTabSection
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_custom_tabs.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/models/custom_tab.py apps/api/chess_api/models/__init__.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): CustomTab ve CustomTabSection modelleri"
```

---

### Task 2: Migration

**Files:**
- Create: `apps/api/alembic/versions/20260803_CustomTabs_add.py`

- [ ] **Step 1: Write the migration**

```python
"""custom_tabs ve custom_tab_sections tablolari — ozel sekme olusturucu (B grubu)

Revision ID: CustomTabs
Revises: BotGameColor

Yalnizca YENI tablolar olusturur. Mevcut hicbir tabloya/sutuna/veriye dokunmaz
(KURAL #3). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "CustomTabs"
down_revision = "BotGameColor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_tabs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=60), nullable=False),
        sa.Column("emoji", sa.String(length=10), nullable=False),
    )
    op.create_table(
        "custom_tab_sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("custom_tab_id", sa.Integer(), sa.ForeignKey("custom_tabs.id"), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("images", sa.JSON(), nullable=False),
    )
    op.create_index("ix_custom_tab_sections_custom_tab_id", "custom_tab_sections", ["custom_tab_id"])


def downgrade() -> None:
    op.drop_index("ix_custom_tab_sections_custom_tab_id", table_name="custom_tab_sections")
    op.drop_table("custom_tab_sections")
    op.drop_table("custom_tabs")
```

- [ ] **Step 2: Run migration to verify it applies**

Run (in `apps/api`): `python -m alembic upgrade head`
Expected: `CustomTabs` revizyonu hatasız uygulanır; `python -m alembic heads` artık `CustomTabs (head)` gösterir.

- [ ] **Step 3: Commit**

```bash
git add apps/api/alembic/versions/20260803_CustomTabs_add.py
git commit -m "feat(api): custom_tabs/custom_tab_sections migration"
```

---

### Task 3: Herkese açık okuma uç noktaları — `GET /custom-tabs`, `GET /custom-tabs/{id}`

**Files:**
- Create: `apps/api/chess_api/routers/custom_tabs.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_custom_tabs.py`

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_bos_liste_bos_dizi_doner(client):
    r = await client.get("/custom-tabs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_olmayan_sekme_404_doner(client):
    r = await client.get("/custom-tabs/999999")
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_custom_tabs.py -v -k "bos_liste or olmayan_sekme"`
Expected: FAIL — 404 Not Found (route hiç yok)

- [ ] **Step 3: Write minimal implementation**

`apps/api/chess_api/routers/custom_tabs.py`:

```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.custom_tab import CustomTab, CustomTabSection

router = APIRouter(tags=["custom-tabs"])


@router.get("/custom-tabs")
async def list_custom_tabs(db: AsyncSession = Depends(get_db)):
    """Ana sayfa hızlı erişim için hafif liste — görsel/bölüm içermez.

    Kimlik doğrulaması gerekmez (/openings ve /pool-images ile aynı desen)."""
    rows = (await db.execute(
        select(CustomTab).order_by(CustomTab.order_index)
    )).scalars().all()
    return [{"id": t.id, "order_index": t.order_index, "label": t.label, "emoji": t.emoji} for t in rows]


@router.get("/custom-tabs/{tab_id}")
async def get_custom_tab(tab_id: int, db: AsyncSession = Depends(get_db)):
    """Bir sekmenin tüm bölümlerini (görsellerle) döner — sekme sayfası açılınca çağrılır."""
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    sections = (await db.execute(
        select(CustomTabSection).where(CustomTabSection.custom_tab_id == tab_id)
        .order_by(CustomTabSection.order_index)
    )).scalars().all()
    return {
        "id": tab.id, "label": tab.label, "emoji": tab.emoji,
        "sections": [
            {"id": s.id, "order_index": s.order_index, "title": s.title, "body": s.body, "images": s.images}
            for s in sections
        ],
    }
```

`apps/api/chess_api/main.py`'da import satırına ekle (mevcut uzun import satırının sonuna, `athletes as athletes_router`'dan sonra):

```python
, custom_tabs as custom_tabs_router
```

`app.include_router(athletes_router.router)` satırının altına ekle:

```python
    app.include_router(custom_tabs_router.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_custom_tabs.py -v`
Expected: PASS (4 tests toplam)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/custom_tabs.py apps/api/chess_api/main.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): GET /custom-tabs ve /custom-tabs/{id}"
```

---

### Task 4: Admin CRUD — sekmeler (`POST/DELETE/reorder /admin/custom-tabs`)

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_custom_tabs.py`

- [ ] **Step 1: Write the failing test**

```python
async def _teacher_token(client, email="ct@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_sekme_ekler_emoji_otomatik_atanir(client):
    tok = await _teacher_token(client, "ct1@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "Turnuvalar"})
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Turnuvalar"
    assert body["emoji"] == "📌"  # ilk sekme -> listedeki 0. emoji


@pytest.mark.asyncio
async def test_ikinci_sekme_farkli_emoji_alir(client):
    tok = await _teacher_token(client, "ct2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/custom-tabs", headers=h, json={"label": "Birinci"})
    r = await client.post("/admin/custom-tabs", headers=h, json={"label": "İkinci"})
    assert r.json()["emoji"] == "⭐"


@pytest.mark.asyncio
async def test_tokensiz_sekme_ekleme_engellenir(client):
    r = await client.post("/admin/custom-tabs", json={"label": "Turnuvalar"})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_bos_etiketle_sekme_reddedilir(client):
    tok = await _teacher_token(client, "ct3@t.com")
    r = await client.post("/admin/custom-tabs", headers={"Authorization": f"Bearer {tok}"},
                          json={"label": "  "})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_sekme_silinince_bolumleri_de_silinir(client):
    tok = await _teacher_token(client, "ct4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = await client.post("/admin/custom-tabs", headers=h, json={"label": "Silinecek"})
    tab_id = tab.json()["id"]
    await client.post(f"/admin/custom-tabs/{tab_id}/sections", headers=h,
                      json={"title": "Bölüm 1", "body": "metin", "images": []})

    r = await client.delete(f"/admin/custom-tabs/{tab_id}", headers=h)
    assert r.status_code == 200

    listing = await client.get("/custom-tabs")
    assert tab_id not in [t["id"] for t in listing.json()]
    detail = await client.get(f"/custom-tabs/{tab_id}")
    assert detail.status_code == 404


@pytest.mark.asyncio
async def test_sekme_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "ct5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    a = (await client.post("/admin/custom-tabs", headers=h, json={"label": "A"})).json()
    b = (await client.post("/admin/custom-tabs", headers=h, json={"label": "B"})).json()

    r = await client.post("/admin/custom-tabs/reorder", headers=h,
                          json={"ordered_ids": [b["id"], a["id"]]})
    assert r.status_code == 200

    listing = (await client.get("/custom-tabs")).json()
    assert [t["id"] for t in listing] == [b["id"], a["id"]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_custom_tabs.py -v -k "ct1 or ikinci_sekme or tokensiz_sekme or bos_etiketle or silinince or siralamasi"`
Expected: FAIL — 404 Not Found (uç noktalar hiç yok)

- [ ] **Step 3: Write minimal implementation**

`apps/api/chess_api/routers/admin.py`'da import satırına ekle (mevcut `from chess_api.models.pool_image import PoolImage` satırının altına):

```python
from chess_api.models.custom_tab import CustomTab, CustomTabSection
```

Dosyanın sonuna (mevcut `/pool-images` uç noktalarının altına) ekle:

```python
CUSTOM_TAB_EMOJIS = ["📌", "⭐", "🎯", "📢", "🗂️", "🧭", "💡", "🔔"]


class CustomTabCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=60)


class CustomTabSectionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = ""
    images: list[str] = []


class CustomTabSectionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = None
    images: list[str] | None = None


@router.post("/custom-tabs", status_code=201)
async def create_custom_tab(
    payload: CustomTabCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    count = (await db.execute(select(func.count(CustomTab.id)))).scalar_one()
    max_order = (await db.execute(select(func.max(CustomTab.order_index)))).scalar_one_or_none() or 0
    tab = CustomTab(
        order_index=max_order + 1, label=payload.label,
        emoji=CUSTOM_TAB_EMOJIS[count % len(CUSTOM_TAB_EMOJIS)],
    )
    db.add(tab)
    await db.commit()
    await db.refresh(tab)
    return {"id": tab.id, "order_index": tab.order_index, "label": tab.label, "emoji": tab.emoji}


@router.delete("/custom-tabs/{tab_id}")
async def delete_custom_tab(
    tab_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sekmeyi ve tüm bölümlerini siler. Sporcu ilerlemesi bu tabloya bağlı
    olmadığı için (yalnızca içerik metni), engelsiz cascade güvenlidir."""
    _ensure_admin(current)
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    await db.execute(delete(CustomTabSection).where(CustomTabSection.custom_tab_id == tab_id))
    await db.delete(tab)
    await db.commit()
    return {"deleted": True}


@router.post("/custom-tabs/reorder")
async def reorder_custom_tabs(
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """order_index UNIQUE olmadığı için tek aşamalı yazım yeterli (modules'in
    aksine burada unique kısıt yok, ama aynı iki-aşamalı deseni izlemek zarar
    vermez ve gelecekte unique eklenirse hazır olur)."""
    _ensure_admin(current)
    tabs = (await db.execute(
        select(CustomTab).where(CustomTab.id.in_(payload.ordered_ids))
    )).scalars().all()
    by_id = {t.id: t for t in tabs}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown custom tab id")
    for i, tid in enumerate(payload.ordered_ids):
        by_id[tid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.post("/custom-tabs/{tab_id}/sections", status_code=201)
async def create_custom_tab_section(
    tab_id: int,
    payload: CustomTabSectionCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    for i, img in enumerate(payload.images):
        _check_data_uri_size(img, f"{i + 1}. görsel")
    max_order = (await db.execute(
        select(func.max(CustomTabSection.order_index)).where(CustomTabSection.custom_tab_id == tab_id)
    )).scalar_one_or_none() or 0
    section = CustomTabSection(
        custom_tab_id=tab_id, order_index=max_order + 1,
        title=payload.title, body=payload.body, images=payload.images,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images}
```

`chess_api/schemas/auth.py`'dan `ReorderRequest`'in zaten import edildiğini doğrula (`admin.py`'nin üstündeki `from chess_api.schemas.auth import (...)` bloğunda — değilse ekle). `Field` importunun `pydantic`'ten geldiğini doğrula (mevcut `from pydantic import BaseModel` satırını `from pydantic import BaseModel, Field` yap).

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_custom_tabs.py -v`
Expected: PASS (10 test toplam)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): admin sekme CRUD (ekle/sil/sırala)"
```

---

### Task 5: Admin CRUD — bölümler (`PATCH/DELETE/reorder /admin/custom-tab-sections`)

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_custom_tabs.py`

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_bolum_guncellenir(client):
    tok = await _teacher_token(client, "cts1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Eski", "body": "eski metin", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"title": "Yeni", "body": "yeni metin"})
    assert r.status_code == 200
    assert r.json()["title"] == "Yeni"
    assert r.json()["body"] == "yeni metin"


@pytest.mark.asyncio
async def test_bolum_silinir(client):
    tok = await _teacher_token(client, "cts2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Bölüm", "body": "x", "images": []})).json()

    r = await client.delete(f"/admin/custom-tab-sections/{section['id']}", headers=h)
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"] == []


@pytest.mark.asyncio
async def test_bolum_siralamasi_degistirilebilir(client):
    tok = await _teacher_token(client, "cts3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    s1 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S1", "body": "", "images": []})).json()
    s2 = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                            json={"title": "S2", "body": "", "images": []})).json()

    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections/reorder", headers=h,
                          json={"ordered_ids": [s2["id"], s1["id"]]})
    assert r.status_code == 200

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert [s["id"] for s in detail["sections"]] == [s2["id"], s1["id"]]


@pytest.mark.asyncio
async def test_cok_buyuk_bolum_gorseli_reddedilir(client):
    tok = await _teacher_token(client, "cts4@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Sekme"})).json()
    huge = "data:image/png;base64," + ("A" * 400_001)
    r = await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                          json={"title": "Bölüm", "body": "", "images": [huge]})
    assert r.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_custom_tabs.py -v -k "bolum_guncellenir or bolum_silinir or bolum_siralamasi or cok_buyuk_bolum"`
Expected: FAIL — 404 Not Found (uç noktalar hiç yok)

- [ ] **Step 3: Write minimal implementation**

`admin.py`'a (Task 4'te eklenen `create_custom_tab_section`'ın altına) ekle:

```python
@router.patch("/custom-tab-sections/{section_id}")
async def update_custom_tab_section(
    section_id: int,
    payload: CustomTabSectionUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    section = await db.get(CustomTabSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if payload.title is not None:
        section.title = payload.title
    if payload.body is not None:
        section.body = payload.body
    if payload.images is not None:
        for i, img in enumerate(payload.images):
            _check_data_uri_size(img, f"{i + 1}. görsel")
        section.images = payload.images
    await db.commit()
    await db.refresh(section)
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images}


@router.delete("/custom-tab-sections/{section_id}")
async def delete_custom_tab_section(
    section_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    section = await db.get(CustomTabSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()
    return {"deleted": True}


@router.post("/custom-tabs/{tab_id}/sections/reorder")
async def reorder_custom_tab_sections(
    tab_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    sections = (await db.execute(
        select(CustomTabSection).where(
            CustomTabSection.id.in_(payload.ordered_ids),
            CustomTabSection.custom_tab_id == tab_id,
        )
    )).scalars().all()
    by_id = {s.id: s for s in sections}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown section id")
    for i, sid in enumerate(payload.ordered_ids):
        by_id[sid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_custom_tabs.py -v`
Expected: PASS (14 test toplam)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): admin bölüm CRUD (güncelle/sil/sırala)"
```

---

### Task 6: Frontend — `defaults.ts` temizliği + `customTabsApi.ts` istemcisi

**Files:**
- Modify: `apps/web/lib/settings/defaults.ts`
- Create: `apps/web/lib/customTabsApi.ts`
- Test: `apps/web/tests/custom-tabs-api.test.ts` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCustomTabs, getCustomTab } from '@/lib/customTabsApi';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('customTabsApi', () => {
  it('listCustomTabs GET /custom-tabs çağırır ve listeyi döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve([{ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' }]),
    });
    const result = await listCustomTabs();
    expect(result).toEqual([{ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' }]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/custom-tabs'));
  });

  it('listCustomTabs başarısız olursa boş dizi döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    expect(await listCustomTabs()).toEqual([]);
  });

  it('getCustomTab GET /custom-tabs/{id} çağırır ve detayı döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve({ id: 1, label: 'Turnuvalar', emoji: '📌', sections: [] }),
    });
    const result = await getCustomTab(1);
    expect(result).toEqual({ id: 1, label: 'Turnuvalar', emoji: '📌', sections: [] });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/custom-tabs/1'));
  });

  it('getCustomTab bulunamazsa null döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    expect(await getCustomTab(999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/web`): `npx vitest run tests/custom-tabs-api.test.ts`
Expected: FAIL — module not found (`@/lib/customTabsApi`)

- [ ] **Step 3: Write minimal implementation**

`apps/web/lib/customTabsApi.ts`:

```ts
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface CustomTabSummary {
  id: number;
  order_index: number;
  label: string;
  emoji: string;
}

export interface CustomTabSection {
  id: number;
  order_index: number;
  title: string;
  body: string;
  images: string[];
}

export interface CustomTabDetail {
  id: number;
  label: string;
  emoji: string;
  sections: CustomTabSection[];
}

export async function listCustomTabs(): Promise<CustomTabSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/custom-tabs`);
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function getCustomTab(id: number): Promise<CustomTabDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/custom-tabs/${id}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function createCustomTab(label: string): Promise<CustomTabSummary | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteCustomTab(id: number): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function createCustomTabSection(
  tabId: number, title: string, body: string, images: string[],
): Promise<CustomTabSection | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${tabId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, body, images }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function updateCustomTabSection(
  sectionId: number, patch: { title?: string; body?: string; images?: string[] },
): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tab-sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteCustomTabSection(sectionId: number): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tab-sections/${sectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
```

`apps/web/lib/settings/defaults.ts`'ten kaldır: `CustomTab` arayüzü (satır 27-32), `customTabs: CustomTab[];` alanı (`AppSettingsData` içinde), `customTabs: [],` satırı (`DEFAULT_SETTINGS` içinde), `TAB_DESTINATIONS` sabiti (satır 34-44). Sonuç dosya:

```ts
// Sporcu paneli global ayarları — tip + varsayılanlar + derin birleştirme.
// Sunucudan gelen ayar eksik/boşsa bu varsayılanlar (bugünkü görünüm) kullanılır (fail-safe).

export interface AppSettingsData {
  labels: {
    levels: Record<string, string>;      // "1".."4"
    features: { play: string; lessons: string; analiz: string; eglence: string };
    sections: { quickAccess: string; lessonsPick: string };
  };
  tabs: { play: boolean; lessons: boolean; analiz: boolean; eglence: boolean };
  /** Sekmelerin sporcu ekranındaki sırası (admin sürükleyip değiştirebilir). */
  tabOrder: TabKey[];
  board: {
    lightSquare: string;
    darkSquare: string;
    pieces: Record<string, string>;      // wK..bP → data-URI; yoksa gömülü SVG
  };
}

export type TabKey = 'play' | 'lessons' | 'analiz' | 'eglence';

/** Uygulamada içeriği olan sekmeler — admin bunları ekleyip/kaldırıp sıralayabilir. */
export const ALL_TABS: TabKey[] = ['play', 'lessons', 'analiz', 'eglence'];

export const DEFAULT_SETTINGS: AppSettingsData = {
  labels: {
    levels: { '1': 'Temel Düzey', '2': 'Başlangıç Düzeyi', '3': 'Orta Düzey', '4': 'İleri Düzey' },
    features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
    sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Dersler — Düzey Seç' },
  },
  tabs: { play: true, lessons: true, analiz: true, eglence: true },
  tabOrder: ['play', 'lessons', 'analiz', 'eglence'],
  board: {
    lightSquare: '#eef0fb',
    darkSquare: '#c3c6ee',
    pieces: {},
  },
};

/**
 * Sporcu ekranında gösterilecek sekmeleri, admin sırasına göre döndürür.
 * Fail-safe: tabOrder eksik/bozuksa varsayılan sıraya düşer, sırada olmayan
 * sekmeler sona eklenir (hiçbir sekme sessizce kaybolmaz).
 */
export function visibleTabsInOrder(s: AppSettingsData): TabKey[] {
  const raw = Array.isArray(s.tabOrder) ? s.tabOrder : [];
  const order = raw.filter((t): t is TabKey => ALL_TABS.includes(t as TabKey));
  const complete = [...order, ...ALL_TABS.filter((t) => !order.includes(t))];
  return complete.filter((t) => s.tabs?.[t] !== false);
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** remote'u DEFAULT üstüne derin birleştirir; eksik alanlar varsayılanda kalır. */
export function mergeSettings(remote: unknown): AppSettingsData {
  function merge(base: Json, inc: Json): Json {
    const out: Json = { ...base };
    for (const [k, v] of Object.entries(inc)) {
      if (isObj(v) && isObj(out[k])) out[k] = merge(out[k] as Json, v);
      else if (v !== undefined && v !== null) out[k] = v;
    }
    return out;
  }
  const base = DEFAULT_SETTINGS as unknown as Json;
  const merged = isObj(remote) ? merge(base, remote) : base;
  return merged as unknown as AppSettingsData;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/custom-tabs-api.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/customTabsApi.ts apps/web/lib/settings/defaults.ts apps/web/tests/custom-tabs-api.test.ts
git commit -m "feat: customTabsApi istemcisi + eski customTabs/TAB_DESTINATIONS temizliği"
```

---

### Task 7: Admin — "Yeni Sekme Ekle" kartının yeniden yazılması

**Files:**
- Modify: `apps/web/app/admin/settings/tabs/page.tsx`
- Modify: `apps/web/tests/admin-tabs-accordion.test.tsx`

- [ ] **Step 1: Write the failing test**

Mevcut `admin-tabs-accordion.test.tsx` dosyasına ekle (dosyanın sonuna, mevcut `describe` bloğunun kapanışından SONRA — mock'ları genişletmek gerekiyor, bu yüzden dosyanın en üstündeki `beforeEach`'i de güncelle):

Dosyanın başındaki `beforeEach` bloğunu değiştir:

```tsx
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  createCustomTab: vi.fn(() => Promise.resolve({ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' })),
  deleteCustomTab: vi.fn(() => Promise.resolve(true)),
}));

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
});
```

Dosyanın sonuna yeni `describe` bloğu ekle:

```tsx
describe('Admin Sekmeler — Yeni Sekme Ekle (B grubu)', () => {
  it('eski "Nereyi açsın?" seçici artık yok', async () => {
    await renderPage();
    expect(screen.queryByText('Nereyi açsın?')).not.toBeInTheDocument();
  });

  it('sadece ad girip Ekle ile yeni sekme oluşturulur', async () => {
    const { createCustomTab } = await import('@/lib/customTabsApi');
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText('örn. Bulmacalar'), { target: { value: 'Turnuvalar' } });
    fireEvent.click(screen.getByText('Ekle'));
    await waitFor(() => expect(createCustomTab).toHaveBeenCalledWith('Turnuvalar'));
  });

  it('eklenen sekmenin yanında "İçeriği düzenle" linki vardır', async () => {
    const { listCustomTabs } = await import('@/lib/customTabsApi');
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
    ]);
    await renderPage();
    await waitFor(() => screen.getByText('Turnuvalar'));
    const link = screen.getByText('İçeriği düzenle').closest('a');
    expect(link).toHaveAttribute('href', '/admin/custom-tabs/1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-tabs-accordion.test.tsx`
Expected: FAIL — yeni testler; "Nereyi açsın?" hâlâ ekranda, `createCustomTab` çağrılmıyor

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/settings/tabs/page.tsx`'te değişiklikler:

Import satırlarını güncelle:

```ts
import { DEFAULT_SETTINGS, mergeSettings, ALL_TABS } from '@/lib/settings/defaults';
import type { AppSettingsData, TabKey } from '@/lib/settings/defaults';
import { listCustomTabs, createCustomTab, deleteCustomTab } from '@/lib/customTabsApi';
import type { CustomTabSummary } from '@/lib/customTabsApi';
```

State ve veri çekmeyi değiştir — `customTabs` state tipini `CustomTabSummary[]` yap, `newDest` state'ini kaldır, `customTabs`'ı artık `/admin/settings`'ten değil `listCustomTabs()`'tan çek:

```ts
const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
const [newLabel, setNewLabel] = useState('');
```

`useEffect` içindeki ayar çekme bloğunun ALTINA (aynı `useEffect` içinde veya ayrı bir `useEffect`'te) ekle:

```ts
useEffect(() => {
  listCustomTabs().then(setCustomTabs);
}, []);
```

`addCustomTab`/`removeCustomTab` fonksiyonlarını değiştir:

```ts
async function addCustomTab() {
  const label = newLabel.trim();
  if (!label) { setMsg('Sekme adı gerekli'); return; }
  const created = await createCustomTab(label);
  if (!created) { setMsg('Eklenemedi'); return; }
  setCustomTabs((prev) => [...prev, created]);
  setNewLabel('');
  setMsg('Kaydedildi ✓');
}

async function removeCustomTab(id: number) {
  const ok = await deleteCustomTab(id);
  if (!ok) { setMsg('Silinemedi'); return; }
  setCustomTabs((prev) => prev.filter((c) => c.id !== id));
  setMsg('Kaydedildi ✓');
}
```

`persist` fonksiyonundaki `customTabs` parametresini ve `body` içindeki `customTabs: nextCustom` alanını kaldır (artık `/admin/settings`'e customTabs gönderilmiyor):

```ts
async function persist(nextTabs: AppSettingsData['tabs'], nextOrder: TabKey[]) {
  setSaving(true); setMsg(null);
  const token = getToken();
  const r = await fetch(`${API_BASE}/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tabs: nextTabs, tabOrder: nextOrder }),
  });
  setSaving(false);
  if (!r.ok) { setMsg('Kaydedilemedi'); return; }
  setMsg('Kaydedildi ✓');
  reload();
}
```

`move`/`setVisible` fonksiyonlarındaki `persist(...)` çağrılarından üçüncü argümanı (customTabs ile ilgili) kaldır (zaten yoktu, `persist(nextTabs, order)` / `persist(tabs, next)` şeklindeydi — değişmez).

"+ Yeni Sekme Ekle" kartının JSX'ini değiştir (mevcut `sm:grid-cols-[1fr_auto_auto]` bloğunu ve altındaki `customTabs.map` listesini):

```tsx
<div className="neon-card neon-green p-5 mb-8">
  <h2 className="font-bold mb-1 n-text">+ Yeni Sekme Ekle</h2>
  <p className="text-xs n-muted mb-4">
    Sekmeye bir ad ver. Kendi sayfası oluşur, içeriğini (başlık/yazı/görsel
    bölümleri) "İçeriği düzenle" linkinden doldurabilirsin.
  </p>
  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
    <div>
      <label className="text-xs n-muted block mb-1">Sekme adı</label>
      <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
        placeholder="örn. Bulmacalar" className="neon-input w-full" />
    </div>
    <button onClick={addCustomTab} disabled={!newLabel.trim()}
      className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm disabled:opacity-40 transition-colors">
      Ekle
    </button>
  </div>

  {customTabs.length > 0 && (
    <div className="grid gap-2 mt-4">
      {customTabs.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <span className="text-xl leading-none">{c.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold n-text">{c.label}</p>
          </div>
          <Link href={`/admin/custom-tabs/${c.id}`}
            className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-xs transition-colors">
            İçeriği düzenle
          </Link>
          <button onClick={() => removeCustomTab(c.id)}
            className="px-2.5 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
            Kaldır
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-tabs-accordion.test.tsx`
Expected: PASS (tüm testler — eski 13 + yeni 3)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/settings/tabs/page.tsx apps/web/tests/admin-tabs-accordion.test.tsx
git commit -m "feat: Yeni Sekme Ekle artık gerçek sayfa oluşturur (kısayol değil)"
```

---

### Task 8: Admin — bölüm yönetim ekranı `admin/custom-tabs/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/admin/custom-tabs/[id]/page.tsx`
- Test: `apps/web/tests/admin-custom-tab-sections.test.tsx` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({
  getCustomTab: vi.fn(),
  createCustomTabSection: vi.fn(),
  updateCustomTabSection: vi.fn(),
  deleteCustomTabSection: vi.fn(),
}));

import AdminCustomTabPage from '@/app/admin/custom-tabs/[id]/page';
import { getCustomTab, createCustomTabSection, deleteCustomTabSection } from '@/lib/customTabsApi';

const TAB = {
  id: 1, label: 'Turnuvalar', emoji: '📌',
  sections: [
    { id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'metin', images: [] },
  ],
};

beforeEach(() => {
  (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(TAB);
});

describe('Admin özel sekme bölüm yönetimi', () => {
  it('sekme başlığı ve mevcut bölüm görünür', async () => {
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
  });

  it('yeni bölüm eklenebilir', async () => {
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 11, order_index: 2, title: 'Yeni Bölüm', body: 'yeni metin', images: [],
    });
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));

    fireEvent.change(screen.getByPlaceholderText('Bölüm başlığı'), { target: { value: 'Yeni Bölüm' } });
    fireEvent.change(screen.getByPlaceholderText('Yazı'), { target: { value: 'yeni metin' } });
    fireEvent.click(screen.getByText('Bölüm ekle'));

    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(1, 'Yeni Bölüm', 'yeni metin', []));
  });

  it('bölüm silinebilir', async () => {
    (deleteCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Kayıt Şartları'));
    fireEvent.click(screen.getByLabelText('Kayıt Şartları bölümünü sil'));
    await waitFor(() => expect(deleteCustomTabSection).toHaveBeenCalledWith(10));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-custom-tab-sections.test.tsx`
Expected: FAIL — module not found (`@/app/admin/custom-tabs/[id]/page`)

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/custom-tabs/[id]/page.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCustomTab, createCustomTabSection, updateCustomTabSection, deleteCustomTabSection,
} from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { compressImageToDataUri } from '@/lib/imageCompress';

export default function AdminCustomTabPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const detail = await getCustomTab(tabId);
    setTab(detail);
    setLoading(false);
  }, [tabId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function onImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setNewImages((prev) => [...prev, ...compressed]);
  }

  async function addSection() {
    const title = newTitle.trim();
    if (!title) { setMsg('Bölüm başlığı gerekli'); return; }
    setBusy(true); setMsg(null);
    const created = await createCustomTabSection(tabId, title, newBody.trim(), newImages);
    setBusy(false);
    if (!created) { setMsg('Eklenemedi'); return; }
    setNewTitle(''); setNewBody(''); setNewImages([]);
    await refresh();
    setMsg('Bölüm eklendi ✓');
  }

  async function removeSection(sectionId: number) {
    const ok = await deleteCustomTabSection(sectionId);
    if (!ok) { setMsg('Silinemedi'); return; }
    await refresh();
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;
  if (!tab) return <p className="text-rose-400">Sekme bulunamadı.</p>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text">{tab.emoji} {tab.label}</h1>
      {msg && <p className="text-sm n-muted mb-3">{msg}</p>}

      {tab.sections.length === 0 ? (
        <p className="n-muted mb-6">Bu sekmede henüz bölüm yok. Aşağıdan ekle.</p>
      ) : (
        <div className="grid gap-3 mb-8">
          {tab.sections.map((s) => (
            <div key={s.id} className="neon-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text">{s.title}</p>
                  <p className="text-xs n-muted truncate">{s.body}</p>
                </div>
                <button onClick={() => removeSection(s.id)}
                  aria-label={`${s.title} bölümünü sil`}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Sil</button>
              </div>
              {s.images.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {s.images.map((uri, i) => (
                    <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                      style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="neon-card neon-cyan p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Bölüm ekle</h2>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Bölüm başlığı" className="neon-input mb-2" />
        <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
          placeholder="Yazı" rows={4} className="neon-input mb-3" />
        <input type="file" accept="image/*" multiple className="hidden" id="section-image-input"
          onChange={(e) => onImageFiles(e.target.files)} />
        <label htmlFor="section-image-input"
          className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer mb-3">
          Bilgisayardan Seç
        </label>
        {newImages.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {newImages.map((uri, i) => (
              <img key={i} src={uri} alt={`Yeni görsel ${i + 1}`}
                style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
            ))}
          </div>
        )}
        <button onClick={addSection} disabled={busy || !newTitle.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          Bölüm ekle
        </button>
      </div>
    </div>
  );
}
```

Not: `updateCustomTabSection` bu ilk sürümde UI'dan çağrılmıyor (Task planında sadece ekle/sil kapsandı — düzenleme, silip-yeniden-ekleme ile yapılabilir; bu YAGNI kararıdır, `customTabsApi.ts`'te fonksiyon zaten hazır, ileride bir "Düzenle" butonu eklemek tek satırlık iş olur).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-custom-tab-sections.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/custom-tabs/\[id\]/page.tsx apps/web/tests/admin-custom-tab-sections.test.tsx
git commit -m "feat: özel sekme bölüm yönetim ekranı"
```

---

### Task 9: Sporcu ana sayfası — özel sekme kartları

**Files:**
- Modify: `apps/web/app/(child)/home/page.tsx`
- Test: `apps/web/tests/home-play-modes.test.tsx` (mevcut dosyaya eklenir — bu dosya home sayfasını zaten test ediyor; yoksa yeni dosya `apps/web/tests/home-custom-tabs.test.tsx` oluştur)

- [ ] **Step 1: Write the failing test**

Yeni dosya `apps/web/tests/home-custom-tabs.test.tsx` — mock zinciri
`home-play-modes.test.tsx` dosyasındaki kanıtlanmış desenin BİREBİR aynısıdır
(`useSettings`, `visibleTabsInOrder`, `practiceApi`, `next/navigation`,
`auth-storage` — hepsi aynı şekilde mock'lanır, sadece `customTabsApi` mock'u
ve `fetch` stub'ı eklenir):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu', getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
      },
    },
  }),
}));
vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 5, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ])),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — özel sekme kartı (B grubu)', () => {
  it('özel sekme kartı görünür ve /custom/5 linkine gider', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    const link = screen.getByText('Turnuvalar').closest('a');
    expect(link).toHaveAttribute('href', '/custom/5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/home-custom-tabs.test.tsx`
Expected: FAIL — "Turnuvalar" ekranda yok (henüz `listCustomTabs` çağrılmıyor)

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/(child)/home/page.tsx` başına import ekle:

```ts
import { listCustomTabs } from '@/lib/customTabsApi';
import type { CustomTabSummary } from '@/lib/customTabsApi';
```

Component içine state + fetch ekle (diğer `useState`/`useEffect`'lerin yanına):

```ts
const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
useEffect(() => { listCustomTabs().then(setCustomTabs); }, []);
```

`{(settings.customTabs ?? []).map((ct, i) => (...))}` bloğunu değiştir:

```tsx
{customTabs.map((ct, i) => (
  <FeatureTab
    key={ct.id} emoji={ct.emoji} label={ct.label}
    color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]} href={`/custom/${ct.id}`}
  />
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/home-custom-tabs.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(child)/home/page.tsx" apps/web/tests/home-custom-tabs.test.tsx
git commit -m "feat: ana sayfada özel sekmeler kendi sayfasına yönlendirir"
```

---

### Task 10: Sporcu görüntüleme sayfası `(child)/custom/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/(child)/custom/[id]/page.tsx`
- Test: `apps/web/tests/custom-tab-view.test.tsx` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));

import CustomTabViewPage from '@/app/(child)/custom/[id]/page';
import { getCustomTab } from '@/lib/customTabsApi';

describe('Sporcu özel sekme sayfası', () => {
  it('bölümler sırayla başlık+yazı+görsellerle render edilir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Turnuvalar', emoji: '📌',
      sections: [
        { id: 1, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [] },
        { id: 2, order_index: 2, title: 'Ödüller', body: 'Kupa verilir', images: ['data:image/png;base64,abc'] },
      ],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
    expect(screen.getByText('En az 8 yaş')).toBeInTheDocument();
    expect(screen.getByText('Ödüller')).toBeInTheDocument();
    expect(screen.getByAltText('Ödüller görseli 1')).toBeInTheDocument();
  });

  it('bölüm yoksa "Henüz içerik eklenmedi" mesajı görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Turnuvalar', emoji: '📌', sections: [],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Henüz içerik eklenmedi')).toBeInTheDocument();
  });

  it('sekme bulunamazsa hata mesajı görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Sayfa bulunamadı'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/custom-tab-view.test.tsx`
Expected: FAIL — module not found (`@/app/(child)/custom/[id]/page`)

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/(child)/custom/[id]/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';

export default function CustomTabViewPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-sm t-muted">← Geri</button>
      <h1 className="text-2xl font-extrabold t-premium flex items-center gap-2">
        <span>{tab.emoji}</span> {tab.label}
      </h1>

      {tab.sections.length === 0 ? (
        <p className="t-muted">Henüz içerik eklenmedi</p>
      ) : (
        <div className="space-y-8">
          {tab.sections.map((s) => (
            <section key={s.id}>
              <h2 className="text-lg font-bold t-premium mb-2">{s.title}</h2>
              {s.body && <p className="t-muted whitespace-pre-wrap mb-3">{s.body}</p>}
              {s.images.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {s.images.map((uri, i) => (
                    <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                      className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/custom-tab-view.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(child)/custom/[id]/page.tsx" apps/web/tests/custom-tab-view.test.tsx
git commit -m "feat: sporcu özel sekme görüntüleme sayfası"
```

---

### Task 11: Tam test kapısı + canlı doğrulama

**Files:** (yok — sadece doğrulama)

- [ ] **Step 1: Frontend tam gate**

Run (in `apps/web`):
```bash
npx tsc --noEmit && npx next lint && npx vitest run
```
Expected: tsc 0 hata (özellikle `settings.customTabs` kullanan başka bir dosya kalmadığından emin ol — `grep -rn "settings.customTabs\|CustomTab\[\]" apps/web/app apps/web/components` ile tara), lint 0 hata, tüm testler PASS.

- [ ] **Step 2: Backend tam gate**

Run (in `apps/api`):
```bash
python -m pytest -q
```
Expected: tüm testler PASS (mevcut regresyon + Task 1-5'teki 14 yeni test).

- [ ] **Step 3: Canlı doğrulama (KURAL #6) — kullanıcıya sormadan ÖNCE bu adımı yapma**

Kullanıcıya "canlı doğrulayayım mı?" diye sor. Onay gelirse (panel giriş-korumalı
olduğu için A grubunda kullanılan mock-fetch + gerçek tarayıcı sürme yöntemi
tekrarlanır — bkz. A grubu Task 11 notları):
- Admin/Sekmeler'de yeni bir sekme ekle, emoji otomatik atandığını gör.
- "İçeriği düzenle" ile aç, görselli bir bölüm ekle, listede göründüğünü doğrula.
- Bölümü sil, listeden kaybolduğunu doğrula.
- Sporcu ana sayfasında yeni sekmenin kart olarak göründüğünü, tıklayınca
  `/custom/{id}` sayfasının açılıp bölümü (başlık+yazı+görsel) doğru gösterdiğini
  doğrula.
- Sekmeyi panelden sil, sporcu ana sayfasında kartın kaybolduğunu doğrula.

- [ ] **Step 4: Commit (varsa küçük düzeltmeler)**

```bash
git add -A
git commit -m "test: B grubu tam test kapısı doğrulaması"
```
