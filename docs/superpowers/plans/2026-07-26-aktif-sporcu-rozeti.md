# P10 — Aktif Sporcu Rozeti — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Arkadaşla Oyna" kartında, o an uygulamada olan diğer sporcu sayısını yeşil/kırmızı bir rozetle göstermek.

**Architecture:** Kalp atışı (heartbeat) — sporcu uygulamadayken 30 sn'de bir `POST /presence/ping` atar, sunucu son 60 sn içinde ping atanları in-memory sayar ve sayıyı ping cevabında döner. Ping tek yerde (sporcu layout'u) atılır, sayı React context ile kartlara dağıtılır.

**Tech Stack:** FastAPI (in-memory servis, `lobby.py` deseni) · Next.js 15 / React 19 / TypeScript · pytest · vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-07-26-aktif-sporcu-rozeti-design.md`

**Yeni tablo YOK, yeni migration YOK.** Veritabanına hiç dokunulmuyor — presence tamamen bellekte (`lobby.py` ile aynı bilinen sınır).

**Test edilebilirlik kararları (önemli):**
1. `presence.py` fonksiyonları `now` parametresini **dışarıdan** alır; `time.time()` fonksiyon içinde çağrılmaz. Zaman aşımı böylece `sleep` olmadan test edilir.
2. `PresenceProvider` `intervalMs` prop'u alır (varsayılan `30_000`). Testte kısa değer verilir. **Sahte zamanlayıcı (fake timers) KULLANILMAZ** — bu projede hiç kullanılmamış bir desen ve async `fetch` ile birleşince kırılgan olur; kısa aralık + `waitFor` daha güvenilir.

---

## Dosya Yapısı

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `apps/api/chess_api/services/presence.py` | In-memory varlık takibi (saf, zaman enjeksiyonlu) | **Yeni** |
| `apps/api/chess_api/routers/presence.py` | `POST /presence/ping` | **Yeni** |
| `apps/api/chess_api/main.py` | Router kaydı | Değişir |
| `apps/api/tests/test_presence.py` | Servis + uç testleri | **Yeni** |
| `apps/web/lib/presence/presenceApi.ts` | Ping istemcisi | **Yeni** |
| `apps/web/lib/presence/PresenceContext.tsx` | Provider (ping döngüsü) + `usePresenceCount` | **Yeni** |
| `apps/web/components/play/ActivePlayersBadge.tsx` | Rozet + `activeColor()` | **Yeni** |
| `apps/web/app/(child)/layout.tsx` | Provider sarmalaması | Değişir |
| `apps/web/app/(child)/home/page.tsx` | Arkadaşla Oyna satırında ikon rengi + rozet | Değişir |
| `apps/web/app/(child)/play/page.tsx` | friend kartında rozet | Değişir |
| `apps/web/tests/presence-api.test.ts` | İstemci testleri | **Yeni** |
| `apps/web/tests/presence-context.test.tsx` | Provider/hook testleri | **Yeni** |
| `apps/web/tests/active-players-badge.test.tsx` | Rozet testleri | **Yeni** |
| `apps/web/tests/friend-badge-usage.test.tsx` | Home + play entegrasyon/regresyon | **Yeni** |

---

### Task 1: Backend — `presence.py` saf servis

**Files:**
- Create: `apps/api/chess_api/services/presence.py`
- Test: `apps/api/tests/test_presence.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_presence.py`:

```python
from chess_api.services.presence import (
    PRESENCE_TTL_SECONDS, touch, active_count, active_players, _reset_for_tests,
)

import pytest


@pytest.fixture(autouse=True)
def _clean():
    _reset_for_tests()
    yield
    _reset_for_tests()


def test_ttl_altmis_saniyedir():
    assert PRESENCE_TTL_SECONDS == 60.0


def test_bos_sistemde_sayi_sifirdir():
    assert active_count(exclude=None, now=1000.0) == 0


def test_tek_sporcu_kendini_saymaz():
    touch(1, "Ali", now=1000.0)
    assert active_count(exclude=1, now=1000.0) == 0


def test_iki_sporcu_birbirini_gorur():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1000.0) == 1
    assert active_count(exclude=2, now=1000.0) == 1


def test_ayni_sporcu_iki_kez_ping_atarsa_bir_kez_sayilir():
    touch(1, "Ali", now=1000.0)
    touch(1, "Ali", now=1005.0)
    touch(2, "Veli", now=1005.0)
    assert active_count(exclude=2, now=1005.0) == 1


def test_zaman_asimi_gecmis_sporcu_sayilmaz():
    """61 saniye once ping atmis sporcu artik aktif degildir (sleep YOK)."""
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1061.0) == 0


def test_sinir_tam_altmis_saniye_hala_sayilir():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1060.0) == 1


def test_sinir_altmis_virgul_bir_saniye_sayilmaz():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1060.1) == 0


def test_ping_tazeleyince_sporcu_yeniden_aktif_olur():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    touch(2, "Veli", now=1050.0)          # Veli tazeledi
    assert active_count(exclude=1, now=1055.0) == 1


def test_active_players_isim_ve_id_doner():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    rows = active_players(exclude=1, now=1000.0)
    assert rows == [{"child_id": 2, "display_name": "Veli"}]


def test_active_players_zaman_asimini_filtreler():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_players(exclude=1, now=1061.0) == []


def test_touch_eski_kayitlari_temizler():
    """Sozluk sinirsiz buyumesin — touch sirasinda suresi gecenler atilir."""
    from chess_api.services import presence

    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1200.0)          # Ali'nin suresi coktan gecti
    assert 1 not in presence._seen
    assert 2 in presence._seen
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_presence.py -q`
Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.presence'`

- [ ] **Step 3: Servisi yaz**

`apps/api/chess_api/services/presence.py`:

```python
"""In-memory varlik takibi: uygulamada olan sporcular.

lobby.py ile ayni desen (tek instance deploy varsayimi). lobby.py'den AYRI
yasar cunku iki kavram farklidir:
  - lobby.py  = "oyun lobisinde, oynamaya hazir"
  - presence  = "uygulamanin herhangi bir yerinde"

Zaman DISARIDAN verilir (now parametresi); time.time() burada cagrilmaz.
Sebep: zaman asimi davranisi ancak boyle sleep'siz test edilebilir.
"""
from typing import Any

PRESENCE_TTL_SECONDS = 60.0

# child_id -> (display_name, last_seen_epoch)
_seen: dict[int, tuple[str, float]] = {}


def _prune(now: float) -> None:
    """Suresi gecmis kayitlari atar — sozluk sinirsiz buyumesin."""
    expired = [cid for cid, (_, seen) in _seen.items() if now - seen > PRESENCE_TTL_SECONDS]
    for cid in expired:
        _seen.pop(cid, None)


def touch(child_id: int, display_name: str, now: float) -> None:
    """Sporcunun 'buradayim' sinyalini kaydeder."""
    _prune(now)
    _seen[child_id] = (display_name, now)


def active_players(exclude: int | None, now: float) -> list[dict[str, Any]]:
    """Son PRESENCE_TTL_SECONDS icinde gorulen sporcular; exclude listeden cikarilir."""
    return [
        {"child_id": cid, "display_name": name}
        for cid, (name, seen) in _seen.items()
        if cid != exclude and now - seen <= PRESENCE_TTL_SECONDS
    ]


def active_count(exclude: int | None, now: float) -> int:
    """Aktif sporcu sayisi. active_players ile AYNI filtreyi kullanir (DRY)."""
    return len(active_players(exclude=exclude, now=now))


def _reset_for_tests() -> None:
    _seen.clear()
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_presence.py -q`
Beklenen: 12 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/services/presence.py apps/api/tests/test_presence.py
git commit -m "feat: presence servisi - zaman enjeksiyonlu varlik takibi"
```

---

### Task 2: Backend — `POST /presence/ping`

**Files:**
- Create: `apps/api/chess_api/routers/presence.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_presence.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_presence.py` dosyasının SONUNA ekle:

```python
async def _child_token(client, email: str, name: str, device: str) -> str:
    """Veli hesabi acar, cocuk ekler, cihaz kaydeder, cocuk token'i doner.

    Akis tests/conftest.py:58 'child_auth' fixture'indan BIREBIR alindi
    (dogrulandi): parent signup -> /children -> /auth/device/register ->
    /auth/child/pin. Hazir fixture kullanilmiyor cunku bu testler IKI ayri
    cocuk gerektiriyor (birbirini saymalilar), fixture ise tek cocuk doner.
    """
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
    })
    parent_token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {parent_token}"}

    r = await client.post("/children", headers=h,
                          json={"display_name": name, "age": 10, "pin": "1234"})
    child_id = r.json()["id"]

    await client.post("/auth/device/register", headers=h,
                      json={"device_fingerprint": device, "name": "Test"})

    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": device,
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_tokensiz_ping_reddedilir(client):
    r = await client.post("/presence/ping")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_tek_sporcu_ping_atinca_sayi_sifirdir(client):
    """Kendisi haric sayilir — tek sporcu varsa 0 gorur."""
    tok = await _child_token(client, "p1@t.com", "Ali", "dev1")
    r = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json() == {"count": 0}


@pytest.mark.asyncio
async def test_iki_sporcu_ping_atinca_birbirini_sayar(client):
    tok1 = await _child_token(client, "p2@t.com", "Ali", "dev2")
    tok2 = await _child_token(client, "p3@t.com", "Veli", "dev3")

    await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok1}"})
    r2 = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok2}"})
    assert r2.json() == {"count": 1}

    r1 = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok1}"})
    assert r1.json() == {"count": 1}
```

> **Yollar doğrulandı** — `_child_token` akışı `tests/conftest.py:58` içindeki mevcut
> `child_auth` fixture'ından birebir alındı. Varsayım yok.

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_presence.py -q`
Beklenen: FAIL — yeni 3 test, `assert 404 == 200` benzeri (uç henüz yok).

Hata `_child_token` **içinde** (401/404/422 ile token alınamıyor) çıkarsa DUR:
kimlik akışı bozulmuş demektir, `tests/conftest.py:58` ile karşılaştır. Bu durumda
presence kodunu yazmadan önce helper'ı düzelt.

- [ ] **Step 3: Router'ı yaz**

`apps/api/chess_api/routers/presence.py`:

```python
import time

from fastapi import APIRouter, Depends

from chess_api.dependencies.auth import get_current_child
from chess_api.models.child import ChildProfile
from chess_api.services.presence import active_count, touch

router = APIRouter(tags=["presence"])


@router.post("/presence/ping")
async def presence_ping(child: ChildProfile = Depends(get_current_child)):
    """Sporcunun 'uygulamadayim' sinyali. Cevapta AKTIF DIGER sporcu sayisi doner.

    Ayri bir GET /presence/count ucu YOKTUR — ping zaten sunucuya gidiyor,
    sayiyi da o tasir (tek uc, tek istek).
    """
    now = time.time()
    touch(child.id, child.display_name, now)
    return {"count": active_count(exclude=child.id, now=now)}
```

- [ ] **Step 4: Router'ı kaydet**

`apps/api/chess_api/main.py` — 5. satırdaki import zincirinin SONUNA ekle:

```python
, presence as presence_router
```

Ve `app.include_router(pool_images_router.router)` satırının ALTINA ekle:

```python
    app.include_router(presence_router.router)
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_presence.py -q`
Beklenen: 15 test PASS

- [ ] **Step 6: Tüm backend testlerinin kırılmadığını doğrula**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS (P9 sonrası 260 + 15 = 275 civarı), **sıfır başarısız**

- [ ] **Step 7: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/routers/presence.py apps/api/chess_api/main.py apps/api/tests/test_presence.py
git commit -m "feat: POST /presence/ping - sayiyi cevapta doner"
```

---

### Task 3: Frontend — `presenceApi.ts`

**Files:**
- Create: `apps/web/lib/presence/presenceApi.ts`
- Test: `apps/web/tests/presence-api.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/presence-api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pingPresence } from '@/lib/presence/presenceApi';

const getToken = vi.fn();
vi.mock('@/lib/auth-storage', () => ({ getToken: () => getToken() }));

beforeEach(() => {
  vi.restoreAllMocks();
  getToken.mockReturnValue('test-token');
});

describe('pingPresence', () => {
  it('doğru URL, method ve token ile POST eder', async () => {
    const spy = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => ({ count: 3 }) }));
    global.fetch = spy as never;
    await pingPresence();
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/presence/ping');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('sayıyı döner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 7 }) })) as never;
    expect(await pingPresence()).toBe(7);
  });

  it('sıfır sayıyı da doğru döner (0 ile null karışmamalı)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 0 }) })) as never;
    expect(await pingPresence()).toBe(0);
  });

  it('token yoksa istek ATMAZ ve null döner', async () => {
    getToken.mockReturnValue(null);
    const spy = vi.fn();
    global.fetch = spy as never;
    expect(await pingPresence()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('sunucu hata dönerse null döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await pingPresence()).toBeNull();
  });

  it('ağ hatası fırlatırsa null döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await pingPresence()).toBeNull();
  });

  it('cevapta count sayı değilse null döner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 'çok' }) })) as never;
    expect(await pingPresence()).toBeNull();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/presence-api.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/presence/presenceApi"`

- [ ] **Step 3: İstemciyi yaz**

`apps/web/lib/presence/presenceApi.ts`:

```ts
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * "Uygulamadayim" sinyali gonderir ve AKTIF DIGER sporcu sayisini doner.
 *
 * null = bilinmiyor (token yok / ag hatasi / bozuk cevap). Cagiran taraf null
 * gorunce rozeti HIC gostermez — uydurma sayi gosterilmez (KURAL #1).
 * 0 ile null'i karistirma: 0 gecerli bir cevaptir ("baska kimse yok").
 */
export async function pingPresence(): Promise<number | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/presence/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data?.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/presence-api.test.ts`
Beklenen: 7 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/lib/presence/presenceApi.ts apps/web/tests/presence-api.test.ts
git commit -m "feat: pingPresence istemcisi"
```

---

### Task 4: Frontend — `PresenceContext`

**Files:**
- Create: `apps/web/lib/presence/PresenceContext.tsx`
- Test: `apps/web/tests/presence-context.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/presence-context.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const pingPresence = vi.fn();
vi.mock('@/lib/presence/presenceApi', () => ({
  pingPresence: () => pingPresence(),
}));

import { PresenceProvider, usePresenceCount } from '@/lib/presence/PresenceContext';

function Probe() {
  const count = usePresenceCount();
  return <span data-testid="count">{count === null ? 'yok' : String(count)}</span>;
}

beforeEach(() => {
  pingPresence.mockReset();
  pingPresence.mockResolvedValue(3);
});

describe('PresenceProvider', () => {
  it('mount olunca HEMEN ping atar (30 sn beklemez)', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(pingPresence).toHaveBeenCalledTimes(1));
  });

  it('gelen sayıyı hook üzerinden dağıtır', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
  });

  it('sayı 0 ise 0 gösterir (null ile karışmaz)', async () => {
    pingPresence.mockResolvedValue(0);
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  });

  it('ping null dönerse sayı bilinmiyor kalır', async () => {
    pingPresence.mockResolvedValue(null);
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(pingPresence).toHaveBeenCalled());
    expect(screen.getByTestId('count')).toHaveTextContent('yok');
  });

  it('aralık dolunca TEKRAR ping atar', async () => {
    render(
      <PresenceProvider intervalMs={40}><Probe /></PresenceProvider>,
    );
    // Kisa aralik + waitFor: sahte zamanlayici KULLANILMIYOR (bkz. plan basi).
    await waitFor(
      () => expect(pingPresence.mock.calls.length).toBeGreaterThanOrEqual(3),
      { timeout: 2000 },
    );
  });

  it('provider dışında kullanılırsa sayı bilinmiyor döner (çökmez)', () => {
    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('yok');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/presence-context.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/lib/presence/PresenceContext"`

- [ ] **Step 3: Context'i yaz**

`apps/web/lib/presence/PresenceContext.tsx`:

```tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { pingPresence } from '@/lib/presence/presenceApi';

/** null = bilinmiyor (henuz ping atilmadi / hata). 0 gecerli bir degerdir. */
const PresenceContext = createContext<number | null>(null);

/** Aktif DIGER sporcu sayisi. Provider disinda null doner (cokmez). */
export function usePresenceCount(): number | null {
  return useContext(PresenceContext);
}

interface Props {
  children: ReactNode;
  /**
   * Ping araligi (ms). Varsayilan 30 sn.
   * Testte kisa deger verilir — sahte zamanlayici yerine gercek kisa aralik
   * kullanilir (async fetch ile fake timer birlesimi kirilgan).
   */
  intervalMs?: number;
}

/**
 * Ping dongusu TEK YERDE calisir (sporcu layout'u). Sayi context ile dagitilir —
 * her kart kendi ping'ini atarsa gereksiz trafik olurdu.
 */
export function PresenceProvider({ children, intervalMs = 30_000 }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      const n = await pingPresence();
      if (alive) setCount(n);
    };
    void beat();                                  // ilk ping hemen
    const id = setInterval(() => void beat(), intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);

  return <PresenceContext.Provider value={count}>{children}</PresenceContext.Provider>;
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/presence-context.test.tsx`
Beklenen: 6 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/lib/presence/PresenceContext.tsx apps/web/tests/presence-context.test.tsx
git commit -m "feat: PresenceProvider + usePresenceCount"
```

---

### Task 5: Frontend — `ActivePlayersBadge`

**Files:**
- Create: `apps/web/components/play/ActivePlayersBadge.tsx`
- Test: `apps/web/tests/active-players-badge.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/active-players-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ActivePlayersBadge, activeColor, ACTIVE_GREEN, INACTIVE_RED,
} from '@/components/play/ActivePlayersBadge';

describe('activeColor', () => {
  it('sıfırda kırmızı döner', () => {
    expect(activeColor(0)).toBe(INACTIVE_RED);
  });

  it('sıfırdan büyükte yeşil döner', () => {
    expect(activeColor(1)).toBe(ACTIVE_GREEN);
    expect(activeColor(45)).toBe(ACTIVE_GREEN);
  });
});

describe('ActivePlayersBadge', () => {
  it('sayıyı gösterir', () => {
    render(<ActivePlayersBadge count={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('sıfırı da gösterir', () => {
    render(<ActivePlayersBadge count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('sayı > 0 iken yeşil arka plan kullanır', () => {
    render(<ActivePlayersBadge count={3} />);
    const el = screen.getByText('3');
    expect(el.style.backgroundColor).not.toBe('');
    expect(el.getAttribute('data-active')).toBe('true');
  });

  it('sayı 0 iken kırmızı ve data-active false olur', () => {
    render(<ActivePlayersBadge count={0} />);
    expect(screen.getByText('0').getAttribute('data-active')).toBe('false');
  });

  it('ekran okuyucu için anlamlı etiket taşır', () => {
    render(<ActivePlayersBadge count={5} />);
    expect(screen.getByLabelText('5 aktif sporcu')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/active-players-badge.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/play/ActivePlayersBadge"`

- [ ] **Step 3: Bileşeni yaz**

`apps/web/components/play/ActivePlayersBadge.tsx`:

```tsx
'use client';

/** Acik yesil — o an baska aktif sporcu VAR. */
export const ACTIVE_GREEN = '#4ade80';
/** Kirmizi — baska aktif sporcu YOK. */
export const INACTIVE_RED = '#f87171';

/** Sayiya gore renk. Ikon rengi ve rozet ayni kaynaktan beslenir (DRY). */
export function activeColor(count: number): string {
  return count > 0 ? ACTIVE_GREEN : INACTIVE_RED;
}

/** "Arkadasla Oyna" yazisinin sonunda duran dairesel sayi rozeti. */
export function ActivePlayersBadge({ count }: { count: number }) {
  const color = activeColor(count);
  return (
    <span
      aria-label={`${count} aktif sporcu`}
      data-active={count > 0 ? 'true' : 'false'}
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{
        minWidth: 20,
        height: 20,
        padding: '0 5px',
        fontSize: '0.68rem',
        backgroundColor: color,
        color: '#0b1020',
      }}
    >
      {count}
    </span>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/active-players-badge.test.tsx`
Beklenen: 7 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/play/ActivePlayersBadge.tsx apps/web/tests/active-players-badge.test.tsx
git commit -m "feat: ActivePlayersBadge + activeColor"
```

---

### Task 6: Layout'a provider, home ve play sayfalarına rozet

**Files:**
- Modify: `apps/web/app/(child)/layout.tsx`
- Modify: `apps/web/app/(child)/home/page.tsx`
- Modify: `apps/web/app/(child)/play/page.tsx`
- Test: `apps/web/tests/friend-badge-usage.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/friend-badge-usage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const usePresenceCount = vi.fn();
vi.mock('@/lib/presence/PresenceContext', () => ({
  usePresenceCount: () => usePresenceCount(),
  PresenceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div>Bota Karşı Pratik Yap</div>,
}));

import PlayPage from '@/app/(child)/play/page';

beforeEach(() => {
  usePresenceCount.mockReset();
});

describe('/play — Arkadaşla Oyna rozeti', () => {
  it('sayı bilinmiyorken rozet GÖSTERİLMEZ', () => {
    usePresenceCount.mockReturnValue(null);
    render(<PlayPage />);
    expect(screen.queryByLabelText(/aktif sporcu/)).not.toBeInTheDocument();
  });

  it('sayı 0 iken kırmızı rozet gösterilir', () => {
    usePresenceCount.mockReturnValue(0);
    render(<PlayPage />);
    const badge = screen.getByLabelText('0 aktif sporcu');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('data-active')).toBe('false');
  });

  it('sayı > 0 iken yeşil rozet ve doğru sayı gösterilir', () => {
    usePresenceCount.mockReturnValue(21);
    render(<PlayPage />);
    const badge = screen.getByLabelText('21 aktif sporcu');
    expect(badge).toHaveTextContent('21');
    expect(badge.getAttribute('data-active')).toBe('true');
  });

  it('rozet YALNIZCA Arkadaşla Oyna kartındadır', () => {
    usePresenceCount.mockReturnValue(5);
    render(<PlayPage />);
    expect(screen.getAllByLabelText(/aktif sporcu/)).toHaveLength(1);
  });

  it('REGRESYON: dört mod kartı hâlâ listeleniyor', () => {
    usePresenceCount.mockReturnValue(5);
    render(<PlayPage />);
    expect(screen.getByText('Arkadaşla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Açılışı Pratiği Yap')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/friend-badge-usage.test.tsx`
Beklenen: FAIL — `Unable to find a label with the text of: 0 aktif sporcu`
(1. test geçebilir çünkü rozet henüz hiç yok — bu normal)

- [ ] **Step 3: Layout'a provider ekle**

`apps/web/app/(child)/layout.tsx` — dosyanın TAMAMINI değiştir:

```tsx
'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';

export default function ChildLayout({ children }: { children: ReactNode }) {
  // Provider BURADA: bu layout tum sporcu sayfalarini kapsar (home, play,
  // lesson, pratik, ...) — "uygulamada olan herkes" tanimi tam olarak budur.
  return (
    <PresenceProvider>
      <div className="t-page min-h-screen">
        <AppNav />
        {children}
      </div>
    </PresenceProvider>
  );
}
```

- [ ] **Step 4: `/play` sayfasına rozeti ekle**

`apps/web/app/(child)/play/page.tsx` — import bloğuna ekle
(`import { useTabGuard } ...` satırının ALTINA):

```tsx
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge } from '@/components/play/ActivePlayersBadge';
```

`function PlayInner() {` içinde, `useTabGuard('play');` satırının ALTINA ekle:

```tsx
  const activeCount = usePresenceCount();
```

Ve mod seçimi kartlarındaki başlık satırını bul:

```tsx
              <p className="font-semibold text-sm">{c.title}</p>
```

TAMAMINI aşağıdakiyle değiştir:

```tsx
              <p className="font-semibold text-sm flex items-center gap-2">
                {c.title}
                {c.mode === 'friend' && activeCount !== null && (
                  <ActivePlayersBadge count={activeCount} />
                )}
              </p>
```

- [ ] **Step 5: Ana sayfaya rozeti ve ikon rengini ekle**

`apps/web/app/(child)/home/page.tsx` — import bloğuna ekle
(`import { HOME_BOT_LEVELS ... } from './botShortcut';` satırının ALTINA):

```tsx
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge, activeColor } from '@/components/play/ActivePlayersBadge';
```

`export default function ChildHomePage() {` içinde, `const { settings } = useSettings();`
satırının ALTINA ekle:

```tsx
  const activeCount = usePresenceCount();
```

Ve "Arkadaşla Oyna" bloğunu bul:

```tsx
            <Link href="/play?mode=friend" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ ...raised(999, 4), width: 44, height: 44, color: 'var(--t-text-1)' }}>
                <IconFriends s={20} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Arkadaşla Oyna</span>
            </Link>
```

TAMAMINI aşağıdakiyle değiştir:

```tsx
            <Link href="/play?mode=friend" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{
                  ...raised(999, 4), width: 44, height: 44,
                  // Sayi bilinmiyorken varsayilan renk korunur (uydurma renk yok).
                  color: activeCount === null ? 'var(--t-text-1)' : activeColor(activeCount),
                }}>
                <IconFriends s={20} />
              </span>
              <span className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--t-text-1)' }}>
                Arkadaşla Oyna
                {activeCount !== null && <ActivePlayersBadge count={activeCount} />}
              </span>
            </Link>
```

- [ ] **Step 6: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/friend-badge-usage.test.tsx`
Beklenen: 5 test PASS

- [ ] **Step 7: Mevcut sayfa testlerinin kırılmadığını doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-page-tabs.test.tsx tests/home-play-modes.test.tsx tests/home-bot-shortcut.test.tsx`
Beklenen: hepsi PASS.

> **Kırılırsa:** Muhtemel sebep, bu testlerin `PresenceProvider` olmadan sayfa render
> etmesidir. `usePresenceCount` provider dışında `null` döndüğü için rozet
> gösterilmez ve sayfa normal çalışır — yani kırılmaması beklenir. Yine de kırılırsa
> testi ZAYIFLATMA; `@/lib/presence/PresenceContext` mock'unu ekle (bu dosyadaki
> mock bloğunu kopyala).

- [ ] **Step 8: Commit**

```bash
cd /c/Users/muham/chess-app
git add "apps/web/app/(child)/layout.tsx" "apps/web/app/(child)/home/page.tsx" "apps/web/app/(child)/play/page.tsx" apps/web/tests/friend-badge-usage.test.tsx
git commit -m "feat: aktif sporcu rozeti - home ve play kartlarinda"
```

---

### Task 7: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: Backend**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS, **sıfır başarısız**

- [ ] **Step 2: TypeScript**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: çıktı yok

- [ ] **Step 3: Lint**

Çalıştır: `cd apps/web && npx next lint`
Beklenen: yalnızca ÖNCEDEN var olan uyarılar. **Yeni HATA (Error) çıkmamalı.**
Hata sayısını doğrula: `npx next lint 2>&1 | grep -c "Error:"` → `0`

- [ ] **Step 4: Tüm frontend testleri**

Çalıştır: `cd apps/web && npx vitest run`
Beklenen: tüm dosyalar PASS. P9 sonrası 432 test vardı; bu plan +25 getirir
(`presence-api` 7, `presence-context` 6, `active-players-badge` 7,
`friend-badge-usage` 5). Toplam **457** olmalı, **sıfır başarısız**.

- [ ] **Step 5: Üretim derlemesi**

Çalıştır: `cd apps/web && npm run build`
Beklenen: `✓ Compiled successfully`

- [ ] **Step 6: Commit (yalnızca düzeltme yapıldıysa)**

```bash
cd /c/Users/muham/chess-app
git add -A apps/web apps/api
git commit -m "test: P10 tam test kapisi"
```

Düzeltme gerekmediyse bu adım atlanır.

---

### Task 8: Canlı doğrulama (KURAL #6)

**Files:** yok (tarayıcıda gerçek sürüş)

Yeni bir backend ucu var, bu yüzden canlı doğrulamadan önce prod'a push gerekir.
Yeni migration YOK — Railway yalnızca kodu deploy eder, şema değişmez.

- [ ] **Step 1: Kullanıcıdan push onayı al**

Kullanıcıya açıkça söyle ve onay bekle:
- Yeni bir uç prod'a çıkacak (`POST /presence/ping`)
- Yeni tablo/migration YOK, veritabanına hiç dokunulmuyor
- Sporcular uygulamadayken 30 sn'de bir küçük bir istek atmaya başlayacak
- **Muhtemelen yalnızca "kırmızı 0" durumu canlıda görülebilecek** (tek tarayıcı
  oturumu var); yeşil durum görülemezse raporda açıkça belirtilecek

Onay gelmezse DUR.

- [ ] **Step 2: Push ve CI**

```bash
cd /c/Users/muham/chess-app
git push origin main
```

`gh run list --limit 1` ile çalışmayı bul, `gh run watch <id> --exit-status` ile bekle,
`gh run view <id> --json status,conclusion,jobs` ile üç işin de (API, Web, E2E)
`success` olduğunu doğrula.

- [ ] **Step 3: Ucun prod'da yayında olduğunu doğrula**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://chess-app-production-1dab.up.railway.app/presence/ping"
```
Beklenen: `401` veya `403` (tokensiz reddediliyor = uç yayında ve korumalı).
`404` dönerse Railway deploy'unu bekle ve tekrar dene.

- [ ] **Step 4: Ortamı hazırla ve dev sunucusunu başlat**

`apps/web/.env.local` oluştur:
```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```
**UYARI:** Bu dosya ASLA commit edilmez, doğrulama bitince silinir.

`preview_start` aracını `{ name: "chess-web" }` ile çağır (Bash ile sunucu başlatılmaz).
`preview_logs` ile derlemenin temiz olduğunu doğrula.

- [ ] **Step 5: Ping'in gerçekten atıldığını doğrula**

Sporcu ana sayfasına (`/home`) git. `read_network_requests` aracını
`{ urlPattern: "presence" }` ile çağır. Doğrula:
- `POST /presence/ping` isteği **var**
- Cevap kodu **200**

- [ ] **Step 6: Rozeti ana sayfada doğrula**

`/home` → Maç Yap sekmesini aç. `get_page_text` ve DOM sorgusuyla doğrula:
- "Arkadaşla Oyna" satırında rozet **var**
- Tek oturum olduğu için sayı **0** ve `data-active="false"` (kırmızı)

`javascript_tool` ile kesinleştir:
```js
(function(){
  const b = document.querySelector('[aria-label$="aktif sporcu"]');
  return b ? JSON.stringify({ metin: b.textContent, aktif: b.dataset.active,
    renk: getComputedStyle(b).backgroundColor }) : 'ROZET YOK';
})();
```
Beklenen: `metin: "0"`, `aktif: "false"`, renk kırmızı tonu (`rgb(248, 113, 113)`).

- [ ] **Step 7: Rozeti /play sayfasında doğrula**

`/play` adresine git. Aynı DOM sorgusuyla doğrula:
- Rozet **yalnızca** "Arkadaşla Oyna" kartında (`document.querySelectorAll('[aria-label$="aktif sporcu"]').length === 1`)
- Yine `0` / kırmızı

- [ ] **Step 8: Sayının canlı olarak arttığını dene (yapılabilirse)**

İkinci bir sporcu oturumu açılabiliyorsa (ayrı tarayıcı profili/gizli pencere),
ikinci sporcu uygulamaya girdiğinde ilk sporcunun rozetinin **yeşil 1** olmasını bekle
(en fazla ~30 sn).

> **Yapılamazsa DUR ve raporda açıkça yaz:** "Yeşil durum canlıda görülemedi — tek
> tarayıcı oturumu var. Yalnızca otomatik testlerle doğrulandı." Uydurma yapma (KURAL #1).

- [ ] **Step 9: Regresyon — sayfalar bozulmadı**

- `/home`: Dersler ve Eğlence sekmeleri hâlâ açılıyor
- `/play`: dört kart duruyor, "Bota Karşı Oyna" seçilince kriter ekranı geliyor

`read_console_messages` ile konsol hatası olmadığını doğrula.

- [ ] **Step 10: Temizlik**

- `apps/web/.env.local` dosyasını **sil**
- `preview_stop` ile sunucuyu durdur
- `git status` ile başıboş dosya kalmadığını doğrula

> **Prod'da kalıntı YOK:** Presence tamamen bellekte ve 60 sn TTL'li — test sırasında
> atılan ping'ler kendiliğinden silinir, temizlenecek veri yoktur.

- [ ] **Step 11: Dürüst rapor yaz**

Neyin tarayıcıda **gerçekten** görüldüğünü, neyin yalnızca otomatik testle doğrulandığını
açıkça ayır. Özellikle: yeşil durum canlıda görüldü mü, görülmedi mi. Doğrulanamayan
hiçbir şey için "çalışıyor" DENMEZ (KURAL #1). Rapor CLAUDE.md'deki ekip ağzıyla yazılır.

---

## Kapsam Notları

- **Yalnızca sayı** — isim listesi yok (4. işin konusu).
- **30 sn gecikme kabul edildi** — anlık güncelleme yok.
- **Diğer üç kart** (Bota Karşı, Açılış Pratiği, Turnuva) rozet almaz.
- **`lobby.py`'ye dokunulmuyor** — 3. iş (lobi teklif panosu) onu kullanacak; presence
  ondan ayrı yaşar.
- **Veritabanı değişikliği yok** — migration yok, tablo yok.
- **`active_players()` bu işte kullanılmıyor** ama yazılıyor: 4. iş (isim arama) onu
  kullanacak ve `active_count` ile aynı filtreyi paylaşıyor (DRY).
