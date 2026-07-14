# Sporcu Modeli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Veli hesabı email+şifre ile girip doğrudan tek bir sporcunun adı-soyadı altında Hızlı Erişim (`/home`) ekranına düşsün; kayıtta sporcu adı-soyadı alınsın; veli/çocuk/PIN katmanı gizlensin.

**Architecture:** Backend'e iki yeni parent-token endpoint'i (`/auth/athlete/session`, `/auth/athlete/create`) ve `parent/signup`'a opsiyonel `athlete_name` eklenir. Frontend'de giriş → athlete session → child token → `/home` akışı kurulur; kayıt formuna sporcu adı eklenir; `/home` üstünde sporcu adı gösterilir. Migration yok, eski endpoint/sayfalar korunur.

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + pytest; Next.js 15 + React 19 + TS + Tailwind + Vitest.

---

## File Structure

**Backend (`apps/api`):**
- Modify: `chess_api/schemas/auth.py` — `ParentSignupRequest.athlete_name`, `AthleteCreateRequest`
- Modify: `chess_api/routers/auth.py` — `athlete_session`, `athlete_create` endpoint'leri + signup'ta profil oluşturma
- Create: `tests/test_athlete_session.py`

**Frontend (`apps/web`):**
- Modify: `lib/auth-storage.ts` — sporcu adı saklama (`saveAthleteName`/`getAthleteName`)
- Modify: `lib/api-client.ts` — `athleteSession`, `athleteCreate`, `parentSignup` gövdesine `athlete_name`
- Modify: `app/page.tsx` — parent login sonrası athlete session akışı
- Modify: `app/(auth)/parent-signup/page.tsx` — "Sporcu Adı Soyadı" alanı + kayıt sonrası akış
- Create: `app/athlete-setup/page.tsx` — sporcu yoksa ad-soyad formu
- Modify: `app/(child)/home/page.tsx` — üstte sporcu adı

---

## Task 1: Backend — şemalar

**Files:**
- Modify: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 1: ParentSignupRequest'e athlete_name ekle ve AthleteCreateRequest tanımla**

`apps/api/chess_api/schemas/auth.py` — mevcut `ParentSignupRequest`'i bul:

```python
class ParentSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
```

Sonuna `athlete_name` ekleyip hemen altına yeni şema koy:

```python
class ParentSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    athlete_name: str | None = Field(default=None, min_length=2, max_length=80)


class AthleteCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
```

- [ ] **Step 2: Import doğrula**

Run: `cd apps/api && python -c "from chess_api.schemas.auth import ParentSignupRequest, AthleteCreateRequest; print(ParentSignupRequest(email='a@b.com', password='12345678', name='Ad').athlete_name)"`
Expected: `None`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/auth.py
git commit -m "feat(api): sporcu şemaları (athlete_name, AthleteCreateRequest)"
```

---

## Task 2: Backend — athlete session + create endpoint'leri + signup profil

**Files:**
- Modify: `apps/api/chess_api/routers/auth.py`
- Test: `apps/api/tests/test_athlete_session.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_athlete_session.py`:

```python
import pytest
from sqlalchemy import select, func
from chess_api.models import ChildProfile


async def _parent_token(client, email="ath@t.com", athlete_name=None):
    body = {"email": email, "password": "guvenli12345", "name": "Veli"}
    if athlete_name is not None:
        body["athlete_name"] = athlete_name
    r = await client.post("/auth/parent/signup", json=body)
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_signup_with_athlete_creates_profile_and_session(client, db):
    tok = await _parent_token(client, email="a1@t.com", athlete_name="Ali Yıldız")
    # profil oluştu mu
    cnt = (await db.execute(select(func.count(ChildProfile.id)))).scalar_one()
    assert cnt == 1
    # session direkt çalışır
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Ali Yıldız"
    assert body["access_token"]
    assert body["child_profile_id"]


@pytest.mark.asyncio
async def test_signup_without_athlete_has_no_session(client):
    tok = await _parent_token(client, email="a2@t.com")  # athlete_name yok
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_athlete_create_then_session(client):
    tok = await _parent_token(client, email="a3@t.com")
    r = await client.post("/auth/athlete/create",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"full_name": "Veli Sporcu"})
    assert r.status_code == 201
    assert r.json()["display_name"] == "Veli Sporcu"
    # artık session var
    r2 = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_athlete_session_returns_oldest_profile(client, db):
    tok = await _parent_token(client, email="a4@t.com", athlete_name="Birinci")
    # ikinci profil ekle
    await client.post("/auth/athlete/create",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"full_name": "İkinci"})
    r = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Birinci"  # en eski


@pytest.mark.asyncio
async def test_athlete_session_requires_parent(client):
    # teacher token ile 403
    r = await client.post("/auth/teacher/signup", json={
        "email": "t@t.com", "password": "guvenli12345", "name": "Teacher",
    })
    ttok = r.json()["access_token"]
    r2 = await client.post("/auth/athlete/session", headers={"Authorization": f"Bearer {ttok}"})
    assert r2.status_code == 403
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && python -m pytest tests/test_athlete_session.py -v`
Expected: FAIL (endpoint yok / athlete_name profil oluşturmuyor)

- [ ] **Step 3: signup'ta athlete profili oluştur**

`apps/api/chess_api/routers/auth.py` — dosyanın başındaki importlara `hash_pin` ve `secrets` (zaten var) kontrol et. `ChildProfile` importu mevcut. `from chess_api.services.password import hash_password, verify_password, verify_pin` satırına `hash_pin` ekle:

```python
from chess_api.services.password import hash_password, verify_password, verify_pin, hash_pin
```

`AthleteCreateRequest`'i şema importuna ekle (mevcut `from chess_api.schemas.auth import (...)` bloğu):

```python
from chess_api.schemas.auth import (
    ParentSignupRequest, LoginRequest, AuthResponse, EmailVerifyRequest,
    DeviceRegisterRequest, ChildPinLoginRequest, ChildEnterRequest,
    AthleteCreateRequest,
)
```

`parent_signup` fonksiyonunda, `db.refresh(user)` çağrısından SONRA, `token = encode_token(...)` satırından ÖNCE ekle:

```python
    # Sporcu adı verildiyse profil oluştur (yaş/PIN varsayılan)
    if payload.athlete_name:
        athlete = ChildProfile(
            parent_user_id=user.id,
            display_name=payload.athlete_name,
            age=10,
            avatar="default",
            pin_hash=hash_pin(f"{secrets.randbelow(9000) + 1000}"),
        )
        db.add(athlete)
        await db.commit()
```

- [ ] **Step 4: session + create endpoint'lerini ekle**

`apps/api/chess_api/routers/auth.py` sonuna (child_enter'dan sonra) ekle:

```python
def _athlete_token(child: ChildProfile) -> dict:
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


@router.post("/athlete/session")
async def athlete_session(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Veli token'ı ile hesabın (en eski) sporcusu için child oturumu. PIN yok."""
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    child = (await db.execute(
        select(ChildProfile)
        .where(ChildProfile.parent_user_id == current.id)
        .order_by(ChildProfile.id.asc())
    )).scalars().first()
    if not child:
        raise HTTPException(status_code=404, detail="No athlete")
    return _athlete_token(child)


@router.post("/athlete/create", status_code=201)
async def athlete_create(
    payload: AthleteCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Veli token'ı ile sporcu profili oluşturur (yaş/PIN varsayılan) ve oturum döner."""
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    child = ChildProfile(
        parent_user_id=current.id,
        display_name=payload.full_name,
        age=10,
        avatar="default",
        pin_hash=hash_pin(f"{secrets.randbelow(9000) + 1000}"),
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return _athlete_token(child)
```

- [ ] **Step 5: Testi çalıştır, geç**

Run: `cd apps/api && python -m pytest tests/test_athlete_session.py -v`
Expected: PASS (5 test)

- [ ] **Step 6: Tam backend suite (regresyon)**

Run: `cd apps/api && python -m pytest tests/ -q`
Expected: Hepsi PASS

- [ ] **Step 7: Commit + push (Railway deploy)**

```bash
git add apps/api/chess_api/routers/auth.py apps/api/tests/test_athlete_session.py
git commit -m "feat(api): athlete session/create endpoint + signup sporcu profili"
git push origin main
```

- [ ] **Step 8: Canlı doğrulama**

Railway deploy sonrası: `curl -s -o /dev/null -w "%{http_code}" -X POST https://chess-app-production-1dab.up.railway.app/auth/athlete/session`
Expected: `403` (auth yok → endpoint mevcut)

---

## Task 3: Frontend — api-client + storage

**Files:**
- Modify: `apps/web/lib/auth-storage.ts`
- Modify: `apps/web/lib/api-client.ts`

- [ ] **Step 1: Storage'a sporcu adı helper'ları ekle**

`apps/web/lib/auth-storage.ts` — dosyanın başındaki `const FINGERPRINT_KEY` satırının altına ekle:

```typescript
const ATHLETE_NAME_KEY = 'bea_athlete_name';
```

Dosyanın sonuna ekle:

```typescript
export function saveAthleteName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ATHLETE_NAME_KEY, name);
}

export function getAthleteName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ATHLETE_NAME_KEY);
}
```

Ayrıca mevcut `clearAuth` fonksiyonuna sporcu adını da temizlet — `clearAuth` içindeki `localStorage.removeItem(TOKEN_KEY);` satırının altına ekle:

```typescript
  localStorage.removeItem(ATHLETE_NAME_KEY);
```

- [ ] **Step 2: api-client metotları**

`apps/web/lib/api-client.ts` — `ParentSignupBody` arayüzüne opsiyonel alan ekle. Mevcut:

```typescript
export interface ParentSignupBody {
  email: string;
  password: string;
  name: string;
}
```

Değiştir:

```typescript
export interface ParentSignupBody {
  email: string;
  password: string;
  name: string;
  athlete_name?: string;
}
```

`apiClient` nesnesine `childEnter`'dan sonra ekle:

```typescript
  athleteSession: () =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/athlete/session',
      { method: 'POST' },
    ),

  athleteCreate: (body: { full_name: string }) =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/athlete/create',
      { method: 'POST', body: JSON.stringify(body) },
    ),
```

Not: `athleteSession`/`athleteCreate` veli token'ı ile çağrılacak. `request` helper'ının Authorization başlığını nasıl eklediğini kontrol et (`lib/api-client.ts` başı). Eğer otomatik token ekliyorsa ek iş yok; eklemiyorsa bu iki çağrı için token'ı manuel geçir (aşağıdaki Task 4/5 fetch ile de yapılabilir). **Doğrula:** `request` fonksiyonunda `getToken()` ile Authorization ekleniyorsa devam; eklenmiyorsa Task 4 ve 5'te doğrudan `fetch` + `Authorization` kullan.

- [ ] **Step 3: request helper'ı incele ve gerekiyorsa uyarlama notu**

Run: `cd apps/web && sed -n '1,35p' lib/api-client.ts`
Beklenen: `request`'in token ekleyip eklemediğini gör. Token EKLEMİYORSA — Task 4 ve 5'teki athleteSession/athleteCreate çağrılarını `fetch(\`${API_BASE}/auth/athlete/session\`, { method:'POST', headers:{ Authorization: \`Bearer ${getToken()}\` }})` ile değiştir.

- [ ] **Step 4: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth-storage.ts apps/web/lib/api-client.ts
git commit -m "feat(web): athlete session/create api-client + sporcu adı storage"
```

---

## Task 4: Frontend — giriş sonrası athlete akışı

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Parent login sonrası athlete session'a geç**

`apps/web/app/page.tsx` — importlara ekle: `getToken` gerekmiyorsa atla; `saveAthleteName` ekle:

```typescript
import { saveAthleteName } from '@/lib/auth-storage';
```

`onSubmit` içindeki başarılı login bloğunu değiştir. Mevcut:

```typescript
      const res = await apiClient.login(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push(res.role === 'teacher' ? '/admin' : '/parent/dashboard');
```

Şununla değiştir:

```typescript
      const res = await apiClient.login(data);
      if (res.role === 'teacher') {
        auth.login(res.access_token, res.role, res.user_id);
        router.push('/admin');
        return;
      }
      // Veli: hesap token'ını kaydet, sonra sporcu oturumuna geç
      auth.login(res.access_token, res.role, res.user_id);
      try {
        const ath = await apiClient.athleteSession();
        auth.login(ath.access_token, 'child', ath.child_profile_id);
        saveAthleteName(ath.display_name);
        router.push('/home');
      } catch (se) {
        if (se instanceof ApiError && se.status === 404) {
          router.push('/athlete-setup');
        } else {
          setError('Sporcu oturumu açılamadı');
        }
      }
```

Not: `apiClient.athleteSession()` veli token'ıyla çağrılır — bu, `auth.login(res.access_token, ...)` sonrası `saveToken` ile token kaydedildiği için `request` helper token'ı okuyabilir (Task 3 Step 3 doğrulaması geçerli). Token otomatik eklenmiyorsa athleteSession'ı `fetch` ile Authorization vererek çağır.

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): veli girişi -> sporcu oturumu -> /home"
```

---

## Task 5: Frontend — kayıt formu sporcu alanı + athlete-setup sayfası

**Files:**
- Modify: `apps/web/app/(auth)/parent-signup/page.tsx`
- Create: `apps/web/app/athlete-setup/page.tsx`

- [ ] **Step 1: Signup şemasına ve forma sporcu adı ekle**

`apps/web/app/(auth)/parent-signup/page.tsx` — zod şemasına `athlete_name` ekle. Mevcut schema:

```typescript
const schema = z.object({
  role: z.enum(['parent', 'teacher']),
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  name: z.string().min(2, 'İsim gerekli'),
  kvkk_consent: z.boolean().refine(v => v === true, 'KVKK onayı gerekli'),
});
```

Değiştir (rol veli ise sporcu adı zorunlu — superRefine):

```typescript
const schema = z.object({
  role: z.enum(['parent', 'teacher']),
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  name: z.string().min(2, 'İsim gerekli'),
  athlete_name: z.string().optional(),
  kvkk_consent: z.boolean().refine(v => v === true, 'KVKK onayı gerekli'),
}).superRefine((val, ctx) => {
  if (val.role === 'parent' && (!val.athlete_name || val.athlete_name.trim().length < 2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['athlete_name'], message: 'Sporcu adı soyadı gerekli' });
  }
});
```

`onSubmit` içindeki gövdeyi değiştir. Mevcut:

```typescript
      const { kvkk_consent, role, ...apiData } = data;
      void kvkk_consent; // frontend-only field
      const res = role === 'teacher'
        ? await apiClient.teacherSignup(apiData)
        : await apiClient.parentSignup(apiData);
      auth.login(res.access_token, res.role, res.user_id);
      router.push(role === 'teacher' ? '/classes' : '/parent/dashboard');
```

Şununla değiştir:

```typescript
      const { kvkk_consent, role, athlete_name, ...base } = data;
      void kvkk_consent; // frontend-only field
      if (role === 'teacher') {
        const res = await apiClient.teacherSignup(base);
        auth.login(res.access_token, res.role, res.user_id);
        router.push('/classes');
        return;
      }
      const res = await apiClient.parentSignup({ ...base, athlete_name: athlete_name?.trim() });
      auth.login(res.access_token, res.role, res.user_id);
      const ath = await apiClient.athleteSession();
      auth.login(ath.access_token, 'child', ath.child_profile_id);
      saveAthleteName(ath.display_name);
      router.push('/home');
```

Importlara ekle:

```typescript
import { saveAthleteName } from '@/lib/auth-storage';
```

- [ ] **Step 2: Sporcu adı alanını render et (rol=veli iken)**

Aynı dosyada, "Hesap türü" seçicisinden HEMEN SONRA (KVKK'dan önce, isim alanının üstünde ya da altında) ekle — `role === 'parent'` iken görünsün. Formda `name` alanının hemen altına şu bloğu ekle:

```tsx
      {role === 'parent' && (
        <div>
          <input
            {...register('athlete_name')}
            placeholder="Sporcu Adı Soyadı"
            className="neon-input"
          />
          {errors.athlete_name && <p className="text-rose-400 text-sm mt-1">{errors.athlete_name.message}</p>}
        </div>
      )}
```

- [ ] **Step 3: athlete-setup sayfası oluştur**

Create `apps/web/app/athlete-setup/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { saveAthleteName } from '@/lib/auth-storage';

export default function AthleteSetupPage() {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError('Sporcu adı soyadı gerekli'); return; }
    setSaving(true);
    try {
      const ath = await apiClient.athleteCreate({ full_name: name.trim() });
      auth.login(ath.access_token, 'child', ath.child_profile_id);
      saveAthleteName(ath.display_name);
      router.push('/home');
    } catch {
      setError('Kaydedilemedi, tekrar dene');
      setSaving(false);
    }
  }

  return (
    <main className="neon-shell flex flex-col items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-xs neon-card neon-cyan p-7 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold n-text">Sporcu Bilgisi</h1>
          <p className="text-sm n-muted mt-1">Uygulamayı kullanacak sporcunun adını girin</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sporcu Adı Soyadı"
          className="neon-input"
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="neon-btn">
          {saving ? 'Kaydediliyor...' : 'Devam'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Tip + smoke test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(auth)/parent-signup/page.tsx" apps/web/app/athlete-setup/page.tsx
git commit -m "feat(web): kayıtta sporcu adı + athlete-setup sayfası"
```

---

## Task 6: Frontend — /home üstünde sporcu adı

**Files:**
- Modify: `apps/web/app/(child)/home/page.tsx`

- [ ] **Step 1: Sporcu adını göster**

`apps/web/app/(child)/home/page.tsx` — importlara ekle:

```typescript
import { getAthleteName } from '@/lib/auth-storage';
```

Component gövdesinde, `const [lastLesson, ...]` state'inin yanına ekle:

```typescript
  const [athleteName, setAthleteName] = useState<string | null>(null);
```

Mevcut `useEffect` içine (localStorage okuyan) ekle:

```typescript
    setAthleteName(getAthleteName());
```

`<section aria-label="Hızlı Erişim">`'in HEMEN ÜSTÜNE, `<main ...>` açılışından sonra ekle:

```tsx
      {athleteName && (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🏅</span>
          <div>
            <p className="text-xs t-muted uppercase tracking-widest">Sporcu</p>
            <p className="text-lg font-bold">{athleteName}</p>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(child)/home/page.tsx"
git commit -m "feat(web): /home üstünde sporcu adı"
```

---

## Task 7: Doğrulama + deploy

**Files:** yok

- [ ] **Step 1: Tam tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: Temiz + PASS

- [ ] **Step 2: Push (Vercel deploy)**

```bash
git push origin main
```

- [ ] **Step 3: Canlı uçtan uca doğrulama (kendi test verisiyle)**

Canlı backend'e curl ile:
- Yeni veli signup `athlete_name` ile → `/auth/athlete/session` 200 + display_name eşleşir.
- `athlete_name` olmadan signup → session 404.

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/parent/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"sp_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Veli\",\"athlete_name\":\"Test Sporcu\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST "$API/auth/athlete/session" -H "Authorization: Bearer $TOK"
```
Expected: `display_name":"Test Sporcu"` içeren 200 yanıtı.

- [ ] **Step 4: Tarayıcıda giriş akışı**

Yeni test hesabıyla (yukarıdaki) canlı sitede giriş → doğrudan `/home`, üstte "Test Sporcu" görünür; "Çocuklarım/Kim oynuyor" görünmez.

---

## Self-Review Notu

- **Spec kapsamı:** Kayıtta sporcu adı (T1,T2,T5), giriş→session→/home (T2,T4), athlete-setup kenar durumu (T2,T5), /home'da sporcu adı (T6), mevcut hesaplar en eski profile düşer (T2 `order_by id asc`), migration yok — karşılandı.
- **Tip tutarlılığı:** athleteSession/athleteCreate dönüşü `{access_token, child_profile_id, display_name}` — backend `_athlete_token` ve frontend kullanımı birebir.
- **Geriye uyumluluk:** `athlete_name` opsiyonel; eski signup ve eski sayfalar korunur; teacher/admin akışı değişmez.
- **Risk noktası:** `request` helper token eklemiyorsa athleteSession/athleteCreate 401 alır → Task 3 Step 3 bu durumu yakalar ve fetch+Authorization alternatifini verir.
