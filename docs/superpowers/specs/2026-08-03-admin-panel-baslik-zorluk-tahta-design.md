# Admin Panel — Başlık Düzenleme, Zorluk Renklendirme, Sabit Tahta (A Grubu) — Tasarım

> Bu spec, kullanıcının 7 maddelik admin-panel isteğinin **A grubunu** kapsar (panel
> iyileştirmeleri, küçük-orta risk). B grubu (Özel Sekme Oluşturucu) ve C grubu
> (Tahtaya Çizim Sistemi) ayrı spec/plan döngüleriyle ele alınacak.

## Kapsam

1. **Başlık düzenleme** — Düzey (modül) adı, ders başlığı, ders adımı (açıklama)
   başlığı üçünde de değiştirme özelliği.
2. **Zorluk renklendirme** — Süresiz Pratik Yap'ın soru havuzu dairelerinin
   zorluğa göre renklenmesi (Kolay: yeşil, Orta: mavi, Zor: kırmızı). Süreli
   Pratik Yap ve Kendini Test Et'te değişiklik yok.
3. **Sabit tahta** — Çoktan seçmeli soru tiplerinde ("Cümle Ekle" ve "Görüntü
   Ekle") Talimat ile Seçenek Sayısı arasına bir tahta; "sporcu görsün mü"
   seçeneğiyle.

Kapsam dışı: 1. madde (sekme senkronu) — mevcut sistem zaten aynı veri kaynağını
kullanıyor, ek iş gerekmiyor, kod değişikliği yapılmayacak.

## 1) Başlık düzenleme

**Mevcut durum (kod incelemesiyle doğrulandı):** Backend'de üç seviye için de
zaten güncelleme uç noktası var — `PATCH /admin/modules/{module_id}` (`name`
alanı), `PATCH /admin/lessons/{lesson_id}` (`title` alanı), `PATCH
/admin/steps/{step_id}` (`content_json` — açıklama adımının `title` alanını
içerir). **Backend'de değişiklik gerekmiyor.** Eksik olan sadece bu üç ekranda
düzenleme arayüzü.

**Frontend değişiklikleri:**

- `apps/web/app/admin/content/page.tsx` (Düzeyler listesi): her modül satırının
  yanına kalem ikonlu bir "Düzenle" butonu. Tıklanınca isim `<input>`'a döner,
  Enter/onay ile `PATCH /admin/modules/{id}` çağrılır, liste yenilenir. İptal
  (Escape/çarpı) ile eski hale döner.
- `apps/web/app/admin/content/[id]/page.tsx` (Dersler listesi): aynı desen,
  ders başlığı için `PATCH /admin/lessons/{id}`.
- `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` (Ders adımları):
  açıklama (`explanation`) tipi adımların başlığı için aynı desen — mevcut
  `content_json` kopyalanır, sadece `title` alanı değiştirilip `PATCH
  /admin/steps/{id}` ile gönderilir (diğer alanlar aynen korunur).
- Soru (inline_exercise/quiz) adımlarının kendi "başlığı" yoktur (soru
  içerikleri zaten `ExerciseForm` üzerinden düzenlenebiliyor) — bu üç ekranın
  dışında ek bir yer dokunulmayacak.

**Ortak bileşen:** Tekrarı önlemek için küçük bir `InlineTitleEdit` bileşeni
oluşturulacak (`apps/web/components/admin/InlineTitleEdit.tsx`): `value`,
`onSave(newValue): Promise<void>` props'u alır, kalem ikonu → input → kaydet/
iptal akışını kendi içinde yönetir. Üç ekran da bu bileşeni kullanır.

## 2) Zorluk renklendirme

**Mevcut durum:** `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`
satır ~346-368'de soru havuzu daireleri `mode.color` (pratik modu rengine göre:
süresiz turkuaz, süreli sarı, test mor) ile boyanıyor. `difficulty` alanı zaten
her sorunun verisinde var (`BoardExercise.difficulty`, 1-8 arası, bkz.
`apps/web/lib/difficultyLabels.ts`).

**Değişiklik:** `EX_MODES` sabitinde süresiz pratik modu `field:
'board_exercises'` ile ayırt ediliyor. Sadece bu mod açıkken, daire rengi
`mode.color` yerine zorluğa göre hesaplanan renk kullanılacak:

- `difficulty` 1-3 arası → yeşil (Kolay)
- `difficulty` 4-6 arası → mavi (Orta)
- `difficulty` 7-8 arası → kırmızı (Zor)

Bu eşik, mevcut `DIFFICULTY_LABELS` (Kolay/Orta/Zor 3 grup) ile birebir
örtüşüyor — yeni bir dosya yerine `apps/web/lib/difficultyLabels.ts`'e küçük
bir `difficultyColor(value: number): string` yardımcı fonksiyonu eklenecek ve
hem burada hem gerekirse ileride başka bir yerde kullanılabilecek.

Süreli ve Test modlarında (`board_exercises_timed`, `board_exercises_test`)
mevcut `mode.color` davranışı **aynen korunur** — koşul sadece `openMode.field
=== 'board_exercises'` olduğunda devreye girer.

## 3) Sabit tahta (Cümle Ekle + Görüntü Ekle)

**Mevcut durum (kod incelemesiyle doğrulandı):**
- "Cümle Ekle" (`sentence_question`) tipinde **hiç tahta/FEN kavramı yok** —
  sadece metin sorusu.
- "Görüntü Ekle" (`image_question`) tipinde tahta zaten var
  (`MultiImagePlacer` + `EmptyBoardGrid`, "Sporcu tahtayı da görsün" onay
  kutusu) ama **Talimat girişinden ÖNCE** duruyor, kullanıcı bunu Talimat ile
  Seçenek Sayısı arasına istiyor.

**"Görüntü Ekle" için değişiklik (küçük):** `ChoiceExerciseFields.tsx`'te
mevcut görsel/tahta bloğu (satır ~281-291) ile talimat input'u (satır
~292-294) yer değiştirir — talimat önce, tahta+checkbox sonra gelir. Davranışta
başka değişiklik yok.

**"Cümle Ekle" için değişiklik (yeni):** Bu tip **boş satranç tahtası**
kavramını ilk kez kazanacak:

- `ChoiceDraft`/`BoardExercise` arayüzüne yeni opsiyonel alanlar:
  `sentence_fen?: string` (kurulan konum), `sentence_show_board?: boolean`
  ("sporcu görsün mü", varsayılan `true`).
- `ChoiceExerciseFields.tsx`'te `kind === 'sentence_question'` dalına, talimat
  input'undan hemen sonra: konumu kurmak için mevcut `BoardEditor` bileşeni
  (taş sürükle-bırak, zaten `move_piece`/`place_pieces` akışlarında kullanılan
  aynı bileşen) + "sporcu tahtayı da görsün" onay kutusu. Tahta **opsiyoneldir**
  — boş bırakılırsa (varsayılan boş FEN) soru eskisi gibi tahtasız görünür,
  var olan sorularda geriye dönük kırılma olmaz (KURAL #3).
- Adım listesi (`questionSteps.ts` → `choiceSteps()`): `sentence_question` için
  yeni bir adım eklenmez — tahta **opsiyonel** olduğundan zorunlu adım listesine
  girmez, sadece "Talimatı Gir" adımının hemen altında ekstra bir alan olarak
  durur.
- Runtime görünüm: `ChoiceQuestionVisual.tsx`'e `sentence_question` dalı
  eklenir — `sentence_fen` doluysa ve `sentence_show_board !== false` ise
  `SavedPositionBoard` (salt-okunur, B grubunda oluşturulan bileşen) ile
  gösterilir; boşsa hiçbir şey render edilmez (mevcut davranış).

**Backend:** `apps/api/chess_api/routers/admin.py` içindeki soru doğrulama
(`_validate_choice_exercise` civarı) `sentence_fen`/`sentence_show_board`
alanlarını **opsiyonel** kabul edecek şekilde genişletilecek — dolu ise FEN
formatı doğrulanır (mevcut `_validate_fen` yardımcı fonksiyonu varsa o
kullanılır), boşsa hiç dokunulmaz.

## Test planı

- Frontend: `InlineTitleEdit` bileşeni birim testleri; üç ekranda "düzenle
  tıkla → kaydet → PATCH çağrıldı" testleri; `difficultyColor()` birim testi;
  havuz dairesi renk testi (sadece süresiz modda); `ChoiceExerciseFields`
  sıra testi (Görüntü Ekle'de tahta artık talimattan sonra); `sentence_question`
  için tahta kur/kaydet/göster-gösterme testleri; `ChoiceQuestionVisual`
  runtime render testi.
- Backend: `PATCH` uçları zaten test kapsamında (mevcut testler regresyon
  ağı); yeni `sentence_fen` doğrulaması için birkaç yeni test.
- Tam gate: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api).
- Canlı doğrulama (KURAL #6): üç başlık düzenleme ekranı, havuz renk
  değişimi, "Cümle Ekle" tahta kur/göster akışı tarayıcıda test edilecek.
