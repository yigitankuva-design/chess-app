# Sunucu İlerleme Kaydı (Parça 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çocukların ders ilerlemesi sunucuya kaydedilsin ve oradan okunsun; mevcut 12 çocuğun localStorage'daki ilerlemesi tek seferlik senkronla korunsun. (Kilit 4b'de, bu plan onun temelini kurar.)

**Architecture:** Backend'e `GET /lessons/progress` ve `POST /lessons/progress/sync` eklenir (child token). Canlı oynatıcı (`/modules/[id]`) açılışta sunucudan ilerlemeyi okur, localStorage'daki eski ilerlemeyi bir kez senkronlar, ders bitince mevcut `POST /lessons/{id}/complete`'i çağırır. localStorage önbellek olarak kalır (ağ hatasında oynatıcı çalışmaya devam eder). Migration YOK.

**Tech Stack:** FastAPI + SQLAlchemy 2 (async) + pytest; Next.js 15 + React 19 + TS.

---

## Kritik Kısıtlar

1. **Canlı çocuk oynatıcısına dokunuluyor** — 12 çocuk profili var. Ağ hatasında oynatıcı **kilitlenmemeli**, localStorage'a düşmeli.
2. **Mevcut ilerleme kaybolmamalı** — localStorage'daki tamamlanmış dersler tek seferlik sunucuya taşınır.
3. **`POST /lessons/{id}/complete` değiştirilmez** — zaten doğru çalışıyor (upsert + rozet/XP).
4. **Migration yok** — `child_lesson_progress` tablosu mevcut.

---

## File Structure

**Backend (`apps/api`):**
- Modify: `chess_api/schemas/lesson.py` — progress şemaları
- Modify: `chess_api/routers/lessons.py` — `GET /lessons/progress`, `POST /lessons/progress/sync`
- Create: `tests/test_lesson_progress.py`

**Frontend (`apps/web`):**
- Modify: `app/(child)/modules/[id]/page.tsx` — sunucudan oku, senkronla, ders bitince yaz

---

## Task 1: Backend — progress şemaları

**Files:**
- Modify: `apps/api/chess_api/schemas/lesson.py`

- [ ] **Step 1: Şemaları ekle**

`apps/api/chess_api/schemas/lesson.py` sonuna ekle:

```python
class LessonProgressResponse(BaseModel):
    completed_lesson_ids: list[int]


class LessonProgressSyncRequest(BaseModel):
    completed_lesson_ids: list[int]


class LessonProgressSyncResponse(BaseModel):
    synced: int
```

- [ ] **Step 2: Import doğrula**

Run: `cd apps/api && ./.venv/Scripts/python.exe -c "from chess_api.schemas.lesson import LessonProgressResponse, LessonProgressSyncRequest, LessonProgressSyncResponse; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/schemas/lesson.py
git commit -m "feat(api): ders ilerleme şemaları"
```

---

## Task 2: Backend — progress okuma + senkron endpoint'leri

**Files:**
- Modify: `apps/api/chess_api/routers/lessons.py`
- Test: `apps/api/tests/test_lesson_progress.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_lesson_progress.py`:

```python
import pytest
from sqlalchemy import select, func
from chess_api.models.module import Module, Lesson
from chess_api.models import ChildLessonProgress
from chess_api.models.progress import LessonStatus


async def _child_token(client, email="prog@t.com"):
    """Sporcu (child) token'ı: veli kaydı + athlete session."""
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
        "athlete_name": "Sporcu Bir",
    })
    ptok = r.json()["access_token"]
    r2 = await client.post("/auth/athlete/session",
                           headers={"Authorization": f"Bearer {ptok}"})
    return r2.json()["access_token"], r2.json()["child_profile_id"]


async def _lessons(db, order=1, count=2):
    m = Module(order_index=order, name=f"M{order}", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    out = []
    for i in range(1, count + 1):
        les = Lesson(module_id=m.id, order_index=i, title=f"Ders {i}",
                     estimated_minutes=10, published=True)
        db.add(les)
        await db.commit()
        await db.refresh(les)
        out.append(les)
    return m, out


@pytest.mark.asyncio
async def test_progress_empty_when_nothing_done(client, db):
    await _lessons(db, order=50)
    tok, _ = await _child_token(client, email="p1@t.com")
    r = await client.get("/lessons/progress", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json()["completed_lesson_ids"] == []


@pytest.mark.asyncio
async def test_progress_requires_child_token(client, db):
    await _lessons(db, order=51)
    r = await client.get("/lessons/progress")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_complete_then_progress_includes_lesson(client, db):
    """Uçtan uca: complete çağır -> progress o dersi döndürsün."""
    m, ls = await _lessons(db, order=52)
    tok, _ = await _child_token(client, email="p2@t.com")
    r = await client.post(f"/lessons/{ls[0].id}/complete",
                          headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    r2 = await client.get("/lessons/progress", headers={"Authorization": f"Bearer {tok}"})
    assert ls[0].id in r2.json()["completed_lesson_ids"]
    assert ls[1].id not in r2.json()["completed_lesson_ids"]


@pytest.mark.asyncio
async def test_sync_adds_missing_progress(client, db):
    m, ls = await _lessons(db, order=53)
    tok, child_id = await _child_token(client, email="p3@t.com")
    r = await client.post("/lessons/progress/sync",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"completed_lesson_ids": [ls[0].id, ls[1].id]})
    assert r.status_code == 200
    assert r.json()["synced"] == 2
    r2 = await client.get("/lessons/progress", headers={"Authorization": f"Bearer {tok}"})
    got = set(r2.json()["completed_lesson_ids"])
    assert got == {ls[0].id, ls[1].id}


@pytest.mark.asyncio
async def test_sync_is_idempotent_and_does_not_duplicate(client, db):
    """Tekrar senkron çoğaltmamalı, mevcut kaydı bozmamalı."""
    m, ls = await _lessons(db, order=54)
    tok, child_id = await _child_token(client, email="p4@t.com")
    await client.post("/lessons/progress/sync",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"completed_lesson_ids": [ls[0].id]})
    r = await client.post("/lessons/progress/sync",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"completed_lesson_ids": [ls[0].id]})
    assert r.status_code == 200
    assert r.json()["synced"] == 0  # zaten vardı
    cnt = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(
            ChildLessonProgress.child_id == child_id,
            ChildLessonProgress.lesson_id == ls[0].id,
        )
    )).scalar_one()
    assert cnt == 1


@pytest.mark.asyncio
async def test_sync_skips_unknown_lesson_ids(client, db):
    """Silinmiş ders id'si gelirse hata vermemeli, sessizce atlamalı."""
    m, ls = await _lessons(db, order=55)
    tok, _ = await _child_token(client, email="p5@t.com")
    r = await client.post("/lessons/progress/sync",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"completed_lesson_ids": [ls[0].id, 999999]})
    assert r.status_code == 200
    assert r.json()["synced"] == 1
    r2 = await client.get("/lessons/progress", headers={"Authorization": f"Bearer {tok}"})
    assert r2.json()["completed_lesson_ids"] == [ls[0].id]
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_lesson_progress.py -q`
Expected: FAIL (endpoint'ler yok)

- [ ] **Step 3: Endpoint'leri ekle**

`apps/api/chess_api/routers/lessons.py` — şema importuna ekle (mevcut `from chess_api.schemas.lesson import (...)` bloğu):

```python
    LessonProgressResponse, LessonProgressSyncRequest, LessonProgressSyncResponse,
```

Dosyanın sonuna ekle:

```python
@router.get("/lessons/progress", response_model=LessonProgressResponse)
async def lesson_progress(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Çocuğun tamamladığı ders id'leri. Kilit ve ilerleme göstergesi buna dayanır."""
    rows = (await db.execute(
        select(ChildLessonProgress.lesson_id).where(
            ChildLessonProgress.child_id == child.id,
            ChildLessonProgress.status == LessonStatus.completed,
        )
    )).scalars().all()
    return LessonProgressResponse(completed_lesson_ids=sorted(rows))


@router.post("/lessons/progress/sync", response_model=LessonProgressSyncResponse)
async def sync_lesson_progress(
    payload: LessonProgressSyncRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """localStorage'daki eski ilerlemeyi tek seferlik sunucuya taşır.

    Sadece EKLER — mevcut kayda dokunmaz, hiçbir şey silmez.
    Bilinmeyen ders id'leri sessizce atlanır (silinmiş ders olabilir).
    """
    if not payload.completed_lesson_ids:
        return LessonProgressSyncResponse(synced=0)

    valid_ids = set((await db.execute(
        select(Lesson.id).where(Lesson.id.in_(payload.completed_lesson_ids))
    )).scalars().all())

    existing_ids = set((await db.execute(
        select(ChildLessonProgress.lesson_id).where(
            ChildLessonProgress.child_id == child.id,
            ChildLessonProgress.lesson_id.in_(valid_ids),
        )
    )).scalars().all()) if valid_ids else set()

    synced = 0
    for lesson_id in valid_ids - existing_ids:
        db.add(ChildLessonProgress(
            child_id=child.id, lesson_id=lesson_id,
            status=LessonStatus.completed, completed_at=datetime.utcnow(),
        ))
        synced += 1
    if synced:
        await db.commit()
    return LessonProgressSyncResponse(synced=synced)
```

Not: `datetime`, `select`, `ChildLessonProgress`, `LessonStatus`, `Lesson`, `ChildProfile`, `get_current_child` zaten import edilmiş durumda (dosyanın başındaki mevcut importlar).

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_lesson_progress.py -q`
Expected: PASS (6 test)

- [ ] **Step 5: Tam suite (regresyon)**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS

- [ ] **Step 6: Commit + push (Railway deploy)**

```bash
git add apps/api/chess_api/schemas/lesson.py apps/api/chess_api/routers/lessons.py apps/api/tests/test_lesson_progress.py
git commit -m "feat(api): ders ilerleme okuma + tek seferlik senkron endpoint'leri"
git push origin main
```

- [ ] **Step 7: Canlı doğrulama**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
PTOK=$(curl -s -X POST "$API/auth/parent/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"pr_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Veli\",\"athlete_name\":\"Test Sporcu\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
CTOK=$(curl -s -X POST "$API/auth/athlete/session" -H "Authorization: Bearer $PTOK" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "-- bos progress --"
curl -s "$API/lessons/progress" -H "Authorization: Bearer $CTOK"
echo
echo "-- gercek dersi (42) tamamla --"
curl -s -X POST "$API/lessons/42/complete" -H "Authorization: Bearer $CTOK" -o /dev/null -w "%{http_code}\n"
echo "-- progress artik 42 icermeli --"
curl -s "$API/lessons/progress" -H "Authorization: Bearer $CTOK"
```
Expected: önce `{"completed_lesson_ids":[]}`, complete `200`, sonra `{"completed_lesson_ids":[42]}`

---

## Task 3: Frontend — oynatıcı sunucuya yazsın/okusun

**Files:**
- Modify: `apps/web/app/(child)/modules/[id]/page.tsx`

- [ ] **Step 1: Sunucudan okuma + senkron + yazma ekle**

`apps/web/app/(child)/modules/[id]/page.tsx` — `getToken` import edilmemişse importlara ekle:

```typescript
import { getToken } from '@/lib/auth-storage';
```

`const LS_LESSON = (lid: number) => \`bea_l_${lid}\`;` satırının ALTINA ekle:

```typescript
const LS_SYNCED = 'bea_progress_synced';
```

Mevcut localStorage hydrate eden `useEffect`'in (satır ~161, `// Hydrate completion state from localStorage`) HEMEN ALTINA yeni bir effect ekle:

```typescript
  // Sunucudan gerçek ilerlemeyi oku; ilk kez ise localStorage'daki eski ilerlemeyi taşı.
  // Ağ hatasında sessizce localStorage'a düşülür — oynatıcı kilitlenmez.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/lessons/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        let serverIds: number[] = data.completed_lesson_ids || [];

        // Tek seferlik senkron: localStorage'da olup sunucuda olmayanları gönder
        if (!localStorage.getItem(LS_SYNCED)) {
          const localIds: number[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)!;
            if (k.startsWith('bea_l_') && localStorage.getItem(k) === '1') {
              const lid = Number(k.slice(6));
              if (!Number.isNaN(lid)) localIds.push(lid);
            }
          }
          const missing = localIds.filter((x) => !serverIds.includes(x));
          if (missing.length) {
            const sres = await fetch(`${API_BASE}/lessons/progress/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ completed_lesson_ids: missing }),
            });
            if (sres.ok) {
              const fresh = await fetch(`${API_BASE}/lessons/progress`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (fresh.ok) serverIds = (await fresh.json()).completed_lesson_ids || [];
            }
          }
          localStorage.setItem(LS_SYNCED, '1');
        }

        if (!cancelled) {
          setDoneLessons((prev) => new Set([...prev, ...serverIds]));
          serverIds.forEach((lid) => localStorage.setItem(LS_LESSON(lid), '1'));
        }
      } catch {
        /* ağ hatası: localStorage ile devam */
      }
    })();

    return () => { cancelled = true; };
  }, []);
```

- [ ] **Step 2: Ders bitince sunucuya yaz**

Aynı dosyada `markStepDone` fonksiyonunu bul:

```typescript
  const markStepDone = useCallback((lessonId: number, stepId: number, steps: Step[]) => {
    const key = `${lessonId}_${stepId}`;
    localStorage.setItem(LS_STEP(lessonId, stepId), '1');
    setDoneSteps((prev) => {
      const next = new Set([...prev, key]);
      // Check if all steps done → mark lesson done
      if (steps.every((s) => next.has(`${lessonId}_${s.id}`))) {
        localStorage.setItem(LS_LESSON(lessonId), '1');
        setDoneLessons((p) => new Set([...p, lessonId]));
      }
      return next;
    });
  }, []);
```

Şununla değiştir:

```typescript
  const markStepDone = useCallback((lessonId: number, stepId: number, steps: Step[]) => {
    const key = `${lessonId}_${stepId}`;
    localStorage.setItem(LS_STEP(lessonId, stepId), '1');
    setDoneSteps((prev) => {
      const next = new Set([...prev, key]);
      // Check if all steps done → mark lesson done
      if (steps.every((s) => next.has(`${lessonId}_${s.id}`))) {
        localStorage.setItem(LS_LESSON(lessonId), '1');
        setDoneLessons((p) => new Set([...p, lessonId]));
        // Sunucuya da yaz (rozet/XP ödülleri de burada veriliyor).
        // Ağ hatası oynatıcıyı etkilemez — localStorage zaten yazıldı.
        const token = getToken();
        if (token) {
          fetch(`${API_BASE}/lessons/${lessonId}/complete`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => { /* sessiz */ });
        }
      }
      return next;
    });
  }, []);
```

- [ ] **Step 3: Tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 4: Commit + push (Vercel deploy)**

```bash
git add "apps/web/app/(child)/modules/[id]/page.tsx"
git commit -m "feat(web): oynatıcı ilerlemeyi sunucuya yazıyor/okuyor + tek seferlik senkron"
git push origin main
```

---

## Task 4: Canlı uçtan uca doğrulama

**Files:** yok

- [ ] **Step 1: Gerçek içerik bozulmadı mı**

```bash
API="https://chess-app-production-1dab.up.railway.app"
curl -s "$API/modules/1/lessons"
```
Expected: `"Tahta ve Taşlar"` hâlâ yayında.

- [ ] **Step 2: Tarayıcıda gerçek akış (EN KRİTİK — canlı oynatıcı)**

Test sporcu hesabıyla canlı sitede:
1. Giriş → `/home` → **Dersler** → bir düzey → ders aç
2. Adımları tamamla → ders bitince
3. Konsolda `POST /lessons/{id}/complete` çağrısı görülmeli (network)
4. `GET /lessons/progress` o dersi döndürmeli
5. **Sayfayı yenile** → ders hâlâ tamamlanmış görünmeli (sunucudan geliyor)
6. **localStorage'ı temizle + yenile** → ders **hâlâ tamamlanmış** görünmeli (asıl kanıt: sunucudan okuyor)

- [ ] **Step 3: Admin panelinde "0 ders tamamlandı" düzeldi mi**

Öğretmen hesabıyla `/admin/parents/{test velinin id'si}` → çocuğun altında **"1 ders tamamlandı"** yazmalı (önceden hep 0'dı).

---

## Self-Review Notu

- **Spec kapsamı (4a):** progress okuma (T2), tek seferlik senkron (T2), oynatıcı okuma+senkron (T3 Step 1), ders bitince yazma (T3 Step 2), canlı doğrulama (T4) — hepsi karşılandı. Kilit bilinçli olarak 4b'de.
- **Kritik kısıt (oynatıcı kilitlenmemeli):** T3'te tüm sunucu çağrıları `try/catch` + `.catch()` içinde; hata durumunda localStorage akışı bozulmadan devam ediyor.
- **Kritik kısıt (mevcut ilerleme kaybolmamalı):** T3 Step 1'deki tek seferlik senkron + T2'deki `sync` endpoint'i (sadece ekler, silmez, idempotent — `test_sync_is_idempotent_and_does_not_duplicate` kanıtlıyor).
- **Tip tutarlılığı:** `completed_lesson_ids` alan adı backend şemaları (T1), endpoint'ler (T2) ve frontend (T3) arasında birebir. `synced` alanı aynı.
- **`complete` endpoint'i değiştirilmedi** — sadece çağrılır oldu.
- **Migration yok** → geriye uyumlu. Deploy sırası: backend (T2 Step 6) → frontend (T3 Step 4).
- **T4 Step 2'deki "localStorage temizle + yenile" adımı** işin gerçekten çalıştığının asıl kanıtı — sadece "yazdım geçti" demiyoruz.
