# Oyunsonu Pratiği Yap — 5 Kategori — Tasarım

Tarih: 2026-08-09

## Amaç

Zafer hoca admin panelinde "Oyunsonu Pratiği Yap" alt sekmesine girdiğinde, konumları
doğrudan tek bir yığına eklemek yerine **5 açılır kart** görsün ve konumları bu
kategorilere ayırarak eklesin:

1. Piyon Finalleri
2. Kale Finalleri
3. Hafif Taşlar Arası Mücadele
4. Ağır Taşlar Arası Mücadele
5. Ağır Taşlar ile Hafif Taşlar Arası Mücadele

Bu, 5 maddelik isteğin **5. maddesidir**. Sıra: 1 ✅ → 4 ✅ → **5** → 3 → 2.

## Karar (kullanıcı onaylı)

Kategoriler **yalnızca hoca'nın düzeni içindir**. Sporcu tarafında kategori seçimi
YOKTUR — Oyunsonu Pratiği'ne giren sporcuya bütün oyunsonu konumları arasından
rastgele gelir. (İstek zaten sadece admin tarafını kapsıyordu.)

## Nasıl Çalışır

Hoca "Oyunsonu Pratiği Yap" alt sekmesini açtığında, konum ekleme alanı yerine
**5 kart** görür. Bir karta tıklayınca o kartın içi açılır ve bugünkü konum ekleme
alanı (Konum Dizerek Ekle / FEN Ekle + o kategorinin havuzu) gelir. Aynı anda tek
kart açıktır.

Her kartın başlığında o kategoride kaç konum olduğu görünür — hoca dağılımı bir
bakışta görür.

### Veri

Havuzdaki her konuma bir **kategori etiketi** eklenir. Kayıt biçimi:

```
{ id, fen, category? }
```

`category` **isteğe bağlıdır**: bugüne kadar eklenmiş konumlarda bu alan yoktur ve
olmamaya devam eder (KURAL #3 — mevcut veri bozulmaz). Kategorisi olmayan oyunsonu
konumları ekranda **"Piyon Finalleri"ne değil**, ayrı bir "Kategorisiz" grubunda
gösterilir; hoca isterse oradan yönetir. Sporcu tarafı zaten hepsini karışık
kullandığı için etkilenmez.

"Kazanç Konumunu Pratik Yap" sekmesi **değişmez** — orada kategori yoktur, konumlar
bugünkü gibi tek havuzda durur.

### Backend

Sunucu tarafındaki konum doğrulaması şu an yalnızca `id` ve `fen` alanlarını tanıyor;
fazlası sessizce siliniyor. Bu yüzden `category` alanının **kabul edilmesi** gerekiyor
— aksi halde seçilen kategori kaydedilmez. Alan boş bırakılabilir olacak.

## Kod Yapısı

5 kategori adı ve sıralaması, "Pratik Yap" sabitlerinin durduğu ortak dosyaya
(`pratikYap.ts`) eklenir — liste iki yerde yazılmaz.

Kategori kartlarını çizen ve seçili kategoriyi tutan kabuk, `PositionPoolFields`'ın
**dışına** yeni bir bileşen olarak konur (`CategorizedPositionPool.tsx`);
`PositionPoolFields` olduğu gibi kalır ve her kategori için yeniden kullanılır.
Böylece Kazanç sekmesi (kategorisiz) ile Oyunsonu sekmesi (kategorili) aynı
konum-ekleme kodunu paylaşır.

## Test Kapsamı

- Kategori listesi ve sırası doğrudur.
- Konumları kategoriye göre gruplama; kategorisiz olanlar ayrı grupta.
- Ekran: 5 kart görünür, tıklanınca içerik açılır, tek kart açık kalır.
- Ekran: her kartın başlığında o kategorideki konum sayısı görünür.
- Ekran: bir kategoride kaydedilen konum o kategoriyle kaydedilir.
- Backend: `category` alanı kabul edilir ve geri döner; alansız kayıt da çalışır.
- Regresyon: Kazanç sekmesi kategorisiz çalışmaya devam eder.
- Tam test kapısı + canlı doğrulama.
