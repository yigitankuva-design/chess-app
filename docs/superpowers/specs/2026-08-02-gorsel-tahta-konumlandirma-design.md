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

## Mimari

### Yeni bileşen: `apps/web/components/admin/ImagePlacer.tsx`

- Saf sunum bileşeni: `{ uri, x, y, w, h, tone, onChange }` prop'ları alır
  (`x,y` = görselin merkezi, `w,h` = boyutu — hepsi tahta genişliğinin/
  yüksekliğinin YÜZDESİ olarak, 0-100).
- 8×8 dama deseni arka plan — `lib/chess/boardSkin.ts`'teki `getBoardColors`
  ile mevcut tahta renk temasıyla tutarlı; gerçek `react-chessboard`/`chess.js`
  kullanılmaz (taş yok, sadece görsel referans ızgarası — YAGNI).
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
(`chess_api/routers/admin.py`) 5 yeni **opsiyonel** alan:

```
image_x?: number    // 0-100, merkez X yüzdesi
image_y?: number    // 0-100, merkez Y yüzdesi
image_w?: number     // 5-90, genişlik yüzdesi
image_h?: number     // 5-90, yükseklik yüzdesi
image_tone?: number  // 0-10 tam sayı, gri tonlama
```

Bu alanlar `undefined` olduğunda (mevcut ~tüm eski `image_question` soruları):
görsel eskisi gibi ortalanmış, sabit varsayılan boyutta (örn. %40×%40), ton=0
render edilir. **Hiçbir eski soru bozulmaz** (KURAL #3) — migration gerekmez,
çünkü içerik zaten JSON alanında saklanıyor (`_validate_choice_exercise`,
admin.py:551, loose dict validation).

Backend `_validate_choice_exercise` içine sayı aralığı kontrolü eklenir
(alanlar varsa 0-100/0-10 aralığında olmalı; yoksa hata verilmez — opsiyonel).

### Değişen mevcut dosyalar

- `ChoiceExerciseFields.tsx`: "Soru Görseli" seçildiğinde altına `ImagePlacer`
  render edilir; "Açıklama (opsiyonel)" input'u kaldırılıp yerine zorunlu
  "Talimat" input'u gelir (aynı `instruction` state'i, sadece placeholder/
  zorunluluk değişir — `validate()` fonksiyonunda `image_question` için de
  boş kontrolü eklenir).
- `lib/admin/questionSteps.ts` (`choiceSteps`): "Talimat" adımı image_question
  için de zorunlu adım listesine eklenir (şu an sadece sentence_question'da
  zorunlu).
- `components/lesson-steps/ChoiceQuestionBody.tsx` (sporcunun gördüğü ekran):
  `prompt_image`'ı artık `image_x/y/w/h/tone` alanlarına göre konumlandırılmış
  render eder; alanlar yoksa eski ortalanmış görünüme düşer.

## Test planı

- `lib/admin/imagePlacement.ts` için saf mantık testleri: clamp sınırları,
  sürükleme delta hesaplama, varsayılan değerler.
- `ImagePlacer.tsx` için: varsayılan render, sürükleme sonrası `onChange`
  çağrısı, ton slider'ının filter değerini değiştirmesi.
- `ChoiceExerciseFields.tsx`: Talimat boşken kaydet butonu kilitli, doldurunca
  açılıyor (mevcut `choiceSteps`/`StepList` desenine uygun).
- `ChoiceQuestionBody.tsx`: `image_x/y/w/h/tone` verilince doğru stil
  uygulanıyor; verilmeyince eski (ortalanmış) görünüm korunuyor (regresyon).
- Backend: `_validate_choice_exercise` yeni alan aralık testleri
  (`test_board_exercises.py`).
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api).
- Canlı doğrulama (KURAL #6): admin panelde gerçek bir `image_question` sorusu
  oluşturup görseli sürükleyip/boyutlandırıp/tonlayıp kaydetme + sporcu
  tarafında (`/pratik` veya ders akışında) doğru konumda göründüğünü tarayıcı
  araçlarıyla gözlemleyerek doğrulama.
