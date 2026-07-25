# Taşı Oynat — Admin Tarafı (P4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelinde "Taşı Oynat" sorusunu, taşları yerleştir → **Konumu Kaydet** → taşları sürükleyerek hamle dizisi kaydet → hamleler otomatik **Notasyon Tablosuna** yazılsın akışına çevirmek.

**Architecture:** Saf satranç mantığı (`replayMoves`/`tryAppendMove`/`notationRows`) ayrı bir lib modülüne çıkarılır — böylece kırılgan sürükle-bırak simülasyonu olmadan güvenilir test edilebilir. UI iki ince bileşene ayrılır: `MovePieceFields` (setup/kayıt fazı kabuğu) ve `MoveRecorderBoard` (tahta + notasyon tablosu). Sporcu tarafına, P5 gelene kadar yeni formatı güvenle karşılayan bir placeholder eklenir.

**Tech Stack:** React/TypeScript, chess.js, react-chessboard, vitest + @testing-library/react, FastAPI + python-chess, pytest.

**Spec:** `docs/superpowers/specs/2026-07-24-tasi-oynat-admin-design.md`

---

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/chess/moveRecorder.ts` | **Yeni** — saf mantık: hamle tekrar oynatma, hamle ekleme/doğrulama, notasyon satırları |
| `apps/web/components/admin/MoveRecorderBoard.tsx` | **Yeni** — sürüklenebilir tahta + Notasyon Tablosu + Geri Al + sıra uyarısı |
| `apps/web/components/admin/MovePieceFields.tsx` | **Yeni** — setup ↔ recording faz kabuğu (Konumu Kaydet / Konumu Düzenle) |
| `apps/web/components/admin/ExerciseForm.tsx` | Değişiklik — `moves` alanı, çift-tahta düzeltmesi, validate/submit |
| `apps/web/components/lesson-steps/BoardExercise.tsx` | Değişiklik — yeni format için güvenlik placeholder'ı + styles guard |
| `apps/api/chess_api/routers/admin.py` | Değişiklik — `move_piece` doğrulaması SAN dizisi tabanlı |

---

## Ölçülmüş gerçekler (plan yazılmadan önce çalıştırılarak doğrulandı)

Bu plan aşağıdaki davranışları **varsaymıyor**, gerçek kütüphanelerle ölçtü:

1. **`chess.js` şahsız FEN'i reddediyor.** `new Chess('8/8/8/8/8/8/4P3/8 w - - 0 1')` →
   `Error: Invalid FEN: missing white king`. `{ skipValidation: true }` ile sorunsuz
   çalışıyor ve şahsız tahtada SAN üretiyor (`e4`). **Bu projenin öğretim pozisyonları
   kasten şahsızdır** — bu seçenek olmadan her şey çöker.
2. **Sıra kuralı çoklu hamleyi sınırlıyor.** `8/8/8/8/8/8/4P3/8 w` → `e4` sonrası sıra
   siyaha geçer, siyahın **0 legal hamlesi** olur. İki taraflı pozisyonda
   (`6k1/8/5K2/8/5R2/8/8/8 w`) `Rh4` → siyah 1 legal → `Kf8` → beyaz 19 legal (akıyor).
   Aynı davranış `python-chess`'te de doğrulandı (backend/frontend tutarlı).
3. **`chess.js .move()`** SAN string'ini doğrudan kabul ediyor (TS imzası:
   `move(move: string | {...})`), dönen nesne `.san` taşıyor, kural dışı hamlede
   **`Error` fırlatıyor** (null dönmüyor).
4. **Uygulamanın `ChessBoard` sarmalayıcısı bu iş için UYGUN DEĞİL.** Şahsız FEN'de
   çökmüyor (64 kare render oluyor) ama tıkla-oynat **sessizce çalışmıyor**:
   `onPieceDrop` 0 kez çağrıldı; şahlı FEN'de 1 kez çağrıldı. Bu yüzden
   `MoveRecorderBoard` ham `Chessboard`/`ChessboardProvider` kullanır (`BoardEditor` ile aynı desen).
5. **`BoardEditor`'da "Hamle sırası: Siyah" butonu var** — yani siyahın başladığı
   pozisyonlar mümkün. Notasyon tablosu bunu ele almalı (ilk satırın beyaz hücresi boş).

---

## Task 1: Sporcu tarafı güvenlik placeholder'ı (ÖNCE — canlı kullanıcı koruması)

Bu görev **ilk sırada** çünkü Task 2'den sonra backend yeni formatı kabul etmeye
başlayacak; sporcu tarafı ondan önce güvenli hale gelmeli (KURAL #3).

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor)**

`apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

// Yeni format (P4) — MovePieceEx tipi henüz `moves` tanımlamıyor (P5'te güncellenecek),
// bu yüzden test verisi kasten cast ediliyor. Çalışma zamanında backend böyle veri döndürebilir.
const newFormat = {
  type: 'move_piece',
  instruction: 'Taktik çizgiyi oyna',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'],
} as unknown as BoardExerciseConfig;

const oldFormat: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: "Piyonu e4'e taşı",
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2',
  target_squares: ['e4'],
};

describe('BoardExercise — yeni format move_piece güvenlik placeholder', () => {
  it('yeni format (moves alanlı) soru placeholder gösterir, tahta render ETMEZ', () => {
    const { container } = render(
      <BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />,
    );
    expect(screen.getByText(/yakında aktif olacak/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
  });

  it('yeni format soru render edilirken çökmez (styles guard)', () => {
    // styles hesaplama bloğu JSX'ten bağımsız, her render'da çalışır —
    // target_squares olmayan bir move_piece'te patlamamalı.
    expect(() =>
      render(<BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />),
    ).not.toThrow();
  });

  it('REGRESYON: eski format move_piece hâlâ tahtayı render eder', () => {
    const { container } = render(
      <BoardExercise exercises={[oldFormat]} done={false} onCorrect={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.queryByText(/yakında aktif olacak/i)).not.toBeInTheDocument();
    expect(screen.getByText("Piyonu e4'e taşı")).toBeInTheDocument();
  });

  it('REGRESYON: eski format move_piece hamlesi hâlâ çalışır', () => {
    const onCorrect = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[oldFormat]} done={false} onCorrect={onCorrect} />,
    );
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // taşı seç
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // hedefe taşı
    expect(container.textContent).toMatch(/Aferin/);
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-exercise-move-piece-placeholder.test.tsx`
Expected: İlk iki test FAIL (placeholder yok, tahta render ediliyor). Son iki regresyon testi PASS.

- [ ] **Step 3: `styles` bloğuna guard ekle**

`apps/web/components/lesson-steps/BoardExercise.tsx`'te:

```ts
    if (status === 'success' && exercise.type === 'move_piece') {
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
    }
```

satırlarını şununla değiştir:

```ts
    // 'moves' alanı varsa bu YENİ format (P4) bir soru — target_squares yok, okunursa çöker.
    if (status === 'success' && exercise.type === 'move_piece' && !('moves' in exercise)) {
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
    }
```

- [ ] **Step 4: JSX'e placeholder dalını ekle**

Mevcut:

```tsx
      {isBoardExercise(exercise) ? (
        <>
          {/* Board */}
```

satırını şununla değiştir (üç yollu dallanma — yeni format ÖNCE kontrol edilmeli,
aksi halde `isBoardExercise` true döner ve eski JSX'e düşüp çöker):

```tsx
      {exercise.type === 'move_piece' && 'moves' in exercise ? (
        <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          <span className="text-xl leading-none flex-shrink-0">🚧</span>
          <p className="text-sm font-semibold flex-1">Bu soru türü yakında aktif olacak.</p>
        </div>
      ) : isBoardExercise(exercise) ? (
        <>
          {/* Board */}
```

(Dosyanın devamı — `{/* Board */}`'dan `</>` kapanışına ve `) : (` `<ChoiceQuestionBody .../>` `)}` kısmına kadar — **değişmez**.)

- [ ] **Step 5: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-exercise-move-piece-placeholder.test.tsx`
Expected: 4 test PASS.

- [ ] **Step 6: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-move-piece-placeholder.test.tsx
git commit -m "feat: yeni format move_piece için sporcu tarafı güvenlik placeholder'ı"
```

---

## Task 2: Backend doğrulaması — SAN hamle dizisi

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Testleri ekle (FAIL bekleniyor)**

`apps/api/tests/test_board_exercises.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_move_piece_valid_move_sequence_accepted(client, db):
    """İki taraflı pozisyonda çoklu hamle dizisi kabul edilir."""
    les = await _lesson(db, order=110)
    tok = await _teacher_token(client, email="mp_ok@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "Taktigi oyna",
         "fen": "6k1/8/5K2/8/5R2/8/8/8 w - - 0 1", "moves": ["Rh4", "Kf8"]},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_move_piece_kingless_teaching_position_accepted(client, db):
    """EN KRİTİK: Zafer'in şahsız öğretim pozisyonları reddedilmemeli."""
    les = await _lesson(db, order=111)
    tok = await _teacher_token(client, email="mp_kingless@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "Piyonu ilerlet",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "moves": ["e4"]},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_move_piece_empty_moves_rejected(client, db):
    les = await _lesson(db, order=112)
    tok = await _teacher_token(client, email="mp_empty@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x",
         "fen": "6k1/8/5K2/8/5R2/8/8/8 w - - 0 1", "moves": []},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_illegal_san_rejected(client, db):
    les = await _lesson(db, order=113)
    tok = await _teacher_token(client, email="mp_illegal@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x",
         "fen": "6k1/8/5K2/8/5R2/8/8/8 w - - 0 1", "moves": ["Qh8"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_garbage_san_rejected(client, db):
    les = await _lesson(db, order=114)
    tok = await _teacher_token(client, email="mp_garbage@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x",
         "fen": "6k1/8/5K2/8/5R2/8/8/8 w - - 0 1", "moves": ["zz9"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_out_of_turn_move_rejected(client, db):
    """Tek renkli pozisyonda ikinci bir beyaz hamle sıraya aykırı — reddedilmeli."""
    les = await _lesson(db, order=115)
    tok = await _teacher_token(client, email="mp_turn@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "moves": ["e4", "e5"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_non_string_move_rejected(client, db):
    les = await _lesson(db, order=116)
    tok = await _teacher_token(client, email="mp_nonstr@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x",
         "fen": "6k1/8/5K2/8/5R2/8/8/8 w - - 0 1", "moves": [42]},
    ])
    assert r.status_code == 400
```

- [ ] **Step 2: Testleri çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v -k move_piece`
Expected: Yeni testlerin çoğu FAIL (mevcut doğrulama `piece_square` bekliyor, `moves` bilmiyor). Mevcut `test_move_piece_validations` ve `test_promotion_move_rejected` testleri de eski formatı test ettiği için bu aşamada hâlâ PASS.

- [ ] **Step 3: `move_piece` doğrulama dalını değiştir**

`apps/api/chess_api/routers/admin.py`'de mevcut:

```python
        elif ex_type == "move_piece":
            piece_sq = ex.get("piece_square")
            if piece_sq not in chess.SQUARE_NAMES:
                raise HTTPException(status_code=400, detail=f"Geçersiz taş karesi: {piece_sq}")
            if board.piece_at(chess.parse_square(piece_sq)) is None:
                raise HTTPException(status_code=400, detail=f"{piece_sq} karesinde taş yok")
            for target in _squares("target_squares"):
                move = chess.Move.from_uci(piece_sq + target)
                if move not in board.legal_moves:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{piece_sq}{target} bu pozisyonda kurallara uygun değil "
                               f"(terfi içeren hamleler desteklenmiyor)",
                    )
```

bloğunu şununla değiştir:

```python
        elif ex_type == "move_piece":
            # Yeni format: SAN hamle dizisi. Başlangıç pozisyonundan itibaren
            # her hamle sırayla oynatılır; kural dışı/sıraya aykırı olan reddedilir.
            # NOT: kurulu python-chess (1.2.0) InvalidMoveError/IllegalMoveError
            # alt sınıflarını İÇERMİYOR — hem bozuk hem kural dışı SAN için düz
            # ValueError fırlatıyor (gerçek ortamda doğrulandı).
            moves = ex.get("moves")
            if not isinstance(moves, list) or len(moves) < 1:
                raise HTTPException(status_code=400, detail="En az bir hamle kaydedilmeli")
            replay_board = chess.Board(fen)
            for i, san in enumerate(moves):
                if not isinstance(san, str):
                    raise HTTPException(status_code=400, detail=f"{i + 1}. hamle geçersiz")
                try:
                    parsed = replay_board.parse_san(san)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{i + 1}. hamle kurallara uygun değil: {san}",
                    )
                replay_board.push(parsed)
```

- [ ] **Step 4: Eski format testlerini yeni formata güncelle**

Aynı dosyadaki iki mevcut test artık eski formatı test ettiği için başarısız
olacak (yeni doğrulama `moves` istiyor). Bunlar **yeni davranışı** yansıtacak
şekilde güncellenir.

`test_kingless_teaching_positions_accepted` içindeki `move_piece` satırını:

```python
        {"type": "move_piece", "instruction": "Piyonu e4'e tasi",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "piece_square": "e2", "target_squares": ["e4"]},
```

şununla değiştir:

```python
        {"type": "move_piece", "instruction": "Piyonu e4'e tasi",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "moves": ["e4"]},
```

`test_move_piece_validations` testinin tamamını şununla değiştir:

```python
@pytest.mark.asyncio
async def test_move_piece_validations(client, db):
    """Eski format (piece_square/target_squares) artık kabul edilmiyor — moves gerekli."""
    les = await _lesson(db, order=45)
    tok = await _teacher_token(client, email="be6@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1",
         "piece_square": "e2", "target_squares": ["e4"]},
    ])
    assert r.status_code == 400
```

`test_promotion_move_rejected` testinin tamamını şununla değiştir:

```python
@pytest.mark.asyncio
async def test_promotion_move_accepted_as_san(client, db):
    """Terfi artık SAN ile ifade edilebiliyor (e8=Q) — eski from/to modelinde imkansızdı."""
    les = await _lesson(db, order=46)
    tok = await _teacher_token(client, email="be7@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "k7/4P3/8/8/8/8/8/4K3 w - - 0 1",
         "moves": ["e8=Q"]},
    ])
    assert r.status_code == 201
```

- [ ] **Step 5: Backend testlerini çalıştır**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v`
Expected: Tüm testler PASS (mevcut + 7 yeni + 2 güncellenmiş).

- [ ] **Step 6: Tüm backend paketini çalıştır**

Run: `cd apps/api && python -m pytest -q`
Expected: Tüm testler PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat: move_piece doğrulaması SAN hamle dizisi tabanlı (moves)"
```

---

## Task 3: `moveRecorder.ts` — saf satranç mantığı

Sürükle-bırak simülasyonu happy-dom'da kırılgan olduğundan, tüm mantık saf
fonksiyonlara çıkarılır ve **burada** kapsamlı test edilir. Bileşenler ince kalır.

**Files:**
- Create: `apps/web/lib/chess/moveRecorder.ts`
- Test: `apps/web/tests/move-recorder.test.ts` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — modül yok)**

`apps/web/tests/move-recorder.test.ts` oluştur:

```ts
import { describe, it, expect } from 'vitest';
import { recorderState, tryAppendMove, notationRows } from '@/lib/chess/moveRecorder';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';   // Zafer'in öğretim pozisyonu
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1'; // gerçek prod pozisyonu
const BLACK_STARTS = '6k1/8/5K2/8/5R2/8/8/8 b - - 0 1';

describe('tryAppendMove', () => {
  it('ŞAHSIZ pozisyonda geçerli hamleyi SAN olarak ekler (skipValidation gerekli)', () => {
    expect(tryAppendMove(KINGLESS, [], 'e2', 'e4')).toEqual(['e4']);
  });

  it('kural dışı hamlede null döner', () => {
    expect(tryAppendMove(KINGLESS, [], 'e2', 'e8')).toBeNull();
  });

  it('iki taraflı pozisyonda art arda iki hamle eklenir', () => {
    const after1 = tryAppendMove(TWO_SIDED, [], 'f4', 'h4');
    expect(after1).toEqual(['Rh4']);
    expect(tryAppendMove(TWO_SIDED, after1!, 'g8', 'f8')).toEqual(['Rh4', 'Kf8']);
  });

  it('SIRA KİLİDİ: tek renkli pozisyonda ikinci hamle eklenemez', () => {
    expect(tryAppendMove(KINGLESS, ['e4'], 'e4', 'e5')).toBeNull();
  });
});

describe('recorderState', () => {
  it('şahsız pozisyonda ilk hamleden sonra sıkışır (karşı tarafın hamlesi yok)', () => {
    const s = recorderState(KINGLESS, ['e4']);
    expect(s.turn).toBe('b');
    expect(s.stuck).toBe(true);
  });

  it('iki taraflı pozisyonda sıkışmaz', () => {
    const s = recorderState(TWO_SIDED, ['Rh4']);
    expect(s.turn).toBe('b');
    expect(s.stuck).toBe(false);
  });

  it('hamlelerden sonraki güncel FEN döner', () => {
    expect(recorderState(KINGLESS, ['e4']).fen).toContain('4P3');
  });
});

describe('notationRows', () => {
  it('hamle yoksa boş dizi', () => {
    expect(notationRows(TWO_SIDED, [])).toEqual([]);
  });

  it('2 hamle → 1 satır (beyaz + siyah)', () => {
    expect(notationRows(TWO_SIDED, ['Rh4', 'Kf8'])).toEqual([
      { no: 1, white: 'Rh4', black: 'Kf8' },
    ]);
  });

  it('3 hamle → 2 satır, ikinci satırın siyahı boş', () => {
    expect(notationRows(TWO_SIDED, ['Rh4', 'Kf8', 'Rh7'])).toEqual([
      { no: 1, white: 'Rh4', black: 'Kf8' },
      { no: 2, white: 'Rh7', black: '' },
    ]);
  });

  it('SİYAH BAŞLARSA ilk satırın beyaz hücresi boş kalır', () => {
    expect(notationRows(BLACK_STARTS, ['Kf8'])).toEqual([
      { no: 1, white: '', black: 'Kf8' },
    ]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/move-recorder.test.ts`
Expected: FAIL — `@/lib/chess/moveRecorder` modülü bulunamadı.

- [ ] **Step 3: Modülü oluştur**

`apps/web/lib/chess/moveRecorder.ts`:

```ts
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

/**
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU.
 *
 * Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır (boş tahta + tek piyon).
 * Bu seçenek olmadan chess.js `Invalid FEN: missing white king` hatasıyla ÇÖKER.
 * (Gerçek ortamda ölçüldü.)
 */
function newRecorderChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

/** Başlangıç pozisyonundan itibaren SAN hamlelerini oynatır. */
function replayMoves(fen: string, moves: string[]): Chess {
  const board = newRecorderChess(fen);
  for (const san of moves) {
    try {
      board.move(san);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
  }
  return board;
}

export interface RecorderState {
  /** Kaydedilen hamlelerden sonraki güncel pozisyon. */
  fen: string;
  /** Sırası gelen taraf. */
  turn: 'w' | 'b';
  /** Sıradaki tarafın hiç legal hamlesi yok mu? (tek renkli pozisyonlarda olur) */
  stuck: boolean;
}

export function recorderState(fen: string, moves: string[]): RecorderState {
  const board = replayMoves(fen, moves);
  return {
    fen: board.fen(),
    turn: board.turn(),
    stuck: board.moves().length === 0,
  };
}

/**
 * Sürüklenen hamleyi doğrular ve kabul edilirse yeni SAN dizisini döndürür.
 * Kural dışı / sıraya aykırı hamlede `null` döner (tahta taşı geri alır).
 */
export function tryAppendMove(
  fen: string,
  moves: string[],
  from: string,
  to: string,
): string[] | null {
  const board = replayMoves(fen, moves);
  try {
    // Terfi her zaman vezir — BotGame/LiveGame ile tutarlı proje geneli kısıtlama.
    const move = board.move({ from: from as Square, to: to as Square, promotion: 'q' });
    return [...moves, move.san];
  } catch {
    return null;
  }
}

export interface NotationRow {
  no: number;
  white: string;
  black: string;
}

/**
 * Hamleleri 3 sütunlu Notasyon Tablosu satırlarına böler.
 * Siyahın başladığı pozisyonlarda ilk satırın beyaz hücresi boş bırakılır.
 */
export function notationRows(fen: string, moves: string[]): NotationRow[] {
  const startsWithBlack = newRecorderChess(fen).turn() === 'b';
  const cells: string[] = startsWithBlack ? ['', ...moves] : [...moves];
  const rows: NotationRow[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: cells[i] ?? '', black: cells[i + 1] ?? '' });
  }
  return rows;
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/move-recorder.test.ts`
Expected: 11 test PASS.

- [ ] **Step 5: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/chess/moveRecorder.ts apps/web/tests/move-recorder.test.ts
git commit -m "feat: moveRecorder.ts — hamle kaydı saf mantığı (şahsız pozisyon destekli)"
```

---

## Task 4: `MoveRecorderBoard` bileşeni

**Files:**
- Create: `apps/web/components/admin/MoveRecorderBoard.tsx`
- Test: `apps/web/tests/move-recorder-board.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor)**

`apps/web/tests/move-recorder-board.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveRecorderBoard } from '@/components/admin/MoveRecorderBoard';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

describe('MoveRecorderBoard', () => {
  it('ŞAHSIZ pozisyonda çökmeden 64 kare render eder', () => {
    const { container } = render(
      <MoveRecorderBoard fen={KINGLESS} moves={[]} onMovesChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('hamle yokken bilgilendirme metni gösterir', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={[]} onMovesChange={vi.fn()} />);
    expect(screen.getByText(/Henüz hamle yok/i)).toBeInTheDocument();
  });

  it('kaydedilen hamleleri Notasyon Tablosunda gösterir', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onMovesChange={vi.fn()} />);
    expect(screen.getByText('Rh4')).toBeInTheDocument();
    expect(screen.getByText('Kf8')).toBeInTheDocument();
  });

  it('"Son Hamleyi Geri Al" son hamleyi çıkarır', () => {
    const onMovesChange = vi.fn();
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onMovesChange={onMovesChange} />);
    fireEvent.click(screen.getByText('Son Hamleyi Geri Al'));
    expect(onMovesChange).toHaveBeenCalledWith(['Rh4']);
  });

  it('hamle yokken "Son Hamleyi Geri Al" devre dışı', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={[]} onMovesChange={vi.fn()} />);
    expect(screen.getByText('Son Hamleyi Geri Al')).toBeDisabled();
  });

  it('SIRA KİLİDİ: tek renkli pozisyonda hamle sonrası uyarı gösterir', () => {
    render(<MoveRecorderBoard fen={KINGLESS} moves={['e4']} onMovesChange={vi.fn()} />);
    expect(screen.getByText(/oynayabileceği taş yok/i)).toBeInTheDocument();
  });

  it('iki taraflı pozisyonda sıra uyarısı GÖSTERMEZ', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4']} onMovesChange={vi.fn()} />);
    expect(screen.queryByText(/oynayabileceği taş yok/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/move-recorder-board.test.tsx`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Bileşeni oluştur**

`apps/web/components/admin/MoveRecorderBoard.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { Chessboard, ChessboardProvider } from 'react-chessboard';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { recorderState, tryAppendMove, notationRows } from '@/lib/chess/moveRecorder';

const { ranks: REC_RANKS, files: REC_FILES } = coordLabels('white');

interface Props {
  /** Konumu Kaydet anındaki başlangıç pozisyonu. */
  fen: string;
  /** Şu ana kadar kaydedilen SAN hamleleri. */
  moves: string[];
  onMovesChange: (moves: string[]) => void;
}

/**
 * NOT: Uygulamanın `ChessBoard` sarmalayıcısı burada KULLANILMAZ — şahsız
 * pozisyonlarda tıkla-oynat sessizce çalışmıyor (ölçüldü: onPieceDrop 0 kez
 * çağrıldı). Bu yüzden `BoardEditor` ile aynı desen: ham ChessboardProvider.
 */
export function MoveRecorderBoard({ fen, moves, onMovesChange }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  const state = useMemo(() => recorderState(fen, moves), [fen, moves]);
  const rows = useMemo(() => notationRows(fen, moves), [fen, moves]);
  const sideLabel = state.turn === 'w' ? 'beyazda' : 'siyahta';

  function handleDrop({ sourceSquare, targetSquare }: {
    piece: { isSparePiece: boolean; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;
    const next = tryAppendMove(fen, moves, sourceSquare, targetSquare);
    if (!next) return false;
    onMovesChange(next);
    return true;
  }

  return (
    <ChessboardProvider
      options={{
        id: 'move-recorder',
        position: state.fen,
        allowDragging: true,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onPieceDrop: handleDrop,
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        {/* Tahta */}
        <div className="rounded-2xl p-3" style={{ backgroundColor: BOARD_CARD_BG, width: 300 }}>
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {REC_RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center text-xs font-semibold select-none"
                  style={{ color: BOARD_LABEL_COLOR }}>{r}</span>
              ))}
            </div>
            <div className="flex-1"><Chessboard /></div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {REC_FILES.map((f) => (
              <span key={f} className="flex-1 text-center text-xs font-semibold select-none"
                style={{ color: BOARD_LABEL_COLOR }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Notasyon Tablosu */}
        <div className="flex-1 space-y-2" style={{ minWidth: 190 }}>
          <p className="text-xs n-muted">Notasyon Tablosu</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="n-muted">
                <th className="text-left py-1" style={{ width: 32 }}>#</th>
                <th className="text-left py-1">Beyaz</th>
                <th className="text-left py-1">Siyah</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 n-muted">
                    Henüz hamle yok — tahtada taşı sürükleyin.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.no} className="border-t border-white/10">
                    <td className="py-1 n-muted">{row.no}.</td>
                    <td className="py-1 font-mono n-text">{row.white}</td>
                    <td className="py-1 font-mono n-text">{row.black}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <button type="button" disabled={moves.length === 0}
            onClick={() => onMovesChange(moves.slice(0, -1))}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 disabled:opacity-40">
            Son Hamleyi Geri Al
          </button>

          {state.stuck && (
            <p className="text-xs text-amber-300">
              Sıra {sideLabel} ama oynayabileceği taş yok. Daha fazla hamle eklemek için
              “Konumu Düzenle” ile karşı tarafa da taş yerleştirin.
            </p>
          )}
        </div>
      </div>
    </ChessboardProvider>
  );
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/move-recorder-board.test.tsx`
Expected: 7 test PASS.

- [ ] **Step 5: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/MoveRecorderBoard.tsx apps/web/tests/move-recorder-board.test.tsx
git commit -m "feat: MoveRecorderBoard — sürüklenebilir tahta + Notasyon Tablosu + Geri Al"
```

---

## Task 5: `MovePieceFields` — faz kabuğu

**Files:**
- Create: `apps/web/components/admin/MovePieceFields.tsx`
- Test: `apps/web/tests/move-piece-fields.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor)**

`apps/web/tests/move-piece-fields.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovePieceFields } from '@/components/admin/MovePieceFields';

const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

describe('MovePieceFields', () => {
  it('fen null iken setup fazı: taş paleti ve "Konumu Kaydet" görünür', () => {
    render(<MovePieceFields fen={null} moves={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.getByLabelText('Beyaz Vezir')).toBeInTheDocument(); // BoardEditor paleti
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
  });

  it('"Konumu Kaydet" tıklanınca güncel FEN ile onChange çağrılır', () => {
    const onChange = vi.fn();
    render(<MovePieceFields fen={null} moves={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [calledFen, calledMoves] = onChange.mock.calls[0];
    expect(typeof calledFen).toBe('string');
    expect(calledMoves).toEqual([]);
  });

  it('fen doluyken recording fazı: Notasyon Tablosu ve "Konumu Düzenle" görünür', () => {
    render(<MovePieceFields fen={TWO_SIDED} moves={['Rh4']} onChange={vi.fn()} />);
    expect(screen.getByText('Notasyon Tablosu')).toBeInTheDocument();
    expect(screen.getByText('Konumu Düzenle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('"Konumu Düzenle" setup fazına döner ve hamleleri sıfırlar', () => {
    const onChange = vi.fn();
    render(<MovePieceFields fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Konumu Düzenle'));
    expect(onChange).toHaveBeenCalledWith(null, []);
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Bileşeni oluştur**

`apps/web/components/admin/MovePieceFields.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';

interface Props {
  /** null = henüz "Konumu Kaydet"e basılmadı (setup fazı). */
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
 */
export function MovePieceFields({ fen, moves, onChange }: Props) {
  const [setupFen, setSetupFen] = useState(fen ?? EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>(
    ((fen ?? EMPTY_FEN).split(' ')[1] as 'w' | 'b') ?? 'w',
  );

  if (fen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted">
          1. Taşları tahtaya yerleştir, sonra <b>Konumu Kaydet</b>'e bas.
        </p>
        <BoardEditor fen={setupFen} turn={turn} onChange={setSetupFen} onTurnChange={setTurn} />
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
          2. Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
        </p>
        <button type="button" onClick={() => { setSetupFen(fen); onChange(null, []); }}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Konumu Düzenle
        </button>
      </div>
      <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={(m) => onChange(fen, m)} />
    </div>
  );
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/move-piece-fields.test.tsx`
Expected: 4 test PASS.

- [ ] **Step 5: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/MovePieceFields.tsx apps/web/tests/move-piece-fields.test.tsx
git commit -m "feat: MovePieceFields — Konumu Kaydet / Konumu Düzenle faz kabuğu"
```

---

## Task 6: `ExerciseForm` entegrasyonu (çift tahta düzeltmesi dahil)

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/exercise-form-move-piece.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor)**

`apps/web/tests/exercise-form-move-piece.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('hamle kaydedilmeden gönderilirse hata gösterir', () => {
    const onSubmit = vi.fn();
    render(<ExerciseForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı oynat'));
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Taktigi oyna' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    // NOT: /Konumu Kaydet/ ile aramak butona DA eşleşir ve getByText çoklu eşleşmede
    // hata verir — bu yüzden hata mesajının ayırt edici kısmı aranıyor.
    expect(screen.getByText(/Önce taşları yerleştirip/)).toBeInTheDocument();
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
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx`
Expected: İlk üç test FAIL (çift tahta 128 kare, "Konumu Kaydet" yok). Son iki regresyon testi PASS.

- [ ] **Step 3: `BoardExercise` tipine `moves` ekle ve `MovePieceFields`'i import et**

`apps/web/components/admin/ExerciseForm.tsx`'te import satırlarına ekle:

```ts
import { MovePieceFields } from './MovePieceFields';
```

`BoardExercise` arayüzünde `answer_kind` satırının ALTINA ekle:

```ts
  /** Sadece move_piece için — SAN hamle dizisi (Konumu Kaydet sonrası kaydedilir). */
  moves?: string[];
```

(`piece_square`/`target_squares` alanları **SİLİNMEZ** — `click_square` hâlâ
`target_squares` kullanıyor.)

- [ ] **Step 4: `BoardExerciseFields` state'ini güncelle**

`const [pieceSquare, setPieceSquare] = useState(initial?.piece_square ?? '');`
satırını **sil** (artık hiçbir yerde okunmuyor), yerine `const [difficulty, ...]`
satırının ALTINA ekle:

```ts
  const [moveFen, setMoveFen] = useState<string | null>(
    initial?.moves?.length ? (initial.fen ?? null) : null,
  );
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
```

- [ ] **Step 5: `validate()` içindeki `move_piece` dalını değiştir**

Mevcut:

```ts
    if (type === 'move_piece') {
      if (!pieceSquare) return 'Hangi taşın oynayacağını seç';
      if (!map[pieceSquare]) return 'Seçilen karede taş yok';
      if (targets.length === 0) return 'En az bir hedef kare seç';
    }
```

şununla değiştir:

```ts
    if (type === 'move_piece') {
      if (!moveFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (moves.length === 0) return 'En az bir hamle kaydedilmeli';
    }
```

- [ ] **Step 6: `submit()` içindeki `move_piece` dalını ve reset'i değiştir**

Mevcut:

```ts
    if (type === 'move_piece') { base.piece_square = pieceSquare; base.target_squares = targets; }
```

şununla değiştir:

```ts
    if (type === 'move_piece') { base.fen = moveFen!; base.moves = moves; }
```

Ayrıca reset bloğunda:

```ts
        setInstruction(''); setTargets([]); setPieceSquare(''); setHighlight('');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
```

şununla değiştir (`setPieceSquare` kaldırıldı, `moveFen`/`moves` sıfırlaması eklendi):

```ts
        setInstruction(''); setTargets([]); setHighlight('');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
        setMoveFen(null); setMoves([]);
```

- [ ] **Step 7: JSX — çift tahta düzeltmesi + move_piece bloğunu değiştir**

Mevcut:

```tsx
      <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
```

şununla değiştir (Taşı oynat kendi tahtasını `MovePieceFields` içinde render ediyor —
bu satır koşullanmazsa ekranda İKİ tahta olur):

```tsx
      {type !== 'move_piece' && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
      )}
```

Sonra mevcut `move_piece` bloğunun tamamını:

```tsx
      {type === 'move_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Oynayacak taşın karesi</p>
            <select value={pieceSquare} onChange={(e) => setPieceSquare(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[10rem]">
              <option value="">seç</option>
              {squares.map((s) => <option key={s} value={s}>{s} ({fenToMap(fen)[s]})</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs n-muted mb-1">Hedef kare(ler)</p>
            <SquarePicker values={targets} onToggle={toggleTarget} />
          </div>
        </div>
      )}
```

şununla değiştir:

```tsx
      {type === 'move_piece' && (
        <MovePieceFields
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
        />
      )}
```

- [ ] **Step 8: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/exercise-form-move-piece.test.tsx`
Expected: 5 test PASS.

- [ ] **Step 9: Tip + lint kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok. (`pieceSquare` state'i silindiği için kullanılmayan
değişken uyarısı da çıkmamalı.)

- [ ] **Step 10: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-move-piece.test.tsx
git commit -m "feat: ExerciseForm'a MovePieceFields entegrasyonu + çift tahta düzeltmesi"
```

---

## Task 7: Tam test kapısı

**Files:** Yok (sadece doğrulama)

- [ ] **Step 1: Backend tüm testler**

Run: `cd apps/api && python -m pytest -q`
Expected: Tüm testler PASS.

- [ ] **Step 2: Frontend tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Frontend lint**

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok.

- [ ] **Step 4: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS (P1-P3'ten kalan 98 test + bu işin ~31 yeni testi).

- [ ] **Step 5: Production build**

Run: `cd apps/web && npm run build`
Expected: `Compiled successfully`, hata yok.

- [ ] **Step 6: Herhangi bir adım başarısız olursa**

İlgili göreve dön, düzelt, o görevin testlerini tekrar çalıştır, sonra bu görevi baştan çalıştır.

---

## Task 8: Canlı doğrulama (KURAL #6)

**Files:** Yok (tarayıcı + prod API doğrulaması)

- [ ] **Step 1: Yerel dev sunucuyu prod API'ye karşı başlat**

`apps/web/.env.local` oluştur:
```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```
Dev sunucuyu `mcp__Claude_Browser__preview_start` (`chess-web`) ile başlat.

- [ ] **Step 2: Geçici test verisi oluştur**

```bash
API=https://chess-app-production-1dab.up.railway.app
EMAIL="verifyp4_$(date +%s)@gmail.com"
SIGNUP=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Verify P4\"}")
TOKEN=$(python -c "import json,sys;print(json.loads(sys.argv[1])['access_token'])" "$SIGNUP")
MOD=$(curl -s -X POST "$API/admin/modules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"TEST_P4_DUZEY","description":"gecici","icon":"🧪"}')
MODID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$MOD")
LES=$(curl -s -X POST "$API/admin/modules/$MODID/lessons" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"TEST_P4_DERS","estimated_minutes":5}')
LESID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$LES")
STEP=$(curl -s -X POST "$API/admin/lessons/$LESID/steps" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"explanation","content_json":{"title":"Test Alt Konu","body":"test"}}')
STEPID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$STEP")
echo "TOKEN=$TOKEN MODID=$MODID LESID=$LESID STEPID=$STEPID"
```

- [ ] **Step 3: Admin panelinde iki taraflı bir Taşı Oynat sorusu oluştur**

`localStorage.setItem('chess_app_token', TOKEN)` ile giriş yap,
`/admin/content/lesson/{LESID}` sayfasına git. Sorular → Süresiz Pratik Yap →
Konum ekle → Taşı oynat. **Tek tahta** göründüğünü doğrula (çift tahta yok).
Beyaz Kale + Beyaz Şah + Siyah Şah yerleştir, **Konumu Kaydet**'e bas.
Kaleyi sürükle → Notasyon Tablosunda `1.` satırının Beyaz sütununda hamlenin
belirdiğini doğrula. Siyah şahı sürükle → aynı satırın Siyah sütununa yazıldığını
doğrula.

- [ ] **Step 4: Geri Al ve Konumu Düzenle'yi doğrula**

**Son Hamleyi Geri Al**'a bas → son hamlenin tablodan silindiğini ve tahtanın bir
önceki pozisyona döndüğünü doğrula. **Konumu Düzenle**'ye bas → taş yerleştirme
ekranına dönüldüğünü doğrula.

- [ ] **Step 5: Şahsız öğretim pozisyonunu doğrula (EN KRİTİK)**

Tahtayı temizle, sadece bir beyaz piyon koy (e2), Konumu Kaydet.
**Ekranın çökmediğini** ve piyonu e4'e sürükleyince `e4` hamlesinin tabloya
yazıldığını doğrula. Ardından **sıra uyarısının** ("oynayabileceği taş yok")
göründüğünü doğrula.

- [ ] **Step 6: Soruyu kaydet ve backend'in kabul ettiğini doğrula**

Talimat yaz, "Soruyu ekle"ye bas. Kaydın başarılı olduğunu (hata mesajı yok,
soru kodu rozeti belirdi) doğrula.

- [ ] **Step 7: Sporcu tarafında placeholder'ı doğrula**

`/pratik/suresiz?step={STEPID}&ders={LESID}&konu=Test` adresine git.
Yeni formatlı sorunun **"Bu soru türü yakında aktif olacak"** mesajını
gösterdiğini ve tahta render EDİLMEDİĞİNİ doğrula (çökme yok).

- [ ] **Step 8: Test verisini temizle**

```bash
curl -s -X DELETE "$API/admin/lessons/$LESID" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$API/admin/modules/$MODID" -H "Authorization: Bearer $TOKEN"
curl -s "$API/modules" | grep -c TEST_P4_DUZEY || echo "temizlendi"
```

- [ ] **Step 9: Yerel ortamı temizle**

`apps/web/.env.local` dosyasını sil, dev sunucuyu durdur.

- [ ] **Step 10: Sonucu kullanıcıya raporla**

Ne test edildi, ne doğrulandı, neyi doğrulayamadın — açıkça yaz (KURAL #6).

---

## Self-Review Notu (plan yazarı için)

- **Spec kapsaması:** Veri modeli (Task 6 Step 3), admin akışı (Task 4-5),
  backend doğrulama (Task 2), sporcu placeholder + styles guard (Task 1),
  çift tahta düzeltmesi (Task 6 Step 7), validate/submit (Task 6 Step 5-6),
  sıra kısıtı uyarısı (Task 4 Step 3), notasyon tablosu siyah-başlangıç
  (Task 3) — spec'in tüm bölümleri bir göreve karşılık geliyor.
- **Ölçülmüş varsayımlar:** 5 teknik gerçek (skipValidation zorunluluğu, sıra
  kilidi, chess.js API davranışı, ChessBoard'un uygunsuzluğu, siyah-başlangıç
  imkanı) plan yazılmadan ÖNCE gerçek kütüphanelerle çalıştırılarak doğrulandı.
- **Tip tutarlılığı:** `recorderState`/`tryAppendMove`/`notationRows`/
  `NotationRow`/`RecorderState` isimleri Task 3'te tanımlanıp Task 4'te aynen
  kullanılıyor. `MovePieceFields` prop'ları (`fen`/`moves`/`onChange`) Task 5'te
  tanımlanıp Task 6'da aynen kullanılıyor.
- **Sıra bağımlılığı:** Task 1 (sporcu güvenliği) kasten EN BAŞTA — Task 2
  backend'i yeni formatı kabul eder hale getirdiğinde canlı sporcular zaten
  korunmuş olur (KURAL #3).
- **Bilinen sınır (dürüstlük):** Sürükle-bırak etkileşimi dnd-kit tabanlı
  olduğundan happy-dom'da güvenilir simüle edilemiyor; bu yüzden hamle ekleme
  mantığı saf fonksiyonlara (`tryAppendMove`) çıkarılıp orada test ediliyor,
  gerçek sürükleme ise Task 8'de tarayıcıda elle doğrulanıyor.
