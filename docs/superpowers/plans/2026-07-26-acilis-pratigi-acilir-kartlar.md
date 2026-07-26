# Açılış Pratiği — Açılır Kartlar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/play` → "Açılışı Pratiği Yap" akışını 4 adımlı sihirbazdan, sıralı ve kilitli açılır kartlara (akordiyon) çevirmek.

**Architecture:** Kilit kuralı saf bir modülde (`lib/play/openingSteps.ts`), açılır kart görünümü kontrollü bir sunum bileşeninde (`components/play/StepCard.tsx`), akış ise `OpeningPractice.tsx` içinde. Backend'e, `MatchCriteria`'ya, `ChallengeScreen`'e ve `BotGame`'e dokunulmaz.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, vitest + @testing-library/react (happy-dom).

**Spec:** `docs/superpowers/specs/2026-07-26-acilis-pratigi-acilir-kartlar-design.md`

---

## Spec'ten sapma (bilinçli, tek)

Spec §8 iki ayrı test dosyası öngörüyordu (`opening-practice-cards.test.tsx` yeni dosya olarak).
**Uygulamada tek dosya kullanılır:** `apps/web/tests/opening-practice.test.tsx` zaten vardır ve
aynı bileşeni test eder. Aynı bileşen için iki test dosyası tutmak, hangi davranışın nerede
test edildiğini bulanıklaştırır. Mevcut dosya güncellenir ve genişletilir.

**Kritik:** mevcut dosyadaki `'arkadaş dalında davet ekranı gösterilir'` testi **kırılacaktır**.
Eski akışta arkadaş dalı da önce açılış seçtiriyordu; yeni tasarımda arkadaş kartı açılış
listesini hiç yüklemez. Bu test Task 3'te yeniden yazılır. Diğer 5 test yeni akışta da geçmelidir.

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/play/openingSteps.ts` **(yeni)** | Kilit kuralı ve özet metni. Saf, React'siz. |
| `apps/web/components/play/StepCard.tsx` **(yeni)** | Bir açılır kartı çizer. İş mantığı yok, tüm durum prop. |
| `apps/web/components/play/OpeningPractice.tsx` **(değişir)** | Sihirbaz → akordiyon. Durum ve akış burada. |
| `apps/web/tests/opening-steps.test.ts` **(yeni)** | Saf mantık birim testleri. |
| `apps/web/tests/opening-practice.test.tsx` **(değişir)** | Akordiyon davranışı + regresyonlar. |

Dokunulmayacak dosyalar: `MatchCriteria.tsx`, `ChallengeScreen.tsx`, `BotGame.tsx`,
`app/(child)/play/page.tsx`, tüm backend.

---

## Task 1: `openingSteps.ts` saf mantık

**Files:**
- Create: `apps/web/lib/play/openingSteps.ts`
- Test: `apps/web/tests/opening-steps.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/opening-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isCriteriaUnlocked, openingSummary } from '@/lib/play/openingSteps';

describe('isCriteriaUnlocked', () => {
  it('açılış seçilmediyse kilitlidir', () => {
    expect(isCriteriaUnlocked(null)).toBe(false);
  });

  it('açılış seçildiyse açılabilir', () => {
    expect(isCriteriaUnlocked('İtalyan Açılışı')).toBe(true);
  });

  it('boş ad seçim sayılmaz', () => {
    expect(isCriteriaUnlocked('')).toBe(false);
    expect(isCriteriaUnlocked('   ')).toBe(false);
  });
});

describe('openingSummary', () => {
  it('seçim yoksa null döner', () => {
    expect(openingSummary(null)).toBeNull();
    expect(openingSummary('  ')).toBeNull();
  });

  it('seçim varsa tik işaretli özet döner', () => {
    expect(openingSummary('İtalyan Açılışı')).toBe('✓ İtalyan Açılışı');
  });

  it('baştaki/sondaki boşlukları kırpar', () => {
    expect(openingSummary('  Sicilya Savunması  ')).toBe('✓ Sicilya Savunması');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/opening-steps.test.ts
```

Beklenen: FAIL — `Failed to resolve import "@/lib/play/openingSteps"`.

- [ ] **Step 3: Write the implementation**

`apps/web/lib/play/openingSteps.ts`:

```ts
/** Bot dalindaki iki acilir kartin anahtarlari. */
export type BotStepKey = 'opening' | 'criteria';

/** Bir acilis adi gercekten secilmis mi? Bos/bosluklu ad secim sayilmaz. */
function picked(openingName: string | null): string | null {
  const t = openingName?.trim();
  return t ? t : null;
}

/** 2. kart (Mac Kriterlerini Sec) acilabilir mi? Kilit kurali TEK yerde. */
export function isCriteriaUnlocked(openingName: string | null): boolean {
  return picked(openingName) !== null;
}

/** 1. kartin basliginda gorunecek ozet; acilis secilmediyse null. */
export function openingSummary(openingName: string | null): string | null {
  const name = picked(openingName);
  return name === null ? null : `✓ ${name}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/opening-steps.test.ts
```

Beklenen: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/openingSteps.ts apps/web/tests/opening-steps.test.ts
git commit -m "feat: acilis pratigi kilit mantigi (saf modul)"
```

---

## Task 2: `StepCard` sunum bileşeni

**Files:**
- Create: `apps/web/components/play/StepCard.tsx`
- Test: `apps/web/tests/step-card.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/step-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepCard } from '@/components/play/StepCard';

describe('StepCard', () => {
  it('kapalıyken gövde DOM\'a girmez', () => {
    render(
      <StepCard title="Açılış Konumunu Seç" open={false} onToggle={vi.fn()}>
        <p>gizli içerik</p>
      </StepCard>,
    );
    expect(screen.queryByText('gizli içerik')).not.toBeInTheDocument();
  });

  it('açıkken gövde görünür ve aria-expanded true olur', () => {
    render(
      <StepCard title="Açılış Konumunu Seç" open onToggle={vi.fn()}>
        <p>gizli içerik</p>
      </StepCard>,
    );
    expect(screen.getByText('gizli içerik')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Açılış Konumunu Seç/ }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('adım numarası başlığın önüne yazılır', () => {
    render(
      <StepCard stepNumber={2} title="Maç Kriterlerini Seç" open={false} onToggle={vi.fn()}>
        <p>x</p>
      </StepCard>,
    );
    expect(screen.getByText('2. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('özet başlıkta gösterilir', () => {
    render(
      <StepCard title="Açılış Konumunu Seç" summary="✓ İtalyan Açılışı"
        open={false} onToggle={vi.fn()}>
        <p>x</p>
      </StepCard>,
    );
    expect(screen.getByText('✓ İtalyan Açılışı')).toBeInTheDocument();
  });

  it('tıklayınca onToggle çağrılır', () => {
    const onToggle = vi.fn();
    render(
      <StepCard title="Açılış Konumunu Seç" open={false} onToggle={onToggle}>
        <p>x</p>
      </StepCard>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Açılış Konumunu Seç/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('KİLİTLİ kart: aria-disabled taşır ve tıklama onToggle çağırmaz', () => {
    const onToggle = vi.fn();
    render(
      <StepCard title="Maç Kriterlerini Seç" open={false} locked onToggle={onToggle}>
        <p>x</p>
      </StepCard>,
    );
    const btn = screen.getByRole('button', { name: /Maç Kriterlerini Seç/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/step-card.test.tsx
```

Beklenen: FAIL — `Failed to resolve import "@/components/play/StepCard"`.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/StepCard.tsx`:

```tsx
'use client';
import type { ReactNode } from 'react';

interface Props {
  /** Kart basligi. */
  title: string;
  /** Dis kartlar icin emoji (🤖 / 🤝). Ic kartlarda kullanilmaz. */
  emoji?: string;
  /** Ic kartlar icin adim numarasi (1 / 2). Dis kartlarda kullanilmaz. */
  stepNumber?: number;
  /** Tamamlanmis adimin basliktaki ozeti ("✓ Italyan Acilisi"). */
  summary?: string | null;
  open: boolean;
  /** Kilitliyse soluk gorunur ve tiklama onToggle cagirmaz. */
  locked?: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Sirali akordiyon karti. Is mantigi YOK — acik/kilitli kararini cagiran verir. */
export function StepCard({
  title, emoji, stepNumber, summary, open, locked = false, onToggle, children,
}: Props) {
  const label = stepNumber === undefined ? title : `${stepNumber}. ${title}`;
  return (
    <div className="t-card-i overflow-hidden">
      <button
        type="button"
        onClick={() => { if (!locked) onToggle(); }}
        aria-expanded={open}
        aria-disabled={locked}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        style={locked ? { opacity: 0.5 } : undefined}
      >
        {emoji && <span className="text-2xl">{emoji}</span>}
        <span className="font-semibold text-sm flex-1">{label}</span>
        {summary && <span className="text-xs t-muted">{summary}</span>}
        <span className="text-sm t-muted" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/step-card.test.tsx
```

Beklenen: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/StepCard.tsx apps/web/tests/step-card.test.tsx
git commit -m "feat: StepCard acilir kart bileseni"
```

---

## Task 3: `OpeningPractice` sihirbazdan akordiyona

**Files:**
- Modify: `apps/web/components/play/OpeningPractice.tsx` (tamamı yeniden yazılır)
- Modify: `apps/web/tests/opening-practice.test.tsx` (tamamı yeniden yazılır)

**Bilinen ve kabul edilen sınır (spec §4.1):** 1. karta geri dönülünce 2. kart kapanır,
`MatchCriteria` DOM'dan çıkar ve içindeki düzey/tempo/renk seçimi sıfırlanır. Bu bir hata
değil, bilinçli karardır — engellemek `MatchCriteria`'yı kontrollü bileşene çevirmeyi
gerektirir, o bileşen üç akışta paylaşılıyor ve bu proje ona dokunmuyor. Seçilen **açılış**
(`chosen`) korunur.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/opening-practice.test.tsx` dosyasının **tamamını** aşağıdakiyle değiştir:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/BotGame', () => ({
  BotGame: ({ startFen }: { startFen?: string }) => (
    <div data-testid="bot-game" data-start-fen={startFen ?? ''} />
  ),
}));

vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));

import { OpeningPractice } from '@/components/play/OpeningPractice';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ id: 1, name: 'İtalyan Açılışı', start_fen: FEN }],
  })));
});

/** Bot kartini acar ve acilis listesinin yuklenmesini bekler. */
async function openBotCard() {
  fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
}

describe('OpeningPractice — akordiyon', () => {
  it('başlangıçta iki dış kart kapalıdır', () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ })).toBeInTheDocument();
    // Govdeler kapali: ic kartlarin basliklari DOM'da yok
    expect(screen.queryByText('1. Açılış Konumunu Seç')).not.toBeInTheDocument();
    expect(screen.queryByTestId('challenge-screen')).not.toBeInTheDocument();
  });

  it('bot kartı açılınca 1. ve 2. kartlar görünür, açılış listesi yüklenir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    expect(screen.getByText('1. Açılış Konumunu Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('KİLİT: açılış seçilmeden 2. kart açılmaz', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    const criteriaBtn = screen.getByRole('button', { name: /2\. Maç Kriterlerini Seç/ });
    expect(criteriaBtn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(criteriaBtn);
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
  });

  it('açılış seçilince 1. kart kapanır, ✓ özet çıkar, 2. kart kendiliğinden açılır', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    // 1. kart kapandi: listedeki secenek artik DOM'da degil
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();
    // Ozet basliga tasindi
    expect(screen.getByText('✓ İtalyan Açılışı')).toBeInTheDocument();
    // 2. kart acildi
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
  });

  it('kapanan 1. karta tekrar tıklanınca açılış değiştirilebilir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Konumunu Seç/ }));
    expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument();
  });

  it('maç seçilen açılışın FENiyle başlar', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);
  });

  it('arkadaş kartı açılınca davet ekranı görünür (açılış seçtirmeden)', () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('dış akordiyon tek-açık: arkadaş açılınca bot kapanır', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    await openBotCard();
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.queryByText('1. Açılış Konumunu Seç')).not.toBeInTheDocument();
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('REGRESYON: açılış listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    await waitFor(() =>
      expect(screen.getByText(/henüz açılış eklemedi/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/opening-practice.test.tsx
```

Beklenen: FAIL. En az `'başlangıçta iki dış kart kapalıdır'` testi kırılır — eski
bileşen `aria-expanded` taşımayan düz kartlar çiziyor ve `1. Açılış Konumunu Seç`
başlığı hiç yok.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/OpeningPractice.tsx` dosyasının **tamamını** aşağıdakiyle değiştir:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { ChallengeScreen } from '@/components/ChallengeScreen';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { StepCard } from '@/components/play/StepCard';
import { isCriteriaUnlocked, openingSummary } from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): acilis -> kriterler. */
export function OpeningPractice({ onMatched }: Props) {
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  const [openInner, setOpenInner] = useState<BotStepKey | null>('opening');
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');

  const loadOpenings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      setOpenings(r.ok ? await r.json() : []);
    } catch {
      setOpenings([]);
    }
  }, []);

  // Acilislar YALNIZCA bot karti acildiginda yuklenir — gereksiz istek atilmaz.
  useEffect(() => {
    if (openOuter === 'bot' && openings === null) void loadOpenings();
  }, [openOuter, openings, loadOpenings]);

  // Kriterler secildi -> mac basladi; akordiyon yerini tahtaya birakir.
  if (criteria && chosen) {
    return (
      <BotGame
        skillLevel={criteria.level.skill}
        depth={criteria.level.depth}
        timeControl={criteria.timeControl}
        studentColor={color}
        startFen={chosen.start_fen}
        onGameEnd={() => {}}
      />
    );
  }

  return (
    <div className="space-y-3">
      <StepCard
        emoji="🤖"
        title="Bota Karşı Pratik Yap"
        open={openOuter === 'bot'}
        onToggle={() => setOpenOuter((p) => (p === 'bot' ? null : 'bot'))}
      >
        <div className="space-y-3">
          <StepCard
            stepNumber={1}
            title="Açılış Konumunu Seç"
            summary={openingSummary(chosen?.name ?? null)}
            open={openInner === 'opening'}
            onToggle={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
          >
            <div className="space-y-2">
              {openings === null && <p className="text-sm t-muted">Yükleniyor…</p>}
              {openings?.length === 0 && (
                <p className="text-sm t-muted">Zafer Hoca henüz açılış eklemedi.</p>
              )}
              {openings?.map((o) => (
                <button key={o.id} type="button"
                  onClick={() => { setChosen(o); setOpenInner('criteria'); }}
                  className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className="text-xl">📖</span>
                  <span className="font-medium text-sm flex-1">{o.name}</span>
                </button>
              ))}
            </div>
          </StepCard>

          <StepCard
            stepNumber={2}
            title="Maç Kriterlerini Seç"
            open={openInner === 'criteria'}
            locked={!isCriteriaUnlocked(chosen?.name ?? null)}
            onToggle={() => setOpenInner((p) => (p === 'criteria' ? null : 'criteria'))}
          >
            <MatchCriteria
              startLabel="Pratiğe Başla"
              onStart={(v) => {
                // Kilit yalnizca gorsel degil: acilis yoksa mac hic baslamaz.
                if (!chosen) return;
                setCriteria(v);
                setColor(resolveColor(v.colorChoice));
              }}
            />
          </StepCard>
        </div>
      </StepCard>

      <StepCard
        emoji="🤝"
        title="Arkadaşına Karşı Pratik Yap"
        open={openOuter === 'friend'}
        onToggle={() => setOpenOuter((p) => (p === 'friend' ? null : 'friend'))}
      >
        <ChallengeScreen onMatched={onMatched} />
      </StepCard>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/opening-practice.test.tsx
```

Beklenen: PASS — 9 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/OpeningPractice.tsx apps/web/tests/opening-practice.test.tsx
git commit -m "feat: acilis pratigi sihirbazdan akordiyona"
```

---

## Task 4: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok (0 hata).

- [ ] **Step 2: Lint**

```bash
cd apps/web && npx next lint
```

Beklenen: `No ESLint warnings or errors`.

- [ ] **Step 3: Tüm frontend testleri**

```bash
cd apps/web && npx vitest run
```

Beklenen: hepsi PASS. Referans: P10 sonunda **457** test geçiyordu. Bu planla eklenenler:
Task 1 → +6, Task 2 → +6, Task 3 → eski 6 test yerine 9 test (**+3**). Toplam beklenen: **472**.
Sayı tutmuyorsa DUR ve nedenini bul — sessizce kabul etme.

- [ ] **Step 4: Build**

```bash
cd apps/web && npm run build
```

Beklenen: `Compiled successfully`.

- [ ] **Step 5: Backend değişmedi doğrulaması**

```bash
git diff --stat main -- apps/api
```

Beklenen: çıktı yok. Backend'e dokunulmadı (spec §2).

- [ ] **Step 6: Commit (yalnızca kapı kırmızıysa yapılan düzeltmeler için)**

Kapı temizse commit gerekmez; Task 3 zaten commit'lendi.

---

## Task 5: Canlı doğrulama (KURAL #6)

**Files:** geçici `apps/web/.env.local` (doğrulama sonunda **silinir**)

- [ ] **Step 1: Kullanıcıya sor**

Canlı test yapmadan önce kullanıcıya sor: "Bunu canlı önizlemede test edeyim mi?"
Onay gelmeden Step 2'ye geçme (KURAL #6).

- [ ] **Step 2: Prod API'ye bağlı dev sunucu**

`apps/web/.env.local` oluştur:

```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```

Sonra preview başlat (Bash ile dev server ÇALIŞTIRMA):

`preview_start` aracı, `{name: "chess-web"}` ile (`.claude/launch.json` içindeki mevcut giriş).

- [ ] **Step 3: Açılış pratiği ekranına git**

Tarayıcıda `/play` → "Açılışı Pratiği Yap" kartına tıkla.
`read_page` ile iki dış kartın (🤖 / 🤝) listelendiğini ve gövdelerinin kapalı olduğunu doğrula.

- [ ] **Step 4: Kilidi doğrula**

🤖 kartını aç. `2. Maç Kriterlerini Seç` başlığına tıkla.
Beklenen: kart AÇILMAZ — "Düzey 1" düğmesi ekranda görünmez. `read_page` ile doğrula.

- [ ] **Step 5: Sıralı akışı doğrula**

Bir açılışa tıkla. Beklenen üç şey birden:
1. Açılış listesi kaybolur (1. kart kapanır),
2. Başlıkta `✓ <açılış adı>` görünür,
3. "Düzey 1" düğmesi görünür (2. kart açıldı).

- [ ] **Step 6: Maçı başlat**

Bir düzey + bir tempo seç, "Pratiğe Başla"ya bas. Tahtanın açıldığını ve konumun
başlangıç konumu DEĞİL, seçilen açılışın konumu olduğunu `computer{action:"screenshot"}`
ile kanıtla.

- [ ] **Step 7: Regresyon — arkadaş kartı**

Geri dön, 🤝 kartını aç. Davet ekranının (kriter seçimi) geldiğini doğrula.
🤖 kartının kapandığını doğrula.

- [ ] **Step 8: Konsol kontrolü**

`read_console_messages` (onlyErrors) — açılış pratiğiyle ilgili yeni hata olmamalı.

- [ ] **Step 9: Temizlik**

```bash
rm -f apps/web/.env.local
```

`preview_stop` ile sunucuyu durdur. `git status --short` ile `.env.local` kalmadığını doğrula.

- [ ] **Step 10: Dürüst rapor**

Ne doğrulandı, ne doğrulanamadı açıkça yazılır. Doğrulanamayan hiçbir şey için
"çalışıyor" DENMEZ (KURAL #1).

---

## Task 6: Bitirme

- [ ] **Step 1: finishing-a-development-branch skill'ini çalıştır**

Testleri doğrula, seçenekleri sun, kullanıcının seçimini uygula.
Depoda tek dal (`main`) kullanılıyor; push kullanıcı onayıyla yapılır.
