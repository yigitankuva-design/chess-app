# Admin Paneli + PIN'siz Çocuk Modu + Tek Sayfa Giriş Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmen-yetkili sol menülü admin paneli, PIN'siz (güvenilir cihaz korumalı) çocuk modu ve ana sayfaya gömülü tek-sayfa giriş formu eklemek.

**Architecture:** Backend'e yeni `admin` router (öğretmen rolüyle korunur) ve `auth/child/enter` endpoint'i eklenir; mevcut endpoint'ler ve PIN akışı silinmez (geriye uyumlu). Frontend'e `/admin/*` sayfa ağacı, ana sayfaya gömülü giriş formu, PIN'siz child-login eklenir.

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + pytest (backend); Next.js 15 + React 19 + TS + Tailwind + Vitest (frontend).

---

## File Structure

**Backend (`apps/api`):**
- Create: `chess_api/routers/admin.py` — tüm `/admin/*` endpoint'leri
- Modify: `chess_api/routers/auth.py` — `POST /auth/child/enter` eklenir
- Modify: `chess_api/schemas/auth.py` — `ChildEnterRequest`, admin şemaları
- Modify: `chess_api/main.py` — admin router include
- Create: `tests/test_child_enter.py`, `tests/test_admin.py`

**Frontend (`apps/web`):**
- Modify: `app/page.tsx` — gömülü giriş formu
- Modify: `app/(auth)/parent-login/page.tsx` — ana sayfaya redirect (route korunur)
- Modify: `app/(auth)/child-login/page.tsx` — PIN kaldır, `child/enter` çağır
- Modify: `lib/api-client.ts` — `childEnter`, admin metotları
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/parents/page.tsx`, `app/admin/parents/[id]/page.tsx`, `app/admin/content/page.tsx`
- Modify: `app/(auth)/parent-login` giriş sonrası ve `app/page.tsx` teacher yönlendirmesi → `/admin`
- Modify: `tests/smoke.test.tsx` — gömülü form başlığına göre

---

## Task 1: Backend — `POST /auth/child/enter` (PIN'siz, güvenilir cihaz korumalı)

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`
- Modify: `apps/api/chess_api/routers/auth.py`
- Test: `apps/api/tests/test_child_enter.py`

- [ ] **Step 1: Şemayı incele ve ChildEnterRequest ekle**

`apps/api/chess_api/schemas/auth.py` içinde `ChildPinLoginRequest`'i bul (referans olarak). Onun altına ekle:

```python
class ChildEnterRequest(BaseModel):
    child_profile_id: int
    device_fingerprint: str
```

- [ ] **Step 2: Failing test yaz**

Create `apps/api/tests/test_child_enter.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_child_enter_trusted_device_succeeds(client):
    # Parent signup
    r = await client.post("/auth/parent/signup", json={
        "email": "enter1@t.com", "password": "guvenli12345", "name": "P",
    })
    parent_token = r.json()["access_token"]
    # Create child
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    # Register device
    await client.post("/auth/device/register",
                      headers={"Authorization": f"Bearer {parent_token}"},
                      json={"device_fingerprint": "dev-ok", "name": "T"})
    # Enter without PIN
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": child_id, "device_fingerprint": "dev-ok",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["child_profile_id"] == child_id
    assert body["access_token"]


@pytest.mark.asyncio
async def test_child_enter_untrusted_device_403(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "enter2@t.com", "password": "guvenli12345", "name": "P",
    })
    parent_token = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    # No device registered → untrusted
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": child_id, "device_fingerprint": "stranger",
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_child_enter_unknown_child_404(client):
    r = await client.post("/auth/child/enter", json={
        "child_profile_id": 999999, "device_fingerprint": "x",
    })
    assert r.status_code == 404
```

- [ ] **Step 3: Testi çalıştır, fail ettiğini gör**

Run: `cd apps/api && python -m pytest tests/test_child_enter.py -v`
Expected: FAIL (404/405 — endpoint yok)

- [ ] **Step 4: Endpoint'i ekle**

`apps/api/chess_api/routers/auth.py` — import satırına `ChildEnterRequest` ekle (mevcut `from chess_api.schemas.auth import (...)` bloğuna). Sonra `child_pin_login` fonksiyonunun ALTINA ekle:

```python
@router.post("/child/enter")
async def child_enter(
    payload: ChildEnterRequest,
    db: AsyncSession = Depends(get_db),
):
    """PIN'siz çocuk girişi. Güvenlik: cihaz, çocuğun velisinin güvenilir cihazı olmalı."""
    child = await db.get(ChildProfile, payload.child_profile_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    device_result = await db.execute(
        select(Device).where(
            Device.device_fingerprint == payload.device_fingerprint,
            Device.parent_user_id == child.parent_user_id,
        )
    )
    device = device_result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=403, detail="Untrusted device")

    token = encode_token({
        "child_profile_id": child.id,
        "parent_user_id": child.parent_user_id,
        "role": "child",
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "child_profile_id": child.id,
        "display_name": child.display_name,
    }
```

- [ ] **Step 5: Testi çalıştır, geçtiğini gör**

Run: `cd apps/api && python -m pytest tests/test_child_enter.py -v`
Expected: PASS (3 test)

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py apps/api/chess_api/routers/auth.py apps/api/tests/test_child_enter.py
git commit -m "feat(api): PIN'siz child/enter endpoint (güvenilir cihaz korumalı)"
```

---

## Task 2: Backend — Admin şemaları

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 1: Admin şemalarını ekle**

`apps/api/chess_api/schemas/auth.py` sonuna ekle:

```python
class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class AdminParentSummary(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    child_count: int


class AdminChildSummary(BaseModel):
    id: int
    display_name: str
    age: int
    avatar: str
    completed_lessons: int


class AdminParentDetail(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    children: list[AdminChildSummary]


class AdminOverview(BaseModel):
    total_parents: int
    total_children: int
    total_teachers: int


class AdminModuleSummary(BaseModel):
    id: int
    order_index: int
    name: str
    lesson_count: int
```

Dosyanın başında `from pydantic import BaseModel, Field` ve `from datetime import datetime` importlarının olduğundan emin ol; yoksa ekle.

- [ ] **Step 2: Import doğrulama**

Run: `cd apps/api && python -c "from chess_api.schemas.auth import AdminParentDetail, AdminOverview, AdminModuleSummary; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py
git commit -m "feat(api): admin panel şemaları"
```

---

## Task 3: Backend — Admin router (veli listesi + genel bakış + içerik)

**Files:**
- Create: `apps/api/chess_api/routers/admin.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_admin.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_admin.py`:

```python
import pytest


async def _teacher_token(client, email="teach@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _parent_with_child(client, email="par@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli Bir",
    })
    ptok = r.json()["access_token"]
    pid = r.json()["user_id"]
    await client.post("/children", headers={"Authorization": f"Bearer {ptok}"},
                      json={"display_name": "Ali", "age": 10, "pin": "1234"})
    return ptok, pid


@pytest.mark.asyncio
async def test_admin_parents_requires_teacher(client):
    ptok, _ = await _parent_with_child(client)
    r = await client.get("/admin/parents", headers={"Authorization": f"Bearer {ptok}"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_lists_parents_with_child_count(client):
    await _parent_with_child(client, email="p1@t.com")
    ttok = await _teacher_token(client)
    r = await client.get("/admin/parents", headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    rows = r.json()
    row = next(x for x in rows if x["email"] == "p1@t.com")
    assert row["child_count"] == 1
    assert row["name"] == "Veli Bir"


@pytest.mark.asyncio
async def test_admin_overview_counts(client):
    await _parent_with_child(client, email="p2@t.com")
    ttok = await _teacher_token(client, email="t2@t.com")
    r = await client.get("/admin/overview", headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_parents"] >= 1
    assert body["total_children"] >= 1
    assert body["total_teachers"] >= 1
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && python -m pytest tests/test_admin.py -v`
Expected: FAIL (404 — router yok)

- [ ] **Step 3: Admin router oluştur**

Create `apps/api/chess_api/routers/admin.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models import User, UserRole, ChildProfile
from chess_api.models.module import Module, Lesson
from chess_api.models.progress import ChildLessonProgress, LessonStatus
from chess_api.dependencies.auth import get_current_user
from chess_api.schemas.auth import (
    AdminParentSummary, AdminParentDetail, AdminChildSummary,
    AdminOverview, AdminModuleSummary,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _ensure_admin(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(status_code=403, detail="Admin (teacher) only")


@router.get("/parents", response_model=list[AdminParentSummary])
async def list_parents(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    parents = (await db.execute(
        select(User).where(User.role == UserRole.parent).order_by(User.created_at.desc())
    )).scalars().all()
    out = []
    for p in parents:
        count = (await db.execute(
            select(func.count(ChildProfile.id)).where(ChildProfile.parent_user_id == p.id)
        )).scalar_one()
        out.append(AdminParentSummary(
            id=p.id, name=p.name, email=p.email,
            created_at=p.created_at, child_count=count,
        ))
    return out


@router.get("/parents/{parent_id}", response_model=AdminParentDetail)
async def parent_detail(
    parent_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent_id)
    )).scalars().all()
    child_out = []
    for c in children:
        completed = (await db.execute(
            select(func.count(ChildLessonProgress.id)).where(
                ChildLessonProgress.child_id == c.id,
                ChildLessonProgress.status == LessonStatus.completed,
            )
        )).scalar_one()
        child_out.append(AdminChildSummary(
            id=c.id, display_name=c.display_name, age=c.age,
            avatar=c.avatar, completed_lessons=completed,
        ))
    return AdminParentDetail(
        id=p.id, name=p.name, email=p.email,
        created_at=p.created_at, children=child_out,
    )


@router.get("/overview", response_model=AdminOverview)
async def overview(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    total_parents = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.parent)
    )).scalar_one()
    total_teachers = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.teacher)
    )).scalar_one()
    total_children = (await db.execute(
        select(func.count(ChildProfile.id))
    )).scalar_one()
    return AdminOverview(
        total_parents=total_parents,
        total_children=total_children,
        total_teachers=total_teachers,
    )


@router.get("/content", response_model=list[AdminModuleSummary])
async def content(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    modules = (await db.execute(
        select(Module).order_by(Module.order_index)
    )).scalars().all()
    out = []
    for m in modules:
        lc = (await db.execute(
            select(func.count(Lesson.id)).where(Lesson.module_id == m.id)
        )).scalar_one()
        out.append(AdminModuleSummary(
            id=m.id, order_index=m.order_index, name=m.name, lesson_count=lc,
        ))
    return out
```

- [ ] **Step 4: Router'ı main'e ekle**

`apps/api/chess_api/main.py`:
- Import satırında `teacher as teacher_router` ifadesinin sonuna `, admin as admin_router` ekle.
- `app.include_router(teacher_router.router)` satırının altına ekle: `app.include_router(admin_router.router)`

- [ ] **Step 5: Testi çalıştır, geç**

Run: `cd apps/api && python -m pytest tests/test_admin.py -v`
Expected: PASS (3 test)

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/chess_api/main.py apps/api/tests/test_admin.py
git commit -m "feat(api): admin router — veli listesi, detay, genel bakış, içerik"
```

---

## Task 4: Backend — Admin şifre sıfırlama + veli silme

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_admin.py`

- [ ] **Step 1: Failing test ekle**

`apps/api/tests/test_admin.py` sonuna ekle:

```python
@pytest.mark.asyncio
async def test_admin_reset_password_then_login(client):
    _, pid = await _parent_with_child(client, email="reset@t.com")
    ttok = await _teacher_token(client, email="t3@t.com")
    r = await client.post(f"/admin/parents/{pid}/reset-password",
                          headers={"Authorization": f"Bearer {ttok}"},
                          json={"new_password": "yeniSifre123"})
    assert r.status_code == 200
    # Eski şifre artık geçmez
    r = await client.post("/auth/login", json={"email": "reset@t.com", "password": "guvenli12345"})
    assert r.status_code == 401
    # Yeni şifre geçer
    r = await client.post("/auth/login", json={"email": "reset@t.com", "password": "yeniSifre123"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_delete_parent(client):
    _, pid = await _parent_with_child(client, email="del@t.com")
    ttok = await _teacher_token(client, email="t4@t.com")
    r = await client.delete(f"/admin/parents/{pid}",
                            headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 200
    # Silinen veli login olamaz
    r = await client.post("/auth/login", json={"email": "del@t.com", "password": "guvenli12345"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_cannot_delete_teacher(client):
    ttok = await _teacher_token(client, email="t5@t.com")
    # Başka bir teacher hedefle
    r = await client.post("/auth/teacher/signup", json={
        "email": "victim@t.com", "password": "guvenli12345", "name": "V",
    })
    victim_id = r.json()["user_id"]
    r = await client.delete(f"/admin/parents/{victim_id}",
                            headers={"Authorization": f"Bearer {ttok}"})
    assert r.status_code == 404
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && python -m pytest tests/test_admin.py -k "reset or delete" -v`
Expected: FAIL (405/404 — endpoint yok)

- [ ] **Step 3: Endpoint'leri ekle**

`apps/api/chess_api/routers/admin.py` — import bloğuna ekle:
`from chess_api.schemas.auth import AdminResetPasswordRequest` (mevcut import satırına ekleyebilirsin) ve
`from chess_api.services.password import hash_password`

Dosya sonuna ekle:

```python
@router.post("/parents/{parent_id}/reset-password")
async def reset_parent_password(
    parent_id: int,
    payload: AdminResetPasswordRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    p.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"reset": True}


@router.delete("/parents/{parent_id}")
async def delete_parent(
    parent_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    # Bağlı çocuk profillerini sil, sonra veliyi
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent_id)
    )).scalars().all()
    for c in children:
        await db.delete(c)
    await db.delete(p)
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 4: Tüm admin testlerini çalıştır**

Run: `cd apps/api && python -m pytest tests/test_admin.py -v`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_admin.py
git commit -m "feat(api): admin şifre sıfırlama + veli silme"
```

---

## Task 5: Backend — tam test paketi (regression) + push

**Files:** yok (doğrulama)

- [ ] **Step 1: Tüm backend testleri**

Run: `cd apps/api && python -m pytest tests/ -q`
Expected: Hepsi PASS (yeni + mevcut). Fail varsa düzelt.

- [ ] **Step 2: Backend'i push et (Railway deploy)**

```bash
git push origin main
```
Not: Backend önce deploy edilmeli ki frontend'in çağıracağı endpoint'ler canlıda hazır olsun.

- [ ] **Step 3: Canlı doğrulama**

Railway deploy bitince: `curl -s -o /dev/null -w "%{http_code}" https://chess-app-production-1dab.up.railway.app/admin/overview`
Expected: `403` (auth yok → endpoint mevcut ve korunuyor; 404 DEĞİL)

---

## Task 6: Frontend — api-client metotları

**Files:**
- Modify: `apps/web/lib/api-client.ts`

- [ ] **Step 1: Tipleri ve metotları ekle**

`apps/web/lib/api-client.ts` — `apiClient` nesnesinin içine (son metodun ardından, `login` bloğunun altına virgülle) ekle:

```typescript
  childEnter: (body: { child_profile_id: number; device_fingerprint: string }) =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/child/enter',
      { method: 'POST', body: JSON.stringify(body) },
    ),
```

Not: Admin sayfaları fetch'i doğrudan token ile yapacağı için (parent dashboard deseni), admin metotlarını api-client'a eklemeye gerek yok. Bu adım sadece childEnter içindir.

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api-client.ts
git commit -m "feat(web): childEnter api-client metodu"
```

---

## Task 7: Frontend — PIN'siz child-login

**Files:**
- Modify: `apps/web/app/(auth)/child-login/page.tsx`

- [ ] **Step 1: PIN pad'i kaldır, enter çağır**

`apps/web/app/(auth)/child-login/page.tsx` dosyasını tamamen aşağıdakiyle değiştir:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceFingerprint } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { avatarEmoji } from '@/lib/avatars';
import { apiClient, ApiError } from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Child {
  id: number;
  display_name: string;
  avatar: string;
  age: number;
}

export default function ChildLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<number | null>(null);

  useEffect(() => {
    const fp = getDeviceFingerprint();
    fetch(`${API_BASE}/auth/device/children?device_fingerprint=${encodeURIComponent(fp)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setChildren(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function enterChild(c: Child) {
    setError(null);
    setEnteringId(c.id);
    try {
      const data = await apiClient.childEnter({
        child_profile_id: c.id,
        device_fingerprint: getDeviceFingerprint(),
      });
      auth.login(data.access_token, 'child', data.child_profile_id);
      router.push('/home');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError('Bu cihaz tanımlı değil. Veli girişinden ekleyin.');
      } else {
        setError('Giriş başarısız, tekrar dene');
      }
      setEnteringId(null);
    }
  }

  if (loading) return <p className="text-center">Yükleniyor...</p>;

  if (children.length === 0) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Çocuk profili yok</h1>
        <p className="opacity-75">Bu cihazda kayıtlı çocuk yok. Veli önce çocuk eklemeli.</p>
        <a
          href="/parent-login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Veli Girişi
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Kim oynuyor?</h1>
      {error && <p className="text-red-600 font-medium text-center">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => enterChild(c)}
            disabled={enteringId !== null}
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow hover:shadow-lg transition disabled:opacity-50"
          >
            <span className="text-5xl">{avatarEmoji(c.avatar)}</span>
            <span className="font-bold">{c.display_name}</span>
            {enteringId === c.id && <span className="text-xs opacity-60">Giriliyor...</span>}
          </button>
        ))}
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
git add "apps/web/app/(auth)/child-login/page.tsx"
git commit -m "feat(web): PIN'siz çocuk modu — profil seç, direkt gir"
```

---

## Task 8: Frontend — Tek sayfa giriş (ana sayfaya gömülü form)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/(auth)/parent-login/page.tsx`
- Modify: `apps/web/tests/smoke.test.tsx`

- [ ] **Step 1: Ana sayfayı gömülü formla değiştir**

`apps/web/app/page.tsx` dosyasını tamamen aşağıdakiyle değiştir:

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function HomePage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, formState: { isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await apiClient.login(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push(res.role === 'teacher' ? '/admin' : '/parent/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('E-posta veya şifre yanlış');
      } else {
        setError('Giriş başarısız');
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-6">
      <div className="text-center">
        <img src="/logo.png" alt="Bozüyük Satranç Akademisi Logo" className="h-20 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-1">Bozüyük Satranç Akademisi</h1>
        <p className="text-base text-gray-500">Akademik Gelişim Platformu</p>
        <hr className="my-5 border-gray-200" />
        <p className="text-lg font-semibold text-gray-700">Hoş Geldiniz</p>
        <hr className="my-5 border-gray-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-xs space-y-4">
        <input
          {...register('email')}
          type="email"
          placeholder="E-posta"
          className="w-full p-3 border rounded"
        />
        <input
          {...register('password')}
          type="password"
          placeholder="Şifre"
          className="w-full p-3 border rounded"
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-blue-600 underline">
            Şifremi unuttum
          </Link>
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-lg font-bold shadow disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
        </button>
        <p className="text-center text-sm opacity-75">
          Hesabın yok mu? <Link href="/parent-signup" className="underline">Kayıt Ol</Link>
        </p>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: parent-login route'unu ana sayfaya yönlendir (route korunur)**

`apps/web/app/(auth)/parent-login/page.tsx` dosyasını tamamen aşağıdakiyle değiştir:

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return <p className="text-center">Yönlendiriliyor...</p>;
}
```

- [ ] **Step 3: smoke testini güncelle**

`apps/web/tests/smoke.test.tsx` — testin gövdesini şununla değiştir (heading hâlâ "Bozüyük Satranç Akademisi", ama artık form da var; test aynı kalabilir ama emin olmak için):

```tsx
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the academy heading and login button', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /Bozüyük Satranç Akademisi/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Giriş Yap/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run tests/smoke.test.tsx`
Expected: tsc temiz, smoke PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx "apps/web/app/(auth)/parent-login/page.tsx" apps/web/tests/smoke.test.tsx
git commit -m "feat(web): tek sayfa giriş — ana sayfaya gömülü form, teacher -> /admin"
```

---

## Task 9: Frontend — Admin layout (sol panel)

**Files:**
- Create: `apps/web/app/admin/layout.tsx`

- [ ] **Step 1: Layout oluştur**

Create `apps/web/app/admin/layout.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/admin', label: 'Genel Bakış' },
  { href: '/admin/parents', label: 'Veliler' },
  { href: '/admin/content', label: 'İçerik' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/'); return; }
    setReady(true);
  }, [router]);

  if (!ready) return <p className="p-6">Yükleniyor...</p>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <p className="font-bold">Admin Paneli</p>
          <p className="text-xs opacity-60">Bozüyük Satranç Akademisi</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { auth.logout(); router.replace('/'); }}
          className="m-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 text-left"
        >
          Çıkış
        </button>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/layout.tsx
git commit -m "feat(web): admin layout — sol panel menü"
```

---

## Task 10: Frontend — Admin genel bakış + içerik sayfaları

**Files:**
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/content/page.tsx`

- [ ] **Step 1: Genel bakış sayfası**

Create `apps/web/app/admin/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Overview { total_parents: number; total_children: number; total_teachers: number; }

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Yükleniyor...</p>;
  if (!data) return <p className="text-red-600">Veri yüklenemedi.</p>;

  const cards = [
    { label: 'Veli', value: data.total_parents },
    { label: 'Çocuk', value: data.total_children },
    { label: 'Öğretmen', value: data.total_teachers },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Genel Bakış</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl shadow p-6">
            <p className="text-3xl font-bold">{c.value}</p>
            <p className="text-sm opacity-60">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: İçerik sayfası**

Create `apps/web/app/admin/content/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ModuleRow { id: number; order_index: number; name: string; lesson_count: number; }

export default function AdminContentPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">İçerik (Modüller)</h1>
      {rows.length === 0 ? (
        <p className="opacity-60">Modül bulunamadı.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow divide-y">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{m.order_index}. {m.name}</p>
              </div>
              <span className="text-sm opacity-60">{m.lesson_count} ders</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/page.tsx apps/web/app/admin/content/page.tsx
git commit -m "feat(web): admin genel bakış + içerik sayfaları"
```

---

## Task 11: Frontend — Veli listesi + arama

**Files:**
- Create: `apps/web/app/admin/parents/page.tsx`

- [ ] **Step 1: Veli listesi sayfası**

Create `apps/web/app/admin/parents/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ParentRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  child_count: number;
}

export default function AdminParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Veliler</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad veya e-posta ara..."
        className="w-full max-w-sm p-2 border rounded mb-4"
      />
      {filtered.length === 0 ? (
        <p className="opacity-60">Veli bulunamadı.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow divide-y">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/admin/parents/${p.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm opacity-60">{p.email}</p>
              </div>
              <span className="text-sm opacity-60">{p.child_count} çocuk</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/parents/page.tsx
git commit -m "feat(web): admin veli listesi + arama"
```

---

## Task 12: Frontend — Veli detay + şifre sıfırlama + silme

**Files:**
- Create: `apps/web/app/admin/parents/[id]/page.tsx`

- [ ] **Step 1: Veli detay sayfası**

Create `apps/web/app/admin/parents/[id]/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChildRow { id: number; display_name: string; age: number; avatar: string; completed_lessons: number; }
interface ParentDetail { id: number; name: string; email: string; created_at: string; children: ChildRow[]; }

export default function AdminParentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ParentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [newPass, setNewPass] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function resetPassword() {
    setResetMsg(null);
    if (newPass.length < 8) { setResetMsg('Şifre en az 8 karakter olmalı'); return; }
    setResetting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/admin/parents/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPass }),
      });
      setResetMsg(res.ok ? 'Şifre güncellendi ✓' : 'İşlem başarısız');
      if (res.ok) setNewPass('');
    } catch {
      setResetMsg('İşlem başarısız');
    }
    setResetting(false);
  }

  async function deleteParent() {
    setDeleting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/admin/parents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { router.replace('/admin/parents'); return; }
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDelete(false);
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (!data) return <p className="text-red-600">Veli bulunamadı.</p>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.back()} className="text-sm underline opacity-70 mb-4">← Geri</button>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="opacity-60">{data.email}</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-bold mb-3">Çocuklar</h2>
        {data.children.length === 0 ? (
          <p className="opacity-60 text-sm">Çocuk yok.</p>
        ) : (
          <div className="space-y-2">
            {data.children.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-2xl">{avatarEmoji(c.avatar)}</span>
                <div className="flex-1">
                  <p className="font-semibold">{c.display_name}</p>
                  <p className="text-xs opacity-60">{c.age} yaşında · {c.completed_lessons} ders tamamlandı</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-bold mb-3">Şifre Sıfırla</h2>
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Yeni şifre (min 8)"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={resetPassword}
            disabled={resetting}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {resetting ? '...' : 'Sıfırla'}
          </button>
        </div>
        {resetMsg && <p className="text-sm mt-2">{resetMsg}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border border-red-100">
        <h2 className="font-bold mb-3 text-red-700">Veliyi Sil</h2>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            Veliyi Sil
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <strong>{data.name}</strong> ve tüm çocuk profilleri silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteParent}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Evet, sil'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
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
git add "apps/web/app/admin/parents/[id]/page.tsx"
git commit -m "feat(web): admin veli detay — çocuklar, şifre sıfırlama, silme"
```

---

## Task 13: Frontend — Yerel doğrulama + deploy

**Files:** yok (doğrulama)

- [ ] **Step 1: Tam tip + tüm frontend testleri**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 2: Dev sunucuda gözle doğrula**

`.claude/launch.json`'daki `chess-web` ile önizleme başlat. Kontrol et:
- `/` → logo + başlıklar + Hoş Geldiniz + gömülü form + Kayıt Ol linki (ayrı giriş sayfası YOK)
- `/parent-login` → `/`'a yönleniyor
- Konsol hatası yok (read_console_messages)

- [ ] **Step 3: Push (Vercel deploy)**

```bash
git push origin main
```

- [ ] **Step 4: Canlı doğrulama**

Vercel deploy bitince:
- `curl -s https://chess-app-web-one.vercel.app/ | grep -o "Giriş Yap"` → eşleşme var
- Öğretmen hesabıyla giriş → `/admin` açılıyor, sol menü çalışıyor, veli listesi geliyor.

---

## Self-Review Notu

- **Spec kapsamı:** Tek sayfa giriş (T8), PIN'siz çocuk modu (T1, T7), admin veli listesi/detay (T3, T11, T12), şifre sıfırlama (T4, T12), veli silme (T4, T12), içerik görüntüleme (T3, T10), genel bakış (T3, T10) — hepsi karşılandı.
- **Geriye uyumluluk:** `child/pin` endpoint'i korundu, migration yok, `parent-login` route'u redirect olarak korundu.
- **Tip tutarlılığı:** `childEnter` dönüşü `{ access_token, child_profile_id, display_name }` — hem T6 tanımı hem T7 kullanımı aynı. Admin şema alan adları (child_count, completed_lessons, lesson_count) backend (T3/T4) ile frontend (T10/T11/T12) arasında birebir.
- **Deploy sırası:** Backend (T5) frontend'den (T13) önce push edilir.
