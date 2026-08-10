# Pratik Yap — 3 Sabit Alt Sekme — Tasarım

Tarih: 2026-08-09

## Amaç

Admin panelinde "Pratik Yap" sekmesinin altında her zaman aynı 3 alt sekme dursun,
hepsi kart içinde ve adının başında ikonla görünsün:

| Sıra | İkon | Ad | Davranış |
|---|---|---|---|
| 1 | 📖 | Açılış Pratiği Yap | Açılış listesi sayfasına gider (bugünkü gibi) |
| 2 | 🏆 | Kazanç Konumunu Pratik Yap | Normal alt sekme — içine konum eklenir |
| 3 | 🏁 | Oyunsonu Pratiği Yap | Normal alt sekme — içine konum eklenir |

Bu, 5 maddelik isteğin **1. maddesidir**. Sıra: 1 → 4 → 5 → 3 → 2 (kullanıcı kararı).

## Kararlar (kullanıcı onaylı)

1. Hoca'nın daha önce eklediği alt sekmeler **SİLİNMEZ** — 3 sabit sekmenin altında
   kalırlar, içlerindeki konumlar korunur (KURAL #3).
2. Hoca 3 sabitin yanına **kendi alt sekmesini eklemeye devam edebilir**;
   "+ Alt Sekme Ekle" kutusu kalır.
3. "Açılış Pratiği Yap" bu maddede **davranış olarak değişmez** — sadece görünümü
   (kart + ikon) diğer ikisiyle aynı olur. Asıl yeniden yapımı 2. maddede.

## Nasıl Çalışır

"Kazanç Konumunu Pratik Yap" ve "Oyunsonu Pratiği Yap" gerçek birer alt sekmedir —
bugünkü alt sekmelerle aynı yapıyı kullanırlar, dolayısıyla konum havuzu, kaydetme ve
sporcu tarafı **hiç değişmeden** çalışır.

Bu iki alt sekme yoksa, hoca "Pratik Yap" sekmesini ilk açtığında **kendiliğinden
oluşturulur**. Adlarına göre kontrol edilir, yani iki kez oluşmaz.

"Açılış Pratiği Yap" bir alt sekme değil, bugünkü gibi sabit bir bağlantı satırıdır —
sadece artık diğer ikisiyle aynı kart/ikon görünümünde.

### Sabitlik

Bu 3 sekmenin adı **değiştirilemez** ve **silinemez** — sabit kalmaları gerekiyor.
Pratikte: bu iki alt sekmenin satırında "Düzenle" ve "Sil" düğmeleri çizilmez.
Hoca'nın kendi eklediği sekmelerde bu düğmeler aynen kalır.

### Sıralama

Ekranda önce 3 sabit sekme (yukarıdaki sırayla), sonra hoca'nın kendi sekmeleri
görünür. Bu yalnızca **görüntüleme sırasıdır** — kayıtlı sıra bilgisine dokunulmaz,
veri taşıma (migration) gerekmez.

### Sporcu Tarafı

Sporcu ana ekranındaki Pratik Yap panelinde de aynı sıra ve aynı ikonlar geçerlidir.
İki yeni alt sekme oradaki listede kendiliğinden görünür (alt sekme oldukları için).

## Kod Yapısı

Admin ve sporcu tarafının aynı listeyi/sırayı/ikonları kullanabilmesi için tek bir
ortak dosya: `apps/web/lib/customTabs/pratikYap.ts`. İçinde sabit adlar, ikonlar,
sıralama ve "bu sekme sabit mi?" kontrolü durur. Her iki ekran da buradan okur —
liste iki yerde ayrı ayrı yazılmaz.

## Test Kapsamı

- Sıralama: 3 sabit önce, hoca'nınkiler sonra; eksik sabitler listede olmasa da
  sıralama bozulmaz.
- "Bu sekme sabit mi?" kontrolü doğru cevap verir.
- Admin: Pratik Yap açılınca eksik iki sabit sekme oluşturulur; zaten varsa
  **ikinci kez oluşturulmaz**.
- Admin: sabit sekmelerde Düzenle/Sil düğmesi YOK, hoca'nınkilerde VAR.
- Sporcu: 3 sabit sekme ikonlarıyla ve doğru sırada görünür.
- Regresyon: hoca'nın eklediği sekmeler ve içerikleri kaybolmaz.
- Tam test kapısı + canlı doğrulama.
