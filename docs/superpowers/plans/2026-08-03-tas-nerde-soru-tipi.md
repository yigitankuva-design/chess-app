# "Taş Nerde?" Soru Tipi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelinde üçüncü tahta sorusu tipi ("Taş Nerde?") eklemek; sporcu, tahtanın dışındaki dairesel kartlarda duran eksik taşları sürükleyerek veya tıklayarak doğru karelere yerleştirsin.

**Architecture:** Saf mantık önce (değerlendirme + 9 adımlık panel akışı), sonra backend doğrulaması, sonra sporcu bileşeni, en son panel entegrasyonu. Sporcu bileşeni `MovePieceSolver` desenini izler: kendi tahtasını ham `react-chessboard` ile çizer (mevcut `ChessBoard.tsx` sarmalayıcısı tahta dışından sürüklenen taşı taşımıyor, imzası `(from, to) => boolean`).

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v3, react-chessboard, Vitest + Testing Library; FastAPI + python-chess, pytest.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/chess/pieceCodes.ts` (YENİ) | Taş paleti sabiti + kod çevirileri — `BoardEditor` ve yeni bileşenler paylaşır |
| `apps/web/lib/play/placePieces.ts` (YENİ) | Sporcunun yerleştirmesini değerlendiren saf mantık |
| `apps/web/lib/admin/placePiecesSteps.ts` (YENİ) | 9 adımlık panel akışının saf mantığı |
| `apps/api/chess_api/routers/admin.py` (DEĞİŞİR) | `place_pieces` tipini tanıma + doğrulama |
| `apps/web/components/lesson-steps/PlacePiecesSolver.tsx` (YENİ) | Sporcu tarafı: dairesel kartlar + tahta |
| `apps/web/components/lesson-steps/BoardExercise.tsx` (DEĞİŞİR) | Yeni tipin tip birleşimi + render dalı |
| `apps/web/components/admin/PlacePiecesFields.tsx` (YENİ) | Panel tarafı: konum dizme + taş/kare eşleştirme |
| `apps/web/components/admin/ExerciseForm.tsx` (DEĞİŞİR) | 3. tip butonu, adım listesi, doğrulama, kaydetme |
| `apps/web/components/BoardEditor.tsx` (DEĞİŞİR) | Palet sabitini ortak modülden alır (kopya kalmaz) |

---

### Task 1: Taş kodu yardımcılarını ortak modüle taşı

`BoardEditor.tsx` içindeki `PALETTE`, `pieceKey`, `pieceTypeToFen` dışa aktarılmamış durumda.
Yeni bileşenler de bunlara ihtiyaç duyacak — kopyalamak yerine ortak modüle taşınır.

**Files:**
- Create: `apps/web/lib/chess/pieceCodes.ts`
- Modify: `apps/web/components/BoardEditor.tsx:16-34`
- Test: `apps/web/tests/piece-codes.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/piece-codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PIECE_PALETTE, pieceKey, pieceTypeToFen } from '@/lib/chess/pieceCodes';

describe('pieceCodes', () => {
  it('palette 12 taş içerir', () => {
    expect(PIECE_PALETTE).toHaveLength(12);
    expect(PIECE_PALETTE.map((p) => p.code)).toContain('K');
    expect(PIECE_PALETTE.map((p) => p.code)).toContain('p');
  });

  it('FEN harfini taş seti anahtarına çevirir', () => {
    expect(pieceKey('K')).toBe('wK');
    expect(pieceKey('p')).toBe('bP');
    expect(pieceKey('n')).toBe('bN');
  });

  it('taş seti anahtarını FEN harfine çevirir', () => {
    expect(pieceTypeToFen('wK')).toBe('K');
    expect(pieceTypeToFen('bP')).toBe('p');
  });

  it('iki çevrim birbirinin tersidir', () => {
    for (const { code } of PIECE_PALETTE) {
      expect(pieceTypeToFen(pieceKey(code))).toBe(code);
    }
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/piece-codes.test.ts
```

Beklenen: FAIL — `@/lib/chess/pieceCodes` modülü yok.

- [ ] **Step 3: `pieceCodes.ts` oluştur**

```ts
import type { CHESS_PIECE_SET } from '@/lib/chess/boardSkin';

/** Paletteki 12 taş — FEN harfi (büyük=beyaz, küçük=siyah) ve Türkçe adı. */
export const PIECE_PALETTE: { code: string; label: string }[] = [
  { code: 'K', label: 'Beyaz Şah' }, { code: 'Q', label: 'Beyaz Vezir' }, { code: 'R', label: 'Beyaz Kale' },
  { code: 'B', label: 'Beyaz Fil' }, { code: 'N', label: 'Beyaz At' }, { code: 'P', label: 'Beyaz Piyon' },
  { code: 'k', label: 'Siyah Şah' }, { code: 'q', label: 'Siyah Vezir' }, { code: 'r', label: 'Siyah Kale' },
  { code: 'b', label: 'Siyah Fil' }, { code: 'n', label: 'Siyah At' }, { code: 'p', label: 'Siyah Piyon' },
];

/** Palet kodunu (K, p, ...) taş seti anahtarına (wK, bP, ...) çevirir. */
export function pieceKey(code: string): keyof typeof CHESS_PIECE_SET {
  return `${code === code.toUpperCase() ? 'w' : 'b'}${code.toUpperCase()}` as keyof typeof CHESS_PIECE_SET;
}

/** Taş seti anahtarını (wP, bN, ...) FEN karakterine (P, n, ...) çevirir. */
export function pieceTypeToFen(pieceType: string): string {
  const color = pieceType[0];
  const type = pieceType[1];
  return color === 'w' ? type.toUpperCase() : type.toLowerCase();
}

/** Geçerli bir FEN taş harfi mi? */
export function isPieceCode(code: string): boolean {
  return code.length === 1 && 'KQRBNPkqrbnp'.includes(code);
}

/** Taşın Türkçe adı (bulunamazsa kodun kendisi). */
export function pieceLabel(code: string): string {
  return PIECE_PALETTE.find((p) => p.code === code)?.label ?? code;
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/piece-codes.test.ts
```

Beklenen: PASS (4 test).

- [ ] **Step 5: `BoardEditor.tsx`'i ortak modüle bağla**

`BoardEditor.tsx` satır 17-34 arasındaki `PALETTE` sabitini, `pieceKey` ve `pieceTypeToFen`
fonksiyonlarını SİL. Yerine dosyanın import bloğuna ekle:

```ts
import { PIECE_PALETTE, pieceKey, pieceTypeToFen } from '@/lib/chess/pieceCodes';
```

Sonra dosya içindeki `PALETTE.map(...)` kullanımını `PIECE_PALETTE.map(...)` yap.
`CHESS_PIECE_SET` importu artık `pieceKey` için gerekmiyorsa ve başka yerde
kullanılmıyorsa kaldır — kullanılıyorsa dokunma (`npx tsc --noEmit` söyler).

- [ ] **Step 6: BoardEditor testleri kırılmadı mı bak**

```bash
cd apps/web && npx vitest run tests/board-editor.test.ts tests/board-editor-annotations.test.tsx tests/click-mode-select.test.tsx && npx tsc --noEmit
```

Beklenen: hepsi PASS, `tsc` sessiz.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/chess/pieceCodes.ts apps/web/components/BoardEditor.tsx apps/web/tests/piece-codes.test.ts
git commit -m "refactor: tas kodu yardimcilari ortak modulde"
```

---

### Task 2: Yerleştirme değerlendirme mantığı

**Files:**
- Create: `apps/web/lib/play/placePieces.ts`
- Test: `apps/web/tests/place-pieces.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/place-pieces.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluatePlacement, allPlaced } from '@/lib/play/placePieces';
import type { PiecePlacement } from '@/lib/play/placePieces';

const pending: PiecePlacement[] = [
  { piece: 'Q', square: 'h5' },
  { piece: 'N', square: 'c6' },
];

describe('evaluatePlacement — sıra serbest, tek hak', () => {
  it('doğru taş doğru kareye konunca kabul edilir ve listeden düşer', () => {
    const r = evaluatePlacement(pending, 'N', 'c6');
    expect(r.ok).toBe(true);
    expect(r.remaining).toEqual([{ piece: 'Q', square: 'h5' }]);
  });

  it('ikinci taş da doğru konunca liste boşalır', () => {
    const r1 = evaluatePlacement(pending, 'N', 'c6');
    const r2 = evaluatePlacement(r1.remaining, 'Q', 'h5');
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toEqual([]);
  });

  it('doğru taş YANLIŞ kareye konursa reddedilir, liste değişmez', () => {
    const r = evaluatePlacement(pending, 'Q', 'a1');
    expect(r.ok).toBe(false);
    expect(r.remaining).toEqual(pending);
  });

  it('listede olmayan taş reddedilir', () => {
    const r = evaluatePlacement(pending, 'R', 'h5');
    expect(r.ok).toBe(false);
  });

  it('aynı taştan iki tane varsa kareye göre ayrışır', () => {
    const two: PiecePlacement[] = [
      { piece: 'R', square: 'a1' },
      { piece: 'R', square: 'h1' },
    ];
    const r = evaluatePlacement(two, 'R', 'h1');
    expect(r.ok).toBe(true);
    expect(r.remaining).toEqual([{ piece: 'R', square: 'a1' }]);
  });
});

describe('allPlaced', () => {
  it('liste boşsa bitmiştir', () => {
    expect(allPlaced([])).toBe(true);
  });
  it('liste doluysa bitmemiştir', () => {
    expect(allPlaced(pending)).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: `placePieces.ts` oluştur**

```ts
/** Bir eksik taş ve onun gitmesi gereken kare. */
export interface PiecePlacement {
  /** FEN harfi — büyük=beyaz, küçük=siyah (bkz. lib/chess/pieceCodes.ts). */
  piece: string;
  square: string;
}

export interface PlacementResult {
  ok: boolean;
  /** Doğruysa yerleştirilen taş çıkarılmış liste; yanlışsa liste aynen. */
  remaining: PiecePlacement[];
}

/**
 * Sporcunun bir taşı bir kareye koymasını değerlendirir.
 *
 * Sıra SERBESTTİR: hangi taşın önce konduğu önemli değil, sadece taşın kendi
 * karesine konması aranır. Aynı taştan birden fazla olabileceği için eşleşme
 * hem taşa hem kareye bakılarak yapılır (iki kale a1/h1 örneği).
 */
export function evaluatePlacement(
  pending: PiecePlacement[],
  piece: string,
  square: string,
): PlacementResult {
  const idx = pending.findIndex((p) => p.piece === piece && p.square === square);
  if (idx === -1) return { ok: false, remaining: pending };
  return { ok: true, remaining: pending.filter((_, i) => i !== idx) };
}

/** Yerleştirilecek taş kalmadı mı? */
export function allPlaced(pending: PiecePlacement[]): boolean {
  return pending.length === 0;
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces.test.ts
```

Beklenen: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/placePieces.ts apps/web/tests/place-pieces.test.ts
git commit -m "feat: tas yerlestirme degerlendirme mantigi"
```

---

### Task 3: 9 adımlık panel akışı mantığı

**Files:**
- Create: `apps/web/lib/admin/placePiecesSteps.ts`
- Test: `apps/web/tests/place-pieces-steps.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/place-pieces-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { placePiecesSteps, PLACE_PIECES_STEP_LABELS } from '@/lib/admin/placePiecesSteps';
import type { PlacePiecesStepState } from '@/lib/admin/placePiecesSteps';

const empty: PlacePiecesStepState = {
  instruction: '',
  setupFen: '8/8/8/8/8/8/8/8 w - - 0 1',
  savedFen: null,
  selectedPiece: null,
  pieces: [],
  answerSaved: false,
  turnChosen: false,
  difficultyChosen: false,
};

const full: PlacePiecesStepState = {
  instruction: 'Veziri mat karesine koy',
  setupFen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  savedFen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  selectedPiece: null,
  pieces: [{ piece: 'Q', square: 'h5' }],
  answerSaved: true,
  turnChosen: true,
  difficultyChosen: true,
};

describe('placePiecesSteps', () => {
  it('9 adım vardır ve sonuncusu Soruyu Ekle', () => {
    expect(PLACE_PIECES_STEP_LABELS).toHaveLength(8); // 9. adım withFinal ile eklenir
    const steps = placePiecesSteps(empty);
    expect(steps).toHaveLength(9);
    expect(steps[8].label).toBe('Soruyu Ekle');
  });

  it('adım sırası kullanıcının verdiği sıradır', () => {
    const labels = placePiecesSteps(empty).map((s) => s.label);
    expect(labels).toEqual([
      'Talimatı Gir',
      'Konumu Diz',
      'Konumu Kaydet',
      'Konuma Eklenecek Taşları Belirle',
      'Taşların Doğru Karelerini Belirle',
      'Cevabı Kaydet',
      'Hamle Sırasını Belirle',
      'Zorluk Düzeyini Belirle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamam değildir', () => {
    expect(placePiecesSteps(empty).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda tüm adımlar tamamdır', () => {
    expect(placePiecesSteps(full).every((s) => s.done)).toBe(true);
  });

  it('palette taş seçilince 4. adım tamam olur, 5. adım olmaz', () => {
    const s = placePiecesSteps({ ...empty, selectedPiece: 'Q' });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(false);
  });

  it('çift oluşunca hem 4. hem 5. adım tamam olur', () => {
    const s = placePiecesSteps({ ...empty, pieces: [{ piece: 'Q', square: 'h5' }] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(true);
  });

  it('konum kaydedilmişse Konumu Diz de tamam sayılır (boş tahta meşrudur)', () => {
    const s = placePiecesSteps({ ...empty, savedFen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    expect(s[1].done).toBe(true);
    expect(s[2].done).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces-steps.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: `placePiecesSteps.ts` oluştur**

```ts
import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';
import type { PiecePlacement } from '@/lib/play/placePieces';

/**
 * "Taş Nerde?" sorusunun 9 adımlık akışının saf mantığı.
 *
 * Adım sırası kullanıcının verdiği sıradır — diğer iki tipte "Hamle Sırasını
 * Belirle" 3. sıradadır, burada 7. sıradadır (hamle sırası cevabı etkilemiyor).
 */
export interface PlacePiecesStepState {
  /** Adım 1 — talimat metni. */
  instruction: string;
  /** Adım 2 — dizme tahtasının FEN'i. */
  setupFen: string;
  /** Adım 3 — "Konumu Kaydet" sonrası kilitlenen konum; null = kaydedilmedi. */
  savedFen: string | null;
  /** Adım 4 — palette seçili ama karesi henüz tıklanmamış taş. */
  selectedPiece: string | null;
  /** Adım 5 — tamamlanmış taş/kare çiftleri. */
  pieces: PiecePlacement[];
  /** Adım 6 — "Cevabı Kaydet"e basıldı mı? */
  answerSaved: boolean;
  /** Adım 7 — hamle sırasına BİLFİİL tıklandı mı (varsayılan Beyaz olduğu için
   *  değere bakmak yetmez — movePieceSteps'teki aynı tuzak). */
  turnChosen: boolean;
  /** Adım 8 — zorluk etiketine BİLFİİL tıklandı mı? */
  difficultyChosen: boolean;
}

export const PLACE_PIECES_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Konuma Eklenecek Taşları Belirle',
  'Taşların Doğru Karelerini Belirle',
  'Cevabı Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
] as const;

export function placePiecesSteps(s: PlacePiecesStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    // BOŞ TAHTA MEŞRUDUR (clickSquareSteps ile aynı kural): konum bilerek
    // kaydedilmişse dizme adımı tamam sayılır.
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.selectedPiece !== null || s.pieces.length > 0,
    s.pieces.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
  ];
  // "Soruyu Ekle" son satırdır: öncekilerin HEPSİ bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...PLACE_PIECES_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces-steps.test.ts
```

Beklenen: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/placePiecesSteps.ts apps/web/tests/place-pieces-steps.test.ts
git commit -m "feat: Tas Nerde 9 adimli akis mantigi"
```

---

### Task 4: Backend doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py:536` (tip demeti) ve `_validate_board_exercises` içi
- Test: `apps/api/tests/test_place_pieces_validation.py`

- [ ] **Step 1: Başarısız testi yaz**

`apps/api/tests/test_place_pieces_validation.py`:

```python
import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "7k/8/8/8/8/8/8/K7 w - - 0 1"


def _ex(**over):
    ex = {
        "type": "place_pieces",
        "instruction": "Veziri mat karesine koy",
        "fen": BASE_FEN,
        "pieces": [{"piece": "Q", "square": "h5"}],
    }
    ex.update(over)
    return ex


def test_gecerli_soru_kabul_edilir():
    _validate_board_exercises([_ex()])


def test_birden_fazla_tas_kabul_edilir():
    _validate_board_exercises([
        _ex(pieces=[{"piece": "Q", "square": "h5"}, {"piece": "N", "square": "c6"}])
    ])


def test_bos_tas_listesi_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(pieces=[])])
    assert e.value.status_code == 400


def test_dolu_kare_reddedilir():
    # a1'de beyaz sah var (BASE_FEN) — eksik tasin karesi BOS olmali.
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(pieces=[{"piece": "Q", "square": "a1"}])])
    assert "dolu" in e.value.detail


def test_ayni_kare_iki_kez_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([
            _ex(pieces=[{"piece": "Q", "square": "h5"}, {"piece": "R", "square": "h5"}])
        ])
    assert e.value.status_code == 400


def test_gecersiz_kare_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "Q", "square": "z9"}])])


def test_gecersiz_tas_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "X", "square": "h5"}])])


def test_bos_string_tas_reddedilir():
    # TUZAK: "" in "KQRBNP..." Python'da True doner — uzunluk kontrolu SART.
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "", "square": "h5"}])])


def test_talimatsiz_soru_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(instruction="  ")])
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/api && python -m pytest tests/test_place_pieces_validation.py -q
```

Beklenen: FAIL — `place_pieces` "Geçersiz alıştırma türü" hatası veriyor.

- [ ] **Step 3: Tip demetine ekle**

`apps/api/chess_api/routers/admin.py` satır 536:

```python
BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece", "place_pieces")
```

- [ ] **Step 4: Doğrulama dalını ekle**

`_validate_board_exercises` içinde, `elif ex_type == "identify_piece":` dalından SONRA
(fonksiyonun sonuna) ekle:

```python
        elif ex_type == "place_pieces":
            pieces = ex.get("pieces")
            if not isinstance(pieces, list) or len(pieces) < 1:
                raise HTTPException(status_code=400, detail="En az bir taş belirlenmeli")
            seen: set[str] = set()
            for i, p in enumerate(pieces):
                if not isinstance(p, dict):
                    raise HTTPException(status_code=400, detail=f"{i + 1}. taş geçersiz")
                pc = p.get("piece")
                # SIRA ONEMLI: uzunluk kontrolu ONCE — "" in "KQRBNP..." True doner.
                if not isinstance(pc, str) or len(pc) != 1 or pc not in "KQRBNPkqrbnp":
                    raise HTTPException(status_code=400, detail=f"Geçersiz taş: {pc}")
                sq = p.get("square")
                if sq not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {sq}")
                if sq in seen:
                    raise HTTPException(status_code=400, detail=f"{sq} karesi iki kez verilmiş")
                seen.add(sq)
                if board.piece_at(chess.parse_square(sq)) is not None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{sq} karesi dolu — eksik taşın karesi boş olmalı",
                    )
```

- [ ] **Step 5: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/api && python -m pytest tests/test_place_pieces_validation.py -q
```

Beklenen: 9 passed.

- [ ] **Step 6: Backend regresyonu**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS (önceki toplam + 9).

- [ ] **Step 7: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_place_pieces_validation.py
git commit -m "feat: place_pieces soru tipi backend dogrulamasi"
```

---

### Task 5: Sporcu bileşeni — `PlacePiecesSolver`

**Files:**
- Create: `apps/web/components/lesson-steps/PlacePiecesSolver.tsx`
- Test: `apps/web/tests/place-pieces-solver.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/place-pieces-solver.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacePiecesSolver } from '@/components/lesson-steps/PlacePiecesSolver';
import type { PlacePiecesEx } from '@/components/lesson-steps/BoardExercise';

const ex: PlacePiecesEx = {
  type: 'place_pieces',
  instruction: 'Eksik taşları yerleştir',
  fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  pieces: [
    { piece: 'Q', square: 'h5' },
    { piece: 'N', square: 'c6' },
  ],
};

function setup(over: Partial<Parameters<typeof PlacePiecesSolver>[0]> = {}) {
  const onSolved = vi.fn();
  const onWrong = vi.fn();
  const r = render(
    <PlacePiecesSolver exercise={ex} disabled={false} onSolved={onSolved} onWrong={onWrong} {...over} />,
  );
  return { ...r, onSolved, onWrong };
}

describe('PlacePiecesSolver', () => {
  it('eksik taşlar dairesel kartlarda gösterilir', () => {
    setup();
    expect(screen.getByRole('button', { name: /Beyaz Vezir/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beyaz At/ })).toBeInTheDocument();
  });

  it('tıkla-tıkla ile doğru yerleştirme kartı listeden düşürür', () => {
    const { container, onWrong } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Beyaz At/ }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    expect(screen.queryByRole('button', { name: /Beyaz At/ })).not.toBeInTheDocument();
    expect(onWrong).not.toHaveBeenCalled();
  });

  it('tüm taşlar doğru konunca onSolved çağrılır', () => {
    const { container, onSolved } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Beyaz At/ }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Beyaz Vezir/ }));
    fireEvent.click(container.querySelector('[data-square="h5"]')!);
    expect(onSolved).toHaveBeenCalledOnce();
  });

  it('yanlış kareye konursa TEK HAK — onWrong çağrılır', () => {
    const { container, onWrong, onSolved } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Beyaz Vezir/ }));
    fireEvent.click(container.querySelector('[data-square="a5"]')!);
    expect(onWrong).toHaveBeenCalledOnce();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('taş seçilmeden kareye tıklamak bir şey yapmaz', () => {
    const { container, onWrong } = setup();
    fireEvent.click(container.querySelector('[data-square="h5"]')!);
    expect(onWrong).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces-solver.test.tsx
```

Beklenen: FAIL — bileşen yok.

- [ ] **Step 3: `PlacePiecesSolver.tsx` oluştur**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { pieceKey, pieceLabel, pieceTypeToFen } from '@/lib/chess/pieceCodes';
import { fenToMap, mapToFen } from '@/components/BoardEditor';
import { evaluatePlacement, allPlaced } from '@/lib/play/placePieces';
import type { PiecePlacement } from '@/lib/play/placePieces';
import type { PlacePiecesEx } from './BoardExercise';

const { ranks: RANKS, files: FILE_LABELS } = coordLabels('white');

interface Props {
  exercise: PlacePiecesEx;
  /** Soru cevaplanmışsa tahta etkileşimsiz olur. */
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
}

/**
 * "Taş Nerde?" sorusunun sporcu tarafı.
 *
 * Kendi tahtasını HAM react-chessboard ile çizer — components/ChessBoard.tsx
 * sarmalayıcısının onPieceDrop imzası `(from, to) => boolean` olduğu için
 * tahta DIŞINDAN sürüklenen taşın "spare" olduğu bilgisini taşımıyor.
 */
export function PlacePiecesSolver({ exercise, disabled, onSolved, onWrong }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  /** Henüz yerleştirilmemiş taşlar — doğru konanlar buradan düşer. */
  const [pending, setPending] = useState<PiecePlacement[]>(exercise.pieces);
  /** Tıkla-tıkla için seçili kart. */
  const [selected, setSelected] = useState<string | null>(null);
  /** Tahtaya konmuş taşlarla güncellenen görüntü FEN'i. */
  const [fen, setFen] = useState(exercise.fen);
  const turn = exercise.fen.split(' ')[1] === 'b' ? 'b' : 'w';

  function place(piece: string, square: string) {
    if (disabled) return;
    const r = evaluatePlacement(pending, piece, square);
    if (!r.ok) {
      onWrong(exercise.fail_msg ?? 'Bu taşın yeri burası değil.');
      return;
    }
    const map = fenToMap(fen);
    map[square] = piece;
    setFen(mapToFen(map, turn));
    setPending(r.remaining);
    setSelected(null);
    if (allPlaced(r.remaining)) onSolved();
  }

  function handleDrop({ piece, targetSquare }: {
    piece: { isSparePiece: boolean; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    // Yalnızca DIŞARIDAN (dairesel karttan) gelen taş kabul edilir; tahtadaki
    // taşları oynatmak bu soru tipinde anlamlı değil.
    if (!targetSquare || !piece.isSparePiece) return false;
    place(pieceTypeToFen(piece.pieceType), targetSquare);
    return true;
  }

  return (
    <ChessboardProvider
      options={{
        id: 'place-pieces-solver',
        position: fen,
        allowDragging: !disabled,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onPieceDrop: handleDrop,
        onSquareClick: ({ square }: { square: string }) => {
          if (selected) place(selected, square);
        },
      }}
    >
      <div className="space-y-2">
        <p className="text-xs text-center" style={{ color: 'var(--t-muted)' }}>
          Taşı tahtaya <b>sürükle</b> veya taşa sonra kareye <b>tıkla</b>
        </p>

        {/* Eksik taşlar — dairesel kartlar */}
        <div className="flex flex-wrap justify-center gap-2">
          {pending.map((p, i) => {
            const isSel = selected === p.piece;
            return (
              <button
                key={`${p.piece}-${p.square}-${i}`}
                type="button"
                disabled={disabled}
                aria-label={pieceLabel(p.piece)}
                title={pieceLabel(p.piece)}
                onClick={() => setSelected((prev) => (prev === p.piece ? null : p.piece))}
                className={`w-12 h-12 rounded-full p-1 border-2 transition-all disabled:opacity-50 ${
                  isSel ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: boardColors.light,
                  borderColor: isSel ? 'var(--t-accent)' : 'var(--t-border)',
                }}
              >
                <SparePiece pieceType={pieceKey(p.piece)} />
              </button>
            );
          })}
        </div>

        {/* Tahta — kenar etiketleriyle (diğer soru tipleriyle aynı görünüm) */}
        <div className="w-full mx-auto p-3 rounded-2xl" style={{ maxWidth: 340, backgroundColor: BOARD_CARD_BG }}>
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center font-semibold select-none"
                  style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{r}</span>
              ))}
            </div>
            <div className="aspect-square flex-1" style={BOARD_STYLE}>
              <Chessboard />
            </div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {FILE_LABELS.map((f) => (
              <span key={f} className="flex-1 text-center font-semibold select-none"
                style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{f}</span>
            ))}
          </div>
        </div>
      </div>
    </ChessboardProvider>
  );
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

**NOT:** `fenToMap` (satır 37) ve `mapToFen` (satır 56) `BoardEditor.tsx`'te ZATEN dışa
aktarılmış — doğrulandı, ek bir değişiklik gerekmiyor.

```bash
cd apps/web && npx vitest run tests/place-pieces-solver.test.tsx
```

Beklenen: PASS (5 test). `PlacePiecesEx` tipi henüz `BoardExercise.tsx`'te tanımlı
olmadığı için tip hatası alırsan Task 6'nın Step 3'ünü ÖNCE uygula, sonra buraya dön.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/lesson-steps/PlacePiecesSolver.tsx apps/web/tests/place-pieces-solver.test.tsx
git commit -m "feat: PlacePiecesSolver sporcu bileseni"
```

---

### Task 6: `BoardExercise` tip birleşimi ve render dalı

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (tip tanımları ~satır 116-122, render dalı)
- Test: `apps/web/tests/board-exercise-place-pieces.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/board-exercise-place-pieces.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise, isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const ex: BoardExerciseConfig = {
  type: 'place_pieces',
  instruction: 'Eksik taşı yerleştir',
  fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  pieces: [{ piece: 'Q', square: 'h5' }],
  code: '011',
};

describe('BoardExercise — place_pieces', () => {
  it('tahta tipi sayılır', () => {
    expect(isBoardExercise(ex)).toBe(true);
  });

  it('dairesel taş kartı board alanında, talimat content alanında', () => {
    const { container } = render(
      <BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />,
    );
    const board = container.querySelector('.pg-board');
    const content = container.querySelector('.pg-content');
    expect(board?.querySelector('[aria-label="Beyaz Vezir"]')).toBeInTheDocument();
    expect(content?.textContent).toContain('Eksik taşı yerleştir');
  });

  it('KOD yazısı gösterilir', () => {
    const { container } = render(
      <BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />,
    );
    expect(container.querySelector('.pg-code')?.textContent).toContain('011');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-place-pieces.test.tsx
```

Beklenen: FAIL — `place_pieces` tipi tanımlı değil.

- [ ] **Step 3: Tip tanımını ekle**

`BoardExercise.tsx` içinde `IdentifyPieceEx` arayüzünden sonra (yaklaşık satır 78, tip
tanımları bölümünde) ekle:

```tsx
/** "Taş Nerde?" — eksik taşlar tahtanın dışında, sporcu doğru karelere yerleştirir. */
export interface PlacePiecesEx {
  type: 'place_pieces';
  instruction: string;
  /** Eksik taşların OLMADIĞI konum. */
  fen: string;
  /** En az bir eleman; `piece` FEN harfidir (bkz. lib/chess/pieceCodes.ts). */
  pieces: { piece: string; square: string }[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
}
```

Sonra tip birleşimini ve `isBoardExercise`'i güncelle (satır 116-122):

```tsx
export type BoardTypeConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx | PlacePiecesEx;
export type ChoiceTypeConfig = SentenceQuestionEx | ImageQuestionEx;
export type BoardExerciseConfig = BoardTypeConfig | ChoiceTypeConfig;

/** Tahta tabanlı bir soru mu (click_square/move_piece/identify_piece/place_pieces)? */
export function isBoardExercise(ex: BoardExerciseConfig): ex is BoardTypeConfig {
  return ex.type === 'click_square' || ex.type === 'move_piece'
    || ex.type === 'identify_piece' || ex.type === 'place_pieces';
}
```

- [ ] **Step 4: Render dalını ekle**

`BoardExercise.tsx` içinde `pg-board` alanındaki dallanmada, `move_piece` dalından SONRA
ve `isBoardExercise` dalından ÖNCE yeni dal ekle. Mevcut yapı:

```tsx
{exercise.type === 'move_piece' && 'moves' in exercise ? (
  <MovePieceSolver ... />
) : isBoardExercise(exercise) ? (
  <div data-testid="board-exercise-coord-frame" ...>
```

Şu hale getir:

```tsx
{exercise.type === 'move_piece' && 'moves' in exercise ? (
  <MovePieceSolver
    key={currentIdx}
    exercise={exercise}
    disabled={status !== 'idle'}
    onSolved={() => succeed()}
    onWrong={(msg) => failNoRetry(msg)}
  />
) : exercise.type === 'place_pieces' ? (
  /* key ZORUNLU: PlacePiecesSolver yerleştirilen taşları kendi state'inde
     tutuyor — key olmadan sonraki soruya önceki taşlar taşınır. */
  <PlacePiecesSolver
    key={currentIdx}
    exercise={exercise}
    disabled={status !== 'idle'}
    onSolved={() => succeed()}
    onWrong={(msg) => failNoRetry(msg)}
  />
) : isBoardExercise(exercise) ? (
```

Ve dosyanın import bloğuna ekle:

```tsx
import { PlacePiecesSolver } from './PlacePiecesSolver';
```

- [ ] **Step 5: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-place-pieces.test.tsx tests/place-pieces-solver.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 6: Mevcut BoardExercise testleri kırılmadı mı**

```bash
cd apps/web && npx vitest run tests/board-exercise-layout.test.tsx tests/board-exercise-render.test.tsx tests/board-exercise-click-square.test.tsx tests/is-board-exercise.test.ts tests/board-exercise-two-card-feedback.test.tsx tests/board-exercise-no-retry.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-place-pieces.test.tsx
git commit -m "feat: BoardExercise place_pieces tipini taniyor"
```

---

### Task 7: Panel bileşeni — `PlacePiecesFields`

**Files:**
- Create: `apps/web/components/admin/PlacePiecesFields.tsx`
- Test: `apps/web/tests/place-pieces-fields.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/place-pieces-fields.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacePiecesFields } from '@/components/admin/PlacePiecesFields';

function setup(over: Partial<Parameters<typeof PlacePiecesFields>[0]> = {}) {
  const props = {
    fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
    turn: 'w' as const,
    savedFen: null as string | null,
    selectedPiece: null as string | null,
    pieces: [] as { piece: string; square: string }[],
    onFenChange: vi.fn(),
    onTurnChange: vi.fn(),
    onSavePosition: vi.fn(),
    onSelectPiece: vi.fn(),
    onAddPair: vi.fn(),
    onRemovePair: vi.fn(),
    ...over,
  };
  return { ...render(<PlacePiecesFields {...props} />), props };
}

describe('PlacePiecesFields', () => {
  it('konum kaydedilmeden taş paleti gösterilmez', () => {
    setup();
    expect(screen.queryByLabelText('Eklenecek taş paleti')).not.toBeInTheDocument();
  });

  it('konum kaydedilince taş paleti çıkar', () => {
    setup({ savedFen: '7k/8/8/8/8/8/8/K7 w - - 0 1' });
    expect(screen.getByLabelText('Eklenecek taş paleti')).toBeInTheDocument();
  });

  it('paletten taş seçilince onSelectPiece çağrılır', () => {
    const { props } = setup({ savedFen: '7k/8/8/8/8/8/8/K7 w - - 0 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    expect(props.onSelectPiece).toHaveBeenCalledWith('Q');
  });

  it('eklenen çiftler listelenir ve silinebilir', () => {
    const { props } = setup({
      savedFen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
      pieces: [{ piece: 'Q', square: 'h5' }],
    });
    expect(screen.getByText(/Beyaz Vezir.*h5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sil/ }));
    expect(props.onRemovePair).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces-fields.test.tsx
```

Beklenen: FAIL — bileşen yok.

- [ ] **Step 3: `PlacePiecesFields.tsx` oluştur**

```tsx
'use client';
import { useMemo } from 'react';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import { BoardEditor } from '@/components/BoardEditor';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { PIECE_PALETTE, pieceKey, pieceLabel } from '@/lib/chess/pieceCodes';

const { ranks: RANKS, files: FILE_LABELS } = coordLabels('white');

interface Props {
  /** Dizme aşamasındaki FEN (kaydedilmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  /** "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  savedFen: string | null;
  /** Palette seçili, karesi henüz belirlenmemiş taş. */
  selectedPiece: string | null;
  pieces: { piece: string; square: string }[];
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  onSavePosition: () => void;
  onSelectPiece: (code: string | null) => void;
  onAddPair: (piece: string, square: string) => void;
  onRemovePair: (index: number) => void;
}

/**
 * "Taş Nerde?" sorusunun panel tarafı.
 *
 * İki faz: (1) konumu diz + kaydet — mevcut BoardEditor kullanılır;
 * (2) eksik taşları belirle — paletten taş seç, tahtada karesine tıkla.
 */
export function PlacePiecesFields({
  fen, turn, savedFen, selectedPiece, pieces,
  onFenChange, onTurnChange, onSavePosition, onSelectPiece, onAddPair, onRemovePair,
}: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  if (savedFen === null) {
    return (
      <div className="space-y-3">
        <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
        {/* Buton stili MovePieceFields.tsx:47 ile birebir aynı — panelde tek görünüm. */}
        <button type="button" onClick={onSavePosition}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs n-muted text-center">
        Paletten bir taş seç, sonra tahtada o taşın gitmesi gereken kareye tıkla
      </p>

      <div className="flex items-start gap-2" style={{ maxWidth: 440 }}>
        <div
          className="grid gap-1 shrink-0"
          style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column' }}
          aria-label="Eklenecek taş paleti"
        >
          {PIECE_PALETTE.map((p) => {
            const sel = selectedPiece === p.code;
            return (
              <button
                key={p.code}
                type="button"
                aria-label={p.label}
                title={p.label}
                onClick={() => onSelectPiece(sel ? null : p.code)}
                className={`w-9 h-9 rounded-md p-0.5 border ${
                  sel ? 'ring-2 ring-cyan-400 border-cyan-400' : 'border-black/10'
                }`}
                style={{ backgroundColor: boardColors.light }}
              >
                <SparePiece pieceType={pieceKey(p.code)} />
              </button>
            );
          })}
        </div>

        <ChessboardProvider
          options={{
            id: 'place-pieces-target',
            position: savedFen,
            allowDragging: false,
            pieces: pieceSet,
            lightSquareStyle: { backgroundColor: boardColors.light },
            darkSquareStyle: { backgroundColor: boardColors.dark },
            boardStyle: BOARD_STYLE,
            showNotation: false,
            onSquareClick: ({ square }: { square: string }) => {
              if (selectedPiece) onAddPair(selectedPiece, square);
            },
          }}
        >
          <div className="rounded-2xl p-3 flex-1 min-w-0" style={{ backgroundColor: BOARD_CARD_BG }}>
            <div className="flex">
              <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
                {RANKS.map((r) => (
                  <span key={r} className="flex items-center justify-center text-xs font-semibold select-none"
                    style={{ color: BOARD_LABEL_COLOR }}>{r}</span>
                ))}
              </div>
              <div className="aspect-square flex-1" style={BOARD_STYLE}>
                <Chessboard />
              </div>
            </div>
            <div className="flex" style={{ paddingLeft: 18 }}>
              {FILE_LABELS.map((f) => (
                <span key={f} className="flex-1 text-center text-xs font-semibold select-none"
                  style={{ color: BOARD_LABEL_COLOR }}>{f}</span>
              ))}
            </div>
          </div>
        </ChessboardProvider>
      </div>

      {pieces.length > 0 && (
        <ul className="space-y-1">
          {pieces.map((p, i) => (
            <li key={`${p.piece}-${p.square}-${i}`}
              className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-white/10">
              <span>{pieceLabel(p.piece)} → {p.square}</span>
              <button type="button" onClick={() => onRemovePair(i)}
                className="text-rose-300 hover:text-rose-200" aria-label={`Sil ${p.square}`}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/place-pieces-fields.test.tsx
```

Beklenen: PASS (4 test). `BoardEditor`'ün `onTurnChange` prop adı farklıysa
(`npx tsc --noEmit` söyler) gerçek imzaya uydur.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/PlacePiecesFields.tsx apps/web/tests/place-pieces-fields.test.tsx
git commit -m "feat: PlacePiecesFields panel bileseni"
```

---

### Task 8: `ExerciseForm` entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (tip, state, doğrulama, kaydetme, buton, adım listesi)
- Test: `apps/web/tests/exercise-form-place-pieces.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/exercise-form-place-pieces.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Taş Nerde? tipi', () => {
  it('üçüncü tip butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Taş nerde?' })).toBeInTheDocument();
  });

  it('tip seçilince 9 adımlık liste gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taş nerde?' }));
    const list = screen.getByLabelText('Taş Nerde? adımları');
    expect(list).toBeInTheDocument();
    expect(list.textContent).toContain('Konuma Eklenecek Taşları Belirle');
    expect(list.textContent).toContain('Taşların Doğru Karelerini Belirle');
    expect(list.textContent).toContain('Cevabı Kaydet');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/exercise-form-place-pieces.test.tsx
```

Beklenen: FAIL — buton yok.

- [ ] **Step 3: Tipi ve alanı genişlet**

`ExerciseForm.tsx` satır 13:

```tsx
export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece' | 'place_pieces';
```

`BoardExercise` arayüzüne (satır 50 civarı, `click_mode` alanından sonra) ekle:

```tsx
  /** Sadece place_pieces için — eksik taşlar ve doğru kareleri. */
  pieces?: { piece: string; square: string }[];
```

- [ ] **Step 4: State ve adım durumunu ekle**

`ExerciseForm` gövdesinde, mevcut `const [clickMode, ...]` state'lerinin yanına ekle:

```tsx
  // "Taş Nerde?" — konum kaydı savedFen ile paylaşılır; taş/kare çiftleri burada.
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [placePairs, setPlacePairs] = useState<{ piece: string; square: string }[]>([]);
  const [answerSaved, setAnswerSaved] = useState(false);
```

`clickSteps` tanımının yanına ekle:

```tsx
  const placeSteps = placePiecesSteps({
    instruction, setupFen: fen, savedFen, selectedPiece,
    pieces: placePairs, answerSaved, turnChosen, difficultyChosen,
  });
```

Ve import bloğuna:

```tsx
import { placePiecesSteps } from '@/lib/admin/placePiecesSteps';
import { PlacePiecesFields } from './PlacePiecesFields';
```

- [ ] **Step 5: `missing` ve `gateOpen` hesabını genişlet**

Mevcut (satır 255-262):

```tsx
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : firstIncompleteStep(stepState);
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : true;
```

Şununla değiştir:

```tsx
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : type === 'place_pieces'
      ? firstIncomplete(placeSteps)
      : firstIncompleteStep(stepState);
  /** Kilit üç Konum tipine de uygulanır. */
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : type === 'place_pieces'
        ? allDone(placeSteps)
        : true;
```

- [ ] **Step 6: Tip butonunu ve adım listesini ekle**

Tip butonları dizisini (satır 268-271) şu hale getir:

```tsx
        {([
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['place_pieces', 'Taş nerde?'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
```

Ve `StepList` satırlarının yanına ekle:

```tsx
      {type === 'place_pieces' && (
        <StepList steps={placeSteps} missingNo={missing?.no ?? null} ariaLabel="Taş Nerde? adımları" />
      )}
```

- [ ] **Step 7: Tahta gösterimini koşulla ve panel bileşenini bağla**

Mevcut satır 297-299 civarındaki koşul `move_piece` kendi tahtasını çizdiği için var.
`place_pieces` de kendi tahtasını çiziyor — koşula ekle:

```tsx
      {type !== 'move_piece' && type !== 'place_pieces' && (type !== 'click_square' || savedFen === null) && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen}
```

`MovePieceFields` render edilen yerin yanına ekle:

```tsx
      {type === 'place_pieces' && (
        <PlacePiecesFields
          fen={fen}
          turn={turn}
          savedFen={savedFen}
          selectedPiece={selectedPiece}
          pieces={placePairs}
          onFenChange={setFen}
          onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }}
          onSavePosition={() => setSavedFen(fen)}
          onSelectPiece={setSelectedPiece}
          onAddPair={(piece, square) => {
            setPlacePairs((prev) => [...prev.filter((p) => p.square !== square), { piece, square }]);
            setSelectedPiece(null);
            setAnswerSaved(false);
          }}
          onRemovePair={(i) => {
            setPlacePairs((prev) => prev.filter((_, idx) => idx !== i));
            setAnswerSaved(false);
          }}
        />
      )}
      {/* Stil MovePieceFields.tsx:85'teki "Notasyonu Kaydet" ile aynı. */}
      {type === 'place_pieces' && placePairs.length > 0 && !answerSaved && (
        <button type="button" onClick={() => setAnswerSaved(true)}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm transition-colors">
          Cevabı Kaydet
        </button>
      )}
```

**NOT:** `onAddPair` aynı kareye ikinci kez taş konmasını engeller (üzerine yazar) —
backend "aynı kare iki kez" hatası bu sayede kullanıcıya hiç ulaşmaz.

- [ ] **Step 8: Doğrulama ve kaydetmeyi genişlet**

`validate()` içine, `identify_piece` bloğundan sonra ekle:

```tsx
    if (type === 'place_pieces') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (placePairs.length === 0) return 'En az bir taş ve doğru karesi belirlenmeli';
      if (!answerSaved) return '"Cevabı Kaydet"e bas';
      const savedMap = fenToMap(savedFen);
      const dolu = placePairs.find((p) => savedMap[p.square]);
      if (dolu) return `${dolu.square} karesi dolu — eksik taşın karesi boş olmalı`;
    }
```

`submit()` içine, `identify_piece` bloğundan sonra ekle:

```tsx
    if (type === 'place_pieces') { base.fen = savedFen!; base.pieces = placePairs; }
```

Ve `submit()` içindeki sıfırlama bloğuna (`if (!editing) { ... }`) ekle:

```tsx
        setSelectedPiece(null); setPlacePairs([]); setAnswerSaved(false);
```

- [ ] **Step 9: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/exercise-form-place-pieces.test.tsx
```

Beklenen: PASS (2 test).

- [ ] **Step 10: Mevcut panel testleri kırılmadı mı**

```bash
cd apps/web && npx vitest run tests/exercise-form-family.test.tsx tests/exercise-form-move-piece.test.tsx tests/exercise-form-square-picker-size.test.tsx tests/click-mode-select.test.tsx tests/admin-lesson-modes-share-form.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-place-pieces.test.tsx
git commit -m "feat: ExerciseForm ucuncu tip Tas Nerde"
```

---

### Task 9: Tam test kapısı, canlı doğrulama, yayına alma

- [ ] **Step 1: Ön yüz tam kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run
```

Beklenen: `tsc` sessiz; `lint` yalnızca ÖNCEDEN var olan uyarılar; `vitest` hepsi PASS.

- [ ] **Step 2: Arka uç tam kapısı**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS.

- [ ] **Step 3: Geliştirme sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır.

- [ ] **Step 4: Sporcu tarafını gerçek tarayıcıda sür**

Backend çalışmıyorsa gerçek veri gelmez. Bu durumda geçici bir doğrulama sayfası
(`apps/web/app/yerlesim-kontrol/page.tsx` deseni — alt çizgiyle BAŞLAMAYAN klasör adı,
Next.js `_` ile başlayanları yok sayar) oluştur, `BoardExercise`'i `place_pieces` sahte
soruyla render et, sonra sayfayı SİL.

Doğrulanacaklar:
1. Dairesel kartlar tahtanın yanında görünüyor
2. Karta tıkla → kareye tıkla → taş kareye gidiyor
3. Yanlış kareye tıkla → soru bitiyor (tek hak)
4. İki taşlı soruda sıra serbest

- [ ] **Step 5: Bulunan sorun varsa düzelt ve Step 4'ü tekrarla**

- [ ] **Step 6: Geçici sayfayı sil ve tam kapıyı TEKRAR çalıştır**

```bash
cd apps/web && rm -rf app/yerlesim-kontrol && rm -rf .next/types/app/yerlesim-kontrol && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 7: Sonucu kullanıcıya sade Türkçe bildir**

Ne test edildi, ne doğrulandı, ne doğrulanamadı — açıkça (KURAL #1, KURAL #6).

- [ ] **Step 8: Yayına al**

Kullanıcı bu iş için "canlıya al" dedi. Her iki test kapısı ve tarayıcı doğrulaması
TEMİZ ise:

```bash
git push origin main
```

Kapı veya doğrulama başarısızsa gönderme — durumu bildir.
