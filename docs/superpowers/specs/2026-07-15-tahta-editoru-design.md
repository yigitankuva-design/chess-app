# Parça 2 — Tahta Editörü — Tasarım (v2, düzeltilmiş)

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

> **v1 iptal edildi.** İlk sürüm `inline_exercise` + `LessonPlayer` üzerine yazılmıştı. Kod incelemesi bunun **ölü kod** olduğunu, canlı sistemin farklı çalıştığını gösterdi. Bu sürüm gerçek sisteme göre yazıldı.

## Amaç

Zafer hoca panelden tahtaya taş dizip pozisyon kurabilsin, doğru cevabı işaretleyip alıştırma oluşturabilsin — ve bu alıştırma **mevcut 60 alıştırmasıyla birebir aynı formatta**, çocukların gerçekten kullandığı oynatıcıda çalışsın.

## Gerçek Sistem (kod + canlı veriyle doğrulandı)

| | Değer |
|---|---|
| Canlı oynatıcı | `app/(child)/modules/[id]/page.tsx` — çocuklar `/home → Dersler → /modules/{id}` yolundan girer |
| Ölü kod | `app/(child)/lesson/[id]` + `LessonPlayer` + `InlineExerciseStep` — **hiçbir yerden link verilmiyor**, dokunulmayacak |
| Adım türü | `explanation` |
| Alıştırmaların yeri | Anlatım adımının `content_json` içinde `board_exercises: []` dizisi |
| Render eden | `components/lesson-steps/BoardExercise.tsx` |
| Cevap kontrolü | **İstemci tarafında** (doğru cevap içeriğin içinde) |

**Canlı içerik:** "Tahta ve Taşlar" dersi = 6 anlatım adımı, her birinde 10 alıştırma = **60 alıştırma**.

**Anlatım adımının content_json şekli:**
```json
{ "title": "...", "body": "...", "board_exercises": [ ... ] }
```

**Alıştırma tipleri** (`BoardExercise.tsx`'ten birebir):
```ts
ClickSquareEx   { type:'click_square',   instruction, fen, target_squares: string[], hint_squares?: string[], success_msg?, fail_msg? }
MovePieceEx     { type:'move_piece',     instruction, fen, piece_square: string, target_squares: string[], hint_squares?: string[], success_msg?, fail_msg? }
IdentifyPieceEx { type:'identify_piece', instruction, fen, highlight_square: string, options: string[], correct_index: number, success_msg? }
```

`target_squares` **dizidir** — birden çok doğru kare olabilir.

**Kütüphaneler:** backend `python-chess==1.2.0`, frontend `chess.js` + `react-chessboard` — ikisi de kurulu, yeni bağımlılık yok.

## 1. Tahta Editörü Bileşeni

**Yaklaşım:** taş paleti + tıkla-yerleştir (lichess/chess.com standardı).

- **Palet:** beyaz/siyah Şah, Vezir, Kale, Fil, At, Piyon + **Silgi**
- **Yerleştirme:** paletten taş seç → kareye tıkla → yerleşir. Silgi ile taş kaldır.
- **Kısayollar:** "Başlangıç konumu", "Tahtayı temizle"
- **Hamle sırası:** Beyaz/Siyah seçimi (FEN'in aktif renk alanı) — `move_piece` doğrulaması için gerekli
- **Çıktı:** FEN

Yeni bileşen: `components/BoardEditor.tsx`. Mevcut `ChessBoard` **kullanılamaz** — o satranç kurallarını zorluyor (sadece sıradaki rengin taşını seçtiriyor, sadece legal hamleye izin veriyor), pozisyon kurmaya uygun değil. `react-chessboard` doğrudan kullanılır (`allowDragging: false` + `onSquareClick` ile yerleştirme).

## 2. Alıştırma Kurma Akışı

Adım editörü sayfasında (`/admin/content/lesson/[lessonId]`) her **anlatım** adımı için "Alıştırmalar (N)" bölümü açılır. İçinde:

**Mevcut alıştırmalar:** liste (tip + instruction özeti) + sil + sırala
**Yeni alıştırma ekle:**
1. Pozisyonu kur (tahta editörü) + hamle sırası
2. Tür seç: **Kareye tıkla** / **Taşı oynat** / **Taşı tanı**
3. Talimat metni (`instruction`) — çocuğa ne soruluyor
4. Doğru cevabı işaretle:
   - *Kareye tıkla* → tahtada bir veya **birden çok** kare seç → `target_squares[]`
   - *Taşı oynat* → önce taşı seç (`piece_square`), sonra gidebileceği kare(ler)i seç → `target_squares[]`
   - *Taşı tanı* → vurgulanacak kareyi seç (`highlight_square`) + şıkları yaz + doğru şıkkı işaretle
5. Opsiyonel: `hint_squares`, `success_msg`, `fail_msg`
6. Kaydet → seçilen adımın `content_json.board_exercises` dizisine eklenir (mevcut `PATCH /admin/steps/{id}` ile)

## 3. Backend Doğrulama (python-chess)

`_validate_step_content` içinde `explanation` için `board_exercises` varsa her alıştırma doğrulanır:

**Ortak:**
- `instruction` boş olamaz → 400
- `fen` zorunlu; `chess.Board(fen)` parse edilebilmeli → 400

> **`board.is_valid()` KULLANILMAZ.** Zafer'in mevcut alıştırmaları kasten **şahsız** öğretim pozisyonları kullanıyor:
> - `8/8/8/8/8/8/8/8 w - - 0 1` (boş tahta — "koyu kareye tıkla")
> - `8/8/8/8/8/8/4P3/8 w - - 0 1` (tek piyon — "piyonu e4'e taşı")
> - `8/8/8/8/4n3/8/8/8 b - - 0 1` (tek at — "bu taş ne?")
>
> `is_valid()` üçüne de `False` döner (şah yok). Bu kural konsaydı **hocanın mevcut 60 alıştırması reddedilirdi**. Sadece "FEN parse edilebiliyor mu" kontrolü yapılır.
>
> Doğrulandı: `legal_moves` şahsız tahtada **çalışıyor** (tek piyon FEN'inde `['e2e3','e2e4']` döner), yani hamle doğrulaması yine de yapılabilir.

**click_square:**
- `target_squares` boş olmayan liste, her eleman geçerli kare adı (`chess.SQUARE_NAMES`) → 400

**move_piece:**
- `piece_square` geçerli kare ve o karede **taş olmalı** → 400
- `target_squares` boş olmayan liste, geçerli kare adları → 400
- Her hedef için `piece_square→target` hamlesi o pozisyonda **legal olmalı** → 400
  (Terfi hamleleri `{from,to}` ile ifade edilemediği için legal bulunmaz → doğal olarak 400; hocaya "terfi içeren hamle desteklenmiyor" denir.)

**identify_piece:**
- `highlight_square` geçerli kare, o karede taş olmalı → 400
- `options` en az 2 eleman → 400
- `correct_index` 0 ≤ i < len(options) → 400

Mevcut anlatım adımlarının doğrulaması korunur (başlık veya metin gerekli). `board_exercises` yoksa doğrulama atlanır → **Zafer'in mevcut 60 alıştırması etkilenmez** (zaten geçerli, ama yine de import/güncelleme sırasında doğrulanır).

## 4. Panel Entegrasyonu

- `/admin/content/lesson/[lessonId]` sayfasında her anlatım adımı kartına **"Alıştırmalar (N)"** butonu
- Tıklanınca o adımın alıştırma listesi + tahta editörlü ekleme formu açılır
- Kaydetme: `PATCH /admin/steps/{id}` ile `content_json` bütün olarak güncellenir (mevcut endpoint, yeni endpoint gerekmez)

## 5. Kapsam Dışı

- `inline_exercise` / `LessonPlayer` / `InlineExerciseStep` — ölü kod, dokunulmayacak
- Cevapların istemcide görünür olması (devtools ile "kopya") — mevcut tasarım böyle; sunucu kontrolüne geçmek ayrı ve büyük iş
- Resimli alıştırma (Parça 3)
- Piyon terfisi içeren hamle (istemci `{from,to}` modeli desteklemiyor)
- Mevcut alıştırmayı görsel düzenleme — bu turda ekleme + silme + sıralama var; düzenleme için sil-yeniden ekle
- Kilit/kademeli ilerleme — not: `/modules/[id]` sayfasında **adım bazında sıralı kilit zaten var** (`isStepAccessible`, önceki adım bitmeden sonraki açılmıyor). Ders/düzey bazında kilit ayrı iş.

## 6. Test

**Backend (pytest):**
- Geçerli `board_exercises` (üç tür) → 201
- Geçersiz FEN (parse edilemeyen, örn. "xyz") → 400
- **Şahsız öğretim pozisyonu → 201** (reddedilmemeli — Zafer'in gerçek FEN'leri böyle; `is_valid()` kullanılmadığının kanıtı)
- `click_square`: boş `target_squares` → 400; geçersiz kare ("z9") → 400
- `move_piece`: `piece_square` boş kare → 400; illegal hedef → 400; terfi hamlesi → 400
- `identify_piece`: `correct_index` aralık dışı → 400; 1 şık → 400
- `board_exercises` olmayan anlatım → 201 (mevcut davranış korunur)
- Canlı formatın birebir kopyası (gerçek örnekten) → 201 (regresyon güvencesi)
- Mevcut testler kırılmaz

**Frontend:** tsc temiz; mevcut testler kırılmaz.

## 7. Geriye Uyumluluk (KURAL #3)

- Migration YOK, yeni endpoint YOK (mevcut `PATCH /admin/steps/{id}` kullanılır)
- Zafer'in mevcut 60 alıştırması aynı formatta kalır, doğrulamayı geçer
- Çocuk tarafı oynatıcı (`/modules/[id]`, `BoardExercise`) değişmez
- Deploy sırası: önce backend (Railway), sonra frontend (Vercel)
