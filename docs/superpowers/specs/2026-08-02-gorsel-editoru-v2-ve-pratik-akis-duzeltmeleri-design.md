# Görsel Editörü v2 (Çoklu Görsel/Vektör/Şeffaflık) ve Pratik Akış Düzeltmeleri — Tasarım

## Bağlam

Zafer Hoca'dan admin görsel editörü ve sporcu pratik akışıyla ilgili 7 maddelik bir
iş listesi geldi. Üç maddesi (2, 6, 7) hata bildirimi, dördü (1, 3, 4, 5) özellik
isteği. Kod okunarak kök nedenler doğrulandı (KURAL #1); belirsiz noktalar
kullanıcıyla netleştirildi.

## Madde 1 — Ton kaydırıcısı anlık güncelleme

**Bulgu:** Mevcut kod (`ImagePlacer.tsx`) zaten anlık güncelliyor — kaydırıcı
hareket ettikçe `placement.tone` state'i değişiyor, görselin `filter` stili
doğrudan bu state'ten okunuyor, hiçbir gecikme/debounce yok.

**Karar:** Kod değişikliği yapılmayacak. Canlı doğrulama adımında (KURAL #6)
tarayıcıda bizzat test edilip teyit edilecek; gerçekten bir gecikme bulunursa
o an düzeltilecek.

## Madde 2 — "Adımlar tamam ama soru eklenmiyor"

**Bulgu:** `ChoiceExerciseFields.tsx`'in adım/doğrulama mantığı (gateOpen,
validate) tutarlı — kod okumasında ayrı bir hata bulunamadı. Bu sabah düzeltilen
"sekmeler arası token çakışması" hatasıyla (commit `a27432f`) aynı belirti:
tamamlanmış adımlarla kayıt denemesi sessizce 401 ile başarısız oluyordu.

**Karar:** Kod değişikliği yapılmayacak. Canlı doğrulamada gerçek bir soru
eklenmeye çalışılıp teyit edilecek. Hâlâ başarısızsa o an ayrı bir kök neden
aranıp düzeltilecek.

## Madde 3 — Çoklu görsel

**Önceki karar tersine döndü:** 2026-08-02 sabahki spec'te "tek görsel" kararı
verilmişti; kullanıcı bu iş kapsamında fikrini değiştirdi, çoklu görsele geçildi.

### Veri modeli

`ImageQuestionEx` / `BoardExercise` tiplerine yeni bir dizi alanı:

```ts
prompt_images?: { uri: string; x: number; y: number; w: number; h: number; tone: number }[]
```

Mevcut `prompt_image` (tekil string) ve düz `image_x/y/w/h/tone` alanları
**DOKUNULMADAN** kalır — eski sorular hiçbir zaman `prompt_images`'e geçmez,
render mantığı eskisi gibi çalışmaya devam eder (KURAL #3). Yeni sorular
`prompt_images` dizisini kullanır. Bir soruda ikisi asla birlikte olmaz.
`image_show_board` tek anahtar olarak kalır (tahta gösterimi soru bazında).

Dizi uzunluğu makul bir üst sınırla korunur (20 görsel/soru) — kötüye kullanımı
önler, pratikte Zafer Hoca'yı kısıtlamaz.

### Admin editörü (`ImagePlacer.tsx`, `ChoiceExerciseFields.tsx`, `PoolPicker.tsx`)

- **Havuzdan Seç** çoklu-seçim moduna geçer: her küçük resimde onay kutusu;
  seçilenler kategori değiştirilince silinmeyen bir "sepet"te toplanır (hayvanlardan
  seç, bitkilere geç, oradan da seç — ikisi de sepette kalır); "Seçilenleri Ekle"
  butonuyla hepsi tahtaya eklenir.
- **Bilgisayardan Seç** çoklu dosya seçimine izin verir (`<input multiple>`).
- Tahtaya eklenen her görsel, üst üste binmesin diye biraz kaydırılmış varsayılan
  konumda başlar; her biri ayrı ayrı tıklanıp seçilip sürüklenip boyutlandırılabilir.
  Seçili görselin altında kendi "Sil" butonu ve ton kaydırıcısı görünür.

### Backend

Aralık kontrolü artık dizinin her elemanına ayrı ayrı uygulanır (aynı
0-100/0-10 kuralları); 400KB/görsel boyut sınırı her eleman için ayrı geçerli.

## Madde 4 ve 5 — Vektörleştirme ve şeffaflık

**Madde 5 (şeffaflık):** İstemci tarafında (tarayıcıda, sunucu gerekmeden) bir
canvas işlemiyle, görselin kenarlarından başlayarak beyaza yakın piksellerin
şeffaf yapılması. Yeni `lib/imageTransparency.ts` (saf mantık, `imageCompress.ts`
deseninde).

**Madde 4 (gerçek vektör):** Tarayıcıda çalışan hazır bir JS izleme (trace)
kütüphanesi (`imagetracerjs`) ile yüklenen JPG/PNG otomatik SVG çizgilerine
çevrilir — sunucu tarafına hiçbir şey eklenmez. Sonuç bir SVG `data:` URI'sidir;
sistemin geri kalanı için sıradan bir görsel gibi davranır (aynı `uri` alanına
yazılır, ImagePlacer'da aynen render edilir) — yeni bir veri tipi gerekmez.

**Akış:** Bir görsel eklendikten sonra yanında iki bağımsız, opsiyonel buton:
**"Şeffaf Yap"** ve **"Vektöre Çevir"**. Sırası veya kullanımı zorunlu değil.

**Bilinen sınır:** Gerçek SVG trace, karmaşık/fotoğrafik görsellerde detay
kaybıyla basit çizgi-tabanlı bir sonuç üretir — bu aracın doğasıdır, hata değil.
Basit ikon/çizim tarzı görsellerde (havuzdaki hayvan/bitki ikonları) iyi çalışır.

## Madde 6 — Yanlış cevap akışı düzeltmesi

**Kök neden:** `BoardExercise.tsx`'teki `fail()` fonksiyonu, "tekrar deneme yok"
modunda kilit ve "Sonraki Soruya Geç" butonunu gösteriyor AMA aynı zamanda
koşulsuz olarak 1.8 saniye sonra ekranı sıfırlayan bir zamanlayıcı çalıştırıyor
— kart/buton bu yüzden birkaç saniye içinde kendiliğinden kayboluyor. Board
kilitli kalsa da (`failLocked`), bu bilgi yalnızca tarayıcının anlık hafızasında
tutuluyor; sayfa yenilenince kaybolduğu için soru sıfırdan çözülebiliyor hale
geliyor.

**Üç değişiklik:**

1. `fail()`, "tekrar deneme yok" modundayken artık otomatik kapanma
   zamanlayıcısını çalıştırmayacak — kart ve buton, sporcu "Sonraki Soruya
   Geç"e basana kadar ekranda kalacak.
2. "Yanlış cevaptan sonra tekrar deneme yok" kuralı şu an sadece Süresiz
   Pratik'te aktif; Süreli Pratik ve Kendini Test Et'e de uygulanacak — üçünde
   de aynı kural geçerli olacak.
3. Sporcu "kırmızı uyarı + Sonraki Soruya Geç" ekranındayken sayfayı yenilerse,
   sistem bu bilgiyi de hatırlayacak (hangi soruda kalındığı bilgisiyle birlikte
   kaydedilecek) — sayfa yenilense bile sporcu aynı kilitli ekranla karşılaşacak,
   tekrar deneyemeyecek.

## Madde 7 — "Son soru" hatası

**Kök neden:** Sporcu 20 soruyu bitirdiğinde (`onFinish` tetiklendiğinde),
sistem bu setin kaydını silmiyor — sadece "Tekrar Dene" butonuna basılırsa
siliniyor. Sonuç ekranından ayrılıp (Tekrar Dene'ye basmadan) sonra tekrar
girilirse, eski (bitmiş) set geri yükleniyor ve sporcu doğrudan onun SON
sorusuyla karşılaşıyor.

**Düzeltme:** Sporcu 20 soruyu bitirdiği anda, o setin kaydı da otomatik
silinecek — "Tekrar Dene"ye basılmış gibi. Bir dahaki girişte her zaman taze
bir 20 soruluk set hazırlanacak.

**Değişmeyen kural (onaylandı):** Sporcu seti bitirmeden başka sayfaya gidip
geri dönerse, kaldığı sorudan devam edecek — bu davranış korunuyor, sadece
"bitmiş halde son soruda takılı kalma" durumu düzeliyor.

## Test planı

- Madde 3: yeni saf mantık (çoklu yerleşim hesaplamaları) vitest ile; admin
  bileşenleri (çoklu seçim, sepet, sil) RTL ile; backend dizi doğrulaması pytest
  ile; sporcu ekranında `prompt_images` varsa çoklu render, yoksa eski `prompt_image`
  render'ının birebir korunduğu regresyon testi.
- Madde 4/5: `imageTransparency.ts` ve trace entegrasyonu için saf mantık testleri
  (mümkün olduğunca — canvas/kütüphane çağrıları mock'lanarak).
- Madde 6: `fail()` davranış testleri (zamanlayıcı çalışmıyor, kart kalıcı);
  `noRetry` üç modda da doğrulanır; F5 sonrası kilitli durumun geri yüklendiği
  regresyon testi.
- Madde 7: `handleFinish` sonrası `clearSession` çağrıldığı testi; "bitmemiş
  oturum devam eder" davranışının regresyon testiyle korunduğu doğrulanır.
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api, madde 3 backend değişikliği için).
- Canlı doğrulama (KURAL #6): madde 1 ve 2 için gerçek tarayıcı testi (kod
  değişikliği beklenmeden doğrudan); madde 3-7 için gerçek admin panelinde
  çoklu görsel ekleme + vektörleştirme/şeffaflık + sporcu tarafında yanlış
  cevap/F5/bitirme senaryoları.

## Geriye uyumluluk (KURAL #3)

- Eski `image_question` soruları (`prompt_image` tekil) hiçbir zaman
  `prompt_images` dizisine geçmez — render davranışı birebir korunur.
- `noRetry`'nin üç moda genişletilmesi (madde 6.2) bilinçli bir davranış
  değişikliği — kullanıcı bunu açıkça onayladı.
- Madde 7'nin `clearSession` değişikliği yalnızca *bitmiş* oturumları etkiler;
  yarıda kalan oturumların "kaldığı yerden devam" davranışı değişmiyor.
