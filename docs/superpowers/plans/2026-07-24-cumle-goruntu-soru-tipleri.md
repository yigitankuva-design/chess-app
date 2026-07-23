# Cümle & Görüntü Soru Tipleri (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin "Yeni Soru" bölümüne, tahta gerektirmeyen iki yeni soru tipi eklemek — Cümle Ekle ve Görüntü Ekle — mevcut Konum Ekle (tahta) akışına hiç dokunmadan.

**Architecture:** Yeni tipler mevcut `board_exercises`/`_timed`/`_test` dizilerine yeni `type` değerleri olarak eklenir (aynı havuz, aynı soru kodu sistemi, aynı rastgele-20-seçim). Backend doğrulaması ve frontend render'ı iki koda ayrılır: tahta tabanlı (mevcut, değişmeyen) ve seçenek tabanlı (yeni). Görseller tarayıcıda sıkıştırılıp data-URI olarak aynı `content_json` JSON alanında saklanır — migration yok.

**Tech Stack:** Next.js/TypeScript (frontend), FastAPI/Python (backend), mevcut `content_json` JSON kolonu, vitest + pytest.

**Spec:** `docs/superpowers/specs/2026-07-24-cumle-goruntu-soru-tipleri-design.md`

---

## Dosya haritası

| Dosya | Değişiklik |
|---|---|
| `apps/api/chess_api/routers/admin.py` | `_validate_board_exercises` yeniden yapılandırılır, `_validate_choice_exercise` + `_check_data_uri_size` eklenir |
| `apps/api/tests/test_board_exercises.py` | Yeni test senaryoları eklenir (mevcutlar korunur) |
| `apps/web/components/lesson-steps/BoardExercise.tsx` | Tip union'ı genişler (`SentenceQuestionEx`/`ImageQuestionEx`), `isBoardExercise` tip koruyucusu, render dallanması |
| `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx` | **Yeni** — seçenek tabanlı soru gövdesi (öğrenci tarafı) |
| `apps/web/lib/imageCompress.ts` | **Yeni** — görsel sıkıştırma yardımcı fonksiyonu |
| `apps/web/components/admin/ExerciseForm.tsx` | Dış kabuk + 3 kart + `BoardExerciseFields` (taşınan mevcut form) |
| `apps/web/components/admin/ChoiceExerciseFields.tsx` | **Yeni** — Cümle/Görüntü admin formu |
| `apps/web/lib/exerciseBadge.ts` | **Yeni** — badge tooltip metni (saf fonksiyon, page.tsx'ten ayrı) |
| `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` | `exerciseBadgeTitle` import + `title` kullanımı (2 satır) |
| `apps/web/tests/*.test.ts(x)` | Yeni test dosyaları (aşağıda) |

---

## Task 1: Backend regresyon güvenlik ağı — mevcut testler yeşil mi?

**Files:**
- Test: `apps/api/tests/test_board_exercises.py` (mevcut, değişmiyor)

- [ ] **Step 1: Mevcut testleri çalıştır, hepsi yeşil olduğunu doğrula**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v`
Expected: 11 test PASS (bu görev için taban çizgisi — Task 2'deki refactor sonrası aynı 11 test hâlâ PASS olmalı).

Bu adım kod değiştirmez; sadece refactora başlamadan önce "kırılmamış" durumu kayıt altına alır.

---

## Task 2: Backend — `_validate_board_exercises` yapısal refactor (davranış değişmez)

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py:525-595`

- [ ] **Step 1: Döngüyü ortak/tahta olarak ikiye ayır, YENİ TİP EKLEMEDEN**

`admin.py:525-595` aralığındaki `_validate_board_exercises` fonksiyonunu şu şekilde değiştir (henüz `sentence_question`/`image_question` kabul edilmiyor — bu adım SADECE yapısal hazırlık).

**Dikkat — tek davranış farkı:** `difficulty` kontrolü, `instruction` kontrolünün ÖNÜNE alınıyor. Bunun sebebi Task 4'te seçenek tipleri için `continue` edilmeden önce `difficulty`'nin ortak kontrol olarak çalışması gerekmesi. **Kabul/ret sonucu değişmez**; sadece hem `instruction` boş HEM `difficulty` geçersiz olan (mevcut testlerde ve gerçek veride bulunmayan) bir soruda dönen hata *mesajı* değişir. Bu kasıtlıdır ve kabul edilmiştir.

```python
BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece")


def _validate_board_exercises(exercises: list) -> None:
    """Anlatım adımının içindeki board_exercises dizisini doğrular.

    ÖNEMLİ: board.is_valid() KULLANILMAZ — hocanın öğretim pozisyonları kasten şahsızdır
    (boş tahta, tek piyon, tek at). is_valid() onlara False döner ve mevcut 60 alıştırmayı
    reddederdi. Sadece FEN parse edilebiliyor mu bakılır. legal_moves şahsız tahtada çalışır.
    """
    if not isinstance(exercises, list):
        raise HTTPException(status_code=400, detail="board_exercises bir liste olmalı")

    for ex in exercises:
        if not isinstance(ex, dict):
            raise HTTPException(status_code=400, detail="Alıştırma nesne olmalı")
        ex_type = ex.get("type")
        if ex_type not in BOARD_EXERCISE_TYPES:
            raise HTTPException(status_code=400, detail=f"Geçersiz alıştırma türü: {ex_type}")

        if "difficulty" in ex and ex["difficulty"] is not None:
            diff = ex["difficulty"]
            if not isinstance(diff, int) or diff < 1 or diff > 5:
                raise HTTPException(status_code=400, detail="Zorluk düzeyi 1-5 arasında olmalı")

        # --- tahta sorusu doğrulaması ---
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Alıştırma talimatı boş olamaz")

        fen = ex.get("fen")
        if not fen:
            raise HTTPException(status_code=400, detail="Alıştırma için pozisyon (fen) gerekli")
        try:
            board = chess.Board(fen)
        except ValueError:
            raise HTTPException(status_code=400, detail="Pozisyon (fen) okunamadı")

        def _squares(key: str) -> list[str]:
            vals = ex.get(key)
            if not isinstance(vals, list) or not vals:
                raise HTTPException(status_code=400, detail=f"{key} boş olamaz")
            for s in vals:
                if s not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {s}")
            return vals

        if ex_type == "click_square":
            _squares("target_squares")

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

        elif ex_type == "identify_piece":
            hl = ex.get("highlight_square")
            if hl not in chess.SQUARE_NAMES:
                raise HTTPException(status_code=400, detail=f"Geçersiz vurgu karesi: {hl}")
            if board.piece_at(chess.parse_square(hl)) is None:
                raise HTTPException(status_code=400, detail=f"{hl} karesinde taş yok")
            options = ex.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise HTTPException(status_code=400, detail="En az 2 şık gerekli")
            ci = ex.get("correct_index")
            if not isinstance(ci, int) or ci < 0 or ci >= len(options):
                raise HTTPException(status_code=400, detail="Doğru şık geçersiz")
```

(Tek fark eskisine göre: `if ex_type not in ("click_square", "move_piece", "identify_piece")` yerine `if ex_type not in BOARD_EXERCISE_TYPES` — davranış birebir aynı, sadece isimlendirilmiş sabit kullanılıyor.)

- [ ] **Step 2: Regresyon testlerini tekrar çalıştır**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v`
Expected: Aynı 11 test hâlâ PASS. Herhangi biri FAIL olursa refactor'da bir davranış kayması var demektir — düzelt, tekrar çalıştır.

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/routers/admin.py
git commit -m "refactor: _validate_board_exercises içine BOARD_EXERCISE_TYPES sabiti (davranış değişmedi)"
```

---

## Task 3: Backend — `_check_data_uri_size` yardımcı fonksiyonu + testleri

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py` (Task 2'de yazılan `_validate_board_exercises`'ın hemen üstüne)
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Testleri yaz (henüz fonksiyon yok — FAIL bekleniyor)**

`apps/api/tests/test_board_exercises.py` dosyasının sonuna ekle:

```python
from chess_api.routers.admin import _check_data_uri_size
from fastapi import HTTPException


def test_data_uri_size_check_accepts_small_image():
    small = "data:image/jpeg;base64," + ("A" * 100)
    _check_data_uri_size(small, "Test görseli")  # exception atmamalı


def test_data_uri_size_check_rejects_oversized_image():
    huge = "data:image/jpeg;base64," + ("A" * 500_000)
    with pytest.raises(HTTPException) as exc:
        _check_data_uri_size(huge, "Test görseli")
    assert exc.value.status_code == 400


def test_data_uri_size_check_rejects_non_data_uri():
    with pytest.raises(HTTPException) as exc:
        _check_data_uri_size("https://example.com/img.png", "Test görseli")
    assert exc.value.status_code == 400


def test_data_uri_size_check_rejects_non_string():
    with pytest.raises(HTTPException):
        _check_data_uri_size(None, "Test görseli")
```

- [ ] **Step 2: Testleri çalıştır, import hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v -k data_uri`
Expected: FAIL — `ImportError: cannot import name '_check_data_uri_size'`

- [ ] **Step 3: Fonksiyonu ekle**

`admin.py`'de `_validate_board_exercises` fonksiyonunun hemen üstüne ekle:

```python
MAX_EXERCISE_IMAGE_BYTES = 400_000


def _check_data_uri_size(value: object, field_label: str) -> None:
    """data-URI'nin gerçek bayt boyutunu kontrol eder (tarayıcı sıkıştırmasının ikinci savunma hattı)."""
    if not isinstance(value, str) or not value.startswith("data:image/"):
        raise HTTPException(status_code=400, detail=f"{field_label} geçerli bir görsel değil")
    if len(value.encode("utf-8")) > MAX_EXERCISE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"{field_label} çok büyük (en fazla 400KB)")
```

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v -k data_uri`
Expected: 4 test PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat: soru görselleri için data-URI boyut kontrolü (_check_data_uri_size)"
```

---

## Task 4: Backend — `_validate_choice_exercise` + yeni tiplerin kabulü

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Testleri yaz (FAIL bekleniyor — yeni tipler henüz reddediliyor)**

`apps/api/tests/test_board_exercises.py` sonuna ekle:

```python
@pytest.mark.asyncio
async def test_sentence_question_accepted(client, db):
    les = await _lesson(db, order=90)
    tok = await _teacher_token(client, email="be_sentence@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "Atın hareket şekli nasıldır?",
         "answer_kind": "sentence", "options": ["L şeklinde", "Düz çizgide"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_sentence_question_without_text_rejected(client, db):
    les = await _lesson(db, order=91)
    tok = await _teacher_token(client, email="be_sentence2@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_requires_prompt_image(client, db):
    les = await _lesson(db, order=92)
    tok = await _teacher_token(client, email="be_image@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_accepted_with_empty_instruction(client, db):
    """Görüntü sorusunda instruction opsiyonel — boş olabilir."""
    les = await _lesson(db, order=93)
    tok = await _teacher_token(client, email="be_image2@t.com")
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_choice_question_bad_option_count_rejected(client, db):
    les = await _lesson(db, order=94)
    tok = await _teacher_token(client, email="be_optcount@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["Tek"], "correct_index": 0},
    ])
    assert r.status_code == 400
    r2 = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["1", "2", "3", "4", "5"], "correct_index": 0},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_bad_correct_index_rejected(client, db):
    les = await _lesson(db, order=95)
    tok = await _teacher_token(client, email="be_ci@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 5},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_invalid_answer_kind_rejected(client, db):
    les = await _lesson(db, order=96)
    tok = await _teacher_token(client, email="be_ak@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "video", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_empty_sentence_option_rejected(client, db):
    les = await _lesson(db, order=97)
    tok = await _teacher_token(client, email="be_empty@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["A", ""], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_oversized_option_image_rejected(client, db):
    les = await _lesson(db, order=98)
    tok = await _teacher_token(client, email="be_optimg@t.com")
    huge_img = "data:image/jpeg;base64," + ("A" * 500_000)
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "image", "options": [huge_img, small_img], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_mixed_board_and_choice_types_in_same_pool_accepted(client, db):
    """Konum + Cümle + Görüntü soruları aynı havuzda karışık kabul edilmeli."""
    les = await _lesson(db, order=99)
    tok = await _teacher_token(client, email="be_mixed@t.com")
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "Koyu kareye tikla",
         "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1"]},
        {"type": "sentence_question", "instruction": "Atın hareketi?",
         "answer_kind": "sentence", "options": ["L şeklinde", "Düz"], "correct_index": 0},
        {"type": "image_question", "instruction": "", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 1},
    ])
    assert r.status_code == 201
```

- [ ] **Step 2: Testleri çalıştır, tümünün FAIL ettiğini doğrula**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v -k "sentence_question or image_question or choice_question or mixed"`
Expected: FAIL (400 yerine kabul bekleniyor / `sentence_question` `ex_type` olarak reddediliyor)

- [ ] **Step 3: `_validate_choice_exercise` fonksiyonunu ekle ve `_validate_board_exercises`'a bağla**

`admin.py`'de, Task 3'te eklenen `_check_data_uri_size`'ın hemen altına ekle:

```python
CHOICE_EXERCISE_TYPES = ("sentence_question", "image_question")


def _validate_choice_exercise(ex: dict, ex_type: str) -> None:
    """sentence_question / image_question doğrulaması — tahtaya bağımlı değil."""
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
        _check_data_uri_size(img, "Soru görseli")
    else:  # sentence_question
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Cümle sorusu için soru metni gerekli")

    options = ex.get("options")
    if not isinstance(options, list) or not (2 <= len(options) <= 4):
        raise HTTPException(status_code=400, detail="2, 3 veya 4 cevap seçeneği gerekli")

    answer_kind = ex.get("answer_kind")
    if answer_kind not in ("sentence", "image"):
        raise HTTPException(status_code=400, detail="Geçersiz cevap tipi")

    if answer_kind == "image":
        for i, opt in enumerate(options):
            _check_data_uri_size(opt, f"{i + 1}. cevap görseli")
    else:
        if any(not (o or "").strip() for o in options):
            raise HTTPException(status_code=400, detail="Boş cevap seçeneği olamaz")

    ci = ex.get("correct_index")
    if not isinstance(ci, int) or ci < 0 or ci >= len(options):
        raise HTTPException(status_code=400, detail="Doğru cevap seçimi geçersiz")
```

Sonra `_validate_board_exercises` içinde `ex_type` kontrolünü ve dallanmayı güncelle:

```python
        ex_type = ex.get("type")
        if ex_type not in BOARD_EXERCISE_TYPES + CHOICE_EXERCISE_TYPES:
            raise HTTPException(status_code=400, detail=f"Geçersiz alıştırma türü: {ex_type}")

        if "difficulty" in ex and ex["difficulty"] is not None:
            diff = ex["difficulty"]
            if not isinstance(diff, int) or diff < 1 or diff > 5:
                raise HTTPException(status_code=400, detail="Zorluk düzeyi 1-5 arasında olmalı")

        if ex_type in CHOICE_EXERCISE_TYPES:
            _validate_choice_exercise(ex, ex_type)
            continue

        # --- tahta sorusu doğrulaması (Task 2'den değişmeden) ---
        if not (ex.get("instruction") or "").strip():
```

(`if ex_type not in BOARD_EXERCISE_TYPES:` satırını yukarıdaki gibi değiştir; `if "difficulty" in ex...` bloğunu olduğu yerden bu yeni konuma taşı — tahta doğrulamasından ÖNCE, ortak kontrol olarak kalsın; hemen ardından `if ex_type in CHOICE_EXERCISE_TYPES: ... continue` eklenir, geri kalan tahta kodu değişmeden altta kalır.)

- [ ] **Step 4: Yeni testleri çalıştır**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v -k "sentence_question or image_question or choice_question or mixed"`
Expected: 10 test PASS

- [ ] **Step 5: TÜM board_exercises testlerini çalıştır (regresyon dahil)**

Run: `cd apps/api && python -m pytest tests/test_board_exercises.py -v`
Expected: Task 1'deki 11 + Task 3'teki 4 + bu görevdeki 10 = 25 test, hepsi PASS.

- [ ] **Step 6: Tüm backend test paketini çalıştır**

Run: `cd apps/api && python -m pytest -q`
Expected: Tüm testler PASS, hiç FAIL yok (KURAL #4'ün zorladığı `test_migration_guard.py` dahil).

- [ ] **Step 7: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat: sentence_question ve image_question soru tipleri backend doğrulaması"
```

---

## Task 5: Frontend — `BoardExercise.tsx` tip union'ı ve `isBoardExercise` koruyucusu

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx:1-45`
- Test: `apps/web/tests/is-board-exercise.test.ts` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — henüz export yok)**

`apps/web/tests/is-board-exercise.test.ts` oluştur:

```ts
import { describe, it, expect } from 'vitest';
import { isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickSquare: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'],
};
const movePiece: BoardExerciseConfig = {
  type: 'move_piece', instruction: 'x', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2', target_squares: ['e4'],
};
const identifyPiece: BoardExerciseConfig = {
  type: 'identify_piece', instruction: 'x', fen: '8/8/8/8/4n3/8/8/8 b - - 0 1',
  highlight_square: 'e4', options: ['At', 'Fil'], correct_index: 0,
};
const sentenceQuestion: BoardExerciseConfig = {
  type: 'sentence_question', instruction: 'Atın hareketi?',
  answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
};
const imageQuestion: BoardExerciseConfig = {
  type: 'image_question', instruction: '', prompt_image: 'data:image/jpeg;base64,AAA',
  answer_kind: 'sentence', options: ['A', 'B'], correct_index: 1,
};

describe('isBoardExercise', () => {
  it('tahta tabanlı 3 tip için true döner', () => {
    expect(isBoardExercise(clickSquare)).toBe(true);
    expect(isBoardExercise(movePiece)).toBe(true);
    expect(isBoardExercise(identifyPiece)).toBe(true);
  });

  it('seçenek tabanlı 2 yeni tip için false döner', () => {
    expect(isBoardExercise(sentenceQuestion)).toBe(false);
    expect(isBoardExercise(imageQuestion)).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, import hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/is-board-exercise.test.ts`
Expected: FAIL — `isBoardExercise` export edilmiyor.

- [ ] **Step 3: `BoardExercise.tsx`'in tip bölümünü genişlet**

`BoardExercise.tsx:9-44` aralığını (mevcut 3 interface + `BoardExerciseConfig` union) şununla değiştir:

```ts
export interface ClickSquareEx {
  type: 'click_square';
  instruction: string;
  fen: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  /** 3 haneli soru kodu — admin panelinde atanır, öğrenciye üstte gösterilir. */
  code?: string;
}

export interface MovePieceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

export interface IdentifyPieceEx {
  type: 'identify_piece';
  instruction: string;
  fen: string;
  highlight_square: string;
  options: string[];
  correct_index: number;
  success_msg?: string;
  code?: string;
}

export interface SentenceQuestionEx {
  type: 'sentence_question';
  instruction: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

export interface ImageQuestionEx {
  type: 'image_question';
  /** İsteğe bağlı alt başlık/açıklama — '' olabilir. */
  instruction: string;
  prompt_image: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

export type BoardTypeConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx;
export type ChoiceTypeConfig = SentenceQuestionEx | ImageQuestionEx;
export type BoardExerciseConfig = BoardTypeConfig | ChoiceTypeConfig;

/** Tahta tabanlı bir soru mu (click_square/move_piece/identify_piece)? */
export function isBoardExercise(ex: BoardExerciseConfig): ex is BoardTypeConfig {
  return ex.type === 'click_square' || ex.type === 'move_piece' || ex.type === 'identify_piece';
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/is-board-exercise.test.ts`
Expected: 2 test PASS

- [ ] **Step 5: TypeScript derlemesini kontrol et (union genişledi, henüz kullanım yerleri güncellenmedi)**

Run: `cd apps/web && npx tsc --noEmit`
Expected: **HATA VEREBİLİR** — `BoardExercise.tsx` içindeki `styles`/`onSquareClick` bölümleri henüz `isBoardExercise` kullanmıyor, `exercise.hint_squares`/`exercise.fen` gibi erişimler union'ın yeni üyelerinde yok. Bu hata Task 7'de giderilecek — bu adımda sadece hatayı gözlemleyip not al, ilerle.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/is-board-exercise.test.ts
git commit -m "feat: BoardExerciseConfig union'ına sentence_question/image_question eklendi + isBoardExercise koruyucusu"
```

(Bu commit'ten sonra `tsc` kırık kalabilir — bu normal, ara commit. Task 7 düzeltecek. Tek bir PR/dal içinde ilerliyorsan sorun değil.)

---

## Task 6: Frontend — `ChoiceQuestionBody.tsx` (öğrenci tarafı seçenek gövdesi)

**Files:**
- Create: `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`
- Test: `apps/web/tests/choice-question-body.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — dosya yok)**

`apps/web/tests/choice-question-body.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ChoiceTypeConfig } from '@/components/lesson-steps/BoardExercise';

const sentenceEx: ChoiceTypeConfig = {
  type: 'sentence_question',
  instruction: 'Atın hareketi nasıldır?',
  answer_kind: 'sentence',
  options: ['L şeklinde', 'Düz çizgide'],
  correct_index: 0,
};

const imageEx: ChoiceTypeConfig = {
  type: 'image_question',
  instruction: '',
  prompt_image: 'data:image/jpeg;base64,AAA',
  answer_kind: 'sentence',
  options: ['A', 'B', 'C'],
  correct_index: 2,
};

describe('ChoiceQuestionBody', () => {
  it('sentence_question için soru metnini ve tüm seçenekleri gösterir', () => {
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled={false} onAnswer={() => {}} />);
    expect(screen.getByText('Atın hareketi nasıldır?')).toBeInTheDocument();
    expect(screen.getByText('L şeklinde')).toBeInTheDocument();
    expect(screen.getByText('Düz çizgide')).toBeInTheDocument();
  });

  it('image_question için görseli gösterir, boş instruction kartı göstermez', () => {
    render(<ChoiceQuestionBody exercise={imageEx} disabled={false} onAnswer={() => {}} />);
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('bir seçeneğe tıklanınca doğru indeksle onAnswer çağrılır', () => {
    const onAnswer = vi.fn();
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled={false} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('Düz çizgide'));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it('disabled iken tıklama onAnswer çağırmaz', () => {
    const onAnswer = vi.fn();
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('L şeklinde'));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, dosya yok hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/choice-question-body.test.tsx`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Bileşeni oluştur**

`apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`:

```tsx
'use client';
import type { ChoiceTypeConfig } from './BoardExercise';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

export function ChoiceQuestionBody({ exercise, disabled, onAnswer }: Props) {
  const gridCols = exercise.options.length === 2 ? 'grid-cols-2'
    : exercise.options.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

  return (
    <>
      {exercise.type === 'image_question' && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {exercise.instruction && (
        <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          <span className="text-xl leading-none flex-shrink-0">🎯</span>
          <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
        </div>
      )}

      <div className={`grid ${gridCols} gap-2`}>
        {exercise.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(i)}
            className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
          >
            {exercise.answer_kind === 'image'
              ? <img src={opt} alt={`Seçenek ${i + 1}`} style={{ width: '100%', maxHeight: 96, objectFit: 'contain' }} />
              : opt}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/choice-question-body.test.tsx`
Expected: 4 test PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/lesson-steps/ChoiceQuestionBody.tsx apps/web/tests/choice-question-body.test.tsx
git commit -m "feat: ChoiceQuestionBody bileşeni (öğrenci tarafı, tahtasız soru gövdesi)"
```

---

## Task 7: Frontend — `BoardExercise.tsx` render'ını `isBoardExercise` ile dallandır

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx:96-`(dosya sonu)
- Test: `apps/web/tests/board-exercise-render.test.tsx` (yeni)

- [ ] **Step 1: Regresyon + yeni davranış testini yaz (FAIL bekleniyor)**

`apps/web/tests/board-exercise-render.test.tsx` oluştur:

`[data-square]` seçicisi react-chessboard'un ürettiği 64 kareyi işaretler (bu ortamda ölçülerek doğrulandı: tahta render olunca tam 64 adet, olmayınca 0). Tahtanın çizilip çizilmediğini bu sayıyla iddia ediyoruz.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — tip dallanması', () => {
  it('click_square için tahtanın 64 karesini render eder (REGRESYON)', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'Bir kareye tıkla', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText('Bir kareye tıkla')).toBeInTheDocument();
  });

  it('sentence_question için HİÇ tahta karesi render ETMEZ, seçenekleri gösterir', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
    expect(screen.getByText('Atın hareketi?')).toBeInTheDocument();
    expect(screen.getByText('L şeklinde')).toBeInTheDocument();
    expect(screen.getByText('Düz')).toBeInTheDocument();
  });

  it('image_question için görseli gösterir, tahta karesi render ETMEZ', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'image_question', instruction: '', prompt_image: 'data:image/jpeg;base64,AAA',
        answer_kind: 'sentence', options: ['A', 'B'], correct_index: 1 },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
  });

  it('sentence_question doğru cevaba tıklayınca onCorrect çağrılır', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByText('L şeklinde'));
    expect(onCorrect).toHaveBeenCalled();
  });

  it('sentence_question yanlış cevaba tıklayınca onCorrect çağrılMAZ', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByText('Düz'));
    expect(onCorrect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL/derleme hatası olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/board-exercise-render.test.tsx`
Expected: FAIL (muhtemelen `exercise.hint_squares` gibi tip hataları ya da render'ın hâlâ koşulsuz tahta çizmesi nedeniyle "Atın hareketi?" testinde tahta da render olur ama seçenekler görünmez).

- [ ] **Step 3: `BoardExercise` bileşeninin gövdesini güncelle**

`BoardExercise.tsx` dosyasının başına import ekle:

```ts
import { ChoiceQuestionBody } from './ChoiceQuestionBody';
```

`// ── Square styles ──` yorumundan (`isBoardExercise` tanımından sonraki ilk satır, component gövdesi içinde) `onSquareClick` tanımının sonuna kadar olan bloğu şu şekilde değiştir:

```tsx
  // ── Tahta kareleri (sadece tahta tipleri için) ─────────────────────────────
  const styles: Record<string, CSSProperties> = {};
  if (isBoardExercise(exercise)) {
    if (status !== 'success' || showNext) {
      if (exercise.type !== 'identify_piece') {
        (exercise.hint_squares ?? []).forEach((sq) => {
          styles[sq] = { backgroundColor: 'rgba(255,200,0,0.50)' };
        });
      }
      if (exercise.type === 'identify_piece') {
        styles[exercise.highlight_square] = { backgroundColor: 'rgba(255,200,0,0.65)' };
      }
      if (selected) {
        styles[selected] = { backgroundColor: 'rgba(80,160,255,0.65)', cursor: 'pointer' };
      }
    }
    if (status === 'success' && exercise.type === 'move_piece') {
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
    }
  }

  // ── Tahta tıklama ────────────────────────────────────────────────────────
  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (status === 'success' || !isBoardExercise(exercise)) return;

    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Tekrar dene.');
      }
      return;
    }

    if (exercise.type === 'move_piece') {
      if (!selected) {
        if (square === exercise.piece_square) {
          setSelected(square);
          if (piece) playPieceSound(piece.pieceType);
        }
        return;
      }
      if (square === exercise.piece_square) {
        setSelected(null);
        return;
      }
      if (exercise.target_squares.includes(square)) {
        succeed(piece?.pieceType);
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Altın renkli kareye taşı.');
      }
    }
  };

  // ── Seçenek tıklama (sentence_question / image_question) ──────────────────
  const onChoiceAnswer = (i: number) => {
    if (status === 'success' || isBoardExercise(exercise)) return;
    if (i === exercise.correct_index) {
      succeed();
    } else {
      fail(exercise.fail_msg ?? 'Yanlış! Tekrar dene.');
    }
  };
```

Sonra JSX'teki "Board" ve "Instruction" ve "Multiple-choice for identify_piece" ve "Helper hint for move_piece" bloklarını (bugünkü `// ── Render ──` altındaki, `{/* Board */}`'dan `{/* Helper hint for move_piece */}`'in kapanışına kadar olan kısım) şu tek blokla değiştir:

```tsx
      {isBoardExercise(exercise) ? (
        <>
          {/* Board */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ maxWidth: 340, margin: '0 auto' }}>
            <Chessboard
              options={{
                position: exercise.fen,
                allowDragging: false,
                squareStyles: styles,
                onSquareClick,
              }}
            />
          </div>

          {/* Instruction — tahtanın altında kart olarak */}
          <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
            style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
            <span className="text-xl leading-none flex-shrink-0">🎯</span>
            <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
          </div>

          {/* Multiple-choice for identify_piece */}
          {exercise.type === 'identify_piece' && status !== 'success' && (
            <div className="grid grid-cols-2 gap-2">
              {exercise.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (i === exercise.correct_index) succeed();
                    else fail('Yanlış! Tekrar bak ve dene.');
                  }}
                  className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
                  style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Helper hint for move_piece */}
          {exercise.type === 'move_piece' && status === 'idle' && (
            <p className="text-xs" style={{ color: 'var(--t-muted)' }}>
              {selected ? '✔ Taş seçildi — şimdi hedef kareye tıkla!' : 'Önce taşa tıkla, sonra gideceği kareye tıkla.'}
            </p>
          )}
        </>
      ) : (
        <ChoiceQuestionBody exercise={exercise} disabled={status === 'success'} onAnswer={onChoiceAnswer} />
      )}
```

(Progress/Feedback/Next-button blokları JSX'te değişmeden kalır — `exercise.code` erişimi zaten her iki grup için de opsiyonel `code?: string` alanı olduğundan sorunsuz çalışır.)

- [ ] **Step 4: TypeScript derlemesini doğrula**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata (Task 5'te bırakılan hata artık giderilmiş olmalı).

- [ ] **Step 5: Yeni testleri çalıştır**

Run: `cd apps/web && npx vitest run tests/board-exercise-render.test.tsx`
Expected: 5 test PASS

- [ ] **Step 6: TÜM frontend test paketini çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run`
Expected: Önceki tüm testler (answer-check, exercise-code, board-editor, chess-board, vb.) + bu görevin testleri, hepsi PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-render.test.tsx
git commit -m "feat: BoardExercise render'ı isBoardExercise ile dallandı, ChoiceQuestionBody bağlandı"
```

---

## Task 8: Frontend — `imageCompress.ts` (görsel sıkıştırma yardımcısı)

**Files:**
- Create: `apps/web/lib/imageCompress.ts`
- Test: `apps/web/tests/image-compress.test.ts` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — dosya yok)**

`apps/web/tests/image-compress.test.ts` oluştur:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageToDataUri } from '@/lib/imageCompress';

class FakeImage {
  width = 1600;
  height = 1200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    // Gerçek tarayıcı yüklemesini simüle et — mikro görev kuyruğunda onload çağır.
    queueMicrotask(() => this.onload?.());
  }
}

describe('compressImageToDataUri', () => {
  const originalImage = global.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  let toDataURLCalls: number[] = [];

  beforeEach(() => {
    toDataURLCalls = [];
    // @ts-expect-error test ortamında Image'i sahteleriz
    global.Image = FakeImage;
    URL.createObjectURL = vi.fn(() => 'blob:fake');

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    let call = 0;
    HTMLCanvasElement.prototype.toDataURL = vi.fn((_type?: string, quality?: number) => {
      call += 1;
      toDataURLCalls.push(quality ?? -1);
      // İlk çağrı büyük (limiti aşar), sonraki çağrılar küçülür.
      const size = call === 1 ? 500_000 : 100_000;
      return 'data:image/jpeg;base64,' + 'A'.repeat(size);
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
  });

  afterEach(() => {
    global.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('ilk deneme limiti aşarsa kaliteyi düşürüp tekrar dener', async () => {
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    const result = await compressImageToDataUri(file, 400_000);
    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(toDataURLCalls.length).toBeGreaterThan(1);
  });

  it('hiçbir kalite seviyesi limite sığmazsa hata fırlatır', async () => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,' + 'A'.repeat(999_999),
    ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    await expect(compressImageToDataUri(file, 400_000)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Testi çalıştır, dosya yok hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/image-compress.test.ts`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Yardımcı fonksiyonu oluştur**

`apps/web/lib/imageCompress.ts`:

```ts
/**
 * Görseli canvas ile yeniden boyutlandırıp (maks. 800px kenar) JPEG kalitesini
 * kademeli düşürerek (0.9 → 0.5) maxBytes altına indirir. Hiçbiri sığmazsa hata fırlatır
 * — bozuk/aşırı büyük veri sessizce kaydedilmez.
 */
export async function compressImageToDataUri(file: File, maxBytes = 400_000): Promise<string> {
  const img = await loadImage(file);
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, w, h);

  for (let quality = 0.9; quality >= 0.5; quality -= 0.1) {
    const uri = canvas.toDataURL('image/jpeg', quality);
    if (new Blob([uri]).size <= maxBytes) return uri;
  }
  throw new Error('Görsel sıkıştırılamadı');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/image-compress.test.ts`
Expected: 2 test PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/imageCompress.ts apps/web/tests/image-compress.test.ts
git commit -m "feat: imageCompress.ts — soru görsellerini 400KB altına sıkıştıran yardımcı"
```

---

## Task 9: Frontend — `ExerciseForm.tsx` dış kabuk: 3 kart + `BoardExerciseFields` ayrımı

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (tamamı yeniden yazılır)
- Test: `apps/web/tests/exercise-form-family.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor)**

`apps/web/tests/exercise-form-family.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — 3 soru ailesi kartı', () => {
  it('varsayılan olarak Konum Ekle formu (talimat + tahta) açık gelir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Talimat/)).toBeInTheDocument();
    expect(screen.getByText('Konum ekle')).toBeInTheDocument();
    expect(screen.getByText('Cümle ekle')).toBeInTheDocument();
    expect(screen.getByText('Görüntü ekle')).toBeInTheDocument();
  });

  it('Cümle ekle karta tıklayınca cümle formu açılır', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Talimat \(örn\./)).not.toBeInTheDocument();
  });

  it('düzenleme modunda (initial verilmiş) kart değiştirme devre dışıdır', () => {
    render(
      <ExerciseForm
        onSubmit={vi.fn()}
        initial={{
          type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
          options: ['L', 'Düz'], correct_index: 0,
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
    const konumCard = screen.getByText('Konum ekle').closest('button');
    expect(konumCard).toBeDisabled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/exercise-form-family.test.tsx`
Expected: FAIL (kartlar/placeholder'lar henüz yok).

- [ ] **Step 3: `ExerciseForm.tsx`'i baştan yaz**

`apps/web/components/admin/ExerciseForm.tsx` dosyasının **tamamını** şununla değiştir:

```tsx
'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';
import { ChoiceExerciseFields } from './ChoiceExerciseFields';

export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece';
export type QuestionFamily = 'sentence_question' | 'image_question' | 'konum';

export interface BoardExercise {
  type: ExerciseType | 'sentence_question' | 'image_question';
  instruction: string;
  /** Sadece tahta tipleri (Konum Ekle) için zorunlu. */
  fen?: string;
  target_squares?: string[];
  piece_square?: string;
  highlight_square?: string;
  options?: string[];
  correct_index?: number;
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  difficulty?: number;
  /** 3 haneli kalıcı soru kodu (örn. "007") — admin panelinde atanır, değişmez. */
  code?: string;
  /** Sadece image_question için — data-URI. */
  prompt_image?: string;
  /** Sadece sentence_question/image_question için — cevapların tipi. */
  answer_kind?: 'sentence' | 'image';
}

interface Props {
  onSubmit: (ex: BoardExercise) => Promise<void>;
  initial?: BoardExercise;
  onCancel?: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const FAMILY_OPTIONS: [QuestionFamily, string][] = [
  ['sentence_question', 'Cümle ekle'],
  ['image_question', 'Görüntü ekle'],
  ['konum', 'Konum ekle'],
];

function familyOf(ex?: BoardExercise): QuestionFamily {
  if (ex?.type === 'sentence_question') return 'sentence_question';
  if (ex?.type === 'image_question') return 'image_question';
  return 'konum';
}

function SquarePicker({ values, onToggle }: { values: string[]; onToggle: (sq: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-8 gap-0.5" style={{ maxWidth: 280 }}>
        {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) =>
          FILES.map((f) => {
            const sq = `${f}${rank}`;
            const on = values.includes(sq);
            return (
              <button key={sq} type="button" onClick={() => onToggle(sq)}
                className={`text-[10px] py-1 rounded transition-colors ${
                  on ? 'bg-cyan-400/40 text-cyan-100 border border-cyan-400' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}>{sq}</button>
            );
          }),
        )}
      </div>
      <p className="text-xs n-muted">Seçili: {values.length ? values.join(', ') : '—'}</p>
    </div>
  );
}

export function ExerciseForm({ onSubmit, initial, onCancel }: Props) {
  const [family, setFamily] = useState<QuestionFamily>(() => familyOf(initial));
  const editing = !!initial;

  return (
    <div className="neon-card neon-green p-5 space-y-4">
      <h3 className="font-bold n-text">
        {editing ? 'Soruyu düzenle' : 'Yeni soru'}
        {editing && initial?.code && <span className="ml-2 text-xs font-mono n-muted">Kod: {initial.code}</span>}
      </h3>

      <div className="flex justify-center gap-3 flex-wrap">
        {FAMILY_OPTIONS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            disabled={editing}
            onClick={() => setFamily(f)}
            className={`w-36 py-4 px-3 rounded-xl border text-center transition-colors ${
              family === f ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="block font-semibold text-sm">{label}</span>
          </button>
        ))}
      </div>

      {family === 'konum' ? (
        <BoardExerciseFields onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      ) : (
        <ChoiceExerciseFields kind={family} onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      )}
    </div>
  );
}

function BoardExerciseFields({ onSubmit, initial, onCancel }: Props) {
  const [type, setType] = useState<ExerciseType>(
    initial && (initial.type === 'click_square' || initial.type === 'move_piece' || initial.type === 'identify_piece')
      ? initial.type
      : 'click_square',
  );
  const [fen, setFen] = useState(initial?.fen ?? EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>(
    initial?.fen ? ((initial.fen.split(' ')[1] as 'w' | 'b') ?? 'w') : 'w',
  );
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [targets, setTargets] = useState<string[]>(initial?.target_squares ?? []);
  const [pieceSquare, setPieceSquare] = useState(initial?.piece_square ?? '');
  const [highlight, setHighlight] = useState(initial?.highlight_square ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length > 0 ? initial.options : ['', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 1);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!initial;

  function toggleTarget(sq: string) {
    setTargets((prev) => (prev.includes(sq) ? prev.filter((x) => x !== sq) : [...prev, sq]));
  }

  function validate(): string | null {
    if (!instruction.trim()) return 'Talimat gerekli';
    const map = fenToMap(fen);
    if (type === 'click_square') {
      if (targets.length === 0) return 'En az bir doğru kare seç';
    }
    if (type === 'move_piece') {
      if (!pieceSquare) return 'Hangi taşın oynayacağını seç';
      if (!map[pieceSquare]) return 'Seçilen karede taş yok';
      if (targets.length === 0) return 'En az bir hedef kare seç';
    }
    if (type === 'identify_piece') {
      if (!highlight) return 'Vurgulanacak kareyi seç';
      if (!map[highlight]) return 'Vurgulanan karede taş yok';
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return 'En az 2 şık gerekli';
      if (correctIndex >= opts.length) return 'Doğru şık geçersiz';
    }
    return null;
  }

  async function submit() {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    const base: BoardExercise = { type, instruction: instruction.trim(), fen, difficulty };
    if (initial?.code) base.code = initial.code;
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    if (type === 'click_square') base.target_squares = targets;
    if (type === 'move_piece') { base.piece_square = pieceSquare; base.target_squares = targets; }
    if (type === 'identify_piece') {
      base.highlight_square = highlight;
      base.options = options.map((o) => o.trim()).filter(Boolean);
      base.correct_index = correctIndex;
    }
    try {
      await onSubmit(base);
      if (!editing) {
        setInstruction(''); setTargets([]); setPieceSquare(''); setHighlight('');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['identify_piece', 'Taşı tanı'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => { setType(t); setTargets([]); setErr(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}>{label}</button>
        ))}
      </div>

      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Piyonu e4'e taşı)" className="neon-input" />

      <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />

      {type === 'click_square' && (
        <div>
          <p className="text-xs n-muted mb-1">Doğru kare(ler) — birden çok seçebilirsin</p>
          <SquarePicker values={targets} onToggle={toggleTarget} />
        </div>
      )}

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

      {type === 'identify_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Vurgulanacak kare (taşın olduğu)</p>
            <select value={highlight} onChange={(e) => setHighlight(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[10rem]">
              <option value="">seç</option>
              {squares.map((s) => <option key={s} value={s}>{s} ({fenToMap(fen)[s]})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="ex-correct" checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
                  className="h-4 w-4 accent-cyan-400" />
                <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ''])}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              + Şık ekle
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)}
          placeholder="Doğru mesajı (opsiyonel)" className="neon-input" />
        <input value={failMsg} onChange={(e) => setFailMsg(e.target.value)}
          placeholder="Yanlış mesajı (opsiyonel)" className="neon-input" />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                difficulty === d ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{d}</button>
          ))}
          <span className="text-xs n-muted self-center">1 en kolay · 5 en zor</span>
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
        {editing && onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
            İptal
          </button>
        )}
      </div>
    </div>
  );
}
```

Not: Bu adımda `ChoiceExerciseFields` henüz yok — bir sonraki adımda oluşturulacak. Bu yüzden bu adımın sonunda `tsc` hata verecek, bu beklenen bir ara durum.

- [ ] **Step 4: Commit (ara durum, tsc kırık olabilir)**

```bash
git add apps/web/components/admin/ExerciseForm.tsx
git commit -m "refactor: ExerciseForm dış kabuk + 3 soru ailesi kartı + BoardExerciseFields ayrımı"
```

---

## Task 10: Frontend — `ChoiceExerciseFields.tsx` (admin Cümle/Görüntü formu)

**Files:**
- Create: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-fields.test.tsx` (yeni)

- [ ] **Step 1: Testleri yaz**

`apps/web/tests/choice-exercise-fields.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields', () => {
  it('sentence_question: 2 boş seçenekle başlar, doldurup gönderince doğru şekli üretir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Atın hareketi?' } });
    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'L şeklinde' } });
    fireEvent.change(optionInputs[1], { target: { value: 'Düz çizgide' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));

    // submit() async — waitFor ile bekle (çıplak `await Promise.resolve()` güvenilir değil)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sentence_question',
      instruction: 'Atın hareketi?',
      answer_kind: 'sentence',
      options: ['L şeklinde', 'Düz çizgide'],
      correct_index: 0,
    }));
  });

  it('seçenek sayısı 4e çıkarılınca 4 giriş alanı görünür', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    expect(screen.getAllByPlaceholderText(/\d\. şık/)).toHaveLength(4);
  });

  it('seçenek sayısı azaltılınca fazla seçenekler kırpılır ve doğru cevap sınır dışındaysa sıfırlanır', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[3]); // 4. seçeneği doğru işaretle
    fireEvent.click(screen.getByText('2 seçenek'));
    const radiosAfter = screen.getAllByRole('radio');
    expect(radiosAfter).toHaveLength(2);
    expect((radiosAfter[0] as HTMLInputElement).checked).toBe(true);
  });

  it('boş cevapla gönderim engellenir, hata mesajı gösterilir', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/doldurulmalı/)).toBeInTheDocument();
  });

  it('image_question: soru metni boşken de gönderim engellenmez (opsiyonel)', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Soruyu ekle'));
    // Görsel seçilmediği için "Soru görseli gerekli" hatası beklenir — instruction eksikliği DEĞİL.
    expect(screen.getByText(/Soru görseli gerekli/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testleri çalıştır, dosya yok hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Bileşeni oluştur**

`apps/web/components/admin/ChoiceExerciseFields.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { BoardExercise, QuestionFamily } from './ExerciseForm';
import { compressImageToDataUri } from '@/lib/imageCompress';

interface Props {
  kind: Extract<QuestionFamily, 'sentence_question' | 'image_question'>;
  onSubmit: (ex: BoardExercise) => Promise<void>;
  initial?: BoardExercise;
  onCancel?: () => void;
}

export function ChoiceExerciseFields({ kind, onSubmit, initial, onCancel }: Props) {
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [promptImage, setPromptImage] = useState(initial?.prompt_image ?? '');
  const [optionCount, setOptionCount] = useState<2 | 3 | 4>(
    ((initial?.options?.length ?? 2) as 2 | 3 | 4),
  );
  const [answerKind, setAnswerKind] = useState<'sentence' | 'image'>(initial?.answer_kind ?? 'sentence');
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length > 0 ? initial.options : ['', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 1);
  const [err, setErr] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!initial;

  function setCount(n: 2 | 3 | 4) {
    setOptionCount(n);
    setOptions((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setCorrectIndex((prev) => (prev >= n ? 0 : prev));
  }

  async function onPromptImageFile(file: File | undefined) {
    if (!file) return;
    setImgErr(null);
    try {
      setPromptImage(await compressImageToDataUri(file));
    } catch {
      setImgErr('Görsel çok büyük, daha küçük bir görsel seçin');
    }
  }

  async function onOptionImageFile(i: number, file: File | undefined) {
    if (!file) return;
    setImgErr(null);
    try {
      const uri = await compressImageToDataUri(file);
      setOptions((prev) => prev.map((o, j) => (j === i ? uri : o)));
    } catch {
      setImgErr('Görsel çok büyük, daha küçük bir görsel seçin');
    }
  }

  function validate(): string | null {
    if (kind === 'sentence_question' && !instruction.trim()) return 'Soru metni gerekli';
    if (kind === 'image_question' && !promptImage) return 'Soru görseli gerekli';
    if (answerKind === 'sentence') {
      if (options.some((o) => !o.trim())) return 'Tüm cevap seçenekleri doldurulmalı';
    } else {
      if (options.some((o) => !o)) return 'Tüm cevap seçenekleri için görsel yüklenmeli';
    }
    return null;
  }

  async function submit() {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    const base: BoardExercise = {
      type: kind,
      instruction: instruction.trim(),
      answer_kind: answerKind,
      options,
      correct_index: correctIndex,
      difficulty,
    };
    if (kind === 'image_question') base.prompt_image = promptImage;
    if (initial?.code) base.code = initial.code;
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    try {
      await onSubmit(base);
      if (!editing) {
        setInstruction(''); setPromptImage(''); setOptionCount(2); setAnswerKind('sentence');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {kind === 'sentence_question' ? (
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
          placeholder="Soru cümlesi (örn. Atın hareket şekli nasıldır?)" className="neon-input" />
      ) : (
        <div className="space-y-2">
          <span className="text-xs n-muted block">Soru görseli</span>
          <input type="file" accept="image/*" className="hidden" id="prompt-image-input"
            onChange={(e) => onPromptImageFile(e.target.files?.[0])} />
          <label htmlFor="prompt-image-input"
            className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
            Görsel seç
          </label>
          {promptImage && (
            <img src={promptImage} alt="Soru görseli önizleme" style={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain' }} />
          )}
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
            placeholder="Açıklama (opsiyonel)" className="neon-input" />
        </div>
      )}

      <div>
        <p className="text-xs n-muted mb-1">Seçenek sayısı</p>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                optionCount === n ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{n} seçenek</button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Cevap tipi</p>
        <div className="flex gap-2">
          {([['sentence', 'Cümle'], ['image', 'Görüntü']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setAnswerKind(k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                answerKind === k ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs n-muted mb-1">Cevaplar — doğru olanı soldaki yuvarlakla işaretle</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="choice-correct" checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
              className="h-4 w-4 accent-cyan-400" />
            {answerKind === 'sentence' ? (
              <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <input type="file" accept="image/*" className="hidden" id={`option-image-${i}`}
                  onChange={(e) => onOptionImageFile(i, e.target.files?.[0])} />
                <label htmlFor={`option-image-${i}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                  {o ? 'Değiştir' : 'Görsel seç'}
                </label>
                {o && <img src={o} alt={`${i + 1}. şık önizleme`} style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />}
              </div>
            )}
          </div>
        ))}
      </div>

      {imgErr && <p className="text-rose-400 text-sm">{imgErr}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)}
          placeholder="Doğru mesajı (opsiyonel)" className="neon-input" />
        <input value={failMsg} onChange={(e) => setFailMsg(e.target.value)}
          placeholder="Yanlış mesajı (opsiyonel)" className="neon-input" />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                difficulty === d ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{d}</button>
          ))}
          <span className="text-xs n-muted self-center">1 en kolay · 5 en zor</span>
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
        {editing && onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
            İptal
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata (Task 9'da bırakılan `ChoiceExerciseFields` import hatası artık giderilmiş olmalı).

- [ ] **Step 5: Testleri çalıştır**

Run: `cd apps/web && npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: 5 test PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/choice-exercise-fields.test.tsx
git commit -m "feat: ChoiceExerciseFields — admin Cümle/Görüntü soru formu"
```

---

## Task 11: Frontend — admin ders içeriği sayfasında badge tooltip düzeltmesi

**Files:**
- Create: `apps/web/lib/exerciseBadge.ts`
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` (import + `title` kullanımı)
- Test: `apps/web/tests/exercise-badge.test.ts` (yeni)

Yardımcı fonksiyon **`page.tsx` içine konmaz**, ayrı bir lib modülüne çıkarılır. İki sebep: (1) Next.js App Router `page.tsx` dosyalarından bileşen dışı isim export etmek desteklenen bir kullanım değil; (2) testin bir sayfa modülünü import etmesi, o sayfanın tüm bağımlılık ağacını (`getToken`, `fetch`, `ExerciseForm` → `BoardEditor` → react-chessboard) çekerdi — saf bir fonksiyon testi için gereksiz ve kırılgan.

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — dosya yok)**

`apps/web/tests/exercise-badge.test.ts` oluştur:

```ts
import { describe, it, expect } from 'vitest';
import { exerciseBadgeTitle } from '@/lib/exerciseBadge';

describe('exerciseBadgeTitle', () => {
  it('instruction doluysa onu döner', () => {
    expect(exerciseBadgeTitle({ type: 'click_square', instruction: 'Bir kareye tıkla' })).toBe('Bir kareye tıkla');
  });

  it('image_question ve instruction boşsa geri düşüş metni döner', () => {
    expect(exerciseBadgeTitle({ type: 'image_question', instruction: '' })).toBe('Görüntü sorusu');
  });

  it('sentence_question ve instruction boşsa (normalde olmaz) boş döner', () => {
    expect(exerciseBadgeTitle({ type: 'sentence_question', instruction: '' })).toBe('');
  });

  it('instruction tanımsızsa çökmez', () => {
    expect(exerciseBadgeTitle({ type: 'image_question' })).toBe('Görüntü sorusu');
  });
});
```

- [ ] **Step 2: Testi çalıştır, dosya yok hatasıyla FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/exercise-badge.test.ts`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Yardımcıyı oluştur ve `page.tsx`'e bağla**

`apps/web/lib/exerciseBadge.ts` oluştur:

```ts
/** Admin badge grid tooltip metni — image_question'da instruction boş olabilir. */
export function exerciseBadgeTitle(ex: { type: string; instruction?: string }): string {
  if (ex.instruction) return ex.instruction;
  return ex.type === 'image_question' ? 'Görüntü sorusu' : '';
}
```

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx` import'larına ekle:

```ts
import { exerciseBadgeTitle } from '@/lib/exerciseBadge';
```

`page.tsx:309` civarındaki:

```tsx
                                      title={ex.instruction}
```

satırını şununla değiştir:

```tsx
                                      title={exerciseBadgeTitle(ex)}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/exercise-badge.test.ts`
Expected: 4 test PASS

- [ ] **Step 5: TypeScript derlemesini doğrula**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/exerciseBadge.ts "apps/web/app/admin/content/lesson/[lessonId]/page.tsx" apps/web/tests/exercise-badge.test.ts
git commit -m "fix: badge tooltip'i image_question'da boş instruction için geri düşüş metni gösterir"
```

---

## Task 12: Tam test kapısı (tsc, lint, vitest, pytest, build)

**Files:** Yok (sadece doğrulama)

- [ ] **Step 1: Backend tam paket**

Run: `cd apps/api && python -m pytest -q`
Expected: Tüm testler PASS.

- [ ] **Step 2: Frontend tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Frontend lint**

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok (mevcut önceden var olan uyarılar kabul edilebilir).

- [ ] **Step 4: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS — bu görevde eklenen 7 yeni test dosyası + önceden var olan tüm testler.

- [ ] **Step 5: Production build**

Run: `cd apps/web && npm run build`
Expected: `Compiled successfully`, tüm sayfalar statik/dinamik olarak üretilir, hata yok.

- [ ] **Step 6: Herhangi bir adım başarısız olursa**

İlgili göreve dön, hatayı düzelt, o görevin testlerini tekrar çalıştır, sonra bu görevi baştan çalıştır. Kapıdan geçmeden Task 13'e geçilmez.

---

## Task 13: Canlı doğrulama (KURAL #6) — prod API'ye karşı, test verisiyle

**Files:** Yok (sadece manuel/API doğrulama, geçici test verisi)

- [ ] **Step 1: Geçici test öğretmeni + ders + alt konu oluştur**

```bash
API=https://chess-app-production-1dab.up.railway.app
EMAIL="verifyp1_$(date +%s)@gmail.com"
SIGNUP=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Verify P1\"}")
TOKEN=$(python -c "import json,sys;print(json.loads(sys.argv[1])['access_token'])" "$SIGNUP")
MOD=$(curl -s -X POST "$API/admin/modules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"TEST_P1_DUZEY","description":"gecici","icon":"🧪"}')
MODID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$MOD")
LES=$(curl -s -X POST "$API/admin/modules/$MODID/lessons" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"TEST_P1_DERS","estimated_minutes":5}')
LESID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$LES")
STEP=$(curl -s -X POST "$API/admin/lessons/$LESID/steps" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"explanation","content_json":{"title":"Test Alt Konu","body":"test"}}')
STEPID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$STEP")
echo "TOKEN=$TOKEN MODID=$MODID LESID=$LESID STEPID=$STEPID"
```

- [ ] **Step 2: Yerel dev sunucuyu prod API'ye karşı başlat**

`.env.local` oluştur: `NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app`
Dev sunucuyu başlat (proje kuralı: `mcp__Claude_Browser__preview_start` ile `chess-web` config'i).

- [ ] **Step 3: Tarayıcıda admin panelinden bir Cümle sorusu ekle**

`localStorage.setItem('chess_app_token', TOKEN)`, `/admin/content/lesson/{LESID}` sayfasına git. Sorular panelini aç, Süresiz Pratik Yap modunu seç. "Cümle ekle" kartına tıkla, soru + 2 seçenek gir, kaydet. Doğrula: yeni bir kod rozeti (örn. "001") badge grid'de görünür.

- [ ] **Step 4: Bir Görüntü sorusu ekle**

"Görüntü ekle" kartına tıkla, küçük bir test görseli yükle (sıkıştırma çalışmalı), 2 seçenek gir, kaydet. Badge grid'de 2. kod ("002") görünür.

- [ ] **Step 5: Öğrenci ekranında doğrula**

`/pratik/suresiz?step={STEPID}&ders={LESID}&konu=Test` adresine git. Tahtasız render edildiğini, seçeneklerin göründüğünü, doğru cevaba tıklayınca başarı geri bildirimi geldiğini, yanlışa tıklayınca hata geri bildirimi geldiğini doğrula. Soru kodu rozetinin (`#001` / `#002`) göründüğünü doğrula.

- [ ] **Step 6: Backend reddini canlıda doğrula**

```bash
curl -s -X PATCH "$API/admin/steps/$STEPID" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"content_json":{"title":"Test Alt Konu","body":"test","board_exercises":[{"type":"sentence_question","instruction":"","answer_kind":"sentence","options":["A","B"],"correct_index":0}]}}'
```
Expected: HTTP 400, "Cümle sorusu için soru metni gerekli" hatası.

- [ ] **Step 7: Test verisini temizle**

```bash
curl -s -X DELETE "$API/admin/lessons/$LESID" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$API/admin/modules/$MODID" -H "Authorization: Bearer $TOKEN"
```
Doğrula: `GET $API/modules` yanıtında `TEST_P1_DUZEY` artık yok.

- [ ] **Step 8: Yerel ortamı temizle**

`.env.local` dosyasını sil, dev sunucuyu durdur.

- [ ] **Step 9: Sonucu kullanıcıya raporla**

Ne test edildi, ne doğrulandı, hangi ekran görüntüsü/kanıt alındı — açıkça yaz (KURAL #6).

---

## Self-Review Notu (plan yazarı için, uygulama öncesi)

- **Spec kapsaması:** Veri modeli (Task 5), backend doğrulama (Task 2-4), admin UI 3 kart (Task 9), Cümle/Görüntü formu (Task 10), görsel sıkıştırma (Task 8), öğrenci render (Task 6-7), badge tooltip (Task 11), test stratejisi (her task içinde + Task 12-13) — spec'in tüm bölümleri bir task'a karşılık geliyor.
- **Tip tutarlılığı:** `BoardExercise` (admin, düz/opsiyonel alanlı) vs `BoardExerciseConfig` (öğrenci, discriminated union) kasıtlı olarak farklı — admin tarafı zaten bu şekilde tasarlanmıştı (bugünkü `options?`/`correct_index?` de opsiyonel). `QuestionFamily` sadece admin tarafında var (`ExerciseForm.tsx`, `ChoiceExerciseFields.tsx`); öğrenci tarafında `ChoiceTypeConfig`/`BoardTypeConfig` kullanılıyor — isimler görev boyunca tutarlı.
- **Sıra bağımlılığı:** Task 9 → Task 10 arası `tsc` kırık kalıyor (ChoiceExerciseFields henüz yok) — bu bilerek bırakıldı, Task 10 Step 4'te doğrulanıyor. Tek bir feature dalında ilerleniyorsa sorun değil; ana dala (main) doğrudan push ediliyorsa Task 9 ve 10 TEK COMMIT'te birleştirilmeli (ayrı ayrı push edilmemeli).
