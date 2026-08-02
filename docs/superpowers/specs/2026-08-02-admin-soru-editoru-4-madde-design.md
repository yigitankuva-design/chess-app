# Admin Soru Editörü — 4 Madde Tasarımı

**Tarih:** 2026-08-02
**Kapsam:** Admin → Dersler → Altkonu → Yeni Soru Ekle bölümü ve sporcunun bu soruları çözdüğü ekranlar.
**Kullanıcı notu (KURAL #0):** Kullanıcı teknik değil; raporlar kısa ve sade olmalı.

## Amaç

Hoca (Zafer Hoca) soru oluştururken dört iyileştirme:

1. Görüntü Ekle'de sürekli/sabit satranç tahtası zemini; görseller bu zeminde serbest.
2. "Kareye Tıkla" akışına yeni adım: sporcunun tek mi yoksa tüm doğru karelere mi tıklaması gerektiği; sporcu tarafında çoklu-kare doğrulama.
3. Yeni soru tipi: "Taş Nerede?" — eksik taşı doğru kareye yerleştirme.
4. "Şeffaf Yap" düzeltmesi: görselin etrafındaki beyaz/açık zemin gerçekten silinsin.

## Geriye Uyumluluk (KURAL #3 ve #4)

- Sorular `content_json` içinde JSON olarak saklanır — **veritabanı migration'ı GEREKMEZ**, yeni alanlar sadece JSON'a eklenir.
- Müfredat tablolarına (modules/lessons/lesson_steps) dokunulmaz; içerik kullanıcı verisidir.
- Tüm yeni alanlar **opsiyonel**; eski sorular aynen çalışır. `click_mode` yoksa "tek kare yeter" (mevcut davranış) varsayılır.
- Backend doğrulaması (`admin.py`) yalnızca EKLER; eski tipleri reddetmez.

---

## A. Sabit tahta + serbest görsel (Madde 1)

### Mevcut durum

`image_question` soruları `prompt_images: [{uri,x,y,w,h,tone}]` ile görselleri yüzde-konumlu
tutuyor. `image_show_board` alanı zaten var (varsayılan true) ve sporcu ekranında boş tahta
arka planını kontrol ediyor. Editör tarafında (`MultiImagePlacer`) görseller serbest
konumlanıyor ama arkada **sabit satranç tahtası zemini garantili değil**.

### Değişiklik

- `MultiImagePlacer` bileşeninin yerleştirme alanına, arkada **her zaman** boş satranç
  tahtası zemini çizilir (`BoardEditor`/`ChessBoard`'un boş tahta görseliyle aynı görünüm).
  Görseller bu zeminin ÜSTÜNDE, şu anki gibi serbest sürüklenip boyutlandırılır (kullanıcı
  "serbest dursun" dedi — kareye yapışma YOK).
- Bu, hem talimat görsel alanı hem soru görseli alanı için geçerli (image_question'ın
  görsel yerleştirme kullandığı her yer).
- Sporcu tarafı (`ChoiceQuestionBody`) zaten `image_show_board` ile tahtayı gösterebiliyor;
  editördeki zemin sporcunun gördüğüyle **birebir aynı** olacak şekilde hizalanır.

### Sınır

Görseller kareye yapışmaz, serbesttir. Tahta yalnızca görsel bir zemin — mantık/soru
verisini etkilemez.

---

## B. "Kareye Tıkla" 8 adım + tıklama modu (Madde 2)

### Mevcut adımlar (7 satır)

`lib/admin/questionSteps.ts` → `clickSquareSteps`:
1. Talimatı Gir · 2. Konum Diz · 3. Hamle Sırasını Belirle · 4. Konumu Kaydet ·
5. Doğru Kare(leri) Seç · 6. Zorluk Düzeyini Belirle · 7. Soruyu Ekle

### Yeni adımlar (8 satır)

İlk 5 aynen kalır. Araya yeni 6. adım eklenir:
6. **Sporcu Tıklama Sayısını Belirle** — iki seçenek:
   - "Tek Kareye Tıklaması Yeterli" (mod: `any`)
   - "Tüm Cevap Karelerine Tıklasın" (mod: `all`)
7. Zorluk Düzeyini Belirle
8. Soruyu Ekle

Adım tamam sayılma kuralı: hoca iki seçenekten birine **bilfiil tıklayınca** (diğer
"Belirle" adımlarındaki gibi — varsayılana bakmak yetmez, P7 deseni).

### Veri

`click_square` egzersizine yeni opsiyonel alan: `click_mode: 'any' | 'all'`.
Yoksa `any` varsayılır (eski sorular = mevcut davranış).

### Admin UI

`ExerciseForm` içinde `click_square` seçiliyken, "Doğru Kare(leri) Seç" ile "Zorluk" arasında
iki butonlu bir seçim: "Tek Kareye Tıklaması Yeterli" / "Tüm Cevap Karelerine Tıklasın".
`clickModeChosen` bayrağı (bilfiil tıklama) `clickSquareSteps`'e girer; kilit 8 adımı zorlar.

### Sporcu tarafı doğrulama

`BoardExercise.tsx` `onSquareClick` → `click_square` dalı:
- **`any` modu (mevcut):** doğru karelerden birine tıklayınca `succeed()`; yanlış kareye
  tıklayınca `failNoRetry()`. DEĞİŞMEZ.
- **`all` modu (yeni):** tıklanan kareler biriktirilir.
  - Tıklanan kare doğru karelerden biri değilse → ANINDA `failNoRetry()` (1 yanlış = soru yanlış).
  - Doğruysa işaretlenir; TÜM doğru kareler tıklanınca `succeed()`.
  - Aynı doğru kareye ikinci tık etkisiz (yanlış saymaz).

Saf mantık `lib/play/multiSquareCheck.ts` içine çıkarılır (React'siz, kapsamlı test edilir):
`evaluateClick(clicked, targets, alreadyClicked) → 'wrong' | 'partial' | 'complete'`.

### Backend

`admin.py` board-exercise doğrulaması `click_mode` alanını kabul eder (yalnız `'any'` veya
`'all'`; yoksa serbest). Ek doğrulama minimum.

---

## C. Yeni soru tipi: "Taş Nerede?" (Madde 3)

### Kavram

Hoca eksik taşlı bir konum dizer (örn. mat konumu ama bir taş eksik). Eksik taş(lar) tahtanın
DIŞINDA dairesel kart(lar)da durur. Sporcu taşı sürükleyip doğru kareye bırakır VEYA önce
taşa, sonra kareye tıklar (taş otomatik gider). Hoca doğru kareyi cevap oluştururken belirler.

### Soru tipi adı

Yeni `type: 'place_piece'`. `ExerciseType` union'ına eklenir. "Kareye Tıkla" ve "Taşı Oynat"
yanına 3. buton: **"Taş Nerede?"**.

### Adımlar (7 satır)

1. Talimatı Gir · 2. Konumu Diz · 3. Konumu Kaydet · 4. Konuma Eklenecek Taşı Belirle ·
5. Taşın Doğru Karesini Belirle · 6. Hamle Sırasını Belirle · 7. Soruyu Kaydet

Adım mantığı `lib/admin/placePieceSteps.ts` içinde (mevcut `movePieceSteps`/`questionSteps`
deseniyle). Her "Belirle" adımı bilfiil seçim ister.

### Veri

`place_piece` egzersizi:
- `fen`: EKSİK taşlı konum (yerleştirilecek taş tahtada YOK).
- `placements: [{ piece: string; square: string }]` — 1 veya 2 öğe (kullanıcı "1 veya 2 taş"
  dedi). `piece` = tek harf/renk kodu (örn. `'wN'` = beyaz at), `square` = doğru kare (örn. `'e5'`).

### Admin UI

- "Konumu Diz" + "Konumu Kaydet": mevcut `BoardEditor` ile (eksik taşlı konum kurulur).
- "Konuma Eklenecek Taşı Belirle": 1–2 taş seçilir (renk + tür paleti). Bu taşlar tahtada
  DEĞİL, dışarıda kart olarak dizilecek.
- "Taşın Doğru Karesini Belirle": her seçilen taş için doğru kare (kare seçici).
- "Hamle Sırasını Belirle": beyaz/siyah (mevcut turn deseni).
- Kilit: 7 adım tamamlanınca "Soruyu Kaydet" açılır.

### Sporcu tarafı

Yeni bileşen `components/lesson-steps/PlacePieceSolver.tsx`:
- Tahta `fen`'den kurulur (eksik taş yok).
- Tahtanın yanında/altında, yerleştirilecek her taş için dairesel kart (mevcut "dairesel kart"
  stiliyle tutarlı).
- Sporcu taşı sürükleyip kareye bırakır (react-chessboard spare-piece deseni) VEYA taşa tıklayıp
  sonra kareye tıklar → taş o kareye gider.
- Doğrulama: yerleştirilen taş DOĞRU karede mi? Tüm taşlar doğru yerleşince `onSolved()`.
  Yanlış kareye bırakınca `onWrong()` (fail mesajı); 1–2 taşlı olduğu için mantık:
  saf modül `lib/play/placePieceCheck.ts` — `placeAttempt(piece, square, placements, placedSoFar)`.

### Backend

`admin.py` `place_piece` tipini kabul eder: `fen` geçerli, `placements` 1–2 öğeli, her öğede
geçerli `piece` ve `square`.

### Sınır

Sürükle-bırak ŞAHSIZ öğretim konumlarında da çalışmalı (`skipValidation` deseni). Eksik taş
sayısı en fazla 2.

---

## D. "Şeffaf Yap" düzeltmesi (Madde 4)

### Kök neden

`lib/imageTransparency.ts` → `makeBackgroundTransparent(threshold=245)`. Kenardan flood-fill
ile SADECE `r,g,b ≥ 245` pikselleri siliyor. Görselin zemini tam beyaz değilse (hafif gri,
JPEG gürültüsü, açık renk), eşik tutmuyor ve **hiçbir şey silinmiyor** — kullanıcının şikayeti
bu ("etraftaki beyaz alan şeffaf olmuyor").

### Değişiklik

Eşik yerine **köşe rengini örnekleyip ona yakın pikselleri** silen daha dayanıklı yöntem:
- Dört köşenin ortalama rengi = "zemin rengi" kabul edilir.
- Kenardan flood-fill, pikselin zemin rengine **renk mesafesi** bir toleransın altındaysa siler
  (sadece saf beyaz değil; açık gri / hafif renkli zeminler de).
- İçteki (dıştan ulaşılamayan) alanlar korunur (mevcut BFS mantığı aynı).
- Sonuç yine şeffaf PNG.

Saf mantık `floodFillTransparent` imzası genişler: eşik yerine `bgColor + tolerance`. Kapsamlı
test: düz beyaz zemin, açık gri zemin, içte korunan beyaz, hiç zemin olmayan görsel.

### Buton

Kullanıcı kararı: "Vektöre Çevir" (SVG) ile "Şeffaf Yap" (PNG) **iki ayrı buton kalır**. Yalnız
"Şeffaf Yap"ın işleyişi düzeltilir. İsimler netleştirilebilir ama iki buton korunur.

---

## Teslim Sırası

Bağımsız, her biri tek başına yayınlanabilir:

| Sıra | Madde | Risk | Backend? |
|---|---|---|---|
| D | Şeffaf Yap düzeltmesi | Düşük (tek fonksiyon) | Hayır |
| A | Sabit tahta zemini | Düşük (görsel) | Hayır |
| B | Kareye Tıkla 8 adım + mod | Orta | Evet (küçük) |
| C | Taş Nerede? yeni tip | Yüksek (yeni tip, sürükle-bırak) | Evet |

## Test Stratejisi

- Saf mantık önce (`multiSquareCheck.ts`, `placePieceCheck.ts`, `imageTransparency.ts`,
  `placePieceSteps.ts`, güncellenmiş `clickSquareSteps`) → vitest ile kapsamlı.
- Sonra bileşen entegrasyon testleri (admin editör adımları, sporcu çözüm akışı).
- Backend: `admin.py` doğrulaması için pytest (yeni alanlar kabul, geçersizler ret).
- Test kapısı: `npx tsc --noEmit && npx next lint && npx vitest run` + `pytest -q`.
- Gözlemlenebilir olduğu için canlı doğrulama (KURAL #6): gerçek tarayıcıda admin akışı ve
  sporcu çözümü.

## Geriye Uyumluluk Özeti

- Migration YOK. Yeni alanların hepsi opsiyonel. Eski sorular birebir çalışır.
- `click_mode` yok → `any`. `place_piece` yeni tip, eskiler etkilenmez. Şeffaflaştırma yalnız
  "Şeffaf Yap"a basılınca çalışır, otomatik değil.
