# Soru Bölümleri Bağımsızlık + Taşı Tanı Kaldırma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cümle/Görüntü/Konum bölümlerini birbirinden tamamen bağımsız yapmak (taslaklar korunarak) ve Taşı Tanı'yı yeni soru formundan kaldırmak (eski sorular çalışmaya devam eder).

**Architecture:** `key={family}` ile bölüm değişince form sıfırdan kurulur; kayıp olmasın diye `ExerciseForm` bölüm başına taslağı `useRef`'te tutar ve alt bileşenler `draft`/`onDraftChange` ile okur-yazar. Taşı Tanı tip düğmesi listeden çıkar; tip birliği, doğrulama dalları ve sporcu çözücüsü aynen kalır.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react (happy-dom). Backend'e dokunulmaz.

**Spec:** `docs/superpowers/specs/2026-07-26-soru-bolumleri-bagimsizlik-design.md`

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/components/admin/ExerciseForm.tsx` **(değişir)** | `key={family}`, taslak deposu, `BoardExerciseFields` tip listesi/kilit/rozet. |
| `apps/web/components/admin/ChoiceExerciseFields.tsx` **(değişir)** | `draft`/`onDraftChange` desteği; `ChoiceDraft` tipini dışa verir. |
| `apps/web/tests/exercise-form-family-isolation.test.tsx` **(yeni)** | Bölüm izolasyonu + taslak korunması. |
| `apps/web/tests/exercise-form-move-piece.test.tsx` **(değişir)** | "Taşı tanı"ya tıklayan 2 test → düzenleme-modu testlerine çevrilir. |

**Dokunulmaz:** `ExerciseType` birliği, `validate()`/`submit()` içindeki `identify_piece`
dalları, backend doğrulaması, sporcu çözücüsü (`BoardExercise.tsx`), `MovePieceFields`.

---

## Task 1: Taşı Tanı formdan kalkar + tip kilidi + rozet

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (BoardExerciseFields, ~215-228 satırları)
- Modify: `apps/web/tests/exercise-form-move-piece.test.tsx`

- [ ] **Step 1: Kırılacak iki testi yeniden yaz**

`tests/exercise-form-move-piece.test.tsx` içinde `'REGRESYON: Taşı tanı hâlâ tahta + vurgu seçici gösterir'`
ve `'REGRESYON: Taşı tanı seçiliyken adım listesi GÖSTERİLMEZ'` testlerini **sil**, yerlerine ekle:

```tsx
  it('YENİ soruda "Taşı tanı" düğmesi YOKTUR', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Kareye tıkla')).toBeInTheDocument();
    expect(screen.getByText('Taşı oynat')).toBeInTheDocument();
    expect(screen.queryByText('Taşı tanı')).not.toBeInTheDocument();
  });

  it('ESKİ Taşı tanı sorusu düzenlemede açılır: rozet görünür, tip düğmeleri kilitli', () => {
    render(
      <ExerciseForm
        onSubmit={vi.fn()}
        initial={{
          type: 'identify_piece',
          instruction: 'Bu taş nedir?',
          fen: '8/8/8/4N3/8/8/8/8 w - - 0 1',
          highlight_square: 'e5',
          options: ['At', 'Fil'],
          correct_index: 0,
          difficulty: 1,
        }}
      />,
    );
    expect(screen.getByText(/Bu soru "Taşı tanı" tipinde/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Kareye tıkla' });
    expect(btn).toBeDisabled();
  });
```

(Bu dosyada `ExerciseForm`, `render`, `screen`, `fireEvent`, `vi` zaten import'lu —
dosyanın mevcut import satırları korunur.)

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx
```

Beklenen: FAIL — "Taşı tanı" düğmesi hâlâ DOM'da; rozet metni yok.

- [ ] **Step 3: Implementation**

`ExerciseForm.tsx` içinde `BoardExerciseFields`'ın tip düğmeleri bloğunu değiştir:

```tsx
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
          <button key={t} type="button" disabled={editing}
            onClick={() => { setType(t); setTargets([]); setErr(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}>{label}</button>
        ))}
        {/* Tasi Tani YENI soruda yok; eski soru duzenlenirken rozetle gosterilir.
            Tip birligi ve validate/submit dallari YASIYOR — eski sorular calisir. */}
        {editing && type === 'identify_piece' && (
          <span className="px-2.5 py-1 rounded-lg text-xs border border-amber-400/50 text-amber-200 bg-amber-400/10">
            🏷 Bu soru &quot;Taşı tanı&quot; tipinde — yeni eklenemez
          </span>
        )}
      </div>
```

Değişenler: liste 2 tipe indi, düğmelere `disabled={editing}` geldi, rozet eklendi.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx
```

Beklenen: PASS — dosyadaki tüm testler.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-move-piece.test.tsx
git commit -m "feat: Tasi Tani yeni soru formundan kalkti, duzenlemede rozet + tip kilidi"
```

---

## Task 2: `key={family}` + bölüm başına taslak

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/exercise-form-family-isolation.test.tsx` (yeni)

- [ ] **Step 1: Write the failing test**

`apps/web/tests/exercise-form-family-isolation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

// PoolPicker havuzu fetch'ler; bos liste yeterli.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
});

const INSTR = /Soru cümlesi/;   // ChoiceExerciseFields talimat placeholder'i

describe('ExerciseForm — bölüm bağımsızlığı', () => {
  it('Cümle\'ye yazılan talimat Görüntü\'ye SIZMAZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'Atın hareketi nasıldır?' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('');
  });

  it('Cümle taslağı Görüntü\'ye gidip DÖNÜNCE geri gelir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'Atın hareketi nasıldır?' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('Atın hareketi nasıldır?');
  });

  it('Konum\'a gidip dönünce de Cümle taslağı durur', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'Kale kaç kare gider?' },
    });
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Kareye tıkla')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('Kale kaç kare gider?');
  });

  it('Görüntü taslağı ile Cümle taslağı AYRIDIR', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'cümle-talimatı' },
    });
    fireEvent.click(screen.getByText('Görüntü ekle'));
    fireEvent.change(screen.getByPlaceholderText(INSTR), {
      target: { value: 'görüntü-talimatı' },
    });
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('cümle-talimatı');
    fireEvent.click(screen.getByText('Görüntü ekle'));
    expect(screen.getByPlaceholderText(INSTR)).toHaveValue('görüntü-talimatı');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/exercise-form-family-isolation.test.tsx
```

Beklenen: FAIL — bugün Cümle↔Görüntü aynı bileşen örneği olduğu için ilk test
("SIZMAZ") kırılır: talimat Görüntü'de de dolu görünür.

- [ ] **Step 3: `ChoiceExerciseFields`'a taslak desteği**

`ChoiceExerciseFields.tsx` — üç değişiklik:

**(a)** Dosyanın üstüne (Props'tan önce) taslak tipi ve dışa verme:

```tsx
/** Bolum taslagi: Zafer hoca baska bolume gecip dondugunde yazdiklarini
 *  kaybetmesin diye ExerciseForm'da saklanan alanlar. YALNIZCA yeni soru
 *  eklerken kullanilir; duzenleme modunda devre disi. */
export interface ChoiceDraft {
  instruction: string;
  promptImage: string;
  optionCount: 2 | 3 | 4;
  answerKind: 'sentence' | 'image';
  options: string[];
  correctIndex: number;
  successMsg: string;
  failMsg: string;
  difficulty: number;
}
```

**(b)** Props'a iki alan:

```tsx
  /** Yeni soru modunda onceki taslak (varsa) — alan baslangic degerleri. */
  draft?: ChoiceDraft;
  /** Her degisimde taslagi yukari yazar. Duzenlemede verilmez. */
  onDraftChange?: (d: ChoiceDraft) => void;
```

ve imzada: `export function ChoiceExerciseFields({ kind, onSubmit, initial, onCancel, draft, onDraftChange }: Props)`

**(c)** State başlangıçları `draft` öncelikli olur (draft yalnızca `initial` yokken gelir):

```tsx
  const [instruction, setInstruction] = useState(draft?.instruction ?? initial?.instruction ?? '');
  const [promptImage, setPromptImage] = useState(draft?.promptImage ?? initial?.prompt_image ?? '');
  const [optionCount, setOptionCount] = useState<2 | 3 | 4>(
    draft?.optionCount ?? ((initial?.options?.length ?? 2) as 2 | 3 | 4),
  );
  const [answerKind, setAnswerKind] = useState<'sentence' | 'image'>(
    draft?.answerKind ?? initial?.answer_kind ?? 'sentence',
  );
  const [options, setOptions] = useState<string[]>(
    draft?.options ?? (initial?.options && initial.options.length > 0 ? initial.options : ['', '']),
  );
  const [correctIndex, setCorrectIndex] = useState(draft?.correctIndex ?? initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(draft?.successMsg ?? initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(draft?.failMsg ?? initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(draft?.difficulty ?? initial?.difficulty ?? 1);
```

**(d)** `editing` satırının altına taslağı yukarı yazan efekt:

```tsx
  // Taslak her degisimde yukari yazilir — bolum degisince form sifirdan
  // kurulsa da (key), yazilanlar ExerciseForm'da yasamaya devam eder.
  useEffect(() => {
    onDraftChange?.({
      instruction, promptImage, optionCount, answerKind,
      options, correctIndex, successMsg, failMsg, difficulty,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, promptImage, optionCount, answerKind, options,
      correctIndex, successMsg, failMsg, difficulty]);
```

`useEffect` import'unu ekle: `import { useState, useEffect } from 'react';`

- [ ] **Step 4: `ExerciseForm`'da `key` + taslak deposu**

`ExerciseForm.tsx` içinde:

**(a)** Import satırına `useRef` ekle ve `ChoiceDraft` tipini al:

```tsx
import { useState, useRef } from 'react';
import { ChoiceExerciseFields } from './ChoiceExerciseFields';
import type { ChoiceDraft } from './ChoiceExerciseFields';
```

**(b)** `ExerciseForm` gövdesinde `editing` satırının altına:

```tsx
  /** Bolum basina taslak. SADECE yeni soru modunda; form kapaninca ucar (YAGNI). */
  const choiceDrafts = useRef<Partial<Record<'sentence_question' | 'image_question', ChoiceDraft>>>({});
```

**(c)** Render dallanmasını değiştir (`ExerciseForm.tsx:106-110`):

```tsx
      {family === 'konum' ? (
        <BoardExerciseFields key="konum" onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      ) : (
        <ChoiceExerciseFields
          key={family}
          kind={family}
          onSubmit={onSubmit}
          initial={initial}
          onCancel={onCancel}
          draft={editing ? undefined : choiceDrafts.current[family]}
          onDraftChange={editing ? undefined : (d) => { choiceDrafts.current[family] = d; }}
        />
      )}
```

**Not — Konum taslağı:** `BoardExerciseFields` bölüm değişiminde zaten sıfırdan
kuruluyordu (farklı bileşen); `key="konum"` davranışı netleştirir. Konum'un kendi
taslağı **bilinçli olarak yapılmaz**: tahta durumu (`moveFen`, `moves`,
`notationSaved`) yarım kopyalanırsa adım kilidi tutarsızlaşır ve bozuk soru
üretilebilir. Spec'teki test listesi de Konum taslağının geri gelmesini istemez —
yalnızca Cümle/Görüntü taslaklarını ister. Bu sapma raporda belirtilir.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/exercise-form-family-isolation.test.tsx
```

Beklenen: PASS — 4 test.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/exercise-form-family-isolation.test.tsx
git commit -m "feat: soru bolumleri bagimsiz - key ile kurulus + bolum basina taslak"
```

---

## Task 3: Tam test kapısı

- [ ] **Step 1: Frontend kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```

Beklenen: tsc 0 hata; lint 0 hata (`boardSkin.tsx` uyarısı önceden var); testler
**504** civarı PASS — hesap: 500 (mevcut) + 4 (Task 2) + 2 (Task 1'de eklenen) −
2 (Task 1'de silinen) = 504. Sayı tutmuyorsa DUR, gerçek sayıyı raporla (KURAL #1);
build `Compiled successfully`.

- [ ] **Step 2: Backend'e dokunulmadığını doğrula**

```bash
cd /c/Users/muham/chess-app && git diff --stat HEAD~2 -- apps/api
```

Beklenen: boş çıktı.

---

## Task 4: Canlı doğrulama (KURAL #6)

Bu proje **tek öğretmen oturumuyla TAM doğrulanabilir** — admin ekranı.

- [ ] **Step 1: Kullanıcıya sor**

"Bunu canlı önizlemede test edeyim mi?" Onay olmadan başlama.

- [ ] **Step 2: Senaryo**

`.env.local` (prod API) + `preview_start {name:"chess-web"}` sonrası admin >
Ders İçeriği > bir alt konu > Süresiz Pratik Yap > Yeni soru:

1. Cümle'ye talimat yaz → Görüntü'ye geç → alan **boş** olmalı.
2. Cümle'ye dön → talimat **geri gelmeli**.
3. Konum ekle'de tip düğmeleri **2 tane** olmalı; "Taşı tanı" görünmemeli.
4. (Varsa) eski bir Taşı Tanı sorusunu düzenlemeye aç → rozet görünmeli, kaydetme
   çalışmalı. Prod'da böyle bir soru yoksa bu adım atlanır ve raporda yazılır.
5. `read_console_messages` (onlyErrors) temiz olmalı.
6. Hiçbir soru KAYDEDILMEZ (canlı veriye yazma yok); form doldurulup vazgeçilir.

- [ ] **Step 3: Temizlik + dürüst rapor**

```bash
rm -f apps/web/.env.local
```

`preview_stop`; doğrulanan/doğrulanamayan açıkça yazılır.

---

## Task 5: Bitirme

- [ ] **Step 1: finishing-a-development-branch**

Testleri doğrula, seçenekleri sun, kullanıcının seçimini uygula. Push kullanıcı
onayıyla.
