# Konum Ekleme — "FEN Ekle" Seçeneği — Tasarım

Tarih: 2026-08-09

## Amaç

Zafer hoca şu an konum eklerken sadece taşları tahtaya elle dizebiliyor. Bu yavaş.
Başka bir satranç uygulamasından beğendiği bir konumun FEN'ini kopyalayıp
yapıştırarak da ekleyebilsin.

Bu, 5 maddelik isteğin **4. maddesidir**. Sıra: 1 ✅ → **4** → 5 → 3 → 2.

## Akış

Hoca bir pratik alt sekmesini açtığında, konum ekleme alanının en üstünde **2 kart**
görür:

| Kart | Ne yapar |
|---|---|
| 🧩 Konum Dizerek Ekle | Bugünkü tahta editörü açılır — taşlar elle dizilir |
| 📋 FEN Ekle | Bir yapıştırma kutusu açılır |

Bir kart seçilince o alanın içeriği görünür; hoca diğer karta tıklayarak istediği
zaman yöntem değiştirebilir. Varsayılan olarak **hiçbiri seçili değildir** —
iki kart yan yana durur, hoca hangisini isterse ona basar.

### FEN Ekle alanı

1. Hoca FEN'i yapıştırır.
2. FEN **anında kontrol edilir**:
   - Geçerliyse: altında konumun küçük bir **tahta önizlemesi** çıkar ve hamle
     sırası FEN'in içinden **otomatik seçili** gelir (hoca isterse değiştirir).
   - Geçersizse: "Bu FEN geçerli değil" uyarısı çıkar, önizleme gösterilmez ve
     **"Konumu Kaydet" düğmesi çalışmaz**. Bozuk konum havuza girmez.
3. Kaydedince konum, elle dizilenlerle **aynı havuza** aynı biçimde eklenir —
   sporcu tarafı için ikisi arasında hiçbir fark yoktur.

Kaydettikten sonra yapıştırma kutusu temizlenir, hoca peş peşe konum ekleyebilir.

## Kod Yapısı

FEN'in geçerliliğini ve içindeki hamle sırasını okuyan mantık, ekran kodundan ayrı
saf bir dosyaya konur (`apps/web/lib/chess/fenInput.ts`) — böylece tek başına
test edilebilir. Kontrol için projede zaten kullanılan satranç kütüphanesi
(chess.js) kullanılır; ayrı bir kural yazılmaz.

Ekran tarafında `PositionPoolFields` iki kartlı bir seçim kabuğuna dönüşür; elle
dizme dalı **aynen korunur** (bugünkü davranış bozulmaz), yanına FEN dalı eklenir.

## Test Kapsamı

- Geçerli FEN tanınır; hamle sırası doğru okunur (beyaz ve siyah için ayrı ayrı).
- Geçersiz/boş/eksik FEN reddedilir.
- Ekran: iki kart görünür; birine basınca ilgili alan açılır.
- Ekran: geçersiz FEN'de uyarı çıkar ve kaydet düğmesi pasif kalır.
- Ekran: geçerli FEN kaydedilince havuza eklenir ve kutu temizlenir.
- Regresyon: elle dizerek ekleme eskisi gibi çalışır.
- Tam test kapısı + canlı doğrulama.
