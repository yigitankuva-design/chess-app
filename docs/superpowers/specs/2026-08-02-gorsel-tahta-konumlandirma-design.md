# Görsel Tahta Konumlandırma (image_question) — Tasarım

## Bağlam

Admin panelde Dersler/Altkonu/Yeni Soru Ekle bölümünde "Görüntü Ekle" ailesi
(`image_question` tipi, `apps/web/components/admin/ChoiceExerciseFields.tsx`)
Zafer Hoca'ya tek bir "Soru Görseli" yükleme imkânı veriyor; görsel sabit boyutta,
sabit konumda (üst-sol hizalı önizleme) gösteriliyor. Eklenen görseller genellikle
satranç tahtası üzerine yerleştirileceği (örn. bir hamleyi/kareyi işaret eden ok,
sembol, açıklama görseli) için Hoca'nın görseli **boş bir tahta üzerinde serbestçe
konumlandırabilmesi, boyutlandırabilmesi ve ton (gri tonlama) ayarlayabilmesi**
gerekiyor.

## Kapsam kararları (kullanıcıyla netleştirildi)

1. **Tek görsel.** Bir soruya yalnızca bir "Soru Görseli" eklenebilir (mevcut
   davranışla aynı) — birden fazla görsel yerleştirme YOK.
2. **Otomatik akış.** Görsel seçilir seçilmez (dosyadan/havuzdan/yapıştırarak),
   altında konumlandırma tahtası otomatik belirir; görsel tahtanın ortasına
   varsayılan boyut ve ton=0 ile düşer.
3. **Ton = gri tonlama yoğunluğu.** 0 = orijinal renkler, 10 = tam gri
   (`grayscale` filtresi, hue-rotate DEĞİL).
4. **Serbest sürükle-bırak.** Görsel kareye kilitlenmez; herhangi bir konuma
   sürüklenebilir ve köşeden serbestçe büyütülüp küçültülebilir (kare sınırına
   bağlı değil).
5. **Yeni "Talimat" alanı.** Mevcut "Açıklama (opsiyonel)" kutusunun YERİNE
   geçer: adı "Talimat" olur, **zorunlu hale gelir** (soru metni olarak
   kullanılır — `instruction` alanına yazılır). Ayrı ikinci bir metin kutusu
   eklenmez.
6. **Tahtanın sporcuya gösterilmesi Hoca'nın kararı.** Her soruda ayrı ayrı
   seçilebilir: bazı sorularda sporcu tahtayı da görür (görsel tahtanın
   üzerinde durur), bazılarında yalnızca görseli görür (tahta sadece Hoca'nın
   yerleştirme aracıdır). Admin editörde bir açık/kapalı anahtarı,
   `image_show_board` alanı olarak kaydedilir. Varsayılan: **açık**.

## Mevcut kodda bulunan tutarsızlık (bu iş kapsamında düzeltilir)

`lib/admin/questionSteps.ts:38`'deki `choiceSteps` "Talimatı Gir" adımını
**zaten her iki soru tipi için de zorunlu** tutuyor ve tamamlanmadıkça "Soruyu
ekle" butonunu kilitliyor. Ancak `ChoiceExerciseFields.tsx:252`'deki input'un
etiketi `"Açıklama (opsiyonel)"` diyor. Zafer Hoca "opsiyonel" yazan kutuyu boş
bırakıyor, buton kilitli kalıyor ve sebebini göremiyor. Kapsam kararı 5 bu
tutarsızlığı ortadan kaldırır — `questionSteps.ts` DEĞİŞMEZ, yalnızca etiket ve
zorunluluk bilgisi doğrusuyla değiştirilir.

## Mimari

### Yeni bileşen: `apps/web/components/admin/ImagePlacer.tsx`

- Saf sunum bileşeni: `{ uri, x, y, w, h, tone, showBoard, onChange }` prop'ları
  alır (`x,y` = görselin merkezi, `w,h` = boyutu — hepsi tahta genişliğinin/
  yüksekliğinin YÜZDESİ olarak, 0-100). `showBoard` yalnızca sporcu ekranındaki
  görünümü belirler; editörde tahta Hoca'ya **her zaman** gösterilir (yerleştirme
  referansı olmadan sürüklemek anlamsız olurdu).
- 8×8 dama deseni arka plan — `lib/chess/boardSkin.ts`'teki `getBoardColors`
  ile mevcut tahta renk temasıyla tutarlı; gerçek `react-chessboard`/`chess.js`
  kullanılmaz (taş yok, sadece görsel referans ızgarası — YAGNI).
- Bu dama deseni, admin editörü ile sporcu ekranının **aynı** görüntüyü vermesi
  için ayrı ve küçük bir `components/chess/EmptyBoardGrid.tsx` bileşenine
  çıkarılır; hem `ImagePlacer` hem `ChoiceQuestionBody` onu kullanır. Böylece
  Hoca'nın editörde gördüğü yerleşim, sporcunun gördüğüyle birebir eşleşir.
- `<img>` mutlak konumlu (`position: absolute`, `left/top` = x/y%,
  `width/height` = w/h%, `transform: translate(-50%,-50%)`).
- Sürükleme: pointer event'leriyle (`onPointerDown/Move/Up`) serbest hareket.
- Boyutlandırma: sağ-alt köşede küçük bir tutamaç; sürüklendiğinde w/h değişir
  (min/max sınır: örn. %5–%90).
- Ton slider'ı (0-10, `<input type="range">`) — `filter: grayscale(tone/10)`
  doğrudan `<img>` üzerine uygulanır.
- Test edilebilirlik için saf mantık (`clampPlacement`, sürükleme/boyutlandırma
  hesaplama fonksiyonları) ayrı bir `lib/admin/imagePlacement.ts` dosyasında,
  React'tan bağımsız — vitest ile doğrudan test edilir.

### Veri modeli — geriye uyumlu opsiyonel alanlar

`BoardExercise` tipine (`ExerciseForm.tsx`) ve backend şemasına
(`chess_api/routers/admin.py`) 6 yeni **opsiyonel** alan:

```
image_x?: number          // 0-100, merkez X yüzdesi
image_y?: number          // 0-100, merkez Y yüzdesi
image_w?: number          // 5-90, genişlik yüzdesi
image_h?: number          // 5-90, yükseklik yüzdesi
image_tone?: number       // 0-10 tam sayı, gri tonlama
image_show_board?: boolean // sporcu tahtayı da görsün mü (varsayılan true)
```

Bu alanlar `undefined` olduğunda (mevcut ~tüm eski `image_question` soruları):
görsel **eskisi gibi**, `ChoiceQuestionBody`'nin bugünkü düz `<img>` görünümüyle
(maxWidth 340, ortalanmış, tahtasız) render edilir. Yani eski sorular yeni tahta
görünümüne GEÇMEZ — davranış birebir korunur. **Hiçbir eski soru bozulmaz**
(KURAL #3) — migration gerekmez, çünkü içerik zaten JSON alanında saklanıyor
(`_validate_choice_exercise`, admin.py:551, gevşek dict doğrulaması).

Backend `_validate_choice_exercise` içine sayı aralığı kontrolü eklenir
(alanlar varsa 0-100/0-10 aralığında olmalı; yoksa hata verilmez — opsiyonel).

### Değişen mevcut dosyalar

- `ChoiceExerciseFields.tsx`: "Soru Görseli" seçildiğinde altına `ImagePlacer`
  ve "Sporcu tahtayı da görsün" anahtarı render edilir; "Açıklama (opsiyonel)"
  input'unun etiketi zorunlu "Talimat" olur (aynı `instruction` state'i, sadece
  placeholder değişir — adım kilidi zaten mevcut, bkz. yukarıdaki tutarsızlık
  bölümü). `validate()`'e `image_question` için de boş talimat kontrolü eklenir
  (ikinci savunma hattı).
- `lib/admin/questionSteps.ts`: **DEĞİŞMEZ** — "Talimatı Gir" adımı zaten her iki
  tip için de zorunlu (satır 38).
- `components/lesson-steps/ChoiceQuestionBody.tsx` (sporcunun gördüğü ekran):
  yerleşim alanları varsa görseli `image_x/y/w/h/tone`'a göre konumlandırılmış
  render eder; `image_show_board` true ise arkasında boş tahta deseni de çizilir.
  Alanlar yoksa bugünkü düz `<img>` görünümü aynen korunur.
- `components/lesson-steps/BoardExercise.tsx`: `ImageQuestionEx` tipine 6 yeni
  opsiyonel alan eklenir.
- `components/admin/ExerciseForm.tsx`: `BoardExercise` tipine aynı 6 alan; kayıt
  gövdesine (`submit`) yazılır.

## Test planı

- `lib/admin/imagePlacement.ts` için saf mantık testleri: clamp sınırları,
  sürükleme delta hesaplama, varsayılan değerler.
- `ImagePlacer.tsx` için: varsayılan render, sürükleme sonrası `onChange`
  çağrısı, ton slider'ının filter değerini değiştirmesi.
- `ChoiceExerciseFields.tsx`: Talimat boşken kaydet butonu kilitli, doldurunca
  açılıyor (mevcut `choiceSteps`/`StepList` desenine uygun); "Sporcu tahtayı
  görsün" anahtarının kayıt gövdesine yansıması.
- `ChoiceQuestionBody.tsx`: `image_x/y/w/h/tone` verilince doğru stil
  uygulanıyor; `image_show_board` true iken tahta çiziliyor, false iken
  çizilmiyor; alanlar HİÇ verilmeyince bugünkü düz `<img>` görünümü birebir
  korunuyor (KURAL #3 regresyon testi).
- Backend: `_validate_choice_exercise` yeni alan aralık testleri
  (`test_board_exercises.py`).
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api).
- Canlı doğrulama (KURAL #6): admin panelde gerçek bir `image_question` sorusu
  oluşturup görseli sürükleyip/boyutlandırıp/tonlayıp kaydetme + sporcu
  tarafında (`/pratik` veya ders akışında) doğru konumda göründüğünü tarayıcı
  araçlarıyla gözlemleyerek doğrulama.
