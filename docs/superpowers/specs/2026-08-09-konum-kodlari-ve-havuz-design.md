# Konum Kodları ve Konum Havuzu Görünümü — Tasarım

Tarih: 2026-08-09

## Amaç

Pratik konumlarına, Süresiz Pratik sorularındaki gibi **kalıcı kod numarası** verilsin;
havuz bu kodlarla dairesel kartlar halinde gösterilsin ve hoca bir konumu tıklayıp
düzeltebilsin.

Bu, 5 maddelik isteğin **3. maddesidir**. Sıra: 1 ✅ → 4 ✅ → 5 ✅ → **3** → 2.

## Kararlar (kullanıcı onaylı)

1. Kod, sporcu tarafında **maç ekranının başlığında** görünür (örn. "🎯 Kale Finalleri · 003").
2. Havuzdaki bir kod kartına tıklanınca **o konum düzenlemeye açılır**; hoca taşları
   düzeltip yeniden kaydeder veya siler.

## Kod Sistemi

Kodlar 3 hanelidir ("001", "002", …) ve projede zaten kullanılan kod mantığı
(`lib/exerciseCodes.ts`) yeniden kullanılır — ikinci bir numaralandırma yazılmaz.

Kod, konum **kaydedilirken kalıcı olarak yazılır**. Daha önce eklenmiş (kodsuz)
konumlar için ekranda sıralarına göre tutarlı bir kod üretilir; kayıtlı kodlarla
asla çakışmaz. Böylece eski veriye dokunmadan (KURAL #3) her konumun bir numarası
olur.

**Kodun kapsamı:** Kodlar her alt sekme (ve Oyunsonu'nda her kategori) içinde
kendi başına 001'den başlar. Yani "Kale Finalleri 003" ile "Piyon Finalleri 003"
farklı konumlardır — sporcuya kod, kategori adıyla birlikte gösterildiği için
karışıklık olmaz.

## Havuz Görünümü

"Konum Havuzu" artık düz bir başlık değil, **dikdörtgen bir karttır**. Kartın
üzerinde havuzdaki konum sayısı yazar. Karta tıklanınca havuz açılır ve içinde
**dairesel kod kartları** görünür:

- Kartlar yatay sıralanır: ilk satırda 1-12, ikinci satırda 13-24, sonrakiler aynı
  şekilde devam eder.
- Bir koda tıklanınca o konum **düzenleme kipinde** açılır: tahta o konumla dolu
  gelir, hamle sırası seçilidir; hoca değişiklik yapıp **"Değişikliği Kaydet"**
  diyebilir, **"Vazgeç"** ile çıkabilir veya **"Sil"** ile konumu kaldırabilir.
- Düzenleme kaydedilince konumun **kodu değişmez** — sporcunun bildiği numara sabit
  kalır.

Bu görünüm hem "Kazanç Konumunu Pratik Yap"ta hem "Oyunsonu Pratiği Yap"ın 5
kategorisinde aynıdır (tek bileşen, iki yerde kullanılır).

## Sporcu Tarafı

Konum havuzuyla oynanan maç ekranının başlığında, alt sekme adının yanında kod
görünür: **"🎯 Kale Finalleri · 003"**. "Farklı Bir Konumu Pratik Yap" ile yeni
konuma geçilince başlıktaki kod da güncellenir.

Sporcuya kod **listesi** gösterilmez; konum yine rastgele gelir (kullanıcı kararı).

## Veri

Havuzdaki her konuma isteğe bağlı bir `code` alanı eklenir:

```
{ id, fen, category?, code? }
```

Sunucu tarafının bu alanı kabul etmesi gerekir — aksi halde kaydedilen kod
kaybolur. Alan boş bırakılabilir (eski kayıtlar).

## Test Kapsamı

- Kod atama: kayıtlı kodlar korunur, kodsuzlara boşta olan en küçük numara verilir,
  çakışma olmaz (mevcut `exerciseCodes` testleri bu mantığı zaten kapsıyor; havuza
  uygulanışı ayrıca test edilir).
- Havuz kartı: kapalıyken kodlar görünmez, tıklanınca açılır.
- Kod kartları 12'lik satırlar halinde dizilir.
- Bir koda tıklayınca düzenleme açılır; kaydedince FEN değişir, **kod değişmez**.
- Düzenlemede Sil çalışır; Vazgeç değişikliği kaydetmez.
- Sporcu: maç başlığında kategori ve kod görünür; farklı konuma geçince kod değişir.
- Backend: `code` alanı kabul edilir ve geri döner.
- Regresyon: kodsuz eski konumlar bozulmaz.
- Tam test kapısı + canlı doğrulama.
