# Arkadaşa Karşı Pratik + İsim Arama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sporcunun aynı hocadaki arkadaşlarını arayıp seçerek maç teklif edebilmesi ve gelen teklifi **uygulamanın her yerinde** görebilmesi.

**Architecture:** Tek yeni backend ucu (`GET /athletes`, aynı hoca kapsamlı). Lobi WebSocket bağlantısı `LobbyProvider`'a taşınır (tek bağlantı kuralı), bildirim şeridi ve teklif panosu aynı context'ten beslenir. Arama mantığı saf ve Türkçe duyarlı bir modülde.

**Tech Stack:** FastAPI + SQLAlchemy 2 async, pytest; Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-26-arkadasa-karsi-pratik-isim-arama-design.md`

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/api/chess_api/routers/athletes.py` **(yeni)** | `GET /athletes` — aynı hocanın sporcuları. |
| `apps/api/chess_api/main.py` **(değişir)** | Router kaydı. |
| `apps/web/lib/play/athleteFilter.ts` **(yeni)** | Saf: Türkçe küçültme, harf harf filtre, aktiflik birleştirme. |
| `apps/web/lib/lobby/LobbyContext.tsx` **(yeni)** | Tek lobi bağlantısı + maç yönlendirmesi. |
| `apps/web/components/play/IncomingChallengeBanner.tsx` **(yeni)** | Her sayfada gelen teklif şeridi. |
| `apps/web/components/play/FriendChallenge.tsx` **(yeni)** | İki sıralı kart: kriterler + arkadaş seçimi (ARA). |
| `apps/web/app/(child)/layout.tsx` **(değişir)** | `LobbyProvider` + banner. |
| `apps/web/components/play/OfferBoard.tsx` **(değişir)** | Context'ten okur, `onMatched` prop'u kalkar. |
| `apps/web/components/play/OpeningPractice.tsx` **(değişir)** | `onMatched` kalkar; 🤝 kartı `FriendChallenge` açar. |
| `apps/web/app/(child)/play/page.tsx` **(değişir)** | `onMatched` geçirmez. |
| `apps/web/components/ChallengeScreen.tsx` **(SİLİNİR)** | Görevi `FriendChallenge`'a devredildi. |

---

## Task 1: `GET /athletes`

**Files:**
- Create: `apps/api/chess_api/routers/athletes.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_athletes.py`

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_athletes.py`:

```python
import pytest
from sqlalchemy import select
from chess_api.models.child import ChildProfile


async def _set_teacher(db, child_id: int, teacher_id: int | None) -> None:
    row = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == child_id)
    )).scalar_one()
    row.teacher_user_id = teacher_id
    await db.commit()


async def _add_child(db, name: str, teacher_id: int | None, parent_id: int) -> int:
    c = ChildProfile(
        parent_user_id=parent_id, display_name=name, age=10,
        pin_hash="x", teacher_user_id=teacher_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c.id


@pytest.mark.asyncio
async def test_hocasi_olmayan_sporcu_bos_liste_alir(client, child_auth):
    """Hangi akademiye ait oldugu bilinmeyen cocuga isim gosterilmez."""
    token, _ = child_auth
    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_ayni_hocanin_sporculari_listelenir_kendisi_haric(client, child_auth, db):
    token, my_id = child_auth
    me = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == my_id)
    )).scalar_one()
    parent_id = me.parent_user_id
    await _set_teacher(db, my_id, 77)

    ayni = await _add_child(db, "Ayse", 77, parent_id)
    await _add_child(db, "Baska Hoca Sporcusu", 88, parent_id)

    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert [a["child_id"] for a in data] == [ayni]
    assert data[0]["display_name"] == "Ayse"


@pytest.mark.asyncio
async def test_ada_gore_sirali_doner(client, child_auth, db):
    token, my_id = child_auth
    me = (await db.execute(
        select(ChildProfile).where(ChildProfile.id == my_id)
    )).scalar_one()
    parent_id = me.parent_user_id
    await _set_teacher(db, my_id, 77)

    await _add_child(db, "Zeynep", 77, parent_id)
    await _add_child(db, "Ahmet", 77, parent_id)

    r = await client.get("/athletes", headers={"Authorization": f"Bearer {token}"})
    assert [a["display_name"] for a in r.json()] == ["Ahmet", "Zeynep"]


@pytest.mark.asyncio
async def test_kimliksiz_istek_reddedilir(client):
    r = await client.get("/athletes")
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_athletes.py -q
```

Beklenen: FAIL — `/athletes` yok, 404 döner.

- [ ] **Step 3: Write the implementation**

`apps/api/chess_api/routers/athletes.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models.child import ChildProfile

router = APIRouter(tags=["athletes"])


@router.get("/athletes")
async def list_athletes(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcunun ARKADASLARI: AYNI HOCAYA bagli diger sporcular.

    Hocasi atanmamis sporcuya BOS liste doner — hangi akademide oldugu
    bilinmeyen bir cocuga baska cocuklarin adlari gosterilmez (gizlilik).
    """
    if child.teacher_user_id is None:
        return []
    rows = (await db.execute(
        select(ChildProfile)
        .where(
            ChildProfile.teacher_user_id == child.teacher_user_id,
            ChildProfile.id != child.id,
        )
        .order_by(ChildProfile.display_name)
    )).scalars().all()
    return [{"child_id": c.id, "display_name": c.display_name} for c in rows]
```

`apps/api/chess_api/main.py`: 5. satırdaki router import zincirine `athletes as athletes_router`
ekle ve `presence_router` kaydının hemen altına şunu koy:

```python
    app.include_router(athletes_router.router)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_athletes.py -q
```

Beklenen: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/athletes.py apps/api/chess_api/main.py apps/api/tests/test_athletes.py
git commit -m "feat: GET /athletes - ayni hocanin sporculari"
```

---

## Task 2: `athleteFilter.ts` saf arama mantığı

**Files:**
- Create: `apps/web/lib/play/athleteFilter.ts`
- Test: `apps/web/tests/athlete-filter.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/athlete-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { trLower, filterAthletes, mergeOnline } from '@/lib/play/athleteFilter';
import type { AthleteRow } from '@/lib/play/athleteFilter';

const ROWS: AthleteRow[] = [
  { child_id: 1, display_name: 'Ayşe',   online: true },
  { child_id: 2, display_name: 'Ayhan',  online: false },
  { child_id: 3, display_name: 'Mehmet', online: true },
  { child_id: 4, display_name: 'Şeyma',  online: false },
  { child_id: 5, display_name: 'Işık',   online: false },
];

describe('trLower', () => {
  it('Türkçe büyük İ küçülünce i olur', () => {
    expect(trLower('İSTANBUL')).toBe('istanbul');
  });

  it('Türkçe büyük I küçülünce ı olur', () => {
    expect(trLower('IŞIK')).toBe('ışık');
  });
});

describe('filterAthletes', () => {
  it('boş sorgu tüm listeyi döndürür', () => {
    expect(filterAthletes(ROWS, '')).toHaveLength(5);
    expect(filterAthletes(ROWS, '   ')).toHaveLength(5);
  });

  it('harf harf daraltır', () => {
    expect(filterAthletes(ROWS, 'a').map((r) => r.display_name))
      .toEqual(['Ayşe', 'Ayhan', 'Mehmet']);
    expect(filterAthletes(ROWS, 'ay').map((r) => r.display_name))
      .toEqual(['Ayşe', 'Ayhan']);
    expect(filterAthletes(ROWS, 'ayh').map((r) => r.display_name))
      .toEqual(['Ayhan']);
  });

  it('TÜRKÇE: büyük harfle arama da tutar', () => {
    expect(filterAthletes(ROWS, 'ŞEY').map((r) => r.display_name)).toEqual(['Şeyma']);
    expect(filterAthletes(ROWS, 'IŞ').map((r) => r.display_name)).toEqual(['Işık']);
  });

  it('eşleşme yoksa boş döner', () => {
    expect(filterAthletes(ROWS, 'zzz')).toEqual([]);
  });
});

describe('mergeOnline', () => {
  it('aktifleri başa alır ve online bayrağını koyar', () => {
    const all = [
      { child_id: 1, display_name: 'Ayşe' },
      { child_id: 2, display_name: 'Ayhan' },
      { child_id: 3, display_name: 'Mehmet' },
    ];
    const merged = mergeOnline(all, [3]);
    expect(merged.map((r) => r.display_name)).toEqual(['Mehmet', 'Ayşe', 'Ayhan']);
    expect(merged[0].online).toBe(true);
    expect(merged[1].online).toBe(false);
  });

  it('kimse aktif değilse sıra korunur', () => {
    const all = [{ child_id: 1, display_name: 'Ayşe' }];
    expect(mergeOnline(all, [])).toEqual([
      { child_id: 1, display_name: 'Ayşe', online: false },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/athlete-filter.test.ts
```

Beklenen: FAIL — `Failed to resolve import "@/lib/play/athleteFilter"`.

- [ ] **Step 3: Write the implementation**

`apps/web/lib/play/athleteFilter.ts`:

```ts
/** /athletes ucundan gelen sporcu. */
export interface Athlete { child_id: number; display_name: string }

/** Listede gosterilen satir: sporcu + o an lobide mi. */
export interface AthleteRow extends Athlete { online: boolean }

/** TURKCE duyarli kucultme.
 *  'İSTANBUL'.toLowerCase() Ingilizce kurallarla 'i̇stanbul' uretir ve
 *  "ist" aramasi TUTMAZ. Cocuk uygulamasinda arama kutusu calismak zorunda. */
export function trLower(s: string): string {
  return s.toLocaleLowerCase('tr');
}

/** Harf harf filtre. Bos/bosluklu sorgu tum listeyi dondurur. */
export function filterAthletes(rows: AthleteRow[], query: string): AthleteRow[] {
  const q = trLower(query.trim());
  if (!q) return rows;
  return rows.filter((r) => trLower(r.display_name).includes(q));
}

/** /athletes listesi + lobideki aktif id'ler -> tek liste.
 *  Aktifler BASA alinir; her grup icinde gelen sira (ada gore) korunur. */
export function mergeOnline(all: Athlete[], onlineIds: number[]): AthleteRow[] {
  const set = new Set(onlineIds);
  const rows: AthleteRow[] = all.map((a) => ({ ...a, online: set.has(a.child_id) }));
  return [...rows.filter((r) => r.online), ...rows.filter((r) => !r.online)];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/athlete-filter.test.ts
```

Beklenen: PASS — 9 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/athleteFilter.ts apps/web/tests/athlete-filter.test.ts
git commit -m "feat: turkce duyarli sporcu arama mantigi"
```

---

## Task 3: `LobbyProvider` — tek lobi bağlantısı

**Files:**
- Create: `apps/web/lib/lobby/LobbyContext.tsx`
- Modify: `apps/web/app/(child)/layout.tsx`
- Modify: `apps/web/components/play/OfferBoard.tsx`
- Modify: `apps/web/app/(child)/play/page.tsx`

- [ ] **Step 1: Provider'ı yaz**

`apps/web/lib/lobby/LobbyContext.tsx`:

```tsx
'use client';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLobby } from '@/lib/hooks/use-lobby';

type LobbyValue = ReturnType<typeof useLobby>;

const LobbyContext = createContext<LobbyValue | null>(null);

export function useLobbyContext(): LobbyValue {
  const v = useContext(LobbyContext);
  if (!v) throw new Error('useLobbyContext yalnizca LobbyProvider icinde kullanilir');
  return v;
}

/** Lobi soketi TEK bir yerde acilir.
 *
 *  Ikinci bir baglanti acmak YASAK: sunucudaki join_lobby ayni cocugun eski
 *  kaydinin uzerine yazar (tek sekme kurali, lobby.py) — yani ikinci baglanti
 *  ilkini dusurur ve teklif panosu olur.
 *
 *  Mac yonlendirmesi de burada: teklif nerede kabul edilirse edilsin sporcu
 *  tahtaya gider. */
export function LobbyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const lobby = useLobby({
    onMatched: ({ gameId, color }) => router.push(`/play/online/${gameId}?color=${color}`),
  });
  return <LobbyContext.Provider value={lobby}>{children}</LobbyContext.Provider>;
}
```

- [ ] **Step 2: `OfferBoard`'u context'e bağla**

`apps/web/components/play/OfferBoard.tsx` içinde:

`import { useLobby } from '@/lib/hooks/use-lobby';` ve
`import type { MatchedInfo } from '@/lib/hooks/use-lobby';` satırlarını **sil**, yerine:

```tsx
import { useLobbyContext } from '@/lib/lobby/LobbyContext';
```

`interface Props { onMatched: ... }` bloğunu **sil** ve imzayı değiştir:

```tsx
/** Teklif panosu: acik teklifleri listeler, tek dokunusla mac baslatir,
 *  uygun teklif yoksa sporcunun kendi teklifini birakmasini saglar.
 *  Mac yonlendirmesi LobbyProvider'da — bu bilesen onMatched ALMAZ. */
export function OfferBoard() {
  const { offers, myOffer, notice, createOffer, cancelOffer, takeOffer } =
    useLobbyContext();
```

(Dosyanın geri kalanı aynen kalır.)

- [ ] **Step 3: Layout'a provider'ı ekle**

`apps/web/app/(child)/layout.tsx` dosyasının **tamamı**:

```tsx
'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';
import { LobbyProvider } from '@/lib/lobby/LobbyContext';
import { IncomingChallengeBanner } from '@/components/play/IncomingChallengeBanner';

export default function ChildLayout({ children }: { children: ReactNode }) {
  // Provider'lar BURADA: bu layout tum sporcu sayfalarini kapsar (home, play,
  // lesson, pratik, ...) — "uygulamada olan herkes" tanimi tam olarak budur.
  // Lobi soketi de burada tek sefer acilir; gelen mac teklifi bu yuzden HER
  // sayfada gorunur.
  return (
    <PresenceProvider>
      <LobbyProvider>
        <div className="t-page min-h-screen">
          <AppNav />
          <IncomingChallengeBanner />
          {children}
        </div>
      </LobbyProvider>
    </PresenceProvider>
  );
}
```

- [ ] **Step 4: `/play` sayfasından `onMatched`'i sök**

`apps/web/app/(child)/play/page.tsx` içinde `mode === 'friend'` dalındaki bloğu değiştir:

```tsx
        <OfferBoard />
```

ve `mode === 'opening'` dalındaki bloğu değiştir:

```tsx
        <OpeningPractice />
```

Ardından `const router = useRouter();` satırı ve `import { useRouter, useSearchParams }`
satırı gözden geçirilir: `router` başka yerde kullanılmıyorsa **ikisi de** sadeleştirilir
(`import { useSearchParams } from 'next/navigation';`). `npx tsc --noEmit` ve
`npx next lint` bunu zaten yakalar.

**NOT:** `IncomingChallengeBanner` Task 4'te yazılacak; Task 3 tek başına derlenmez.
Task 3 ve Task 4 **tek commit** olarak bitirilir (Task 4 Step 4'teki commit).

---

## Task 4: `IncomingChallengeBanner`

**Files:**
- Create: `apps/web/components/play/IncomingChallengeBanner.tsx`
- Test: `apps/web/tests/incoming-challenge-banner.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/incoming-challenge-banner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IncomingChallenge } from '@/lib/hooks/use-lobby';

const acceptChallenge = vi.fn();
const declineChallenge = vi.fn();
let incoming: IncomingChallenge | null = null;

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({
    players: [], offers: [], myOffer: null, notice: '', incoming,
    acceptChallenge, declineChallenge,
    challenge: vi.fn(), createOffer: vi.fn(), cancelOffer: vi.fn(), takeOffer: vi.fn(),
  }),
}));

import { IncomingChallengeBanner } from '@/components/play/IncomingChallengeBanner';

beforeEach(() => {
  acceptChallenge.mockReset();
  declineChallenge.mockReset();
  incoming = null;
});

describe('IncomingChallengeBanner', () => {
  it('teklif yokken hiç render edilmez', () => {
    const { container } = render(<IncomingChallengeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('teklif varken ad ve tempo görünür', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: { tc_label: '5+0' } };
    render(<IncomingChallengeBanner />);
    expect(screen.getByText(/Ayşe sana maç teklif etti/)).toBeInTheDocument();
    expect(screen.getByText(/5\+0/)).toBeInTheDocument();
  });

  it('tempo bilgisi yoksa UYDURULMAZ', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    expect(screen.getByText(/Ayşe sana maç teklif etti/)).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('Evet acceptChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Evet' }));
    expect(acceptChallenge).toHaveBeenCalledTimes(1);
  });

  it('Hayır declineChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayır' }));
    expect(declineChallenge).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/incoming-challenge-banner.test.tsx
```

Beklenen: FAIL — bileşen yok.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/IncomingChallengeBanner.tsx`:

```tsx
'use client';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';

/** Gelen mac teklifi seridi. Layout'ta durur, bu yuzden sporcu HANGI sayfada
 *  olursa olsun teklifi gorur. Teklif yoksa hicbir sey cizmez. */
export function IncomingChallengeBanner() {
  const { incoming, acceptChallenge, declineChallenge } = useLobbyContext();
  if (!incoming) return null;

  // criteria serbest bicimli geldigi icin TIP KONTROLUYLE okunur; alan yoksa
  // etiket hic gosterilmez (uydurulmaz — KURAL #1).
  const tc = typeof incoming.criteria.tc_label === 'string'
    ? incoming.criteria.tc_label
    : null;

  return (
    <div className="t-ok mx-4 mt-3 p-3 flex items-center gap-2 flex-wrap">
      <p className="text-sm font-semibold flex-1 min-w-0">
        🤝 {incoming.from_name} sana maç teklif etti{tc ? ` — ${tc}` : ''}
      </p>
      <button type="button" className="t-btn px-4 py-2 text-sm"
        onClick={() => acceptChallenge(incoming)}>
        Evet
      </button>
      <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
        onClick={() => declineChallenge(incoming)}>
        Hayır
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Testleri çalıştır ve Task 3 + Task 4'ü birlikte commit et**

```bash
cd apps/web && npx vitest run tests/incoming-challenge-banner.test.tsx
```

Beklenen: PASS — 5 test.

```bash
git add apps/web/lib/lobby/LobbyContext.tsx apps/web/components/play/IncomingChallengeBanner.tsx apps/web/tests/incoming-challenge-banner.test.tsx apps/web/app/\(child\)/layout.tsx apps/web/app/\(child\)/play/page.tsx apps/web/components/play/OfferBoard.tsx
git commit -m "feat: tek lobi baglantisi (LobbyProvider) + her sayfada teklif seridi"
```

---

## Task 5: `FriendChallenge` + `ChallengeScreen` silinmesi

**Files:**
- Create: `apps/web/components/play/FriendChallenge.tsx`
- Delete: `apps/web/components/ChallengeScreen.tsx`
- Modify: `apps/web/components/play/OpeningPractice.tsx`
- Test: `apps/web/tests/friend-challenge.test.tsx`
- Modify: `apps/web/tests/opening-practice.test.tsx`, `apps/web/tests/friend-badge-usage.test.tsx`, `apps/web/tests/play-page-tabs.test.tsx`, `apps/web/tests/play-mode-param.test.tsx` (ChallengeScreen mock'ları → FriendChallenge)

- [ ] **Step 1: Write the failing test**

`apps/web/tests/friend-challenge.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const challenge = vi.fn();
let players: { child_id: number; display_name: string }[] = [];

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({
    players, offers: [], myOffer: null, notice: '', incoming: null,
    challenge, createOffer: vi.fn(), cancelOffer: vi.fn(), takeOffer: vi.fn(),
    acceptChallenge: vi.fn(), declineChallenge: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { FriendChallenge } from '@/components/play/FriendChallenge';

const ATHLETES = [
  { child_id: 1, display_name: 'Ayşe' },
  { child_id: 2, display_name: 'Ayhan' },
  { child_id: 3, display_name: 'Mehmet' },
];

beforeEach(() => {
  challenge.mockReset();
  players = [{ child_id: 1, display_name: 'Ayşe' }];  // yalnizca Ayse aktif
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ATHLETES })));
});

/** 1. karti onaylayip 2. karti acar ve isimlerin gelmesini bekler. */
async function pickCriteria() {
  fireEvent.click(screen.getByRole('button', { name: '5+0' }));
  fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));
  await waitFor(() => expect(screen.getByText('Ayşe')).toBeInTheDocument());
}

describe('FriendChallenge', () => {
  it('KİLİT: kriterler onaylanmadan 2. kart açılmaz', () => {
    render(<FriendChallenge />);
    const btn = screen.getByRole('button', { name: /2\. Arkadaşını Seç/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(screen.queryByPlaceholderText(/ARA/)).not.toBeInTheDocument();
  });

  it('kriterler onaylanınca 2. kart açılır ve isimler listelenir', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    expect(screen.getByText('Ayhan')).toBeInTheDocument();
    expect(screen.getByText('Mehmet')).toBeInTheDocument();
  });

  it('ARA kutusu harf harf süzer', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.change(screen.getByPlaceholderText(/ARA/), { target: { value: 'ayh' } });
    expect(screen.getByText('Ayhan')).toBeInTheDocument();
    expect(screen.queryByText('Mehmet')).not.toBeInTheDocument();
  });

  it('çevrimdışı isim seçilemez', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    const offline = screen.getByRole('button', { name: /Ayhan/ });
    expect(offline).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(offline);
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).not.toHaveBeenCalled();
  });

  it('aktif isme tıklanıp Teklif Et ile davet gönderilir', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Ayşe/ }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).toHaveBeenCalledTimes(1);
    expect(challenge.mock.calls[0][0]).toBe(1);
    expect(screen.getByText(/Ayşe bekleniyor/)).toBeInTheDocument();
  });

  it('isim seçilmeden Teklif Et basılamaz', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).not.toHaveBeenCalled();
  });

  it('liste yüklenemezse hata mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    render(<FriendChallenge />);
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));
    await waitFor(() =>
      expect(screen.getByText(/Sporcu listesi yüklenemedi/)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/friend-challenge.test.tsx
```

Beklenen: FAIL — bileşen yok.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/FriendChallenge.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { StepCard } from '@/components/play/StepCard';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';
import { filterAthletes, mergeOnline } from '@/lib/play/athleteFilter';
import type { Athlete, AthleteRow } from '@/lib/play/athleteFilter';
import { resolveColor } from '@/lib/play/color';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type StepKey = 'criteria' | 'friend';

/** Kriterleri WS'e gonderilecek sade nesneye cevirir (renk burada cozulur).
 *  ChallengeScreen'den TASINDI — alan adlari sunucudaki
 *  _handle_challenge_accept ile eslesmek zorunda, degistirilmez. */
function criteriaPayload(v: MatchCriteriaValue) {
  return {
    color: resolveColor(v.colorChoice),
    skill: v.level.skill,
    depth: v.level.depth,
    tc_label: v.timeControl.label,
    tc_base: v.timeControl.base,
    tc_increment: v.timeControl.increment,
  };
}

/** Arkadasa karsi pratik: sirali iki kart — kriterler, sonra arkadas secimi. */
export function FriendChallenge() {
  const { players, challenge } = useLobbyContext();
  const [open, setOpen] = useState<StepKey | null>('criteria');
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [all, setAll] = useState<Athlete[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AthleteRow | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  // Sporcu listesi bir kez yuklenir; aktiflik lobi soketinden ayrica gelir.
  useEffect(() => {
    const token = getToken();
    if (!token) { setAll([]); return; }
    let alive = true;
    fetch(`${API_BASE}/athletes`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('yuklenemedi'))))
      .then((d) => { if (alive) setAll(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) { setAll([]); setLoadError(true); } });
    return () => { alive = false; };
  }, []);

  const rows = mergeOnline(all ?? [], players.map((p) => p.child_id));
  const shown = filterAthletes(rows, query);

  function sendChallenge() {
    if (!criteria || !selected || !selected.online) return;
    challenge(selected.child_id, criteriaPayload(criteria));
    setWaitingFor(selected.display_name);
  }

  if (waitingFor) {
    return (
      <div className="t-card-i p-5 text-center space-y-2">
        <p className="text-3xl">⏳</p>
        <p className="font-bold text-sm">{waitingFor} bekleniyor…</p>
        <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
          onClick={() => setWaitingFor(null)}>
          Vazgeç
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StepCard
        stepNumber={1}
        title="Maç Kriterlerini Belirle"
        summary={criteria ? `✓ ${criteria.timeControl.label}` : null}
        open={open === 'criteria'}
        onToggle={() => setOpen((p) => (p === 'criteria' ? null : 'criteria'))}
      >
        <MatchCriteria
          startLabel="Kriterleri Onayla"
          onStart={(v) => { setCriteria(v); setOpen('friend'); }}
        />
      </StepCard>

      <StepCard
        stepNumber={2}
        title="Arkadaşını Seç"
        summary={selected ? `✓ ${selected.display_name}` : null}
        open={open === 'friend'}
        locked={criteria === null}
        onToggle={() => setOpen((p) => (p === 'friend' ? null : 'friend'))}
      >
        <div className="space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 ARA — arkadaşının adını yaz"
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{
              border: '1px solid var(--t-border)',
              background: 'var(--t-surface)',
              color: 'var(--t-text)',
            }}
          />

          {loadError && (
            <p className="text-sm t-muted">Sporcu listesi yüklenemedi.</p>
          )}
          {!loadError && all !== null && rows.length === 0 && (
            <p className="text-sm t-muted">Listede sporcu yok.</p>
          )}
          {!loadError && all !== null && rows.length > 0 && shown.length === 0 && (
            <p className="text-sm t-muted">Bu ada uyan arkadaş yok.</p>
          )}

          <div className="space-y-2">
            {shown.map((r) => {
              const isSel = selected?.child_id === r.child_id;
              return (
                <button
                  key={r.child_id}
                  type="button"
                  aria-disabled={!r.online}
                  onClick={() => { if (r.online) setSelected(r); }}
                  className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{
                    opacity: r.online ? 1 : 0.5,
                    border: isSel ? '2px solid var(--t-accent)' : undefined,
                  }}
                >
                  <span className="text-sm">{r.online ? '🟢' : '⚪'}</span>
                  <span className="font-medium text-sm flex-1">{r.display_name}</span>
                  {!r.online && <span className="text-xs t-muted">çevrimdışı</span>}
                  {isSel && <span className="text-xs" style={{ color: 'var(--t-accent)' }}>seçili</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={sendChallenge}
            disabled={!selected || !selected.online}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--t-accent)', color: '#fff' }}
          >
            ▶️ Teklif Et
          </button>
        </div>
      </StepCard>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/friend-challenge.test.tsx
```

Beklenen: PASS — 7 test.

- [ ] **Step 5: `OpeningPractice`'ı bağla ve `ChallengeScreen`'i sil**

`apps/web/components/play/OpeningPractice.tsx` içinde:

- `import { ChallengeScreen } from '@/components/ChallengeScreen';` → **sil**, yerine:
  ```tsx
  import { FriendChallenge } from '@/components/play/FriendChallenge';
  ```
- `import type { MatchedInfo } from '@/lib/hooks/use-lobby';` → **sil**
- `interface Props { onMatched: (info: MatchedInfo) => void }` → **sil**
- İmzayı değiştir: `export function OpeningPractice() {`
- 🤝 kartının gövdesini değiştir: `<ChallengeScreen onMatched={onMatched} />` → `<FriendChallenge />`

Sonra dosyayı sil:

```bash
git rm apps/web/components/ChallengeScreen.tsx
```

- [ ] **Step 6: `ChallengeScreen` mock'larını temizle**

Şu dört test dosyasındaki `vi.mock('@/components/ChallengeScreen', ...)` bloklarını **sil**:
`tests/opening-practice.test.tsx`, `tests/friend-badge-usage.test.tsx`,
`tests/play-page-tabs.test.tsx`, `tests/play-mode-param.test.tsx`.

`tests/opening-practice.test.tsx` içine yerine şunu ekle (🤝 kartı testi bunu bekliyor):

```tsx
vi.mock('@/components/play/FriendChallenge', () => ({
  FriendChallenge: () => <div data-testid="friend-challenge" />,
}));
```

Aynı dosyada `challenge-screen` geçen iki testi `friend-challenge` olarak güncelle ve
`<OpeningPractice onMatched={vi.fn()} />` çağrılarını `<OpeningPractice />` yap.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web
git commit -m "feat: FriendChallenge (ARA + sirali kartlar), ChallengeScreen kaldirildi"
```

---

## Task 6: Tam test kapısı

- [ ] **Step 1: Backend**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: **295** test PASS (291 + Task 1'den 4).

- [ ] **Step 2: Migration başı tek mi**

```bash
cd apps/api && python -m alembic heads
```

Beklenen: tek head. Bu projede yeni migration YOK.

- [ ] **Step 3: TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok. Kullanılmayan `onMatched`/`router` kalıntısı varsa burada patlar.

- [ ] **Step 4: Lint**

```bash
cd apps/web && npx next lint
```

Beklenen: 0 hata (`boardSkin.tsx` uyarısı bu projeden önce de vardı).

- [ ] **Step 5: Frontend testler**

```bash
cd apps/web && npx vitest run
```

Beklenen: **509** test PASS (488 + Task 2'den 9 + Task 4'ten 5 + Task 5'ten 7).
Sayı tutmuyorsa DUR ve nedenini bul.

- [ ] **Step 6: Build**

```bash
cd apps/web && npm run build
```

Beklenen: `Compiled successfully`.

---

## Task 7: Canlı doğrulama (KURAL #6)

- [ ] **Step 1: Sınırı ÖNCEDEN söyle**

Teklif akışının tamamı (A teklif eder → B bildirimi görür → Evet) **iki ayrı sporcu
oturumu** ister. Tek tarayıcı oturumuyla doğrulanamaz. Bu, rapora **açıkça** yazılır.

- [ ] **Step 2: Doğrulanabilenler**

Prod API'ye bağlı dev sunucuda (`apps/web/.env.local` + `preview_start {name:"chess-web"}`):
ekranın açılması, iki kartın sıralı/kilitli davranışı, ARA'nın harf harf süzmesi,
çevrimdışı isimlerin seçilememesi, "Teklif Et" kilidi.

- [ ] **Step 3: Temizlik**

```bash
rm -f apps/web/.env.local
```

`preview_stop` + `git status --short`.

- [ ] **Step 4: Dürüst rapor**

Doğrulanan ve doğrulanamayan ayrı ayrı yazılır. Doğrulanamayan için "çalışıyor" DENMEZ
(KURAL #1).

---

## Task 8: Bitirme

- [ ] **Step 1: finishing-a-development-branch**

Testleri doğrula, seçenekleri sun, kullanıcının seçimini uygula.
