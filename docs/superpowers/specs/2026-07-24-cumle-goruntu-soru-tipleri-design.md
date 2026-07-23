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

İki **ayrı** arayüz tanımlanır (tek arayüzde `type: 'a' | 'b'` kullanılsaydı
TypeScript `prompt_image`'ın hangi tipte zorunlu olduğunu daraltamazdı):

```ts
/** İki seçenek tipinin ortak alanları. */
interface ChoiceExBase {
  answer_kind: 'sentence' | 'image';   // TÜM seçenekler bu tipte (karışık olamaz)
  options: string[];          // 2, 3 veya 4 eleman
                               // answer_kind='sentence' → düz metin
                               // answer_kind='image' → data-URI (≤400KB, sıkıştırılmış)
  correct_index: number;
  difficulty?: number;        // mevcut alıştırmalarla aynı 1-5 skala
  success_msg?: string;
  fail_msg?: string;
  code?: string;              // mevcut soru kodu sistemiyle aynı (lib/exerciseCodes.ts)
}

export interface SentenceQuestionEx extends ChoiceExBase {
  type: 'sentence_question';
  instruction: string;        // sorunun kendisi — zorunlu, boş olamaz
}

export interface ImageQuestionEx extends ChoiceExBase {
  type: 'image_question';
  prompt_image: string;       // data-URI (≤400KB, sıkıştırılmış) — zorunlu
  instruction: string;        // isteğe bağlı alt başlık/açıklama — '' olabilir
}
```

`instruction` her iki tipte de **alan olarak** bulunur (opsiyonel değil), ama
`image_question`'da boş dize kabul edilir. Böylece hem mevcut kodun
`exercise.instruction` erişimleri güvenli kalır hem de "görsel sorunun metni
isteğe bağlı" kuralı korunur.

**Seçenek sayısı ayrı bir alan olarak saklanmaz.** Kullanıcı akışı "önce sayı
seç, sonra cevapları gir" şeklinde olacak ama bu sayı yalnızca formun *yerel
state*'inde tutulur; kaydedilen veride sayı `options.length`'ten okunur. Ayrı
bir `option_count` alanı tutmak, `options` ile sapabilecek ikinci bir doğruluk
kaynağı yaratırdı (örn. sayı 4 ama dizide 3 eleman) — bu yüzden kasten yok.

Mevcut 3 tip (`click_square`, `move_piece`, `identify_piece`) **hiç
değişmez** — aynı arayüzler, aynı validasyon, aynı render. Bu iş sadece
union tipine 2 yeni üye ekler.

## Backend değişiklikleri

`apps/api/chess_api/routers/admin.py` içindeki `_validate_board_exercises`
**yeniden yapılandırılmalı** — sadece `elif` eklemek yetmez.

Bugünkü döngüde şu iki kontrol *bütün tiplere ortak* olarak çalışıyor ve yeni
tipleri hatalı biçimde reddederdi:

- `admin.py:541-542` — `if not (ex.get("instruction") or "").strip(): raise`
  → `image_question`'da instruction boş olabilir, bu kontrol onu reddeder.
- `admin.py:549-555` — `fen = ex.get("fen"); if not fen: raise` ve ardından
  `chess.Board(fen)` → yeni tiplerde `fen` hiç yok, bu kontrol onları reddeder.

Yeni yapı: `ex_type` kabul listesine iki yeni değer eklenir, sonra döngü
gövdesi **tahta tabanlı** ve **seçenek tabanlı** olmak üzere ikiye ayrılır.
Ortak kalanlar: `type` geçerliliği ve `difficulty` (1-5) kontrolü.

```python
BOARD_TYPES = ("click_square", "move_piece", "identify_piece")
CHOICE_TYPES = ("sentence_question", "image_question")
MAX_IMAGE_BYTES = 400_000


def _check_data_uri_size(value: str, field: str) -> None:
    """data-URI'nin gerçek bayt boyutunu kontrol eder (base64 şişmesi dahil)."""
    if not isinstance(value, str) or not value.startswith("data:image/"):
        raise HTTPException(status_code=400, detail=f"{field} geçerli bir görsel değil")
    if len(value.encode("utf-8")) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"{field} çok büyük (en fazla 400KB)")
```

Döngü gövdesi:

```python
ex_type = ex.get("type")
if ex_type not in BOARD_TYPES + CHOICE_TYPES:
    raise HTTPException(status_code=400, detail=f"Geçersiz alıştırma türü: {ex_type}")

if "difficulty" in ex and ex["difficulty"] is not None:
    diff = ex["difficulty"]
    if not isinstance(diff, int) or diff < 1 or diff > 5:
        raise HTTPException(status_code=400, detail="Zorluk düzeyi 1-5 arasında olmalı")

if ex_type in CHOICE_TYPES:
    _validate_choice_exercise(ex, ex_type)
    continue

# --- buradan aşağısı BUGÜNKÜ admin.py:541-595 kodu, DEĞİŞMEDEN taşınır:
#     instruction kontrolü, fen kontrolü, chess.Board(fen), _squares(),
#     ve click_square / move_piece / identify_piece dalları ---
if not (ex.get("instruction") or "").strip():
    raise HTTPException(status_code=400, detail="Alıştırma talimatı boş olamaz")
fen = ex.get("fen")
if not fen:
    raise HTTPException(status_code=400, detail="Alıştırma için pozisyon (fen) gerekli")
# ... (mevcut gövdenin geri kalanı aynen korunur)
```

`_validate_choice_exercise` ayrı bir fonksiyon olur (döngü gövdesi zaten uzun;
yeni mantığı içine gömmek okunabilirliği bozar):

```python
def _validate_choice_exercise(ex: dict, ex_type: str) -> None:
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
        _check_data_uri_size(img, "Soru görseli")
    else:  # sentence_question
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Cümle sorusu için soru metni gerekli")

    options = ex.get("options")
    if not isinstance(options, list) or not (2 <= len(options) <= 4):
        raise HTTPException(status_code=400, detail="2, 3 veya 4 cevap seçeneği gerekli")

    answer_kind = ex.get("answer_kind")
    if answer_kind not in ("sentence", "image"):
        raise HTTPException(status_code=400, detail="Geçersiz cevap tipi")

    if answer_kind == "image":
        for i, opt in enumerate(options):
            _check_data_uri_size(opt, f"{i + 1}. cevap görseli")
    else:
        if any(not (o or "").strip() for o in options):
            raise HTTPException(status_code=400, detail="Boş cevap seçeneği olamaz")

    ci = ex.get("correct_index")
    if not isinstance(ci, int) or ci < 0 or ci >= len(options):
        raise HTTPException(status_code=400, detail="Doğru cevap seçimi geçersiz")
```

## Frontend değişiklikleri

### `apps/web/components/admin/ExerciseForm.tsx` — yeniden yapılandırma

Şu anki `ExerciseForm`, hem "hangi tip" seçimini hem tahta formunu tek
bileşende karıştırıyor. Yeni yapı:

- **`ExerciseForm`** (dış kabuk): üstte 3 ortalanmış kart (Cümle Ekle /
  Görüntü Ekle / Konum Ekle). `initial` prop verilmişse (düzenleme modu),
  `initial.type`'a bakarak doğru kartı otomatik seçili başlatır ve **kart
  değiştirme devre dışı kalır** (bir sorunun tipi sonradan değiştirilemez —
  aksi halde yarısı dolu, tutarsız veri oluşur).
- Kart seçimine göre alt bileşenlerden biri render edilir:
  - **`ChoiceExerciseFields`** (yeni dosya:
    `apps/web/components/admin/ChoiceExerciseFields.tsx`) — Cümle/Görüntü
    ortak formu: soru girişi (metin veya görsel-yükle), seçenek sayısı
    butonları (2/3/4 — yalnızca yerel state), cevap tipi seçici
    (Cümle/Görüntü), seçenek girişleri + doğru cevap radio'su.
  - **Mevcut tahta formu** (bugünkü `ExerciseForm` içeriği, aynen taşınır) —
    Konum Ekle seçilince.
- Admin tarafındaki `BoardExercise` tipi (`ExerciseForm.tsx` içinde tanımlı,
  öğrenci tarafındaki ayrık union'dan farklı olarak *düz/opsiyonel alanlı* bir
  yapı) genişler: `prompt_image?`, `answer_kind?`, `options?`, `correct_index?`
  alanları opsiyonel olarak eklenir. `options` ve `correct_index` zaten var
  (`identify_piece` kullanıyor) — tekrar eklenmez, yeniden kullanılır. Mevcut
  alanların hiçbiri değiştirilmez.

**Kaydetme yolu ayrılır.** Bugünkü `submit()` her durumda `fen` içeren bir
nesne kuruyor (`ExerciseForm.tsx:103`: `const base = { type, instruction, fen, difficulty }`).
Seçenek tipleri için `fen` **gönderilmemeli** (backend onu beklemiyor, gönderilse
ölü veri olur). Bu yüzden `validate()` ve `submit()` iki ayrı yol alır:
tahta tipleri bugünkü gövdeyi kullanır, seçenek tipleri
`{ type, instruction, prompt_image?, answer_kind, options, correct_index, difficulty }`
kurar. Mevcut kod yolu değişmediği için tahta soruları bire bir aynı kaydedilir.

**Seçenek sayısı azaltılırsa** (örn. 4'ten 2'ye) fazla `options` elemanları
kırpılır ve `correct_index` yeni sınırın dışında kaldıysa `0`'a çekilir —
aksi halde geçersiz `correct_index` kaydedilebilirdi.

### `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` — küçük düzeltme

Kod rozeti grid'i `title={ex.instruction}` kullanıyor
(`page.tsx:337` civarı). `image_question`'da `instruction` boş olabileceği
için tooltip boş kalır. Geri düşüş eklenir:
`title={ex.instruction || (ex.type === 'image_question' ? 'Görüntü sorusu' : '')}`

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

Bu dosya **tip daraltma (type narrowing) nedeniyle yeniden yapılandırılmalı.**
Bugünkü kod, union'ın her üyesinin tahta tipi olduğunu varsayıyor:

- `BoardExercise.tsx:145-149` — `if (exercise.type !== 'identify_piece')`
  dalında `exercise.hint_squares` okunuyor. Union'a `sentence_question` ve
  `image_question` eklenince bu daralma artık `hint_squares` içermeyen üyeleri
  de kapsar ve **TypeScript derlemesi kırılır**.
- `BoardExercise.tsx:235` — `position={exercise.fen}` koşulsuz okunuyor; yeni
  tiplerde `fen` alanı yok.

Çözüm — bir tip koruyucusu (type guard) eklenir:

```ts
export type BoardTypeConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx;
export type ChoiceTypeConfig = SentenceQuestionEx | ImageQuestionEx;
export type BoardExerciseConfig = BoardTypeConfig | ChoiceTypeConfig;

export function isBoardExercise(ex: BoardExerciseConfig): ex is BoardTypeConfig {
  return ex.type === 'click_square' || ex.type === 'move_piece' || ex.type === 'identify_piece';
}
```

`styles` hesaplaması ve `onSquareClick` tanımı `isBoardExercise(exercise)`
koruması içine alınır; JSX'te tahta bloğu ile seçenek bloğu ayrı dallara
ayrılır. **Paylaşılan kabuk aynı kalır** — `ProgressDots`, soru kodu rozeti
(`#003`), başarı/başarısızlık geri bildirim kutuları, "Sonraki Soru" butonu ve
`succeed`/`fail`/`goNext` durum makinesi tek yerde kalır (DRY); yalnızca
"sorunun gövdesi" tipe göre değişir.

Seçenek gövdesi yeni bir bileşene çıkarılır — `BoardExercise.tsx` zaten ~320
satır ve iki ayrı soru ailesini tek dosyada tutmak onu hantallaştırır:

**`apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`** (yeni)

```tsx
interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}
```

- `image_question`: `prompt_image` üstte (`max-height` sınırlı, `object-fit: contain`),
  `instruction` doluysa altında küçük açıklama kartı olarak.
- `sentence_question`: `instruction` soru kartı olarak (mevcut talimat kartı stili).
- Seçenekler `options.length`'e göre grid: 2 seçenek → 2 sütun, 3 → 3 sütun,
  4 → 2×2. `answer_kind === 'image'` ise her seçenek küçük resim kartı, değilse
  metin butonu.
- Tıklama `onAnswer(i)` çağırır; `BoardExercise` içinde
  `i === exercise.correct_index ? succeed() : fail(exercise.fail_msg ?? '...')`.

Bu, mevcut `identify_piece` seçenek grid'iyle aynı davranış modelini izler
(o kod referans alınabilir) ama tahtaya bağımlı değildir.

### `apps/web/app/(child)/pratik/[mode]/page.tsx`, `modules/[id]/page.tsx`

Değişiklik gerekmez — `assignExerciseCodes` ve exercise dizisi akışı zaten
tip-agnostik (herhangi bir `{code?: string}` üyesi için çalışıyor).

## Test stratejisi

- **Backend (pytest):**
  - **Regresyon (en önemli):** mevcut 3 tahta tipinin bugünkü geçerli/geçersiz
    senaryoları, döngü yeniden yapılandırıldıktan sonra **aynı sonucu** vermeli
    (özellikle boş `instruction` ve eksik/bozuk `fen` hâlâ reddedilmeli).
  - Yeni tipler: geçerli `sentence_question`/`image_question`; `options`
    uzunluğunun 2-4 dışında olması; `answer_kind` geçersiz; `correct_index`
    sınır dışı; `image_question`'da `prompt_image` eksik; 400KB üstü data-URI
    reddi; `answer_kind='sentence'` iken boş cevap reddi.
- **Frontend (vitest):**
  - `isBoardExercise` tip koruyucusu: 5 tipin her biri için doğru dala
    ayrıldığını doğrular (union genişlemesinin regresyona uğramaması için).
  - `imageCompress.ts` için: küçük dosya sıkıştırma gerektirmez, büyük dosya
    hedef boyutun altına iner (jsdom'da `canvas.toBlob` mock'lanarak).
  - `ChoiceQuestionBody`: 2/3/4 seçenek render edilir, tıklama doğru indeksi
    bildirir, `disabled` iken tıklama yok sayılır.
  - Seçenek sayısı azaltıldığında `correct_index`'in sınır dışına düşmemesi
    (form mantığı, `exercise-code.test.ts` desenindeki saf fonksiyon testi).
- **Canlı doğrulama (KURAL #6):** gerçek prod API'ye karşı, test öğretmen
  hesabıyla geçici bir ders adımına 1 Cümle + 1 Görüntü sorusu eklenip admin
  panelinde badge-grid'de göründüğü, öğrenci ekranında (`/pratik/suresiz`)
  tahtasız render edildiği, doğru/yanlış tıklamanın çalıştığı doğrulanır;
  test verisi silinir.

## Geriye uyumluluk (KURAL #3)

- `content_json` şema değişikliği yok, **migration yok**. Mevcut sorulara
  hiçbir alan eklenmez/silinmez.
- Yeni tip değerleri yalnızca Zafer Hoca yeni bir Cümle/Görüntü sorusu
  eklediğinde ortaya çıkar; mevcut sorular okunurken de yazılırken de
  etkilenmez.

**Dürüst uyarı — bu iş "sadece ekleme" değil.** İki dosyada, canlıda çalışan
kod yolları *yeniden yapılandırılıyor*:

1. `_validate_board_exercises` (backend) — ortak `instruction`/`fen`
   kontrolleri tahta dalına taşınıyor.
2. `BoardExercise.tsx` (öğrenci render) — union genişlediği için tip daraltma
   ve JSX dallanması değişiyor.

Her ikisinde de **davranış** aynı kalmalı ama kod hareket ediyor; bu yüzden
test stratejisindeki *regresyon testleri* (mevcut 3 tipin bugünkü kabul/ret
davranışının korunduğunu kanıtlayan) bu işin en kritik parçası. Regresyon
testleri yazılmadan yeniden yapılandırma yapılmayacak (TDD sırası: önce
mevcut davranışı kilitleyen testler, sonra yapı değişikliği, sonra yeni tipler).
