# Özel Sekmeler Ana Ekranda Açılsın — Tasarım

Tarih: 2026-08-09

## Amaç

Sporcu ana sayfasındaki hızlı erişim bölümünde, Zafer hoca'nın eklediği sekmeler
(örn. "Pratik Yap") şu anda tıklanınca AYRI bir sayfaya (`/custom/[id]`) gidiyor.
Bunun yerine, yerleşik "Maç Yap" sekmesindeki gibi **ana ekranda aşağı açılsın**;
alt sekmeler orada listelensin; sporcu bir alt sekmeye tıklayınca o da aynı yerde
açılsın.

## Kararlar (kullanıcı onaylı)

1. **Kapsam:** Sadece "Pratik Yap" değil, hoca'nın eklediği **tüm sekmeler** böyle
   çalışacak.
2. **Maç ekranı:** Sporcu bir pratik alt sekmesinde maç kriterlerini seçip
   başlattığında, satranç tahtası ana ekranda DEĞİL, **tam ekran maç sayfasında**
   açılacak (Bota Karşı Oyna'daki gibi).

## Ana Ekran Davranışı

Hoca'nın eklediği sekme kutucukları artık bağlantı değil, **açılır düğme** olur —
yerleşik sekmelerle aynı akordiyon kuralına girer (aynı anda yalnızca bir sekme
açık; başka bir sekmeye tıklanınca öteki kapanır).

Bir özel sekme açıldığında altında paneli belirir:

- Sekmenin alt sekmeleri sırayla listelenir (akordiyon; aynı anda bir tanesi açık).
- Sekmenin adı tam olarak "Pratik Yap" ise, listenin en üstünde sabit
  **"Açılış Pratiği Yap"** satırı durur (mevcut davranış korunur) ve tıklanınca
  `/play?mode=opening` sayfasına gider.
- Alt sekme açıldığında içeriği:
  - **Pratik Yap sekmesinin alt sekmeleri** → Maç Kriterlerini Seç ekranı.
    Havuzda hiç konum yoksa "Henüz konum eklenmedi." yazısı görünür, kriter
    ekranı gösterilmez.
  - **Diğer sekmelerin alt sekmeleri** → yazı ve görseller (mevcut
    `/custom/[id]` sayfasındaki görünümün aynısı).

## Maç Başlatma

Pratik alt sekmesinde kriterler seçilip "Pratiğe Başla"ya basılınca maç sayfasına
gidilir:

```
/play?mode=pool&section=<altSekmeId>&skill=<düzeyNo>&tc=<tempo>&color=<renk>
```

Maç sayfası bu adresi görünce:
1. O alt sekmenin konum havuzunu sunucudan çeker,
2. Havuzdan rastgele bir konum seçer,
3. Kriter ekranını ATLAYIP doğrudan bota karşı maçı başlatır,
4. Tahtanın altında mevcut 3 kart görünür: Terk Et / Aynı Konumu Pratik Et /
   Farklı Bir Konumu Pratik Yap.

Havuz boşsa veya alt sekme bulunamazsa maç sayfasında kısa bir bilgi mesajı
gösterilir ("Bu bölümde henüz konum yok."), boş tahta açılmaz.

## Kod Yapısı

Alt sekme listesi hem ana ekranda hem `/custom/[id]` sayfasında görüneceği için,
bu görünüm **tek bir ortak bileşene** taşınır (`CustomTabPanel.tsx`); iki yer de
onu kullanır — aynı ekran iki kez yazılmaz.

`PositionPoolPractice` bileşenine, kriterlerin dışarıdan hazır geldiği durum için
opsiyonel bir alan eklenir; bu alan doluysa bileşen kriter ekranını göstermeden
doğrudan maça başlar. Alan verilmezse bileşen eskisi gibi kriter ekranıyla
başlar — mevcut kullanım bozulmaz.

`/custom/[id]` sayfası **silinmez**; artık ana ekrandan bağlantı verilmese de
adres elle açılırsa çalışmaya devam eder (eski bağlantılar kırılmasın).

## Test Kapsamı (özet)

- Ana ekran: özel sekme kutucuğuna tıklayınca sayfa DEĞİŞMEZ, panel açılır.
- Ana ekran: ikinci bir sekmeye tıklayınca ilki kapanır (akordiyon).
- Pratik Yap alt sekmesi: kriter ekranı görünür; başlatınca doğru adrese gider.
- Diğer sekmelerin alt sekmesi: yazı/görsel görünür (regresyon).
- `/custom/[id]` sayfası hâlâ çalışır (regresyon).
- Maç sayfası: `mode=pool` ile açılınca kriter ekranı atlanır, tahta gelir;
  havuz boşsa bilgi mesajı çıkar.
- Tam test kapısı + kullanıcı onayıyla canlı doğrulama.
