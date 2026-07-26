# P7 — Admin Sekme Akordiyonu + Konum Ekle Adım Akışı

**Tarih:** 2026-07-26
**Durum:** Onaylandı (kullanıcı "evet" dedi)

## Amaç

İki bağımsız admin iyileştirmesi tek planda:

- **A)** Admin > Sekmeler sayfasındaki 4 sekme kartı tıklanıp-açılabilir (akordiyon) olsun;
  kartın ortasındaki dairesel "AÇ" düğmesiyle açılsın. Zafer hoca ileride alt-sekmelere
  buradan ekleme/düzenleme yapacak.
- **B)** Konum Ekle > "Taşı Oynat" soru akışı 6 numaralı adıma bölünsün; hamleler
  tamamlandıktan sonra **"Notasyonu Kaydet"** adımı gelsin ve kaydedilen notasyon cevap olsun.

## Kapsam Dışı (bilinçli)

- **Görsel Havuzu (12 kategori, Bilgisayardan/Havuzdan Seç):** Ayrı spec olarak sonra ele
  alınacak. Sebep: havuzdaki görsellerin kaynağı (özellikle "Satranç Şampiyonları" — telif)
  karara bağlı; bu karar verilmeden tasarlanamaz (KURAL #1).
- **"Cümle Ekle" / "Görüntü Ekle" / "Konum Ekle" bağımsızlığı:** Kod incelendi — bu üçü
  ZATEN tamamen bağımsız bileşenler (`ChoiceExerciseFields` ve `BoardExerciseFields`).
  Ek iş gerekmiyor. Kullanıcının (a) maddesi mevcut durumla karşılanmış durumda.
- **"Cümle Ekle" bölümü:** Kullanıcı isteği gereği dokunulmayacak.
- **"Kareye tıkla" ve "Taşı tanı" soru tipleri:** Adım akışına GEÇMEYECEK, mevcut düzende
  kalacak. Yalnızca "Taşı Oynat" değişiyor.
- **Analiz Et / Eğlence için gerçek yönetim ekranı:** Şimdilik "yakında" notu.

---

## A) Admin > Sekmeler — akordiyon + dairesel "AÇ"

**Dosya:** `apps/web/app/admin/settings/tabs/page.tsx`

### Mevcut durum

Görünen her sekme kartı `neon-card` içinde: emoji, sıra numarası + ad, açıklama,
↑ / ↓ / Kaldır butonları. Yalnızca `lessons` kartında ek olarak "Ders İçeriği" linki
**her zaman açık** duruyor. Diğer üç sekmenin (play, analiz, eglence) hiç içeriği yok.

### Yeni durum

Kart başlığı satırı **aynen korunur** — emoji, ad, açıklama, ↑ / ↓ / Kaldır. Bu butonlar
kart kapalıyken de çalışır (sıralama ve kaldırma, açma-kapamadan bağımsız işlevler).

Başlık satırının altına, **kartın ortasında yatay olarak hizalı** dairesel düğme:

- Kapalıyken: `AÇ`
- Açıkken: `KAPAT`
- Dairesel (`border-radius: 999px`), sabit boyut (56px), sekmenin kendi rengini (`m.color`)
  kenarlık ve metin rengi olarak kullanır — mevcut `neon-card` dilinin devamı.
- `aria-expanded` doğru değerle verilir (erişilebilirlik).

**Tek seferde yalnızca bir kart açık** (akordiyon). Sporcu ana sayfasındaki
(`app/(child)/home/page.tsx`) `openTab` deseniyle aynı dil — tutarlılık.

### Açılan kartın içeriği

| Sekme | Açılınca görünen |
|---|---|
| 📚 Dersler (`lessons`) | **Ders İçeriği** linki → `/admin/content` (mevcut kart, olduğu gibi taşınır) |
| 🎮 Maç Yap (`play`) | **Açılış Listesi** linki → `/admin/openings` |
| 🔍 Analiz Et (`analiz`) | "İçerik yönetimi yakında" notu |
| 🎉 Eğlence (`eglence`) | "İçerik yönetimi yakında" notu |

**Açılış Listesi yan menüde de KALIR** (kullanıcı onayı). `app/admin/layout.tsx`
NAV_GROUPS'a dokunulmaz — iki kapı bir odaya açılır, alışkanlık bozulmaz.

"Yakında" notu için tek ortak bileşen kullanılır; ileride gerçek ekran gelince
tabloya bir satır eklemek yeterli olur.

### Kaldırılan sekmeler bölümü

Değişmez. Kaldırılmış sekmeler zaten içerik yönetimi göstermiyor, akordiyon uygulanmaz.

---

## B) Konum Ekle > Taşı Oynat — 6 numaralı adım

**Dosyalar:**
- `apps/web/components/admin/MovePieceFields.tsx` (notasyon kaydetme fazı)
- `apps/web/components/admin/ExerciseForm.tsx` (`BoardExerciseFields` — adım listesi ve
  "Soruyu Ekle" kilidi)
- Yeni: `apps/web/lib/admin/movePieceSteps.ts` (saf adım-tamamlanma mantığı)

### Adım listesi

Yalnızca `type === 'move_piece'` seçiliyken gösterilir:

| # | Adım | Tamamlanma ölçütü |
|---|---|---|
| 1 | Talimat Ekle | `instruction.trim()` boş değil |
| 2 | Konum Diz | `setupFen !== EMPTY_FEN` (tahtada en az bir taş var) |
| 3 | Konumu Kaydet | `moveFen !== null` (mevcut buton) |
| 4 | Cevap Hamlelerini Yap ve Notasyon Oluştur | `moves.length > 0` |
| 5 | Notasyonu Kaydet | `notationSaved === true` (**YENİ**) |
| 6 | Zorluk Düzeyinin Seçimini Yap | `difficultyChosen === true` (aşağıya bak) |

### Ön koşul: dizme tahtası durumu yukarı taşınır

Mevcut kodda `move_piece` seçiliyken üst bileşen (`BoardExerciseFields`) `BoardEditor`'ı
render **etmiyor** (`type !== 'move_piece'` koşulu); dizme tahtasını `MovePieceFields`
kendi içindeki `setupFen` / `turn` state'lerinde tutuyor. Sonuç: üst bileşenin `fen`
state'i `move_piece` akışı boyunca `EMPTY_FEN`'de kalır.

Bu yüzden adım 2 naif biçimde üst bileşenin `fen`'ine bakarsa **asla tamamlanmaz**.

Çözüm — durumu yukarı taşı (lift state up): dizme tahtasının tek doğruluk kaynağı üst
bileşen olur. `MovePieceFields` arayüzü şöyle genişler:

```ts
interface Props {
  setupFen: string;                          // YENİ — üst bileşenden gelir
  onSetupFenChange: (fen: string) => void;   // YENİ
  setupTurn: 'w' | 'b';                      // YENİ
  onSetupTurnChange: (t: 'w' | 'b') => void; // YENİ
  fen: string | null;                        // mevcut (Konumu Kaydet sonrası)
  moves: string[];                           // mevcut
  onChange: (fen: string | null, moves: string[]) => void; // mevcut
}
```

Üst bileşende zaten var olan ve `move_piece` için kullanılmayan `fen` / `turn` state'leri
bu amaçla kullanılır — yeni state eklenmez, ölü state canlanır.

Her adım: numara + ad + durum işareti. Tamamlanan adım **yeşil tik (✓)** alır.
Sıradaki adım açık ve vurgulu; henüz sırası gelmeyen adımlar soluk (`opacity`) görünür.
Adımlar sırayla açılır — 3 tamamlanmadan 4'ün alanı etkin olmaz (mevcut faz mantığı
bunu zaten `moveFen === null` ile sağlıyor).

`Soruyu Ekle` butonu **6 adımın hepsi ✓ olmadan aktif olmaz**; kapalıyken hangi adımın
eksik olduğunu yazar (örn. "Eksik: 5. Notasyonu Kaydet").

### Adım 5 — "Notasyonu Kaydet" (asıl yeni özellik)

Şu an hamleler `MoveRecorderBoard` tarafından canlı kaydediliyor; ayrı bir onay adımı yok.

Yeni davranış:
- Kayıt fazında (adım 4), en az bir hamle varken **"Notasyonu Kaydet"** butonu görünür.
- Basılınca notasyon **cevap olarak kilitlenir**: tahta ve hamle kaydı salt-okunur olur,
  ekranda `Cevap: 1. e4 e5 2. Nf3` biçiminde özet gösterilir.
- Yanına **"Notasyonu Düzenle"** butonu gelir; basılınca kilit açılır (adım 5 tiki kalkar),
  Zafer hoca hamleleri değiştirebilir.
- Kilit durumu `notationSaved` state'i ile tutulur.

**Veri modeline yeni alan EKLENMEZ.** `notationSaved` yalnızca form içi UI durumudur;
kaydedilen soru yine `{ type: 'move_piece', fen, moves, ... }` olarak gider. Backend'e,
şemaya, migration'a dokunulmaz.

### Adım 6 — "Zorluk Düzeyi" tuzağı ve çözümü

`difficulty` state'i **varsayılan 1** ("Kolay"). Bu yüzden "seçildi mi?" testi naif
yazılırsa adım hiç tıklanmadan yeşil olur ve gate işlevsiz kalır.

Çözüm: ayrı bir `difficultyChosen` boolean tutulur.
- Yeni soru eklerken `false` başlar; Zafer hoca bir zorluk etiketine **bilfiil tıklayınca**
  `true` olur.
- Mevcut soruyu **düzenlerken** (`initial` var) `true` başlar — kayıtlı bir değer zaten var,
  Zafer hoca'yı tekrar tıklamaya zorlamak regresyon olur (KURAL #3).

Bu yaklaşım `lib/difficultyLabels.ts` başındaki mevcut felsefeyle uyumlu:
"kullanıcı bir etikete BİLFİİL tıklamadıkça var olan sayısal değer değişmeden kalır."

### Geriye uyumluluk (KURAL #3)

- Kayıtlı `moves` dizisi olan mevcut sorular düzenlemeye açıldığında: `moveFen` dolu,
  `moves` dolu, `notationSaved = true`, `difficultyChosen = true` → 6 adım da ✓ görünür,
  hoca doğrudan kaydedebilir.
- `click_square` ve `identify_piece` soruları hiç etkilenmez (adım listesi gösterilmez).
- Backend, şema, migration: **dokunulmuyor.** Sporcu tarafı (`BoardExercise`,
  `MovePieceSolver`) **dokunulmuyor** — kaydedilen veri biçimi aynı.

---

## Mimari kararlar

**Saf mantık ayrılır.** Adım-tamamlanma hesabı `lib/admin/movePieceSteps.ts` içinde saf
fonksiyon olarak durur; React'ten bağımsız, doğrudan test edilir. Bu, projedeki mevcut
desenin devamı (`lib/practice/scoring.ts`, `lib/play/levels.ts`, `moveRecorder.ts`).

```ts
export interface MovePieceStepState {
  instruction: string;
  setupFen: string;       // dizme tahtası (üst bileşen sahibi)
  moveFen: string | null; // Konumu Kaydet sonrası
  moves: string[];
  notationSaved: boolean;
  difficultyChosen: boolean;
}
export interface StepInfo { no: number; label: string; done: boolean }
export function movePieceSteps(s: MovePieceStepState): StepInfo[];
export function firstIncompleteStep(s: MovePieceStepState): StepInfo | null;
export function allStepsDone(s: MovePieceStepState): boolean;
export function formatNotation(fen: string, moves: string[]): string;
```

**Neden ayrı dosya:** `ExerciseForm.tsx` şu an 298 satır ve iki bileşen barındırıyor.
Adım mantığını içine gömmek onu daha da büyütürdü. Saf mantığı dışarı almak dosyayı
şişirmeden test edilebilir kılar.

**Notasyon biçimlendirme (DRY):** `Cevap: 1. e4 e5 2. Nf3` metni için sıfırdan bir
ayrıştırıcı YAZILMAZ. `lib/chess/moveRecorder.ts` içindeki mevcut
`notationRows(fen, moves): NotationRow[]` fonksiyonu yeniden kullanılır — siyahın
başladığı konumlarda ilk satırın beyaz hücresini boş bırakma davranışını zaten doğru
biçimde ele alıyor. `formatNotation` yalnızca o satırları tek satırlık metne çevirir.
Bu yüzden `fen` parametresi zorunludur (sıranın kimde olduğunu bilmek için).

## Test stratejisi

**Saf mantık (vitest, DOM yok):**
- `movePieceSteps` — 6 adımın her biri için eksik/tam durumlar
- `difficultyChosen` tuzağı — dokunulmamış varsayılanın adım 6'yı tamamlamadığı
- Adım 2 tuzağı — `setupFen === EMPTY_FEN` iken tamamlanmadığı, taş dizilince tamamlandığı
- `firstIncompleteStep` — doğru adımı bildirdiği
- `formatNotation` — tek hamle, çift hamle, tek sayıda hamle (siyah eksik) ve **siyahın
  başladığı** konum durumları

**Bileşen (vitest + @testing-library/react):**
- Admin Sekmeler: kart kapalı başlar; "AÇ"a basınca içerik açılır ve düğme "KAPAT" olur;
  ikinci karta basınca ilki kapanır (akordiyon); Dersler açılınca Ders İçeriği linki,
  Maç Yap açılınca Açılış Listesi linki görünür; Analiz/Eğlence "yakında" gösterir;
  ↑ / ↓ / Kaldır kart kapalıyken de çalışır (regresyon).
- Konum Ekle: `move_piece` seçilince 6 adım görünür; `click_square` seçilince görünmez
  (regresyon); "Soruyu Ekle" eksik adım varken kapalı ve eksiği yazar; "Notasyonu Kaydet"
  basılınca özet çıkar ve adım 5 ✓ olur; "Notasyonu Düzenle" kilidi açar.

**Kapı (pazarlık konusu değil):**
```
apps/web: npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```
Backend'e dokunulmadığı için `pytest` gerekmez; yine de mevcut testlerin kırılmadığı
`vitest run` ile doğrulanır.

**Canlı doğrulama (KURAL #6):** Dev sunucu + gerçek tarayıcı sürüşü. Admin Sekmeler
sayfasında dört kart tek tek açılıp kapatılır; Konum Ekle > Taşı Oynat akışı baştan
sona sürülür (talimat → konum → kaydet → hamle → notasyon kaydet → zorluk → soru ekle)
ve soru gerçekten eklendiği doğrulanır. Prod veriye eklenen test sorusu **silinir**.

## Riskler

| Risk | Önlem |
|---|---|
| Sekme kartı kapanınca ↑/↓/Kaldır erişilemez hale gelir | Başlık satırı akordiyondan bağımsız; regresyon testi yazılır |
| Adım akışı `click_square`/`identify_piece`'i de etkiler | Adım listesi `type === 'move_piece'` koşuluna bağlı; regresyon testi yazılır |
| Mevcut kayıtlı `move_piece` soruları düzenlenemez hale gelir | `initial` varken tüm adımlar ✓ başlar; test yazılır |
| Zorluk adımı varsayılan yüzünden işlevsiz kalır | Ayrı `difficultyChosen` state'i; özel test yazılır |
| Adım 2 asla tamamlanmaz (dizme fen'i üst bileşene ulaşmıyor) | Durum yukarı taşınır (`setupFen` prop'u); özel test yazılır |
| Dizme tahtası durumu yukarı taşınırken mevcut Taşı Oynat akışı bozulur | `MovePieceFields` için mevcut testler korunur, gerekiyorsa güncellenir; canlı sürüşle doğrulanır |
