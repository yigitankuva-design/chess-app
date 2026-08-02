# C Grubu — "Taşa Tıkla" Soru Tipi

> Kullanıcının altı maddelik isteğinin **C grubu** (son grup). A ve B bitti, yayında.

## Amaç

Konum ekle bölümüne dördüncü tahta sorusu tipi eklenir: **Taşa Tıkla**. Zafer Hoca bir
konum dizer ve o konumdaki taşlardan bir veya birkaçını cevap olarak işaretler. Sporcu
tahtadaki doğru taşlara tıklar.

Buton sırası (kullanıcının isteği): **Kareye tıkla → Taşa tıkla → Taşı oynat → Taş nerde?**

## Kullanıcı Kararları (onaylandı)

| Konu | Karar |
|---|---|
| Zorluk düzeyi adımı | **Eklenir** — akış 7 değil **8 adım** |
| Birden fazla cevap taşı | **Hepsine tıklanmalı** — biri eksikse soru bitmez |
| Yanlış taşa tıklama | **Soru yanlış sayılır** — tek hak, tekrar deneme yok |

## Panel Akışı — 8 Adım

1. Talimatı Gir
2. Konumu Diz
3. Konumu Kaydet
4. Cevap Taşlarını Seç
5. Taş Seçimini Kaydet
6. Hamle Sırasını Belirle
7. Zorluk Düzeyini Belirle
8. Soruyu Ekle

**4. adım — cevap taşı seçimi:** Konum kaydedildikten sonra ekranda kalır; hoca üzerindeki
taşlara tıklayarak seçer. Seçilen taş halkayla işaretlenir; tekrar tıklamak seçimi kaldırır.
**Yalnızca üzerinde taş olan kareler seçilebilir** — boş kareye tıklamak bir şey yapmaz,
çünkü bu tipin cevabı "taş", "kare" değil.

## Veri Biçimi

Yeni alıştırma tipi: `click_piece`

```
{
  type: 'click_piece',
  instruction: string,
  fen: string,
  piece_squares: string[],   // cevap taşlarının bulunduğu kareler, en az 1
  success_msg?, fail_msg?, code?, difficulty?
}
```

**Neden `target_squares` değil `piece_squares`:** `click_square` tipi zaten
`target_squares` kullanıyor ve orada kareler BOŞ olabilir. Ayrı ad, iki tipin
doğrulama kurallarının karışmasını önler ve "burada kare değil taş aranıyor" bilgisini
alan adının kendisi taşır.

## Mevcut Parçaların Yeniden Kullanımı

| İhtiyaç | Kullanılacak |
|---|---|
| Çoklu tıklama değerlendirmesi | `lib/play/multiSquareCheck.ts` → `evaluateClick()` — `'wrong' \| 'partial' \| 'complete'` döner; tam olarak istenen davranış (biri yanlışsa `'wrong'`, hepsi tamamlanınca `'complete'`) |
| Tıklanan taş göstergesi | `lib/chess/squareMarker.ts` → `ringStyle()` + `RING_BLUE/GREEN/RED` (A grubu) |
| Yanlışta soru bitirme | `BoardExercise` içindeki mevcut `failNoRetry()` |
| Panel konum tahtası | `components/admin/SavedPositionBoard.tsx` (B grubu) — **tıklanabilir hale getirilecek** |

`SavedPositionBoard` şu an salt-okunur. İsteğe bağlı bir `onSquareClick` eklenir:
verilmezse bugünkü davranış aynen sürer (B grubundaki kullanım bozulmaz), verilirse
tıklanabilir olur. Yeni bir tahta bileşeni yazmak yerine mevcut olan genişletilir.

## Sporcu Tarafı

`BoardExercise` içinde yeni bir dal:

- Tahtada bir kareye tıklanır. **Üzerinde taş yoksa hiçbir şey olmaz.**
- Taş varsa `evaluateClick(square, piece_squares, tıklananlar)` çağrılır:
  - `'wrong'` → `failNoRetry()` — soru yanlış, tekrar deneme yok
  - `'partial'` → kare mavi halka alır, sporcu devam eder
  - `'complete'` → `succeed()` — soru doğru biter
- Ayrı bir çözücü bileşen (`MovePieceSolver`/`PlacePiecesSolver` gibi) **gerekmez**:
  bu tip `click_square` ile aynı tahtayı ve aynı tıklama yolunu kullanır, sadece
  hedefin taş olması şartı eklenir.

## Backend Doğrulaması

`apps/api/chess_api/routers/admin.py`:
- `BOARD_EXERCISE_TYPES` demetine `"click_piece"` eklenir. **Şart** — eklenmezse kayıt
  "Geçersiz alıştırma türü" hatasıyla reddedilir.
- Yeni dal:
  - `piece_squares` liste ve en az 1 eleman olmalı
  - her eleman geçerli kare adı olmalı
  - **o karede TAŞ OLMALI** — boş kare reddedilir (bu tipin cevabı taştır)
  - aynı kare iki kez verilmemeli

## Kapsam Dışı

- Mevcut üç tahta tipinin davranışı değişmez.
- "biri yeterli" seçeneği yok — kullanıcı "hepsine tıklamalı" dedi, tek davranış.
- Zorluk/puanlama/kilit mantığı değişmez.

## Test Planı

- **Saf mantık:** 8 adımın tamamlanma durumu (`clickPieceSteps`).
- **Backend:** geçerli soru kabul edilir; boş kare, tekrarlı kare, boş liste reddedilir.
- **Sporcu bileşeni:** boş kareye tıklamak etkisiz; doğru taşta halka çıkar ve soru
  bitmez; son taşta soru doğru biter; yanlış taşta soru yanlış biter (tek hak).
- **Panel:** dördüncü buton doğru sırada görünür; 8 adım listelenir; adımlar bitmeden
  "Soruyu Ekle" kilidi açılmaz; taş olmayan kareye tıklamak seçim yapmaz.
- **Regresyon:** `SavedPositionBoard`'un B grubundaki salt-okunur kullanımı bozulmamalı.
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` + `python -m pytest -q`.
- Gerçek tarayıcı doğrulaması (KURAL #6): panelde taş seçme, sporcu tarafında doğru ve
  yanlış tıklama akışları.
