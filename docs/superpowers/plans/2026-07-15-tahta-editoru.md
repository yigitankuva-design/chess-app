# Tahta Editörü (Parça 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca panelden tahtaya taş dizip pozisyon kurabilsin ve doğru cevabı işaretleyip alıştırma oluşturabilsin — mevcut 60 alıştırmasıyla **birebir aynı formatta** (`board_exercises` içinde `click_square` / `move_piece` / `identify_piece`).

**Architecture:** Yeni `BoardEditor` bileşeni react-chessboard'u doğrudan kullanır (mevcut `ChessBoard` satranç kurallarını zorladığı için pozisyon kurmaya uygun değil). Alıştırma, seçilen **anlatım** adımının `content_json.board_exercises` dizisine eklenir; kaydetme mevcut `PATCH /admin/steps/{id}` ile yapılır. Backend `_validate_step_content` python-chess ile doğrular. Migration ve yeni endpoint YOK.

**Tech Stack:** FastAPI + python-chess 1.2.0 + pytest; Next.js 15 + React 19 + react-chessboard 5 + chess.js + TS + Tailwind.

---

## Kritik Kısıtlar (uygulayan mutlaka okusun)

1. **`board.is_valid()` KULLANMA.** Zafer'in gerçek FEN'leri kasten şahsız: `8/8/8/8/8/8/8/8 w - - 0 1`, `8/8/8/8/8/8/4P3/8 w - - 0 1`, `8/8/8/8/4n3/8/8/8 b - - 0 1`. Üçü de `is_valid()=False` döner. Bu kural mevcut 60 alıştırmayı reddederdi. Sadece **parse** kontrolü yapılır.
2. **`legal_moves` şahsız tahtada çalışır** (doğrulandı: tek piyon FEN'inde `['e2e3','e2e4']`). Hamle doğrulaması yapılabilir.
3. **Mevcut `ChessBoard` bileşeni editör için kullanılamaz** — `interactive` + sıradaki rengin taşı + legal hamle zorlaması var. `BoardEditor` react-chessboard'u doğrudan kullanır.
4. **Alıştırmalar `explanation` adımının içinde** yaşar, ayrı adım türü değil. `inline_exercise`/`LessonPlayer` ölü kod — **dokunma**.

---

## File Structure

**Backend (`apps/api`):**
- Modify: `chess_api/routers/admin.py` — `_validate_step_content` içine `board_exercises` doğrulaması
- Create: `tests/test_board_exercises.py` — doğrulama testleri

**Frontend (`apps/web`):**
- Create: `components/BoardEditor.tsx` — palet + tıkla-yerleştir, FEN üretir
- Create: `components/admin/ExerciseForm.tsx` — tür seç + cevap işaretle + kaydet
- Modify: `app/admin/content/lesson/[lessonId]/page.tsx` — anlatım adımına "Alıştırmalar (N)" bölümü

---

## Task 1: Backend — board_exercises doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Failing test yaz**

Create `apps/api/tests/test_board_exercises.py`:

```python
import pytest
from chess_api.models.module import Module, Lesson


async def _teacher_token(client, email="be@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _lesson(db, order=1):
    m = Module(order_index=order, name=f"M{order}", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders", estimated_minutes=10, published=False)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    return les


async def _post_step(client, tok, lesson_id, exercises):
    return await client.post(
        f"/admin/lessons/{lesson_id}/steps",
        headers={"Authorization": f"Bearer {tok}"},
        json={"type": "explanation",
              "content_json": {"title": "T", "body": "b", "board_exercises": exercises}},
    )


@pytest.mark.asyncio
async def test_kingless_teaching_positions_accepted(client, db):
    """EN KRİTİK: Zafer'in gerçek FEN'leri şahsız — reddedilmemeli (is_valid kullanılmamalı)."""
    les = await _lesson(db, order=40)
    tok = await _teacher_token(client, email="be1@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "Koyu kareye tikla",
         "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1", "c3"]},
        {"type": "move_piece", "instruction": "Piyonu e4'e tasi",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "piece_square": "e2", "target_squares": ["e4"]},
        {"type": "identify_piece", "instruction": "Bu tas ne?",
         "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1", "highlight_square": "e4",
         "options": ["Piyon", "At"], "correct_index": 1},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_explanation_without_exercises_still_ok(client, db):
    les = await _lesson(db, order=41)
    tok = await _teacher_token(client, email="be2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_unparseable_fen_rejected(client, db):
    les = await _lesson(db, order=42)
    tok = await _teacher_token(client, email="be3@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "bu-fen-degil", "target_squares": ["a1"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_empty_instruction_rejected(client, db):
    les = await _lesson(db, order=43)
    tok = await _teacher_token(client, email="be4@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": ["a1"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_click_square_bad_targets_rejected(client, db):
    les = await _lesson(db, order=44)
    tok = await _teacher_token(client, email="be5@t.com")
    # bos liste
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": []},
    ])
    assert r.status_code == 400
    # gecersiz kare
    r2 = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": ["z9"]},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_validations(client, db):
    les = await _lesson(db, order=45)
    tok = await _teacher_token(client, email="be6@t.com")
    # piece_square bos kare
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1",
         "piece_square": "a1", "target_squares": ["a2"]},
    ])
    assert r.status_code == 400
    # illegal hedef (piyon e2'den h8'e gidemez)
    r2 = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1",
         "piece_square": "e2", "target_squares": ["h8"]},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_promotion_move_rejected(client, db):
    """Terfi {from,to} ile ifade edilemiyor -> legal bulunmaz -> 400."""
    les = await _lesson(db, order=46)
    tok = await _teacher_token(client, email="be7@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "k7/4P3/8/8/8/8/8/4K3 w - - 0 1",
         "piece_square": "e7", "target_squares": ["e8"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_identify_piece_validations(client, db):
    les = await _lesson(db, order=47)
    tok = await _teacher_token(client, email="be8@t.com")
    # correct_index aralik disi
    r = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "e4", "options": ["A", "B"], "correct_index": 5},
    ])
    assert r.status_code == 400
    # tek sik
    r2 = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "e4", "options": ["A"], "correct_index": 0},
    ])
    assert r2.status_code == 400
    # highlight_square'de tas yok
    r3 = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "a1", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r3.status_code == 400


@pytest.mark.asyncio
async def test_unknown_exercise_type_rejected(client, db):
    les = await _lesson(db, order=48)
    tok = await _teacher_token(client, email="be9@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sarki_soyle", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1"},
    ])
    assert r.status_code == 400
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_board_exercises.py -q`
Expected: Doğrulama olmadığı için reddetme testleri FAIL (201 dönüyor)

- [ ] **Step 3: Doğrulamayı ekle**

`apps/api/chess_api/routers/admin.py` — dosyanın başına ekle:

```python
import chess
```

Mevcut `_validate_step_content` fonksiyonunu bul:

```python
def _validate_step_content(step_type: LessonStepType, content: dict) -> None:
    """Editörden gelen içerik oynatıcının beklediği şekle uymalı; uymazsa çocukta bozuk görünür."""
    if step_type == LessonStepType.quiz:
```

Bu fonksiyonun ÜSTÜNE şu yardımcıyı ekle:

```python
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
        if ex_type not in ("click_square", "move_piece", "identify_piece"):
            raise HTTPException(status_code=400, detail=f"Geçersiz alıştırma türü: {ex_type}")
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

Sonra `_validate_step_content` içindeki `explanation` dalını değiştir. Mevcut:

```python
    elif step_type == LessonStepType.explanation:
        if not content.get("title") and not content.get("body"):
            raise HTTPException(status_code=400, detail="Anlatım için başlık veya metin gerekli")
```

Şununla değiştir:

```python
    elif step_type == LessonStepType.explanation:
        if not content.get("title") and not content.get("body"):
            raise HTTPException(status_code=400, detail="Anlatım için başlık veya metin gerekli")
        if "board_exercises" in content:
            _validate_board_exercises(content["board_exercises"])
```

- [ ] **Step 4: Testleri çalıştır, geç**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/test_board_exercises.py -q`
Expected: PASS (9 test)

- [ ] **Step 5: Zafer'in GERÇEK içeriği doğrulamayı geçiyor mu (regresyon güvencesi)**

Canlı export'tan alınan gerçek alıştırmayı import ederek dene:

```bash
cd apps/api
./.venv/Scripts/python.exe -c "
import chess
# Zafer'in gercek FEN'leri parse + legal kontrolu
for fen in ['8/8/8/8/8/8/8/8 w - - 0 1', '8/8/8/8/8/8/4P3/8 w - - 0 1', '8/8/8/8/4n3/8/8/8 b - - 0 1']:
    b = chess.Board(fen)
    print(fen, '-> parse OK, is_valid()=', b.is_valid())
b = chess.Board('8/8/8/8/8/8/4P3/8 w - - 0 1')
print('e2->e4 legal:', chess.Move.from_uci('e2e4') in b.legal_moves)
"
```
Expected: üçü de parse OK (is_valid False olsa bile), `e2->e4 legal: True`

- [ ] **Step 6: Tam suite (regresyon)**

Run: `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q`
Expected: Hepsi PASS

- [ ] **Step 7: Commit + push (Railway deploy)**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat(api): board_exercises doğrulaması (python-chess, is_valid kullanmadan)"
git push origin main
```

- [ ] **Step 8: Canlı doğrulama — gerçek içerik hâlâ geçerli mi (EN KRİTİK)**

Parça 0'daki export/import ile gerçek müfredatı aynen geri yükle. Doğrulama devredeyken bu **geçmeli** — geçmezse doğrulama hocanın içeriğini reddediyor demektir:

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"bev_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"Teacher\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
SP="/c/Users/muham/AppData/Local/Temp/claude/C--Users-muham/1e9ffcfb-7693-4fdc-92a4-db7c9d06ddd6/scratchpad"
curl -s "$API/admin/content/export" -H "Authorization: Bearer $TOK" > "$SP/exp3.json"
python -c "
import json
d = json.load(open(r'$SP/exp3.json'.replace('/c/','C:/'), encoding='utf-8'))
json.dump({'version': d['version'], 'modules': d['modules']}, open(r'$SP/imp3.json'.replace('/c/','C:/'),'w',encoding='utf-8'), ensure_ascii=False)
"
curl -s -X POST "$API/admin/content/import" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" --data-binary @"$SP/imp3.json"
```
Expected: `{"modules_updated":4,...,"steps_updated":6,...}` — **200 ve created değerleri 0**. 400 gelirse doğrulama hocanın gerçek içeriğini reddediyor → DUR ve düzelt.

---

## Task 2: Frontend — BoardEditor bileşeni

**Files:**
- Create: `apps/web/components/BoardEditor.tsx`

- [ ] **Step 1: Bileşeni oluştur**

Create `apps/web/components/BoardEditor.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PALETTE: { code: string; label: string }[] = [
  { code: 'K', label: '♔ Şah' }, { code: 'Q', label: '♕ Vezir' }, { code: 'R', label: '♖ Kale' },
  { code: 'B', label: '♗ Fil' }, { code: 'N', label: '♘ At' }, { code: 'P', label: '♙ Piyon' },
  { code: 'k', label: '♚ Şah' }, { code: 'q', label: '♛ Vezir' }, { code: 'r', label: '♜ Kale' },
  { code: 'b', label: '♝ Fil' }, { code: 'n', label: '♞ At' }, { code: 'p', label: '♟ Piyon' },
];

/** FEN'in taş yerleşimi kısmını kare→taş haritasına çevirir. */
export function fenToMap(fen: string): Record<string, string> {
  const placement = fen.split(' ')[0];
  const map: Record<string, string> = {};
  placement.split('/').forEach((row, rankIdx) => {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        fileIdx += Number(ch);
      } else {
        map[`${FILES[fileIdx]}${rank}`] = ch;
        fileIdx += 1;
      }
    }
  });
  return map;
}

/** Kare→taş haritasını tam FEN'e çevirir. */
export function mapToFen(map: Record<string, string>, turn: 'w' | 'b'): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const f of FILES) {
      const piece = map[`${f}${rank}`];
      if (piece) {
        if (empty > 0) { row += String(empty); empty = 0; }
        row += piece;
      } else {
        empty += 1;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 1`;
}

interface Props {
  fen: string;
  turn: 'w' | 'b';
  onChange: (fen: string) => void;
  onTurnChange: (turn: 'w' | 'b') => void;
}

export function BoardEditor({ fen, turn, onChange, onTurnChange }: Props) {
  const [selected, setSelected] = useState<string | null>('P');

  function handleSquareClick(square: string) {
    const map = fenToMap(fen);
    if (selected === null) {
      delete map[square];
    } else {
      map[square] = selected;
    }
    onChange(mapToFen(map, turn));
  }

  function setTurn(t: 'w' | 'b') {
    onTurnChange(t);
    onChange(mapToFen(fenToMap(fen), t));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            onSquareClick: ({ square }) => handleSquareClick(square as string),
          }}
        />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Beyaz taşlar</p>
        <div className="flex flex-wrap gap-1">
          {PALETTE.slice(0, 6).map((p) => (
            <button key={p.code} type="button" onClick={() => setSelected(p.code)}
              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                selected === p.code ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{p.label}</button>
          ))}
        </div>
        <p className="text-xs n-muted mt-2 mb-1">Siyah taşlar</p>
        <div className="flex flex-wrap gap-1">
          {PALETTE.slice(6).map((p) => (
            <button key={p.code} type="button" onClick={() => setSelected(p.code)}
              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                selected === p.code ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelected(null)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            selected === null ? 'border-rose-400 bg-rose-400/15 text-rose-200' : 'border-white/15 text-white/70 hover:bg-white/5'
          }`}>🧹 Silgi</button>
        <button type="button" onClick={() => onChange(mapToFen(fenToMap(START_FEN), turn))}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Başlangıç konumu
        </button>
        <button type="button" onClick={() => onChange(mapToFen({}, turn))}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Tahtayı temizle
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs n-muted">Hamle sırası:</span>
        <button type="button" onClick={() => setTurn('w')}
          className={`px-3 py-1 rounded-lg text-xs border ${turn === 'w' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'}`}>Beyaz</button>
        <button type="button" onClick={() => setTurn('b')}
          className={`px-3 py-1 rounded-lg text-xs border ${turn === 'b' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'}`}>Siyah</button>
      </div>

      <p className="text-xs n-muted break-all">FEN: {fen}</p>
    </div>
  );
}

export { START_FEN, EMPTY_FEN };
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: fenToMap/mapToFen birim testi yaz**

Create `apps/web/tests/board-editor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fenToMap, mapToFen, START_FEN, EMPTY_FEN } from '@/components/BoardEditor';

describe('BoardEditor FEN yardımcıları', () => {
  it('başlangıç konumunu doğru çözer', () => {
    const map = fenToMap(START_FEN);
    expect(map['e1']).toBe('K');
    expect(map['e8']).toBe('k');
    expect(map['a2']).toBe('P');
    expect(Object.keys(map).length).toBe(32);
  });

  it('boş tahtayı doğru çözer', () => {
    expect(Object.keys(fenToMap(EMPTY_FEN)).length).toBe(0);
  });

  it('gidiş-dönüş: harita -> FEN -> harita aynı kalır', () => {
    const map = fenToMap(START_FEN);
    const fen = mapToFen(map, 'w');
    expect(fenToMap(fen)).toEqual(map);
  });

  it('boş harita boş tahta FEN üretir', () => {
    expect(mapToFen({}, 'w')).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it("Zafer'in tek piyon pozisyonunu üretebilir", () => {
    expect(mapToFen({ e2: 'P' }, 'w')).toBe('8/8/8/8/8/8/4P3/8 w - - 0 1');
  });

  it('hamle sırası FEN e yansır', () => {
    expect(mapToFen({ e4: 'n' }, 'b')).toBe('8/8/8/8/4n3/8/8/8 b - - 0 1');
  });
});
```

- [ ] **Step 4: Testi çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor.test.ts`
Expected: PASS (6 test) — özellikle son ikisi Zafer'in gerçek FEN'lerini birebir üretmeli

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor.test.ts
git commit -m "feat(web): BoardEditor bileşeni (palet + tıkla-yerleştir, FEN üretir)"
```

---

## Task 3: Frontend — Alıştırma formu

**Files:**
- Create: `apps/web/components/admin/ExerciseForm.tsx`

- [ ] **Step 1: Formu oluştur**

Create `apps/web/components/admin/ExerciseForm.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';

export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece';

export interface BoardExercise {
  type: ExerciseType;
  instruction: string;
  fen: string;
  target_squares?: string[];
  piece_square?: string;
  highlight_square?: string;
  options?: string[];
  correct_index?: number;
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
}

interface Props {
  onAdd: (ex: BoardExercise) => Promise<void>;
}

export function ExerciseForm({ onAdd }: Props) {
  const [type, setType] = useState<ExerciseType>('click_square');
  const [fen, setFen] = useState(EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [instruction, setInstruction] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [pieceSquare, setPieceSquare] = useState('');
  const [highlight, setHighlight] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [failMsg, setFailMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    const base: BoardExercise = { type, instruction: instruction.trim(), fen };
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
      await onAdd(base);
      setInstruction(''); setTargets([]); setPieceSquare(''); setHighlight('');
      setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg('');
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  return (
    <div className="neon-card neon-green p-5 space-y-4">
      <h3 className="font-bold n-text">Yeni alıştırma</h3>

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
          <p className="text-xs n-muted mb-1">Doğru kare(ler) — tahtadaki kareyi yaz, birden çok olabilir</p>
          <SquarePicker values={targets} onToggle={toggleTarget} />
        </div>
      )}

      {type === 'move_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Oynayacak taşın karesi</p>
            <select value={pieceSquare} onChange={(e) => setPieceSquare(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[8rem]">
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
              className="neon-input py-1.5 text-xs max-w-[8rem]">
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

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <button type="button" onClick={submit} disabled={saving}
        className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
        {saving ? 'Kaydediliyor...' : 'Alıştırmayı ekle'}
      </button>
    </div>
  );
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

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
```

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx
git commit -m "feat(web): alıştırma formu (3 tür, tahta editörlü)"
```

---

## Task 4: Frontend — adım editörüne alıştırma bölümü

**Files:**
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`

- [ ] **Step 1: Alıştırma yönetimini ekle**

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx` — importlara ekle:

```typescript
import { ExerciseForm } from '@/components/admin/ExerciseForm';
import type { BoardExercise } from '@/components/admin/ExerciseForm';
```

Component gövdesine (mevcut state'lerin altına) ekle:

```typescript
  const [openExercises, setOpenExercises] = useState<number | null>(null);

  function exercisesOf(s: StepRow): BoardExercise[] {
    return (s.content_json.board_exercises as BoardExercise[]) || [];
  }

  async function saveExercises(s: StepRow, list: BoardExercise[]) {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content_json: { ...s.content_json, board_exercises: list } }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || 'Kaydedilemedi');
    }
    await refresh();
  }

  async function addExercise(s: StepRow, ex: BoardExercise) {
    setMsg(null);
    try {
      await saveExercises(s, [...exercisesOf(s), ex]);
      setMsg('Alıştırma eklendi');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
      throw e;
    }
  }

  async function deleteExercise(s: StepRow, idx: number) {
    if (!confirm('Bu alıştırmayı silmek istiyor musun?')) return;
    setMsg(null);
    try {
      await saveExercises(s, exercisesOf(s).filter((_, i) => i !== idx));
      setMsg('Alıştırma silindi');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Silinemedi');
    }
  }
```

- [ ] **Step 2: Adım kartına "Alıştırmalar (N)" butonu ve paneli ekle**

Aynı dosyada, adım kartındaki `<button onClick={() => deleteStep(s)}` satırının HEMEN ÜSTÜNE ekle:

```tsx
                {s.type === 'explanation' && (
                  <button onClick={() => setOpenExercises(openExercises === s.id ? null : s.id)}
                    className="px-3 py-1.5 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-xs transition-colors">
                    Alıştırmalar ({exercisesOf(s).length})
                  </button>
                )}
```

Adım kartını saran `<div key={s.id} className={...}>` bloğunun KAPANIŞINDAN sonra (yani `</div>` ile `);` arasına) alıştırma panelini ekle. Kart render'ını şu yapıya çevir:

```tsx
            return (
              <div key={s.id}>
                <div className={`neon-card ${accent} flex items-center gap-3 p-4`}>
                  {/* ... mevcut kart içeriği aynen ... */}
                </div>

                {openExercises === s.id && (
                  <div className="mt-3 ml-6 space-y-3">
                    {exercisesOf(s).length === 0 ? (
                      <p className="text-sm n-muted">Bu adımda henüz alıştırma yok.</p>
                    ) : (
                      <div className="grid gap-2">
                        {exercisesOf(s).map((ex, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                            <span className="text-xs n-muted w-6">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs n-muted uppercase">{ex.type}</p>
                              <p className="text-sm n-text truncate">{ex.instruction}</p>
                            </div>
                            <button onClick={() => deleteExercise(s, i)}
                              className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Sil</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <ExerciseForm onAdd={(ex) => addExercise(s, ex)} />
                  </div>
                )}
              </div>
            );
```

- [ ] **Step 3: Tip + test**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: tsc temiz, testler PASS

- [ ] **Step 4: Commit + push (Vercel deploy)**

```bash
git add "apps/web/app/admin/content/lesson/[lessonId]/page.tsx"
git commit -m "feat(web): adım editörüne alıştırma yönetimi (ekle/sil)"
git push origin main
```

---

## Task 5: Canlı uçtan uca doğrulama

**Files:** yok

- [ ] **Step 1: Gerçek içerik bozulmadı mı (EN KRİTİK)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
curl -s "$API/modules/1/lessons"
```
Expected: `"Tahta ve Taşlar"` hâlâ yayında.

Ayrıca Zafer'in 60 alıştırmasının hâlâ yerinde olduğunu doğrula:

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"fin_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"T\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$API/admin/lessons/42/steps" -H "Authorization: Bearer $TOK" \
  | python -c "
import sys, json
d = json.load(sys.stdin)
total = sum(len(s['content_json'].get('board_exercises', [])) for s in d)
print('adim sayisi:', len(d), '| toplam alistirma:', total)
"
```
Expected: `adim sayisi: 6 | toplam alistirma: 60`

- [ ] **Step 2: Kendi test dersimde alıştırma ekleme (gerçek içeriğe dokunmadan)**

```bash
API="https://chess-app-production-1dab.up.railway.app"
TS=$(date +%s)
TOK=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"bx_${TS}@t.com\",\"password\":\"guvenli12345\",\"name\":\"T\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
LID=$(curl -s -X POST "$API/admin/modules/2/lessons" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"title":"BX Test","estimated_minutes":10}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
printf "sahsiz pozisyonlu alistirma (201 beklenir): "
curl -s -X POST "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d '{"type":"explanation","content_json":{"title":"T","body":"b","board_exercises":[{"type":"move_piece","instruction":"Piyonu e4e tasi","fen":"8/8/8/8/8/8/4P3/8 w - - 0 1","piece_square":"e2","target_squares":["e4"]}]}}' \
  -o /dev/null -w "%{http_code}\n"
printf "illegal hamle (400 beklenir): "
curl -s -X POST "$API/admin/lessons/$LID/steps" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d '{"type":"explanation","content_json":{"title":"T","body":"b","board_exercises":[{"type":"move_piece","instruction":"x","fen":"8/8/8/8/8/8/4P3/8 w - - 0 1","piece_square":"e2","target_squares":["h8"]}]}}' \
  -o /dev/null -w "%{http_code}\n"
printf "temizlik: "
curl -s -X DELETE "$API/admin/lessons/$LID" -H "Authorization: Bearer $TOK"
```
Expected: şahsız pozisyon **201**, illegal hamle **400**, temizlik `{"deleted":true}`

- [ ] **Step 3: Tarayıcıda editör doğrulama**

Öğretmen hesabıyla canlı sitede: `/admin/content` → düzey → ders → **İçeriği düzenle** → bir anlatım adımında **Alıştırmalar (N)** → tahtaya taş diz, tür seç, hedef kare işaretle, **Alıştırmayı ekle**. Liste güncellenmeli, konsol hatası olmamalı.

---

## Self-Review Notu

- **Spec kapsamı:** BoardEditor (T2), 3 tür alıştırma formu (T3), panel entegrasyonu (T4), backend doğrulama (T1), canlı doğrulama (T5) — hepsi karşılandı.
- **Kritik kısıt #1 (`is_valid()` yasak):** T1 Step 3'te açık yorumla kodlandı; T1 Step 1'deki `test_kingless_teaching_positions_accepted` bunu **kanıtlıyor** (Zafer'in üç gerçek FEN'i 201 almalı). T1 Step 8 canlı gerçek içeriği import ederek doğruluyor.
- **Kritik kısıt #2 (legal_moves şahsız çalışır):** `test_move_piece_validations` ve T1 Step 5 doğruluyor.
- **Kritik kısıt #3 (ChessBoard kullanılamaz):** T2'de react-chessboard doğrudan kullanılıyor (`allowDragging: false` + `onSquareClick`), mevcut ChessBoard'a dokunulmuyor.
- **Kritik kısıt #4 (ölü koda dokunma):** `inline_exercise`/LessonPlayer hiçbir task'ta geçmiyor.
- **Tip tutarlılığı:** `BoardExercise` arayüzü (T3) backend doğrulamasının beklediği anahtarlarla birebir: type, instruction, fen, target_squares, piece_square, highlight_square, options, correct_index, hint_squares, success_msg, fail_msg. `fenToMap`/`mapToFen` T2'de tanımlandı, T3'te aynı adlarla kullanıldı.
- **Zafer'in formatıyla uyum:** T2 Step 3 testleri `mapToFen({e2:'P'},'w')` → `8/8/8/8/8/8/4P3/8 w - - 0 1` yani hocanın gerçek FEN'ini birebir üretiyor.
- **Migration yok, yeni endpoint yok** (mevcut `PATCH /admin/steps/{id}`) → geriye uyumlu.
- **Deploy sırası:** backend (T1 Step 7) → frontend (T4 Step 4).
