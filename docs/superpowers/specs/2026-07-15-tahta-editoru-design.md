# Parça 2 — Tahta Editörü — Tasarım

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Amaç

Zafer hoca panelden tahtaya taşları dizip pozisyon kurabilsin, doğru cevabı (hamle veya kare) işaretleyip alıştırma oluşturabilsin. Oluşturduğu alıştırma çocuklarda doğru çalışsın — yani üretilen JSON oynatıcının beklediği şekle uysun ve pozisyon/hamle satranç kurallarına uygun olsun.

## Mevcut Durum (kod üzerinden doğrulandı)

**Oynatıcının `inline_exercise` için beklediği şekil** (`components/lesson-steps/InlineExerciseStep.tsx`):
```ts
content: { title?: string; body?: string; fen?: string; task_type?: 'click_square' | 'make_move' }
```

**İstemcinin gönderdiği cevap:**
- `click_square` → `{ square: "e4" }`
- `make_move` → `{ from: "e2", to: "e4" }`

**Sunucunun cevap kontrolü** (`routers/lessons.py`, `submit_step_answer`):
```python
expected = step.correct_answer_json or {}
is_correct = all(payload.answer_json.get(k) == v for k, v in expected.items()) if expected else True
```

Yani sunucu **satranç bilmiyor** — sadece sözlük karşılaştırması yapıyor.

**Kütüphaneler:** backend `python-chess==1.2.0` ✓, frontend `chess.js` + `react-chessboard` ✓ (ikisi de kurulu, yeni bağımlılık gerekmez).

**Canlı durum:** production'da hiç `inline_exercise` adımı yok (ders 42 = 6 anlatım). Bu, sunucu davranışını sertleştirmeyi güvenli kılıyor.

## Çözülen İki Kritik Sorun

1. **Sunucu satranç doğrulaması yapmıyor.** Zafer geçersiz bir pozisyon kurar veya kurallara aykırı bir hamleyi "doğru" işaretlerse sistem yakalamaz; çocuk o alıştırmayı asla çözemez. → Kayıtta python-chess ile doğrulanacak.
2. **`correct_answer_json` boşsa her cevap "doğru" sayılıyor** (`if expected else True`). Cevabı işaretlenmemiş alıştırma tüm çocukları geçirir. → Düzeltilecek.

## 1. Tahta Editörü Bileşeni (frontend)

**Yaklaşım:** taş paleti + tıkla-yerleştir (lichess/chess.com standardı).

- **Palet:** beyaz ve siyah için Şah, Vezir, Kale, Fil, At, Piyon + **Silgi**.
- **Yerleştirme:** paletten taş seç → tahtada kareye tıkla → taş yerleşir. Silgi seçiliyken kareye tıkla → taş kalkar.
- **Kısayollar:** "Başlangıç konumu", "Tahtayı temizle".
- **Sıra seçimi:** "Hamle sırası: Beyaz / Siyah" — `make_move` için şart (FEN'in aktif renk alanı).
- **Çıktı:** FEN.

Bileşen `components/BoardEditor.tsx` olarak yazılır; mevcut `ChessBoard`/react-chessboard kullanılır. Pozisyon state'i kare→taş haritası olarak tutulur, FEN'e çevrilir.

## 2. Alıştırma Kurma Akışı (panel)

Adım editörü sayfasına (`/admin/content/lesson/[lessonId]`) "Tahta alıştırması ekle" bölümü eklenir:

1. Pozisyonu kur (tahta editörü) + hamle sırası seç
2. Görev türü: **Hamleyi yap** / **Kareye tıkla**
3. Doğru cevabı işaretle:
   - *Hamleyi yap* → hoca hamleyi tahtada oynar (chess.js sadece legal hamleye izin verir) → `{from, to}`
   - *Kareye tıkla* → hoca kareye tıklar → `{square}`
4. Başlık + açıklama (çocuğa ne sorulduğu: "En iyi hamleyi oyna")
5. Kaydet → `POST /admin/lessons/{id}/steps` (mevcut endpoint) ile:
   - `type: "inline_exercise"`
   - `content_json: {title, body, fen, task_type}`
   - `correct_answer_json: {from,to}` veya `{square}`

## 3. Doğrulama — İki Katman

**Frontend (chess.js):** pozisyon kurulurken ve hamle işaretlenirken anında geri bildirim; tahta zaten kurallara aykırı hamleyi kabul etmez.

**Backend (python-chess) — asıl güvence.** `create_step`/`update_step` içindeki `_validate_step_content` genişletilir; `inline_exercise` için:

- `fen` zorunlu; `chess.Board(fen)` parse edilebilmeli → aksi halde 400
- Pozisyon geçerli olmalı: `board.is_valid()` (her tarafta tam 1 şah, oynamayan taraf şahta değil vb.) → aksi halde 400
- `task_type` `click_square` veya `make_move` olmalı → aksi halde 400
- **`correct_answer_json` boş olamaz** → 400
- `make_move` → `correct_answer_json` `{from, to}` içermeli ve bu hamle o pozisyonda **legal** olmalı (`chess.Move.from_uci(from+to) in board.legal_moves`) → aksi halde 400
- `click_square` → `correct_answer_json` `{square}` içermeli, geçerli kare adı (a1–h8) olmalı → aksi halde 400

Not: `_validate_step_content` şu an sadece `content` alıyor; `inline_exercise` doğrulaması `correct_answer_json`'a da ihtiyaç duyduğu için imzası genişletilir (`content`, `correct_answer`).

## 4. Sunucu Cevap Kontrolü Düzeltmesi

`routers/lessons.py` → `submit_step_answer`:

```python
expected = step.correct_answer_json or {}
if not expected:
    is_correct = step.type != LessonStepType.inline_exercise
else:
    is_correct = all(payload.answer_json.get(k) == v for k, v in expected.items())
```

Yani: cevabı tanımlanmamış bir **alıştırma** artık otomatik "doğru" saymaz. Diğer adım türlerinin (anlatım) mevcut davranışı korunur — anlatımda cevap yok, "doğru" dönmesi normal.

Güvenli: canlıda hiç `inline_exercise` yok.

## 5. Kapsam Dışı

- Anlatım adımında tahta gösterme (`fen` + `highlight_squares`) — oynatıcı destekliyor ama bu turda yok.
- Resimli alıştırma (Parça 3).
- **Çok hamleli** alıştırma — tek hamle.
- **Piyon terfisi** — istemci sadece `{from,to}` gönderiyor, terfi taşı ifade edilemiyor. Terfi içeren hamle işaretlenirse backend legal bulur ama çocuk tarafında terfi taşı belirsiz kalır; bu yüzden editör terfi hamlesini **reddeder** (400) ve hocaya "terfi içeren hamle şu an desteklenmiyor" der. Dürüst sınır.
- Adım düzenleme ekranında tahta ile **var olan** alıştırmayı görsel düzenleme — bu turda alıştırma ekleme + silme var; düzenleme için sil-yeniden ekle.

## 6. Test

**Backend (pytest):**
- Geçerli `inline_exercise` (make_move, legal hamle) → 201
- Geçersiz FEN → 400
- Geçersiz pozisyon (şah yok / iki şah) → 400
- `make_move` ama hamle illegal → 400
- `make_move` ama `correct_answer_json` boş → 400
- `click_square` geçerli kare → 201; geçersiz kare ("z9") → 400
- Terfi hamlesi → 400
- `submit_step_answer`: cevabı olmayan `inline_exercise` → `correct: False` (düzeltme testi)
- `submit_step_answer`: doğru `{from,to}` → `correct: True`; yanlış → `correct: False`
- Mevcut testler kırılmaz (anlatım/quiz)

**Frontend:** tsc temiz; mevcut testler kırılmaz.

## 7. Geriye Uyumluluk (KURAL #3)

- Migration YOK.
- Mevcut adım türleri (anlatım/quiz) ve endpoint'ler etkilenmez.
- Cevap kontrolü düzeltmesi sadece `inline_exercise` için davranış değiştirir; canlıda o türde adım yok.
- Deploy sırası: önce backend (Railway), sonra frontend (Vercel).
