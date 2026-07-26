# Soru Bölümlerinin Bağımsızlığı + Taşı Tanı'nın Kaldırılması (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Kullanıcının "Sekmeler düzenlemeleri" isteğindeki **3a** ve **3f** maddeleri.
**Alt proje sırası:** B — 1/5 (onaylanan sıra: B → C → A → E → D; maç saati planı bunlardan sonra)

---

## 1. Problem

### 1.1 Bölümler birbirine karışıyor (madde 3a)

Kullanıcının şikayeti birebir: *"cümle ekle kısmına yazdığım bir cümle veya görüntü ile
ilgili veriler Görüntü ekle bölümüne yansıtılmasın."*

Kök neden: `ExerciseForm.tsx:106-110` — Cümle Ekle ve Görüntü Ekle **aynı bileşen
örneğini** paylaşıyor:

```tsx
{family === 'konum' ? (
  <BoardExerciseFields ... />
) : (
  <ChoiceExerciseFields kind={family} ... />   // cumle <-> goruntu gecisinde
)}                                              // AYNI ornek, sadece kind degisir
```

React aynı bileşeni yeniden kullandığı için içindeki tüm durum (talimat, şıklar,
görsel...) bölüm değişince **olduğu gibi kalıyor**. Konum ↔ Cümle geçişinde ise bileşen
değiştiği için durum sıfırlanıyor — yani davranış tutarsız: bazen taşınıyor, bazen
taşınmıyor.

### 1.2 Taşı Tanı kaldırılacak (madde 3f)

Konum Ekle'de üç tip var: Kareye Tıkla, Taşı Oynat, **Taşı Tanı** (`identify_piece`).
Kullanıcı Taşı Tanı'yı istemiyor.

## 2. Onaylanan kararlar

| Konu | Karar |
|---|---|
| Taşı Tanı | **Formdan kaldırılır, eski sorular çalışmaya devam eder.** Tip koddan silinmez. |
| Bölüm geçişi | Bölümler **tamamen bağımsız**; hiçbir alan diğerine taşınmaz. |

## 3. Tasarım

### 3.1 Bağımsız bölümler — `key` ile yeniden kuruluş + bölüm başına taslak

`ExerciseForm.tsx` render dallanması değişir:

```tsx
{family === 'konum' ? (
  <BoardExerciseFields key="konum" ... />
) : (
  <ChoiceExerciseFields key={family} kind={family} ... />
)}
```

`key={family}` React'e "bölüm değişti, formu SIFIRDAN kur" der. Böylece:

- Cümle'ye yazılan talimat Görüntü'ye **asla** görünmez.
- Görüntü'de seçilen görsel Cümle'ye **asla** taşınmaz.
- Davranış üç bölümde de **aynı ve öngörülebilir** olur.

**Taslak korunması:** `key` değişince React durumu çöpe atar — Zafer hoca yanlışlıkla
bölüm değiştirirse yazdıkları kaybolur. Bunu önlemek için `ExerciseForm` **Cümle ve
Görüntü** bölümlerinin taslağını kendi üstünde saklar (bölüm başına bir taslak nesnesi).
**Konum bölümüne taslak yapılmaz** — bilinçli: tahta durumu (`moveFen`, hamleler, adım
kilidi) yarım kopyalanırsa sıralı adım kilidi tutarsızlaşır ve bozuk soru üretilebilir;
Konum zaten bugün de bölüm değişiminde sıfırlanıyordu, davranış değişmez.

```tsx
/** Bolum basina taslak: bolum degisince form sifirdan kurulur ama onceki
 *  bolumun yazdiklari kaybolmaz — geri donunce ayni birakildigi gibi bulunur.
 *  Taslaklar SADECE bu form acikken yasar (kalicilik yok, YAGNI). */
const drafts = useRef<Partial<Record<QuestionFamily, unknown>>>({});
```

`ChoiceExerciseFields` ve `BoardExerciseFields` iki yeni prop alır:

```tsx
draft?: unknown;                    // varsa formun baslangic degerleri
onDraftChange?: (d: unknown) => void;  // her degisimde taslak yukari yazilir
```

- Taslak **yalnızca yeni soru eklerken** çalışır; düzenleme modunda (`initial` doluyken)
  devre dışıdır — düzenlenen sorunun alanları taslakla karışmaz.
- Taslaklar sayfa yenilenince veya form kapanınca uçar. Kalıcı saklama (localStorage)
  **yapılmaz** — YAGNI; istek "karışmasın"dır, "sonsuza dek saklansın" değildir.

### 3.2 Taşı Tanı — formdan kaldırma

`BoardExerciseFields` içindeki tip düğmeleri listesinden `identify_piece` çıkarılır:

```tsx
[['click_square', 'Kareye tıkla'], ['move_piece', 'Taşı oynat']]
```

**Ama tip yaşamaya devam eder** (KURAL #3):

- `ExerciseType` birliğinden `identify_piece` **silinmez**.
- `validate()` ve `submit()` içindeki `identify_piece` dalları **silinmez**.
- Backend doğrulaması (`_validate_board_exercises`) `identify_piece`'i kabul etmeye
  devam eder.
- Sporcu tarafındaki çözücü (`BoardExercise`) aynen kalır — kayıtlı Taşı Tanı soruları
  çocuklarda çalışmaya devam eder.

**Eski soruyu düzenleme:** Zafer hoca kayıtlı bir Taşı Tanı sorusunu düzenlemeye
açarsa form açılır, mevcut alanlar dolu gelir, ama tip düğmeleri arasında Taşı Tanı
olmadığı için tip **rozet olarak** gösterilir:

```
[Kareye tıkla] [Taşı oynat]   🏷 Bu soru "Taşı tanı" tipinde (yeni eklenemez)
```

- **Bugünkü kod:** bölüm düğmeleri düzenlemede kilitli (`disabled={editing}`,
  `ExerciseForm.tsx:95`) ama **tip** düğmeleri (Kareye tıkla / Taşı oynat / Taşı tanı)
  düzenlemede de tıklanabilir. **Bu değişir:** `initial` doluyken tip düğmeleri de
  kilitlenir. Böylece hoca eski soruyu düzenleyip kaydedebilir ama tipini değiştirip
  yarı dolu alanlarla bozuk soru üretemez.

## 4. Kapsam dışı

- Adım listeleri (3b/3d/3e) — **C** alt projesi.
- "AÇ" düğmesi ve Maç Yap kartı (1-2) — **A** alt projesi.
- Görsel havuzu (3c) — **D** alt projesi.
- Süreli Pratik / Kendini Test Et (4) — **E** alt projesi.
- Backend'e hiç dokunulmaz. Migration yok.

## 5. Hata durumları

| Durum | Davranış |
|---|---|
| Bölüm değiştirip geri dönme | Taslak geri gelir; alanlar bırakıldığı gibi. |
| Düzenleme modunda bölüm değiştirme | Zaten kilitli (`disabled={editing}`, mevcut davranış) — değişmez. |
| Eski Taşı Tanı sorusunu düzenleme | Form açılır, tip rozeti görünür, kaydetme çalışır. |
| Taşı Tanı sorusu sporcuda | Bugünkü gibi çözülür — hiçbir değişiklik yok. |

## 6. Test planı

**Frontend (vitest + RTL)** — mevcut `exercise-form` test dosyalarına ekleme:
- Cümle'ye talimat yaz → Görüntü'ye geç → talimat alanı **boş**.
- Görüntü'ye geç, talimat yaz → Cümle'ye dön → Cümle'nin eski talimatı **duruyor**
  (taslak korunması) ve Görüntü'nün talimatı görünmüyor.
- Konum'a geç → Cümle'ye dön → Cümle taslağı duruyor.
- Yeni soruda tip düğmeleri yalnızca 2 tane: "Kareye tıkla", "Taşı oynat";
  "Taşı tanı" **yok**.
- `initial` tipi `identify_piece` olan düzenlemede: form açılır, "Taşı tanı" rozeti
  görünür, tip düğmeleri kilitli.
- REGRESYON: Kareye Tıkla ve Taşı Oynat akışları (mevcut testler) bozulmaz.

**Test kapısı:**
```
apps/web:  npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```
Backend'e dokunulmadığı için pytest zorunlu değil; CI'da yine koşar.

**Canlı doğrulama (KURAL #6):** Tek öğretmen oturumu YETERLİDİR (admin ekranı) —
bu proje tam canlı doğrulanabilir: bölüm geçişlerinde alan sızmadığı, Taşı Tanı'nın
görünmediği tarayıcıda tıklanarak kanıtlanır.

## 7. Riskler

- **`key` ile yeniden kuruluş** tüm iç durumu sıfırlar — taslak mekanizması bunun
  panzehiri. Taslak `unknown` tipli tutulur; her bölüm kendi taslağını kendisi anlar
  (form alanları bölümden bölüme farklı).
- **Tip kilidi düzenlemede** yeni bir kısıt: hoca eski soruda tipi değiştiremez olur.
  Bu bilinçli — tip değiştirme yarı dolu alanlarla bozuk soru üretebiliyordu.
