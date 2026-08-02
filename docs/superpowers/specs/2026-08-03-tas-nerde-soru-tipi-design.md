# "Taş Nerde?" Soru Tipi — Tasarım

## Amaç

Admin panelinde (Dersler → Alt konu → Yeni Soru Ekle → Konum ekle) şu an iki soru tipi
var: **Kareye Tıkla** ve **Taşı Oynat**. Üçüncü tip ekleniyor: **Taş Nerde?**

Zafer Hoca tahtaya bir konum dizer (örn. mat konumu) ama bir veya birkaç taşı KASTEN
yerleştirmez. Eksik taşlar tahtanın dışında dairesel kartlarda durur. Sporcu taşı
sürükleyip doğru kareye bırakır, ya da önce taşa sonra kareye tıklar.

## Kullanıcı Kararları (onaylandı)

| Konu | Karar |
|---|---|
| Zorluk düzeyi adımı | **Eklenir** — akış 8 değil **9 adım** olur |
| Eksik taş sayısı | **Birden fazla olabilir** |
| Yanlış cevap | **Tek hak** — tekrar deneme yok |
| Çok taşlı soruda değerlendirme | **İlk yanlışta soru biter**, kalan taşlar sorulmaz |
| Yerleştirme sırası | **Serbest** — sporcu istediği taşı istediği sırada koyar |

## Panel Akışı — 9 Adım

1. Talimatı Gir
2. Konumu Diz
3. Konumu Kaydet
4. Konuma Eklenecek Taşları Belirle
5. Taşların Doğru Karelerini Belirle
6. Cevabı Kaydet
7. Hamle Sırasını Belirle
8. Zorluk Düzeyini Belirle
9. Soruyu Kaydet

**4. ve 5. adım birlikte çalışır:** Hoca paletten bir taş seçer (adım 4 ✓), sonra tahtada
o taşın gitmesi gereken kareye tıklar (adım 5 ✓). Çift oluşur ve listeye eklenir. Birden
fazla taş için tekrarlanır. Listeden tek tek silinebilir.

**Adım sırası neden böyle:** Diğer iki tipte "Hamle Sırasını Belirle" 3. sıradadır. Burada
kullanıcı 7. sırayı istedi — çünkü hamle sırası (beyaz/siyah) cevabı etkilemiyor, sadece
konumun kaydında saklanıyor. Kullanıcının verdiği sıraya uyulur.

## Veri Biçimi

Yeni alıştırma tipi: `place_pieces`

```
{
  type: 'place_pieces',
  instruction: string,
  fen: string,                 // eksik taşların OLMADIĞI konum
  pieces: [                    // en az 1 eleman
    { piece: 'Q', square: 'h5' },   // büyük harf = beyaz
    { piece: 'n', square: 'c6' }    // küçük harf = siyah
  ],
  success_msg?, fail_msg?, code?, difficulty?
}
```

`piece` **FEN harfidir** — `BoardEditor`'ün `selectedPaletteKey` değeriyle birebir aynı
kodlama (satır 119: `map[square] = selectedPaletteKey`, doğrudan FEN haritasına yazılıyor).
Yeni bir kodlama icat edilmez.

**Dikkat — iki ayrı kodlama var:** `react-chessboard`'un kendi `pieceType` biçimi `'wQ'`
şeklindedir; `BoardEditor` bunu `pieceTypeToFen()` (satır 30) ile FEN harfine çevirir.
Sakladığımız ve doğruladığımız biçim **FEN harfi**; `react-chessboard`'a veri verirken
ters çevrim gerekir.

## Sporcu Tarafı — Yeni Bileşen Gerekiyor

**Teknik engel (gerçek kodda doğrulandı):** `components/ChessBoard.tsx` sarmalayıcısının
`onPieceDrop` imzası `(from: Square, to: Square) => boolean` (satır 24). Tahta DIŞINDAN
sürüklenen taş için gereken "bu taş tahtadan değil, paletten geldi" bilgisini taşımıyor.
`BoardEditor.tsx` bunu `piece.isSparePiece` ile yapıyor (satır 96-108) ama o bir admin
editörü — silme, palet yönetimi, FEN düzenleme içeriyor, sporcuya verilemez.

**Karar:** Sporcu için ayrı bir bileşen yazılır: `PlacePiecesSolver.tsx`. Deseni
`MovePieceSolver.tsx` ile aynıdır (kendi tahtasını kendi çizer, `BoardExercise` onu
`pg-board` alanına koyar). Ham `react-chessboard` kullanır — tıpkı `BoardExercise`'in
`click_square` dalının yaptığı gibi — böylece `isSparePiece` bilgisine erişir.

**Alternatif düşünüldü, seçilmedi:** `ChessBoard.tsx`'e spare piece desteği eklemek. Bu
sarmalayıcıyı maç ekranı, analiz ve pratik hep birlikte kullanıyor; imzasını değiştirmek
canlıdaki üç akışı birden riske atar (KURAL #3).

## Sporcu Etkileşimi

- **Sürükle-bırak:** Dairesel karttaki taş tahtaya sürüklenir.
- **Tıkla-tıkla:** Önce dairesel karta tıklanır (seçilir, vurgulanır), sonra tahtada bir
  kareye tıklanır — taş oraya gider. Bu, `BoardEditor`'ün palet mantığının (satır 88-121)
  sporcu sürümüdür.
- Taş doğru kareye konursa o taşın kartı listeden düşer, kalan taşlarla devam edilir.
- Taş yanlış kareye konursa **soru biter** — mevcut `failNoRetry` yolu kullanılır
  (`move_piece` tipinde zaten var).
- Tüm taşlar doğru konunca soru başarıyla biter (`succeed`).

## Backend Doğrulaması

`apps/api/chess_api/routers/admin.py`:
- `BOARD_EXERCISE_TYPES` (satır 536) demetine `"place_pieces"` eklenir. **Bu şart** —
  eklenmezse kaydetme "Geçersiz alıştırma türü" hatasıyla reddedilir.
- `_validate_board_exercises` içine yeni dal eklenir:
  - `pieces` bir liste ve en az 1 eleman olmalı
  - her eleman `{piece, square}` sözlüğü olmalı
  - `square` geçerli bir kare adı olmalı
  - **o kare FEN'de BOŞ olmalı** — doluysa soru anlamsızdır, reddedilir
  - aynı kare iki kez verilmemeli

## Kapsam Dışı

- Mevcut iki soru tipinin davranışı değişmez.
- "Taşı Tanı" (`identify_piece`) eski tipi olduğu gibi kalır.
- Bu tip için ayrı bir istatistik/raporlama eklenmez — mevcut puanlama yolunu kullanır.

## Test Planı

- **Saf mantık testleri:** 9 adımın tamamlanma durumu (`placePiecesSteps`), doğru/yanlış
  yerleştirme değerlendirmesi.
- **Backend testleri:** geçerli soru kabul edilir; boş olmayan kareye hedef verilmesi,
  tekrarlı kare, boş `pieces` listesi reddedilir.
- **Bileşen testleri:** `PlacePiecesSolver` — tıkla-tıkla ile doğru yerleştirme başarı
  verir, yanlış yerleştirme tek hakla soruyu bitirir, çok taşlı soruda sıra serbesttir.
- **Panel testi:** üçüncü tip butonu görünür, adım listesi 9 satırdır, tüm adımlar
  bitmeden "Soruyu Ekle" kilidi açılmaz.
- Tam test kapısı: `npx tsc --noEmit && npx next lint && npx vitest run` ve
  `python -m pytest -q`.
- Gerçek tarayıcı doğrulaması (KURAL #6): panelde soru oluşturma ve sporcu tarafında
  hem sürükleyerek hem tıklayarak çözme.
