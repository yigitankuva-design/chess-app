# Tahtaya Çizim Sistemi (C Grubu) — Tasarım

> Bu spec, kullanıcının 7 maddelik admin-panel isteğinin **C grubunu** (madde 6-7,
> en büyük parça) kapsar. A grubu (başlık düzenleme, zorluk renklendirme, sabit
> tahta) ve B grubu (Özel Sekme Oluşturucu) tamamlanıp yayınlandı.

## Kapsam

Zafer hoca, **her soru tipinde** (Kareye Tıkla, Taşı Oynat, Taş Nerde, Taşa Tıkla,
Cümle Ekle, Görüntü Ekle) tahtaya serbestçe yazı ve şekil ekleyebilecek, renklendirebilecek.
Bu, mevcut adım listelerine **"Yazı-Şekil-Renk Ekle"** adında yeni, **opsiyonel**
bir adım olarak eklenir. Eklenen öğeler soruyla birlikte kaydedilir ve **sporcu
tarafında da görünür** — bir notu değil, sorunun bir parçasıdır.

**Netleşen kararlar (kullanıcı onaylı):**
- Adım **opsiyonel** — boş bırakılıp geçilebilir, kaydı engellemez.
- Öğe sayısında **sınır yok**.
- Yerleştirme **serbest**: hoca önce aracı (yazı/şekil) seçer, sonra tahtaya
  tıklar; öğe oraya düşer, sonra sürükleyip taşıyabilir/boyutlandırabilir.
- 6 şekil: Daire, Kare, Dikdörtgen, Yıldız, Ok İşareti, Soru İşareti — hepsi
  **boyutlandırılabilir ve döndürülebilir**.
- Yazı: **punto ayarlanabilir**.
- **10 renk**: Siyah, Beyaz, Kırmızı, Mavi, Yeşil, Mor, Turuncu, Turkuaz,
  Kahverengi, Sarı.
- **Ctrl+Z** son işlemi geri alır.
- Tahtanın sağında basit bir araç paneli (yazı/şekil/renk seçimi).

## Mevcut kodla ilişki (kod incelemesiyle doğrulandı)

Proje zaten aynı matematiği kanıtlamış durumda:
`apps/web/components/admin/MultiImagePlacer.tsx` + `apps/web/lib/chess/imagePlacement.ts`
— yüzde-bazlı (x%, y%, w%, h%) konum, sürükleyerek taşıma, köşeden boyutlandırma.
Çizim sistemi **aynı deseni** kullanır, üstüne **döndürme** eklenir (yeni yetenek
— resimlerde rotasyon yok, burada gerekiyor).

## Veri modeli

Her soruya (tip fark etmeksizin) opsiyonel bir dizi eklenir:

```ts
interface PaintItemBase {
  id: string;        // benzersiz anahtar
  x: number; y: number;   // merkez, yüzde (0-100)
  rotation: number;       // derece (0-359)
  color: string;          // 10 renkten biri (hex)
}
interface TextPaintItem extends PaintItemBase {
  kind: 'text';
  text: string;
  fontSize: number;  // px (12-72 arası sınırlanır)
}
interface ShapePaintItem extends PaintItemBase {
  kind: 'shape';
  shape: 'circle' | 'square' | 'rectangle' | 'star' | 'arrow' | 'question';
  w: number; h: number;   // yüzde (2-90 arası sınırlanır)
}
type PaintItem = TextPaintItem | ShapePaintItem;
```

`annotations: PaintItem[]` alanı **her soru tipinin** veri şekline eklenir
(`ExerciseForm.tsx`'teki `BoardExercise`, `BoardExercise.tsx`'teki tüm tahta ve
çoktan-seçmeli tip arayüzleri). Yoksa `[]` — geriye dönük kırılma olmaz (KURAL #3).

**10 renk paleti (sabit):**
Siyah `#000000`, Beyaz `#ffffff`, Kırmızı `#ef4444`, Mavi `#3b82f6`,
Yeşil `#22c55e`, Mor `#a855f7`, Turuncu `#f97316`, Turkuaz `#14b8a6`,
Kahverengi `#92400e`, Sarı `#eab308`.

## Frontend mimarisi

**`apps/web/lib/chess/paintItems.ts`** (yeni, saf mantık) — `PaintItem` tipleri,
`PALETTE` sabiti, `SHAPES` sabiti, sürükleme/boyutlandırma/döndürme matematiği
(`imagePlacement.ts`'teki `dragToPercent`/`resizeToPercent` deseninin genişletilmişi
+ yeni `rotateToAngle` fonksiyonu — açıyı `atan2` ile hesaplar).

**`apps/web/components/admin/PaintEditor.tsx`** (yeni) — tahta üzerine binen
etkileşimli katman: sağda araç paneli (metin ekle butonu + 6 şekil butonu + 10
renk paleti), tahtaya tıklayınca seçili araç o noktaya eklenir, her öğe
tıklanınca seçilir (taşıma/boyutlandırma/döndürme tutamaçları + Sil butonu
belirir — `MultiImagePlacer.tsx` ile aynı etkileşim dili). İç bir `history`
dizisi tutar; `Ctrl+Z` bir önceki `annotations` durumuna döner (basit
geri-al-yığını, `redo` yok — istenmedi, YAGNI).

**`apps/web/components/PaintItemView.tsx`** (yeni) — TEK bir öğeyi render eder
(salt-okunur, `pointer-events: none`). Hem `PaintEditor.tsx` (düzenlenebilir mod,
üstüne etkileşim katmanı bindirir) hem de sporcu tarafındaki salt-okunur
gösterimde **aynı bileşen** kullanılır — çizim mantığı tek yerde durur.
Şekiller CSS ile çizilir (daire: `border-radius:50%`; kare/dikdörtgen: düz
`border`; yıldız: `clip-path: polygon(...)`; ok: küçük bir SVG; soru işareti:
büyük `?` karakteri) — yeni bir çizim kütüphanesi eklenmez, mevcut CSS-only
yaklaşım sürdürülür (bu oturumda `radial-gradient`'in test ortamında
çalışmadığı zaten öğrenildi — `border`/`clip-path`/SVG kullanılacak).

**Adım listeleri** — şu 4 dosyadaki 5 fonksiyona yeni bir adım eklenir:
`movePieceSteps.ts` (`movePieceSteps`), `clickPieceSteps.ts` (`clickPieceSteps`),
`placePiecesSteps.ts` (`placePiecesSteps`), `questionSteps.ts` (`choiceSteps` VE
`clickSquareSteps`). Adım adı: **"Yazı-Şekil-Renk Ekle"**, `done` her zaman
`true` (opsiyonel — asla kilitlemez), listenin **sonuna** ("Zorluk Düzeyini
Belirle"den sonra, "Soruyu Ekle"den önce) eklenir.

**`ExerciseForm.tsx` / `ChoiceExerciseFields.tsx`** — her tip için kurulan
tahtanın (Konum Diz / Cümle Ekle'nin opsiyonel tahtası / Görüntü Ekle'nin boş
tahtası) yanına `PaintEditor` eklenir, `annotations` state'i tutulur ve
submit'te gönderilir.

**Sporcu tarafı (`BoardExercise.tsx`, `ChoiceQuestionVisual.tsx`)** — mevcut
tahta render'ının üstüne, `exercise.annotations` doluysa her öğe için
salt-okunur `PaintItemView` bindirilir.

## Backend doğrulama

`apps/api/chess_api/routers/admin.py`'a `_validate_annotations(items: list)`
yardımcı fonksiyonu eklenir, hem `_validate_board_exercises` hem
`_validate_choice_exercise` içinden çağrılır: her öğe için `kind` geçerli mi
(`text`/`shape`), `color` 10 renkten biri mi, `shape` 6 değerden biri mi
(kind=shape ise), `x`/`y` 0-100 arası mı, `rotation` 0-359 arası mı, `text`
en fazla 200 karakter mi, `fontSize` 12-72 arası mı, `w`/`h` 2-90 arası mı.
Öğe **sayısında** sınır yok (kullanıcı onayı) ama her alanın kendi mantıklı
aralığı doğrulanır — bozuk/aşırı büyük veri kaydedilmez.

## Test planı

- Frontend: `paintItems.ts` saf fonksiyon testleri (drag/resize/rotate
  matematiği); `PaintEditor` etkileşim testleri (araç seç → tıkla → öğe
  eklenir, sürükle → taşınır, Ctrl+Z → geri alınır, Sil → kaldırılır);
  `PaintItemView` render testleri (6 şekil + metin, renk/döndürme uygulanıyor
  mu); 5 adım listesi dosyasında yeni adımın `done:true` ve doğru sırada
  olduğu testleri; `ExerciseForm`/`ChoiceExerciseFields` entegrasyon testleri;
  sporcu tarafı render testleri (annotations boşsa hiçbir şey çizilmez —
  geriye dönük uyumluluk).
- Backend: `_validate_annotations` için geçerli/geçersiz alan testleri (her
  sınır için en az bir "reddedilir" testi).
- Tam gate: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api).
- Canlı doğrulama (KURAL #6): bir soruya yazı + birkaç şekil ekle, döndür,
  boyutlandır, Ctrl+Z ile birini geri al, kaydet; sporcu tarafında aynı
  öğelerin aynı konum/renk/döndürmeyle göründüğünü doğrula.
