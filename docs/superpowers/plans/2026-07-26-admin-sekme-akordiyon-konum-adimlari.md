# P7 — Admin Sekme Akordiyonu + Konum Ekle Adım Akışı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin > Sekmeler kartlarını dairesel "AÇ" düğmesiyle akordiyon yapmak ve Konum Ekle > Taşı Oynat akışını, yeni "Notasyonu Kaydet" adımı dahil 6 numaralı adıma bölmek.

**Architecture:** Adım-tamamlanma mantığı React'ten ayrılıp saf bir modüle (`lib/admin/movePieceSteps.ts`) taşınır ve doğrudan test edilir. `MovePieceFields` tamamen kontrollü bileşene dönüşür (dizme tahtası durumu üst bileşene taşınır) — böylece "Konum Diz" adımı üst bileşenden görülebilir. Notasyon metni için sıfırdan ayrıştırıcı yazılmaz; mevcut `notationRows` yeniden kullanılır.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / Tailwind 3 · vitest + @testing-library/react (happy-dom)

**Spec:** `docs/superpowers/specs/2026-07-26-admin-sekme-akordiyon-konum-adimlari-design.md`

**Backend'e, şemaya, migration'a DOKUNULMUYOR.** Sporcu tarafı bileşenleri (`BoardExercise`, `MovePieceSolver`) değişmiyor — kaydedilen veri biçimi aynı kalıyor (KURAL #3).

---

## Dosya Yapısı

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `apps/web/lib/admin/movePieceSteps.ts` | Saf adım-tamamlanma mantığı + notasyon metni | **Yeni** |
| `apps/web/tests/move-piece-steps.test.ts` | Saf mantık testleri | **Yeni** |
| `apps/web/app/admin/settings/tabs/page.tsx` | Sekme kartları — akordiyon + dairesel AÇ düğmesi | Değişir |
| `apps/web/tests/admin-tabs-accordion.test.tsx` | Akordiyon davranışı + regresyon | **Yeni** |
| `apps/web/components/admin/MovePieceFields.tsx` | Kontrollü bileşen + Notasyonu Kaydet fazı | Değişir |
| `apps/web/tests/move-piece-fields.test.tsx` | Mevcut testler yeni arayüze uyarlanır | Değişir |
| `apps/web/components/admin/ExerciseForm.tsx` | Adım listesi + "Soruyu ekle" kilidi | Değişir |
| `apps/web/tests/exercise-form-move-piece.test.tsx` | Kilit davranışı için güncellenir | Değişir |

`apps/web/app/admin/layout.tsx` **değişmiyor** — Açılış Listesi yan menüde de kalır (kullanıcı onayı).

---

### Task 1: `movePieceSteps.ts` — saf adım mantığı

**Files:**
- Create: `apps/web/lib/admin/movePieceSteps.ts`
- Test: `apps/web/tests/move-piece-steps.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/move-piece-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  movePieceSteps, firstIncompleteStep, allStepsDone, hasPieces, formatNotation,
} from '@/lib/admin/movePieceSteps';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';
/** Siyahın oynadığı konum — formatNotation'ın "1..." dalını sınar. */
const BLACK_TURN = '6k1/8/5K2/8/5R2/8/8/8 b - - 0 1';

const BLANK: MovePieceStepState = {
  instruction: '',
  setupFen: EMPTY,
  moveFen: null,
  moves: [],
  notationSaved: false,
  difficultyChosen: false,
};

const FULL: MovePieceStepState = {
  instruction: 'Kaleyi h4e oyna',
  setupFen: TWO_SIDED,
  moveFen: TWO_SIDED,
  moves: ['Rh4'],
  notationSaved: true,
  difficultyChosen: true,
};

describe('hasPieces', () => {
  it('boş tahtada taş yoktur', () => {
    expect(hasPieces(EMPTY)).toBe(false);
  });

  it('taş varsa true döner', () => {
    expect(hasPieces(TWO_SIDED)).toBe(true);
  });

  it('sıra/rok alanları farklı olan boş tahtayı da boş sayar', () => {
    expect(hasPieces('8/8/8/8/8/8/8/8 b KQkq e3 5 12')).toBe(false);
  });
});

describe('movePieceSteps', () => {
  it('altı adım döner ve sıra numaraları 1-6 olur', () => {
    const steps = movePieceSteps(BLANK);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('adım etiketleri kullanıcının istediği metinlerdir', () => {
    expect(movePieceSteps(BLANK).map((s) => s.label)).toEqual([
      'Talimat Ekle',
      'Konum Diz',
      'Konumu Kaydet',
      'Cevap Hamlelerini Yap ve Notasyon Oluştur',
      'Notasyonu Kaydet',
      'Zorluk Düzeyinin Seçimini Yap',
    ]);
  });

  it('boş durumda hiçbir adım tamamlanmamıştır', () => {
    expect(movePieceSteps(BLANK).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda altı adım da tamamlanmıştır', () => {
    expect(movePieceSteps(FULL).every((s) => s.done)).toBe(true);
  });

  it('adım 1 talimat girilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, instruction: 'Oyna' })[0].done).toBe(true);
  });

  it('adım 1 yalnızca boşluk girilirse tamamlanmaz', () => {
    expect(movePieceSteps({ ...BLANK, instruction: '   ' })[0].done).toBe(false);
  });

  it('TUZAK: adım 2 boş tahtada tamamlanmaz, taş dizilince tamamlanır', () => {
    expect(movePieceSteps(BLANK)[1].done).toBe(false);
    expect(movePieceSteps({ ...BLANK, setupFen: TWO_SIDED })[1].done).toBe(true);
  });

  it('adım 3 konum kaydedilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, moveFen: TWO_SIDED })[2].done).toBe(true);
  });

  it('adım 4 en az bir hamle varsa tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, moves: ['Rh4'] })[3].done).toBe(true);
  });

  it('adım 5 notasyon kaydedilince tamamlanır', () => {
    expect(movePieceSteps({ ...BLANK, notationSaved: true })[4].done).toBe(true);
  });

  it('TUZAK: adım 6 zorluk BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(movePieceSteps(BLANK)[5].done).toBe(false);
    expect(movePieceSteps({ ...BLANK, difficultyChosen: true })[5].done).toBe(true);
  });
});

describe('firstIncompleteStep / allStepsDone', () => {
  it('boş durumda ilk eksik adım 1. adımdır', () => {
    expect(firstIncompleteStep(BLANK)?.no).toBe(1);
  });

  it('yalnızca notasyon eksikse ilk eksik adım 5. adımdır', () => {
    expect(firstIncompleteStep({ ...FULL, notationSaved: false })?.no).toBe(5);
  });

  it('tam durumda eksik adım yoktur', () => {
    expect(firstIncompleteStep(FULL)).toBeNull();
  });

  it('allStepsDone yalnızca hepsi tamamsa true döner', () => {
    expect(allStepsDone(BLANK)).toBe(false);
    expect(allStepsDone(FULL)).toBe(true);
    expect(allStepsDone({ ...FULL, difficultyChosen: false })).toBe(false);
  });
});

describe('formatNotation', () => {
  it('hamle yoksa boş metin döner', () => {
    expect(formatNotation(TWO_SIDED, [])).toBe('');
  });

  it('tek hamleyi numaralandırır', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4'])).toBe('1. Rh4');
  });

  it('beyaz-siyah çiftini tek satırda birleştirir', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4', 'Kf8'])).toBe('1. Rh4 Kf8');
  });

  it('tek sayıda hamlede son siyah hücresi boş bırakılır', () => {
    expect(formatNotation(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8'])).toBe('1. Rh4 Kf8 2. Rh8');
  });

  it('siyahın başladığı konumda "1..." biçimi kullanılır', () => {
    expect(formatNotation(BLACK_TURN, ['Kf8'])).toBe('1... Kf8');
  });

  it('siyah başlayıp devam ederse numaralandırma kaymaz', () => {
    expect(formatNotation(BLACK_TURN, ['Kf8', 'Rh4'])).toBe('1... Kf8 2. Rh4');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-steps.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/admin/movePieceSteps"`

- [ ] **Step 3: Modülü yaz**

`apps/web/lib/admin/movePieceSteps.ts`:

```ts
import { notationRows } from '@/lib/chess/moveRecorder';

/**
 * Taşı Oynat sorusunun 6 adımlık akışının saf mantığı.
 * React'ten bağımsızdır — doğrudan test edilir (mevcut desen: lib/practice/scoring.ts).
 */
export interface MovePieceStepState {
  /** Adım 1 — talimat metni. */
  instruction: string;
  /** Adım 2 — dizme tahtasının FEN'i (üst bileşen sahibi, bkz. MovePieceFields). */
  setupFen: string;
  /** Adım 3 — "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  moveFen: string | null;
  /** Adım 4 — kaydedilen SAN hamleleri. */
  moves: string[];
  /** Adım 5 — "Notasyonu Kaydet"e basıldı mı? */
  notationSaved: boolean;
  /**
   * Adım 6 — zorluk etiketine BİLFİİL tıklandı mı?
   * `difficulty` state'i varsayılan 1 olduğu için sayıya bakmak yetmez; bakılsa
   * adım hiç tıklanmadan tamamlanmış görünür ve kilit işlevsiz kalır.
   */
  difficultyChosen: boolean;
}

export interface StepInfo {
  no: number;
  label: string;
  done: boolean;
}

export const MOVE_PIECE_STEP_LABELS = [
  'Talimat Ekle',
  'Konum Diz',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Zorluk Düzeyinin Seçimini Yap',
] as const;

/**
 * FEN'in tahta alanında en az bir taş var mı?
 * EMPTY_FEN sabitiyle karşılaştırmak yerine tahta alanı taranır — sıra/rok/hamle
 * alanları farklı olan boş tahtalar da doğru biçimde "boş" sayılır. Ayrıca bu
 * fonksiyon BoardEditor bileşenine bağımlı olmaz (saf modül kalır).
 */
export function hasPieces(fen: string): boolean {
  const board = fen.split(' ')[0] ?? '';
  return /[a-zA-Z]/.test(board);
}

export function movePieceSteps(s: MovePieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    hasPieces(s.setupFen),
    s.moveFen !== null,
    s.moves.length > 0,
    s.notationSaved,
    s.difficultyChosen,
  ];
  return MOVE_PIECE_STEP_LABELS.map((label, i) => ({ no: i + 1, label, done: done[i] }));
}

export function firstIncompleteStep(s: MovePieceStepState): StepInfo | null {
  return movePieceSteps(s).find((st) => !st.done) ?? null;
}

export function allStepsDone(s: MovePieceStepState): boolean {
  return firstIncompleteStep(s) === null;
}

/**
 * SAN hamlelerini tek satırlık okunur notasyona çevirir ("1. Rh4 Kf8 2. Rh8").
 * Satırlara bölme işini mevcut `notationRows` yapar (DRY) — siyahın başladığı
 * konumlarda ilk satırın beyaz hücresini boş bırakma davranışı orada zaten doğru.
 */
export function formatNotation(fen: string, moves: string[]): string {
  if (moves.length === 0) return '';
  return notationRows(fen, moves)
    .map((r) => (r.white
      ? `${r.no}. ${r.white}${r.black ? ` ${r.black}` : ''}`
      : `${r.no}... ${r.black}`))
    .join(' ');
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-steps.test.ts`
Beklenen: PASS — 24 test

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/lib/admin/movePieceSteps.ts apps/web/tests/move-piece-steps.test.ts
git commit -m "feat: movePieceSteps saf adim mantigi + formatNotation"
```

---

### Task 2: Admin Sekmeler — akordiyon + dairesel AÇ düğmesi

**Files:**
- Modify: `apps/web/app/admin/settings/tabs/page.tsx`
- Test: `apps/web/tests/admin-tabs-accordion.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/admin-tabs-accordion.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ reload: vi.fn() }),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';

/** Sayfa açılışta /admin/settings çeker; boş gövde varsayılan ayarlara düşer. */
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
});

async function renderPage() {
  render(<AdminTabsPage />);
  await waitFor(() =>
    expect(screen.queryByText(/Yükleniyor/)).not.toBeInTheDocument(),
  );
}

describe('Admin Sekmeler — akordiyon', () => {
  it('dört sekme kartı da listelenir', async () => {
    await renderPage();
    expect(screen.getByText(/Maç Yap/)).toBeInTheDocument();
    expect(screen.getByText(/Dersler/)).toBeInTheDocument();
    expect(screen.getByText(/Analiz Et/)).toBeInTheDocument();
    expect(screen.getByText(/Eğlence/)).toBeInTheDocument();
  });

  it('her kartta dairesel AÇ düğmesi vardır', async () => {
    await renderPage();
    expect(screen.getAllByRole('button', { name: 'AÇ' })).toHaveLength(4);
  });

  it('kart kapalı başlar — Ders İçeriği linki görünmez', async () => {
    await renderPage();
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('Dersler kartı açılınca Ders İçeriği linki görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    const link = screen.getByText('Ders İçeriği').closest('a');
    expect(link).toHaveAttribute('href', '/admin/content');
  });

  it('Maç Yap kartı açılınca Açılış Listesi linki görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    const link = screen.getByText('Açılış Listesi').closest('a');
    expect(link).toHaveAttribute('href', '/admin/openings');
  });

  it('Analiz Et kartı açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Analiz Et sekmesini aç'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Eğlence kartı açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Eğlence sekmesini aç'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('açık kartın düğmesi KAPAT olur ve aria-expanded true döner', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    const btn = screen.getByLabelText('Dersler sekmesini kapat');
    expect(btn).toHaveTextContent('KAPAT');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('KAPAT tıklanınca içerik kapanır', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    fireEvent.click(screen.getByLabelText('Dersler sekmesini kapat'));
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('AKORDİYON: ikinci kart açılınca ilki kapanır', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    expect(screen.getByText('Açılış Listesi')).toBeInTheDocument();
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('REGRESYON: kart kapalıyken sıralama ve Kaldır butonları çalışır', async () => {
    await renderPage();
    expect(screen.getAllByLabelText('Yukarı taşı')).toHaveLength(4);
    expect(screen.getAllByLabelText('Aşağı taşı')).toHaveLength(4);
    expect(screen.getAllByText('Kaldır')).toHaveLength(4);
    fireEvent.click(screen.getAllByText('Kaldır')[0]);
    // PATCH isteği gönderilir (ilk çağrı açılıştaki GET'ti)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/admin-tabs-accordion.test.tsx`
Beklenen: FAIL — `Unable to find a label with the text of: Dersler sekmesini aç` (AÇ düğmesi henüz yok)

- [ ] **Step 3: `TAB_CONTENT` haritasını ekle**

`apps/web/app/admin/settings/tabs/page.tsx` — `TAB_META` tanımının hemen ALTINA ekle:

```tsx
/**
 * Sekme açıldığında görünecek yönetim ekranı. null = henüz yönetim ekranı yok.
 * Yeni bir ekran hazır olduğunda buraya bir satır eklemek yeterlidir.
 */
const TAB_CONTENT: Record<TabKey, { href: string; emoji: string; title: string; desc: string } | null> = {
  lessons: { href: '/admin/content',  emoji: '📘', title: 'Ders İçeriği',   desc: 'Düzey, ders, alt konu ve soruları yönet' },
  play:    { href: '/admin/openings', emoji: '📖', title: 'Açılış Listesi', desc: 'Açılış pratiği için açılış ekle ve kaldır' },
  analiz:  null,
  eglence: null,
};
```

- [ ] **Step 4: Akordiyon state'ini ekle**

Aynı dosyada, `const [saving, setSaving] = useState(false);` satırının ALTINA ekle:

```tsx
  /** Tek seferde yalnızca bir kart açık (akordiyon) — sporcu ana sayfasıyla aynı dil. */
  const [openKey, setOpenKey] = useState<TabKey | null>(null);
```

- [ ] **Step 5: Kart gövdesini akordiyona çevir**

Aynı dosyada, `{shown.map((key, idx) => {` bloğunu bul. `const m = TAB_META[key];` satırından `})}` kapanışına kadar olan kısmı TAMAMEN aşağıdakiyle değiştir:

```tsx
          const m = TAB_META[key];
          const open = openKey === key;
          const content = TAB_CONTENT[key];
          return (
            <div key={key} className="neon-card p-4" style={{ borderColor: m.color }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text" style={{ color: m.color }}>{idx + 1}. {m.label}</p>
                  <p className="text-xs n-muted">{m.desc}</p>
                </div>
                <button onClick={() => move(key, -1)} disabled={idx === 0 || saving}
                  aria-label="Yukarı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                <button onClick={() => move(key, 1)} disabled={idx === shown.length - 1 || saving}
                  aria-label="Aşağı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                <button onClick={() => setVisible(key, false)} disabled={saving}
                  className="px-2.5 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs disabled:opacity-40">
                  Kaldır
                </button>
              </div>

              {/* Dairesel AÇ / KAPAT düğmesi — kartın ortasında */}
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setOpenKey((prev) => (prev === key ? null : key))}
                  aria-expanded={open}
                  aria-label={`${m.label} sekmesini ${open ? 'kapat' : 'aç'}`}
                  className="flex items-center justify-center rounded-full font-bold transition-colors"
                  style={{
                    width: 60,
                    height: 60,
                    fontSize: '0.65rem',
                    letterSpacing: '0.04em',
                    border: `2px solid ${m.color}`,
                    color: m.color,
                    background: open ? `${m.color}26` : 'transparent',
                  }}
                >
                  {open ? 'KAPAT' : 'AÇ'}
                </button>
              </div>

              {/* Sekmenin yönetim ekranı — yalnızca açıkken */}
              {open && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {content ? (
                    <Link href={content.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:brightness-125 transition-all"
                      style={{ background: `${m.color}1a`, border: `1px solid ${m.color}66` }}>
                      <span className="text-xl leading-none">{content.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: m.color }}>{content.title}</p>
                        <p className="text-xs n-muted">{content.desc}</p>
                      </div>
                      <span className="text-sm" style={{ color: m.color }}>→</span>
                    </Link>
                  ) : (
                    <p className="text-sm n-muted">
                      İçerik yönetimi yakında — bu sekme için ekleme/düzenleme ekranı hazırlanıyor.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
```

- [ ] **Step 6: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/admin-tabs-accordion.test.tsx`
Beklenen: PASS — 11 test

- [ ] **Step 7: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/app/admin/settings/tabs/page.tsx apps/web/tests/admin-tabs-accordion.test.tsx
git commit -m "feat: admin sekme kartlari dairesel AC dugmesiyle akordiyon"
```

---

### Task 3: `MovePieceFields` — dizme tahtası durumunu yukarı taşı

Bu görev **yalnızca durum taşımadır** (davranış değişmez). "Notasyonu Kaydet" Task 4'te gelir.
Bu ayrım kasıtlı: arayüz değişimini davranış değişiminden ayırmak, testlerin hangi
değişiklikten kırıldığını belirsizleştirmeyi önler.

**Files:**
- Modify: `apps/web/components/admin/MovePieceFields.tsx`
- Modify: `apps/web/tests/move-piece-fields.test.tsx`
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (çağrı yeri)

- [ ] **Step 1: Mevcut testleri yeni arayüze uyarla ve yeni test ekle**

`apps/web/tests/move-piece-fields.test.tsx` — dosyanın TAMAMINI aşağıdakiyle değiştir:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovePieceFields } from '@/components/admin/MovePieceFields';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

/** Zorunlu propları tek yerden verir — testler yalnızca ilgilendiklerini ezer. */
function setup(over: Partial<React.ComponentProps<typeof MovePieceFields>> = {}) {
  const props = {
    setupFen: EMPTY,
    onSetupFenChange: vi.fn(),
    setupTurn: 'w' as const,
    onSetupTurnChange: vi.fn(),
    fen: null as string | null,
    moves: [] as string[],
    onChange: vi.fn(),
    ...over,
  };
  render(<MovePieceFields {...props} />);
  return props;
}

describe('MovePieceFields', () => {
  it('fen null iken setup fazı: taş paleti ve "Konumu Kaydet" görünür', () => {
    setup();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.getByLabelText('Beyaz Vezir')).toBeInTheDocument(); // BoardEditor paleti
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
  });

  it('"Konumu Kaydet" tıklanınca ÜST BİLEŞENDEN gelen setupFen ile onChange çağrılır', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(props.onChange).toHaveBeenCalledWith(TWO_SIDED, []);
  });

  it('KANIT: dizme tahtası ÜST BİLEŞENDEN gelen setupFen ile çizilir', () => {
    setup({ setupFen: TWO_SIDED });
    // BoardEditor kendi altında "FEN: ..." yazdırır — iç state kullanılsaydı
    // burada boş tahta FEN'i görünürdü.
    expect(screen.getByText(`FEN: ${TWO_SIDED}`)).toBeInTheDocument();
  });

  it('tahta temizlenince onSetupFenChange üst bileşene haber verir', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Tahtayı temizle'));
    expect(props.onSetupFenChange).toHaveBeenCalled();
  });

  it('hamle sırası değişince onSetupTurnChange üst bileşene haber verir', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Siyah'));
    expect(props.onSetupTurnChange).toHaveBeenCalledWith('b');
  });

  it('fen doluyken recording fazı: Notasyon Tablosu ve "Konumu Düzenle" görünür', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    expect(screen.getByText('Notasyon Tablosu')).toBeInTheDocument();
    expect(screen.getByText('Konumu Düzenle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('"Konumu Düzenle" setup fazına döner ve hamleleri sıfırlar', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4', 'Kf8'] });
    fireEvent.click(screen.getByText('Konumu Düzenle'));
    expect(props.onChange).toHaveBeenCalledWith(null, []);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx`
Beklenen: FAIL — 4 test başarısız. Bileşen `setupFen` / `setupTurn` proplarını yok sayıp
kendi iç state'ini kullandığı için:
- `"Konumu Kaydet" ... setupFen ile onChange` → `onChange` boş tahta FEN'iyle çağrılır
- `KANIT: ... setupFen ile çizilir` → `FEN: 8/8/...` görünür, beklenen FEN değil
- `onSetupFenChange` ve `onSetupTurnChange` → hiç çağrılmaz

> Bu testlerdeki `Tahtayı temizle`, `Siyah` ve `FEN: ` metinleri `BoardEditor.tsx`
> içinde doğrulanmış GERÇEK metinlerdir (satır 225, 234, 237) — uydurma değil.

- [ ] **Step 3: `MovePieceFields`'i kontrollü bileşene çevir**

`apps/web/components/admin/MovePieceFields.tsx` — dosyanın TAMAMINI aşağıdakiyle değiştir:

```tsx
'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';

interface Props {
  /** Adım 2 — dizme tahtası. Durum ÜST BİLEŞENDE tutulur (tek doğruluk kaynağı). */
  setupFen: string;
  onSetupFenChange: (fen: string) => void;
  setupTurn: 'w' | 'b';
  onSetupTurnChange: (t: 'w' | 'b') => void;
  /** Adım 3 — null = henüz "Konumu Kaydet"e basılmadı (setup fazı). */
  fen: string | null;
  moves: string[];
  onChange: (fen: string | null, moves: string[]) => void;
}

/**
 * Taşı Oynat sorusunun iki fazlı akışı:
 *   setup     → taşları yerleştir, "Konumu Kaydet"
 *   recording → taşları sürükleyerek hamle dizisi kaydet
 *
 * Faz ayrı bir state'te tutulmaz; `fen === null` olması setup fazını belirler
 * (tek doğruluk kaynağı — faz ile fen'in birbirinden sapması imkansız).
 *
 * Bileşen tamamen KONTROLLÜdür: hiç iç state tutmaz. Dizme tahtasının durumu üst
 * bileşende yaşar, çünkü adım listesi ("Konum Diz" tamamlandı mı?) orada hesaplanır.
 */
export function MovePieceFields({
  setupFen, onSetupFenChange, setupTurn, onSetupTurnChange, fen, moves, onChange,
}: Props) {
  if (fen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted">
          Taşları tahtaya yerleştir, sonra aşağıdaki butona bas.
        </p>
        <BoardEditor
          fen={setupFen} turn={setupTurn}
          onChange={onSetupFenChange} onTurnChange={onSetupTurnChange}
        />
        <button type="button" onClick={() => onChange(setupFen, [])}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs n-muted flex-1">
          Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
        </p>
        <button type="button" onClick={() => onChange(null, [])}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Konumu Düzenle
        </button>
      </div>
      <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={(m) => onChange(fen, m)} />
    </div>
  );
}
```

- [ ] **Step 4: `ExerciseForm`'daki çağrıyı güncelle**

`apps/web/components/admin/ExerciseForm.tsx` — `{type === 'move_piece' && (` bloğunu bul
(`<MovePieceFields ... />` içeren) ve TAMAMINI aşağıdakiyle değiştir:

```tsx
      {type === 'move_piece' && (
        <MovePieceFields
          setupFen={fen}
          onSetupFenChange={setFen}
          setupTurn={turn}
          onSetupTurnChange={setTurn}
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
        />
      )}
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx tests/exercise-form-move-piece.test.tsx`
Beklenen: PASS — `move-piece-fields` 7 test, `exercise-form-move-piece` 5 test (henüz
değişmedi; adım kilidi Task 5'te geldiğinde bu dosya güncellenecek)

- [ ] **Step 6: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/MovePieceFields.tsx apps/web/components/admin/ExerciseForm.tsx apps/web/tests/move-piece-fields.test.tsx
git commit -m "refactor: MovePieceFields tam kontrollu, dizme tahtasi durumu ust bilesende"
```

---

### Task 4: `MovePieceFields` — "Notasyonu Kaydet" fazı

**Files:**
- Modify: `apps/web/components/admin/MovePieceFields.tsx`
- Modify: `apps/web/tests/move-piece-fields.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/move-piece-fields.test.tsx` — `setup()` yardımcısındaki `props` nesnesine
iki satır EKLE (`onChange: vi.fn(),` satırının hemen altına):

```tsx
    notationSaved: false,
    onNotationSavedChange: vi.fn(),
```

Aynı dosyanın SONUNA, son `});` kapanışından ÖNCE aşağıdaki describe bloğunu ekle:

```tsx
describe('MovePieceFields — Notasyonu Kaydet (adım 5)', () => {
  it('hamle yokken "Notasyonu Kaydet" devre dışıdır', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: [] });
    expect(screen.getByText('Notasyonu Kaydet')).toBeDisabled();
  });

  it('hamle varken "Notasyonu Kaydet" etkindir', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    expect(screen.getByText('Notasyonu Kaydet')).toBeEnabled();
  });

  it('"Notasyonu Kaydet" tıklanınca üst bileşene true bildirilir', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    fireEvent.click(screen.getByText('Notasyonu Kaydet'));
    expect(props.onNotationSavedChange).toHaveBeenCalledWith(true);
  });

  it('notationSaved true iken kaydedilen notasyon cevap olarak gösterilir', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4', 'Kf8'], notationSaved: true });
    expect(screen.getByText('1. Rh4 Kf8')).toBeInTheDocument();
    expect(screen.getByText(/Kaydedilen cevap notasyonu/)).toBeInTheDocument();
  });

  it('notationSaved true iken tahta ve kaydet butonu gösterilmez (kilitli)', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'], notationSaved: true });
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
    expect(screen.queryByText('Notasyonu Kaydet')).not.toBeInTheDocument();
  });

  it('"Notasyonu Düzenle" kilidi açar', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'], notationSaved: true });
    fireEvent.click(screen.getByText('Notasyonu Düzenle'));
    expect(props.onNotationSavedChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx`
Beklenen: FAIL — `Unable to find an element with the text: Notasyonu Kaydet`

- [ ] **Step 3: Notasyon kilidini uygula**

`apps/web/components/admin/MovePieceFields.tsx` — üç değişiklik:

**3a.** İlk satırdaki import bloğuna `formatNotation`'ı ekle:

```tsx
'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';
import { formatNotation } from '@/lib/admin/movePieceSteps';
```

**3b.** `Props` arayüzüne iki alan ekle (`onChange` satırının ALTINA):

```tsx
  /** Adım 5 — notasyon cevap olarak kilitlendi mi? */
  notationSaved: boolean;
  onNotationSavedChange: (v: boolean) => void;
```

**3c.** Fonksiyon imzasını ve recording fazı gövdesini değiştir. `export function MovePieceFields({`
satırından dosya sonuna kadar olan kısmı aşağıdakiyle değiştir:

```tsx
export function MovePieceFields({
  setupFen, onSetupFenChange, setupTurn, onSetupTurnChange,
  fen, moves, onChange, notationSaved, onNotationSavedChange,
}: Props) {
  if (fen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted">
          Taşları tahtaya yerleştir, sonra aşağıdaki butona bas.
        </p>
        <BoardEditor
          fen={setupFen} turn={setupTurn}
          onChange={onSetupFenChange} onTurnChange={onSetupTurnChange}
        />
        <button type="button" onClick={() => onChange(setupFen, [])}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      </div>
    );
  }

  // Adım 5 tamam: notasyon cevap olarak kilitlendi — tahta salt-okunur olur.
  if (notationSaved) {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/40">
          <p className="text-xs n-muted mb-1">Kaydedilen cevap notasyonu</p>
          <p className="font-mono text-sm text-cyan-200">{formatNotation(fen, moves)}</p>
        </div>
        <button type="button" onClick={() => onNotationSavedChange(false)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Notasyonu Düzenle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs n-muted flex-1">
          Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
        </p>
        <button type="button" onClick={() => onChange(null, [])}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Konumu Düzenle
        </button>
      </div>
      <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={(m) => onChange(fen, m)} />
      <button type="button" disabled={moves.length === 0}
        onClick={() => onNotationSavedChange(true)}
        className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
        Notasyonu Kaydet
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `ExerciseForm`'da geçici prop bağla**

`ExerciseForm.tsx` derlenebilsin diye iki yeni prop şimdilik yerel state ile bağlanır;
Task 5'te bu state adım listesine de beslenecek. `BoardExerciseFields` içindeki
`const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);` satırının ALTINA ekle:

```tsx
  /** Adım 5 — mevcut soruyu düzenlerken kayıtlı notasyon zaten onaylı sayılır (KURAL #3). */
  const [notationSaved, setNotationSaved] = useState(!!initial?.moves?.length);
```

Ve `<MovePieceFields ... />` çağrısına iki prop ekle:

```tsx
      {type === 'move_piece' && (
        <MovePieceFields
          setupFen={fen}
          onSetupFenChange={setFen}
          setupTurn={turn}
          onSetupTurnChange={setTurn}
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
          notationSaved={notationSaved}
          onNotationSavedChange={setNotationSaved}
        />
      )}
```

Ayrıca `submit()` içindeki sıfırlama bloğunda (`if (!editing) {` içinde) `setMoveFen(null); setMoves([]);`
satırının yanına ekle:

```tsx
        setNotationSaved(false);
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx tests/exercise-form-move-piece.test.tsx`
Beklenen: PASS — `move-piece-fields` 13 test, `exercise-form-move-piece` 5 test

- [ ] **Step 6: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/MovePieceFields.tsx apps/web/components/admin/ExerciseForm.tsx apps/web/tests/move-piece-fields.test.tsx
git commit -m "feat: Notasyonu Kaydet adimi - notasyon cevap olarak kilitlenir"
```

---

### Task 5: `ExerciseForm` — 6 adımlık liste + "Soruyu ekle" kilidi

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Modify: `apps/web/tests/exercise-form-move-piece.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/exercise-form-move-piece.test.tsx` — dosyanın TAMAMINI aşağıdakiyle değiştir.
(Mevcut "hamle kaydedilmeden gönderilirse hata gösterir" testi artık geçerli değil: buton
kilit yüzünden `disabled` olduğu için tıklama hiç `validate()`'e ulaşmıyor. Yerine kilidin
kendisi sınanır.)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

function openMovePiece() {
  render(<ExerciseForm onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByText('Konum ekle'));
  fireEvent.click(screen.getByText('Taşı oynat'));
}

describe('ExerciseForm — Taşı oynat entegrasyonu', () => {
  it('ÇİFT TAHTA OLMAMALI: Taşı oynat seçilince tek tahta render edilir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı oynat'));
    // Her tahta 64 kare üretir; iki tahta olsaydı 128 olurdu.
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('Taşı oynat seçilince "Konumu Kaydet" görünür, eski hedef-kare seçici görünmez', () => {
    openMovePiece();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.queryByText('Oynayacak taşın karesi')).not.toBeInTheDocument();
  });

  it('REGRESYON: Kareye tıkla hâlâ tahta + hedef-kare seçici gösterir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    // varsayılan zaten click_square
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText(/Doğru kare\(ler\)/)).toBeInTheDocument();
  });

  it('REGRESYON: Taşı tanı hâlâ tahta + vurgu seçici gösterir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı tanı'));
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText(/Vurgulanacak kare/)).toBeInTheDocument();
  });
});

describe('ExerciseForm — Taşı oynat 6 adımlı akış', () => {
  /**
   * Adım listesi kendi aria-label'ı ile bulunur. Serbest `getByText` KULLANILMAZ:
   * "Konumu Kaydet" ve "Notasyonu Kaydet" metinleri hem adım listesinde hem de
   * butonlarda geçiyor; çoklu eşleşmede getByText hata verir.
   */
  function stepTexts(): string[] {
    const list = screen.getByLabelText('Taşı Oynat adımları');
    return Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
  }

  it('altı adım da sırayla ve doğru etiketlerle listelenir', () => {
    openMovePiece();
    const texts = stepTexts();
    expect(texts).toHaveLength(6);
    expect(texts[0]).toContain('1. Talimat Ekle');
    expect(texts[1]).toContain('2. Konum Diz');
    expect(texts[2]).toContain('3. Konumu Kaydet');
    expect(texts[3]).toContain('4. Cevap Hamlelerini Yap ve Notasyon Oluştur');
    expect(texts[4]).toContain('5. Notasyonu Kaydet');
    expect(texts[5]).toContain('6. Zorluk Düzeyinin Seçimini Yap');
  });

  it('REGRESYON: Kareye tıkla seçiliyken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('REGRESYON: Taşı tanı seçiliyken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı tanı'));
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('eksik adım varken "Soruyu ekle" devre dışıdır', () => {
    openMovePiece();
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('eksik olan ilk adımı ekranda yazar', () => {
    openMovePiece();
    expect(screen.getByText(/Eksik: 1\. Talimat Ekle/)).toBeInTheDocument();
  });

  it('talimat girilince eksik adım 2ye ilerler', () => {
    openMovePiece();
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Kaleyi oyna' } });
    expect(screen.getByText(/Eksik: 2\. Konum Diz/)).toBeInTheDocument();
  });

  it('TUZAK: zorluk varsayılanı 1 olsa da tıklanmadıkça adım 6 tamamlanmaz', () => {
    openMovePiece();
    // Zorluk state'i varsayılan 1 ("Kolay") — ama BİLFİİL tıklanmadı.
    expect(stepTexts()[5]).not.toContain('✓');
    fireEvent.click(screen.getByText('Kolay'));
    expect(stepTexts()[5]).toContain('✓');
  });

  it('talimat girilince adım 1 tik alır', () => {
    openMovePiece();
    expect(stepTexts()[0]).not.toContain('✓');
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Oyna' } });
    expect(stepTexts()[0]).toContain('✓');
  });
});

describe('ExerciseForm — mevcut Taşı oynat sorusunu düzenleme (KURAL #3)', () => {
  const EXISTING = {
    type: 'move_piece' as const,
    instruction: 'Kaleyi h4e oyna',
    fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
    moves: ['Rh4'],
    difficulty: 3,
    code: '007',
  };

  it('kayıtlı soru açılınca altı adım da tamamlanmış sayılır ve buton etkindir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={EXISTING} />);
    expect(screen.getByText('Soruyu kaydet')).toBeEnabled();
    expect(screen.queryByText(/Eksik:/)).not.toBeInTheDocument();
  });

  it('kayıtlı sorunun notasyonu cevap olarak gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={EXISTING} />);
    expect(screen.getByText('1. Rh4')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx`
Beklenen: FAIL — `Unable to find an element with the text: /Eksik: 1\. Talimat Ekle/`
(adım listesi ve kilit henüz yok)

- [ ] **Step 3: Adım mantığını içe al**

`apps/web/components/admin/ExerciseForm.tsx` — dosya başındaki import bloğuna ekle
(`import { DIFFICULTY_LABELS, ... }` satırının ALTINA):

```tsx
import { movePieceSteps, firstIncompleteStep, allStepsDone } from '@/lib/admin/movePieceSteps';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';
```

- [ ] **Step 4: `difficultyChosen` state'ini ekle**

`BoardExerciseFields` içinde, Task 4'te eklenen `const [notationSaved, setNotationSaved] = ...`
satırının ALTINA ekle:

```tsx
  /**
   * Adım 6 — zorluk etiketine BİLFİİL tıklandı mı? `difficulty` varsayılanı 1 olduğu
   * için sayıya bakmak yetmez. Mevcut soruyu düzenlerken kayıtlı bir değer zaten var,
   * hocayı tekrar tıklamaya zorlamak regresyon olur (KURAL #3) — bu yüzden true başlar.
   */
  const [difficultyChosen, setDifficultyChosen] = useState(!!initial);
```

- [ ] **Step 5: Adım durumunu ve kilidi hesapla**

Aynı bileşende, `const squares = Object.keys(fenToMap(fen)).sort();` satırının ALTINA ekle:

```tsx
  const stepState: MovePieceStepState = {
    instruction, setupFen: fen, moveFen, moves, notationSaved, difficultyChosen,
  };
  const steps = movePieceSteps(stepState);
  const missing = firstIncompleteStep(stepState);
  /** Kilit YALNIZCA Taşı Oynat'a uygulanır; diğer iki tip eskisi gibi çalışır. */
  const gateOpen = type !== 'move_piece' || allStepsDone(stepState);
```

- [ ] **Step 6: Adım listesini render et**

Aynı bileşende, talimat girişini bul:

```tsx
      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Piyonu e4'e taşı)" className="neon-input" />
```

Bu satırların HEMEN ÜSTÜNE ekle:

```tsx
      {type === 'move_piece' && (
        <ol className="grid gap-1.5" aria-label="Taşı Oynat adımları">
          {steps.map((st) => {
            const active = !st.done && st.no === missing?.no;
            return (
              <li key={st.no} className="flex items-center gap-2 text-xs"
                style={{ opacity: st.done || active ? 1 : 0.45 }}>
                <span className="flex items-center justify-center rounded-full flex-shrink-0 font-bold"
                  style={{
                    width: 20, height: 20, fontSize: '0.65rem',
                    border: `1.5px solid ${st.done ? '#34d399' : 'rgba(255,255,255,0.25)'}`,
                    color: st.done ? '#34d399' : 'rgba(255,255,255,0.6)',
                  }}>
                  {st.done ? '✓' : st.no}
                </span>
                <span style={{ color: st.done ? '#34d399' : undefined }}>
                  {st.no}. {st.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
```

- [ ] **Step 7: Zorluk düğmesine "bilfiil tıklandı" işaretini ekle**

Aynı bileşende zorluk düğmesini bul ve `onClick`'ini değiştir:

```tsx
            <button key={val} type="button"
              onClick={() => { setDifficulty(val); setDifficultyChosen(true); }}
```

- [ ] **Step 8: "Soruyu ekle" butonunu kilitle**

Aynı bileşende gönder butonunu bul ve blok TAMAMINI aşağıdakiyle değiştir:

```tsx
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={submit} disabled={saving || !gateOpen}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
        {!gateOpen && missing && (
          <span className="text-xs n-muted">Eksik: {missing.no}. {missing.label}</span>
        )}
        {editing && onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
            İptal
          </button>
        )}
      </div>
```

- [ ] **Step 9: Sıfırlamaya `difficultyChosen`'ı ekle**

`submit()` içindeki `if (!editing) {` bloğunda, Task 4'te eklenen `setNotationSaved(false);`
satırının yanına ekle:

```tsx
        setDifficultyChosen(false);
```

- [ ] **Step 10: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx`
Beklenen: PASS — 14 test

- [ ] **Step 11: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-move-piece.test.tsx
git commit -m "feat: Tasi Oynat 6 adimli akis + Soruyu ekle kilidi"
```

---

### Task 6: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: TypeScript**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: çıktı yok (hata yok)

- [ ] **Step 2: Lint**

Çalıştır: `cd apps/web && npx next lint`
Beklenen: yalnızca ÖNCEDEN var olan uyarılar (`no-img-element`, `saveScroll`, `_score`/`_max`).
Bu görevde dokunulan dosyalardan YENİ uyarı çıkmamalı. Çıkarsa düzelt.

- [ ] **Step 3: Tüm test paketi**

Çalıştır: `cd apps/web && npx vitest run`
Beklenen: tüm dosyalar PASS. Bu plan öncesi 332 test vardı; bu plan net +53 test getirir:
`move-piece-steps` +24 (yeni), `admin-tabs-accordion` +11 (yeni),
`move-piece-fields` 4 → 13 (+9), `exercise-form-move-piece` 5 → 14 (+9).
Not: `exercise-form-move-piece`'teki eski "hamle kaydedilmeden gönderilirse hata
gösterir" testi Task 5'te SİLİNDİ (buton artık `disabled` olduğu için tıklama
`validate()`'e hiç ulaşmıyor); yerine kilit davranışı sınanıyor.
Toplam **385** olmalı ve **başarısız test olmamalı**.

Sayı birebir tutmazsa panik yok — önemli olan **sıfır başarısız test**. Ama beklenenden
AZ test varsa bir dosya çalışmıyor olabilir; kontrol et.

Herhangi bir test kırılırsa DUR ve düzelt — kırık testle ilerlenmez.

- [ ] **Step 4: Üretim derlemesi**

Çalıştır: `cd apps/web && npm run build`
Beklenen: `✓ Compiled successfully`, hata yok

- [ ] **Step 5: Commit (yalnızca düzeltme yapıldıysa)**

```bash
cd /c/Users/muham/chess-app
git add -A apps/web
git commit -m "test: P7 tam test kapisi"
```

Düzeltme gerekmediyse bu adım atlanır (commit edilecek bir şey yoktur).

---

### Task 7: Canlı doğrulama (KURAL #6)

**Files:** yok (tarayıcıda gerçek sürüş)

Bu görev **prod backend'e bağlı** dev sunucuda yapılır. Backend'e dokunulmadığı için
push gerekmez — mevcut prod API yeterlidir.

- [ ] **Step 1: Ortamı hazırla**

`apps/web/.env.local` dosyasını oluştur:

```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```

**UYARI:** Bu dosya ASLA commit edilmez; doğrulama bitince silinir.

- [ ] **Step 2: Dev sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır. **Bash ile sunucu başlatılmaz.**
Ardından `preview_logs` ile derlemenin temiz olduğunu doğrula.

- [ ] **Step 3: Admin Sekmeler akordiyonunu doğrula**

`/admin/settings/tabs` adresine git. Doğrula:
- Dört kartın da ortasında dairesel **AÇ** düğmesi var
- Hiçbir kart açık değil (Ders İçeriği linki görünmüyor)
- **Dersler**'in AÇ'ına bas → Ders İçeriği linki çıkar, düğme **KAPAT** olur
- **Maç Yap**'ın AÇ'ına bas → Açılış Listesi linki çıkar, Dersler kapanır (akordiyon)
- **Analiz Et** ve **Eğlence** açılınca "yakında" notu görünür
- KAPAT'a bas → içerik kapanır
- Kart kapalıyken ↑ / ↓ / Kaldır butonları hâlâ çalışıyor (bir sekmeyi kaldır, sonra
  "Kaldırılan sekmeler" bölümünden **+ Ekle** ile geri koy — prod ayarı bozulmuş kalmasın)

`read_console_messages` ile hata olmadığını doğrula.

- [ ] **Step 4: Konum Ekle > Taşı Oynat akışını baştan sona sür**

`/admin/content` → bir düzey → bir ders → bir alt konu → soru ekleme ekranını aç.
**Konum ekle** → **Taşı oynat** seç. Doğrula:
- Altı adım numaralı listede görünüyor, hiçbiri ✓ değil
- "Soruyu ekle" kapalı ve yanında "Eksik: 1. Talimat Ekle" yazıyor

Sonra sırayla:
1. Talimata `P7 TEST SORUSU - SILINECEK` yaz → adım 1 ✓ olur, eksik 2'ye geçer
2. Tahtaya en az bir beyaz ve bir siyah taş yerleştir (örn. beyaz kale + iki şah) → adım 2 ✓
3. **Konumu Kaydet**'e bas → adım 3 ✓, notasyon tablosu açılır
4. Bir taşı sürükleyip hamle yap → adım 4 ✓, hamle tabloya yazılır
5. **Notasyonu Kaydet**'e bas → adım 5 ✓, "Kaydedilen cevap notasyonu" ve notasyon metni görünür
6. Bir zorluk etiketine bas → adım 6 ✓
- Artık "Soruyu ekle" **etkin** ve "Eksik:" yazısı kaybolmuş olmalı

- [ ] **Step 5: Soruyu gerçekten ekle ve doğrula**

"Soruyu ekle"ye bas. Sorunun listeye eklendiğini doğrula. Sonra soruyu **düzenlemeye aç**
ve altı adımın da ✓ geldiğini, notasyonun cevap olarak göründüğünü doğrula (KURAL #3).

- [ ] **Step 6: "Notasyonu Düzenle" kilidini doğrula**

Düzenleme ekranında **Notasyonu Düzenle**'ye bas → adım 5 tiki kalkar, tahta yeniden
düzenlenebilir olur, "Soruyu kaydet" kilitlenir.

- [ ] **Step 7: Regresyon — diğer iki tip**

Aynı ekranda **Kareye tıkla** ve **Taşı tanı** seç. Doğrula:
- Adım listesi **görünmüyor**
- "Soruyu ekle" eskisi gibi çalışıyor (adım kilidi uygulanmıyor)

- [ ] **Step 8: Temizlik**

- Step 5'te eklenen `P7 TEST SORUSU - SILINECEK` sorusunu **sil** ve silindiğini doğrula
- Step 3'te kaldırılan sekme geri eklenmiş olmalı — `/admin/settings/tabs`'ta dört sekmenin
  de "Sporcuda görünen sekmeler" listesinde olduğunu doğrula
- `apps/web/.env.local` dosyasını **sil**
- `preview_stop` ile sunucuyu durdur

- [ ] **Step 9: Dürüst rapor yaz**

Neyin tarayıcıda **gerçekten** görüldüğünü, neyin yalnızca otomatik testle doğrulandığını
açıkça ayır. Doğrulanamayan bir şey varsa "doğrulayamadım" yaz — "çalışıyor" DEME (KURAL #1).
Rapor CLAUDE.md'deki ekip ağzıyla yazılır.

---

## Kapsam Notları

- **Görsel Havuzu** bu planda YOK — ayrı spec bekliyor (havuz görsellerinin kaynağı kararı).
- **Cümle Ekle** bölümüne dokunulmuyor.
- **Kareye tıkla / Taşı tanı** soru tipleri adım akışına geçmiyor; regresyon testleriyle korunuyor.
- **Backend / şema / migration / sporcu tarafı** değişmiyor.
- `app/admin/layout.tsx` değişmiyor — Açılış Listesi yan menüde de kalıyor.
