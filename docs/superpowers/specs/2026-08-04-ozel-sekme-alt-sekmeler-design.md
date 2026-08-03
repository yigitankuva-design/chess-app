# Özel Sekmelere Alt Sekme Ekleme + Açılış Pratiği Yap Taşınması — Tasarım

## Kapsam

Zafer hoca'nın admin panelinde eklediği "özel sekmeler" (Sekmeler sayfası, `+ Yeni Sekme Ekle`)
şu an yerleşik sekmelerden (Maç Yap/Dersler/Analiz Et/Eğlence) farklı görünüyor: numarasız, dairesel
AÇ/KAPAT butonu yok, "İçeriği düzenle" linki ayrı bir sayfaya gidiyor. Bu tasarım:

1. Özel sekmeleri yerleşik sekmelerle GÖRSEL OLARAK AYNI yapar (numaralı, dairesel AÇ/KAPAT).
2. AÇ'a basınca kartın İÇİNDE alt sekme yönetimi açar — ayrı sayfaya gitme kalkar.
3. Maç Yap'taki "Açılış Pratiği Yap" alt penceresini kaldırıp "Pratik Yap" adlı özel sekmenin
   (varsa) SABİT bir alt sekmesi yapar.
4. Sporcu tarafında aynı mantığı uygular.

## Veri Modeli

Mevcut "Bölüm" (section: title/body/images) veri modeli DEĞİŞMEZ — sadece kullanıcıya gösterilen
metin "Bölüm" yerine "Alt Sekme" olur (`customTabsApi.ts`, backend API alan adları aynı kalır).

## Admin — Sekmeler sayfası (`app/admin/settings/tabs/page.tsx`)

- Özel sekme kartları artık yerleşik kartlarla AYNI bileşenle render edilir: numaralı başlık,
  renkli çerçeve, dairesel AÇ/KAPAT butonu (`openKey` state'i özel sekme id'lerini de kapsayacak
  şekilde genişler).
- AÇ'a basılınca kart içinde:
  - Mevcut alt sekmelerin akordiyon listesi (başlığa tıkla → yazı/görselleri göster/gizle, yanında
    Sil butonu).
  - Altında kompakt "+ Alt Sekme Ekle" formu (başlık + yazı + görsel yükleme + Ekle butonu) —
    `/admin/custom-tabs/[id]` sayfasındaki mevcut formla aynı işlevi görür, karta gömülü çalışır.
- Sekmenin etiketi tam olarak **"Pratik Yap"** ise, alt sekme listesinin EN BAŞINDA silinemez/
  taşınamaz bir **"Açılış Pratiği Yap"** satırı görünür (`/admin/openings` linki, Maç Yap'taki ile
  aynı görünüm/işlev).
- `/admin/custom-tabs/[id]` sayfası artık hiçbir yerden linklenmiyor — kod tabanında bırakmak
  karışıklık yaratacağından SİLİNİR.
- `PLAY_SUBSECTIONS` dizisinden "Açılış Pratiği Yap" elemanı çıkarılır (3 alt pencere kalır).

## Sporcu tarafı

- `app/(child)/custom/[id]/page.tsx`: düz liste yerine her alt sekme akordiyon olur (başlığa
  tıkla → aç/kapa). Sekme etiketi "Pratik Yap" ise en üstte sabit "Açılış Pratiği Yap" satırı
  (Link → `/play?mode=opening`, Maç Yap'takiyle birebir aynı görünüm) görünür.
- `app/(child)/home/page.tsx`: Maç Yap "Nasıl Oynayalım?" panelinden "Açılış Pratiği Yap" satırı
  kaldırılır.

## Geriye Uyumluluk (KURAL #3)

- Mevcut "Açılış Listesi" yönetimi (`/admin/openings`) ve `/play?mode=opening` akışı
  DEĞİŞMEDEN çalışmaya devam eder — sadece giriş noktası taşınıyor.
- Zafer hoca henüz "Pratik Yap" adında bir sekme eklemediyse, "Açılış Pratiği Yap" kısayolu
  HİÇBİR YERDE görünmez (ne admin ne sporcu) — bu kabul edilebilir bir ara durumdur, kullanıcı
  onayladı (canlıya alınmadan önce Zafer hoca "Pratik Yap" sekmesini ekleyecek).
- Mevcut özel sekmeler (varsa) ve alt sekmeleri (sections) DEĞİŞMEDEN görünmeye devam eder,
  sadece sunum biçimi (akordiyon) değişir.

## Test Planı

- Admin Sekmeler sayfası: özel sekme kartının numaralı+dairesel-butonlu render edilmesi, AÇ'a
  basınca alt sekme listesi+ekleme formunun görünmesi, alt sekme eklenip silinmesi, "Pratik Yap"
  etiketli sekmede sabit "Açılış Pratiği Yap" satırının görünmesi ve diğer etiketlerde
  GÖRÜNMEMESİ, Maç Yap alt pencerelerinde artık "Açılış Pratiği Yap" olmaması.
- Sporcu `/custom/[id]` sayfası: alt sekmelerin akordiyon davranışı, "Pratik Yap" özel satırı.
- Sporcu ana sayfa: Maç Yap panelinde "Açılış Pratiği Yap" satırının kalktığının doğrulanması.
