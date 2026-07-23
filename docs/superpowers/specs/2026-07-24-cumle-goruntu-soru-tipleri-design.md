# Cümle & Görüntü soru tipleri — Admin "Yeni Soru" bölümü (P1)

## Bağlam

Bu, kullanıcının talep ettiği daha büyük bir işin (admin "Yeni Soru" bölümünün
yeniden tasarımı — Cümle/Görüntü/Konum soru tipleri, Taşı Oynat modu, notasyon
tablosu, puanlama ve kademeli kilit açma sistemi) **ilk alt projesidir (P1)**.
İş 6 bağımsız alt sisteme bölündü, kullanıcı P1 ile başlanmasını onayladı.

Diğer alt projeler (ayrı spec'lerle, sırayla):
- **P2** — Konum editörü iyileştirmeleri (tıkla-ekle, sola yaslama)
- **P3** — Kareye Tıkla sporcu davranışı (yeşil/kırmızı geri bildirim, tek deneme)
- **P4** — Taşı Oynat: admin tarafı (Konumu Kaydet + Notasyon Tablosu)
- **P5** — Taşı Oynat: sporcu tarafı (kurallı hamle + rakip cevabı)
- **P6** — Puanlama + sonuç ekranı + kademeli kilit açma sistemi

## Amaç

Zafer Hoca şu an sadece satranç tahtası üzerinden soru hazırlayabiliyor
(Kareye Tıkla / Taşı Oynat / Taşı Tanı). Bazı sorular tahta gerektirmiyor —
düz metin bir soru ("Atın hareket şekli nasıldır?") veya bir görsel
(diyagram, ekran görüntüsü, fotoğraf) üzerinden çoktan seçmeli soru
hazırlayabilmesi gerekiyor.

## Kapsam

Admin panelinde ders içeriği → alt konu → soru ekleme bölümünün ("Yeni Soru")
3 soru ailesine ayrılması:

1. **Cümle Ekle** — soru bir metin cümlesi
2. **Görüntü Ekle** — soru bir görsel (+ isteğe bağlı metin açıklama)
3. **Konum Ekle** — **mevcut tahta tabanlı soru formu, değişiklik yok**
   (Kareye Tıkla / Taşı Oynat / Taşı Tanı aynen kalır)

Cümle ve Görüntü sorularının **ortak** özelliği: cevap alanı 2/3/4 seçenekli
çoktan seçmeli, önce seçenek sayısı seçilir sonra cevaplar girilir, cevaplar
(hepsi birden) ya metin ya görsel olur.

**Kapsam dışı:** Taşı Oynat'ın yeniden tasarımı (notasyon tablosu, kural
motoru), Kareye Tıkla'nın geri bildirim rengi, puanlama/kilit sistemi — bunlar
ayrı alt projeler (P3-P6).

## Veri modeli

Yeni exercise tipleri, mevcut `board_exercises` / `board_exercises_timed` /
`board_exercises_test` dizilerine (aynı havuza) eklenir — **karışık** gelirler
(Süresiz Pratik Yap'ta 20 soru seçilirken Konum/Cümle/Görüntü tipleri karışık
çıkabilir). Mevcut soru kodu (`assignExerciseCodes`), havuz-rastgele-seçim ve
admin badge-grid sistemi hiçbir değişiklik olmadan bu yeni tipleri de kapsar.

```ts
interface ChoiceQuestionEx {
  type: 'sentence_question' | 'image_question';
  instruction: string;        // sentence_question: sorunun kendisi
                               // image_question: isteğe bağlı alt başlık/açıklama (boş olabilir)
  prompt_image?: string;      // SADECE image_question — data-URI (≤400KB, sıkıştırılmış)
  option_count: 2 | 3 | 4;
  answer_kind: 'sentence' | 'image';   // TÜM seçenekler bu tipte (karışık olamaz)
  options: string[];          // answer_kind='sentence' → düz metin
                               // answer_kind='image' → data-URI (≤400KB, sıkıştırılmış)
  correct_index: number;
  difficulty?: number;        // mevcut alıştırmalarla aynı 1-5 skala
  success_msg?: string;
  fail_msg?: string;
  code?: string;              // mevcut soru kodu sistemiyle aynı (lib/exerciseCodes.ts)
}
```

Mevcut 3 tip (`click_square`, `move_piece`, `identify_piece`) **hiç
değişmez** — aynı arayüzler, aynı validasyon, aynı render. Bu iş sadece
union tipine 2 yeni üye ekler.

## Backend değişiklikleri

`apps/api/chess_api/routers/admin.py` içindeki `_validate_board_exercises`
fonksiyonuna yeni dallar eklenir (mevcut dallar dokunulmaz):

```python
elif ex_type in ("sentence_question", "image_question"):
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img or not isinstance(img, str):
            raise HTTPException(400, "Görsel soru için görsel gerekli")
        _check_data_uri_size(img, max_bytes=400_000)
    else:
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(400, "Cümle sorusu için metin gerekli")
    option_count = ex.get("option_count")
    if option_count not in (2, 3, 4):
        raise HTTPException(400, "Seçenek sayısı 2, 3 veya 4 olmalı")
    options = ex.get("options")
    if not isinstance(options, list) or len(options) != option_count:
        raise HTTPException(400, "Seçenek sayısı ile cevap listesi uyuşmuyor")
    answer_kind = ex.get("answer_kind")
    if answer_kind not in ("sentence", "image"):
        raise HTTPException(400, "Geçersiz cevap tipi")
    if answer_kind == "image":
        for opt in options:
            _check_data_uri_size(opt, max_bytes=400_000)
    else:
        if any(not (o or "").strip() for o in options):
            raise HTTPException(400, "Boş cevap olamaz")
    ci = ex.get("correct_index")
    if not isinstance(ci, int) or ci < 0 or ci >= option_count:
        raise HTTPException(400, "Doğru cevap seçimi geçersiz")
```

`instruction` bu iki tip için genel doğrulamadan (üst kısımda zaten var olan
`if not (ex.get("instruction") or "").strip(): raise ...`) **muaf tutulmalı**
çünkü `image_question`'da instruction boş olabilir — bu satır mevcut ortak
kontrolün, yeni tipler için şarta bağlanmasını gerektirir.

`fen` alanı bu iki tip için **hiç yok/gerekmez** — mevcut `if not fen: raise`
kontrolü de yeni tipler için atlanmalı.

`_check_data_uri_size` yeni bir yardımcı: data-URI'nin baytlarını hesaplayıp
400KB üstündeyse 400 döner (sunucu tarafı ikinci savunma hattı — birincisi
tarayıcıda sıkıştırma).

## Frontend değişiklikleri

### `apps/web/components/admin/ExerciseForm.tsx` — yeniden yapılandırma

Şu anki `ExerciseForm`, hem "hangi tip" seçimini hem tahta formunu tek
bileşende karıştırıyor. Yeni yapı:

- **`ExerciseForm`** (dış kabuk): üstte 3 ortalanmış kart (Cümle Ekle /
  Görüntü Ekle / Konum Ekle). `initial` prop verilmişse (düzenleme modu),
  `initial.type`'a bakarak doğru kartı otomatik seçili başlatır.
- Kart seçimine göre alt bileşenlerden biri render edilir:
  - **`ChoiceExerciseFields`** (yeni) — Cümle/Görüntü ortak formu: soru
    girişi (metin veya görsel-yükle), seçenek sayısı butonları (2/3/4),
    cevap tipi seçici (Cümle/Görüntü), seçenek girişleri + doğru cevap
    radio'su.
  - **Mevcut tahta formu** (bugünkü `ExerciseForm` içeriği, aynen taşınır) —
    Konum Ekle seçilince.
- `BoardExercise` tip tanımı (admin tarafı, `ExerciseForm.tsx` içinde)
  genişler: `ChoiceQuestionEx` alanları opsiyonel olarak eklenir (mevcut
  alanlar dokunulmaz).

### Görsel yükleme + sıkıştırma (paylaşılan yardımcı)

`apps/web/lib/imageCompress.ts` (yeni) — `admin/settings/board/page.tsx`
içindeki mevcut `FileReader`/boyut-kontrolü desenine benzer ama sıkıştırma
ekler:

```ts
export async function compressImageToDataUri(file: File, maxBytes = 400_000): Promise<string>
```

`<canvas>` ile yeniden boyutlandırıp (maks. genişlik ~800px) JPEG kalitesini
kademeli düşürerek (0.9 → 0.5 adım adım) `maxBytes` altına iner; hâlâ
sığmıyorsa kullanıcıya "Görsel çok büyük, daha küçük bir görsel seçin"
hatası gösterilir (üretim yapılmaz, sessizce bozuk veri kaydedilmez).

### `apps/web/components/lesson-steps/BoardExercise.tsx` — öğrenci render

`exercise.type === 'sentence_question' | 'image_question'` durumunda:

- Tahta (`Chessboard`) **render edilmez**.
- `sentence_question`: `instruction` başlık olarak gösterilir.
- `image_question`: `prompt_image` üstte gösterilir, `instruction` varsa
  altında küçük açıklama olarak.
- Seçenekler `answer_kind`'a göre metin buton grid'i veya görsel kart grid'i
  (2/3/4 sütun, `option_count`'a göre).
- Doğru/yanlış akışı (`succeed`/`fail`, `ProgressDots`, soru kodu rozeti)
  **mevcut mantıkla aynı** — sadece tıklama hedefi `correct_index` karşılaştırması
  olur (mevcut `identify_piece` dalına çok benzer, o kod yeniden kullanılabilir).

### `apps/web/app/(child)/pratik/[mode]/page.tsx`, `modules/[id]/page.tsx`

Değişiklik gerekmez — `assignExerciseCodes` ve exercise dizisi akışı zaten
tip-agnostik (herhangi bir `{code?: string}` üyesi için çalışıyor).

## Test stratejisi

- **Backend (pytest):** `_validate_board_exercises` için yeni testler —
  geçerli/geçersiz `sentence_question`/`image_question` senaryoları,
  `option_count`/`options` uyuşmazlığı, `correct_index` sınırları, 400KB
  üstü data-URI reddi.
- **Frontend (vitest):**
  - `imageCompress.ts` için: küçük dosya sıkıştırma gerektirmez, büyük dosya
    hedef boyutun altına iner (jsdom'da `canvas.toBlob` mock'lanarak).
  - `BoardExercise.tsx`: yeni tipler için doğru/yanlış tıklama senaryoları
    (mevcut `answer-check.test.ts` deseniyle).
- **Canlı doğrulama (KURAL #6):** gerçek prod API'ye karşı, test öğretmen
  hesabıyla geçici bir ders adımına 1 Cümle + 1 Görüntü sorusu eklenip admin
  panelinde badge-grid'de göründüğü, öğrenci ekranında (`/pratik/suresiz`)
  tahtasız render edildiği, doğru/yanlış tıklamanın çalıştığı doğrulanır;
  test verisi silinir.

## Geriye uyumluluk (KURAL #3)

- Mevcut 3 exercise tipi ve onların validasyonu/render'ı **satır satır
  aynı kalır** — hiçbir dal silinmez veya değiştirilmez, sadece yeni dallar
  eklenir.
- `content_json` şema değişikliği yok, migration yok.
- Mevcut sorularda `type` alanı zaten var (`click_square` vb.) — yeni tip
  değerleri sadece admin yeni soru eklediğinde ortaya çıkar, geriye dönük
  hiçbir soru etkilenmez.
