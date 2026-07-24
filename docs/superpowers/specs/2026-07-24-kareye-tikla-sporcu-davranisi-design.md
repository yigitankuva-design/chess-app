# Kareye Tıkla sporcu davranışı (P3) — kare renklendirme + tekrar deneme yok

## Bağlam

"Yeni Soru" bölümünün yeniden tasarımının **üçüncü alt projesi (P3)**. P1
(Cümle & Görüntü) ve P2 (Konum editörü iyileştirmeleri) tamamlandı, canlıda.
P3, orijinal istekteki d1 maddesini kapsar:

> "Konum ekle kısmına 'Kareye Tıkla – Taşı Oynat' şeklinde iki adet seçenek
> ile başlayalım. Kareye Tıkla seçeneği seçilince bu bölümündeki soru ve
> cevap hazırlama süreci sistemde var olan şekliyle kalsın, değişiklik
> yapmana gerek yok. Sadece Hızlı erişim kısmında soru çözen sporcu bir
> kareye tıkladığında, önce tıklanan kare açık yeşil renkte görünsün daha
> sonra geribildirim yap. Eğer sporcu cevap olarak yanlış bir kareye
> tıkladı ise bu sefer cevap karesi Açık Kırmızı renkte görünsün daha sonra
> geribildirim yap. Geri bildirim yapıldıktan sonra sporcu diğer soruya
> geçiş yapsın. Aynı soruyu tekrar çözemesin."

**Admin tarafında hiçbir değişiklik yok** — "Kareye Tıkla" soru
hazırlama süreci (`ExerciseForm.tsx` içindeki `BoardExerciseFields`)
aynen kalıyor, bu spec sadece **öğrenci (Hızlı Erişim) tarafını** kapsıyor.

Diğer alt projeler (P4-P6) ayrı spec'lerle, sırayla ilerleyecek.

## Kapsam

Tek dosya: `apps/web/components/lesson-steps/BoardExercise.tsx`, **sadece
`click_square` tipi için**. `move_piece`, `identify_piece`,
`sentence_question`, `image_question` tiplerinin öğrenci tarafı davranışı
**hiç değişmez** — hepsi bugünkü gibi yanlış cevapta tekrar deneme hakkı
sunmaya devam eder.

1. Tıklanan kare, doğruysa **açık yeşil**, yanlışsa **açık kırmızı**
   renklenir (şu an hiç renklenmiyor — sadece alttaki banner mesajı var).
2. Yanlış cevapta **tekrar deneme hakkı yok** — bugünkü davranış (1.8
   saniye sonra sıfırlanıp aynı soruyu tekrar denetme) sadece `click_square`
   için kaldırılıyor. Geri bildirim (banner) gösterildikten sonra sporcu
   "Sonraki Soru" butonuyla ilerler — tıpkı doğru cevapta olduğu gibi, aynı
   buton/akış yeniden kullanılıyor.
3. Son soru yanlış cevaplanırsa: yerel bir "sorular bitti" ekranı gösterilir
   (mevcut `onCorrect` callback'i **çağrılmaz** — bkz. aşağıdaki karar).

**Kapsam dışı:** Taşı Oynat modu (P5), puanlama/sonuç ekranı/kademeli kilit
açma (P6), doğru cevabın görsel olarak gösterilmesi (kullanıcı onaylamadı —
sadece tıklanan kare renklenir, doğru cevap ayrıca vurgulanmaz).

## Kritik tasarım kararı — tamamlanma sinyali

`BoardExercise`'in `onCorrect` prop'u bugün **sadece** dizideki TÜM sorular
doğru cevaplandığında çağrılıyor, ve iki farklı yerde gerçek bir yan etkisi
var:

- `apps/web/app/(child)/pratik/[mode]/page.tsx`: `onCorrect={() =>
  setSolved((s) => Math.min(s + 1, exercises.length))}` — "Kendini Test
  Et" modundaki **puan sayacını** artırıyor.
- `apps/web/app/(child)/modules/[id]/page.tsx`: `onCorrect={() =>
  markStepDone(l.id, step.id, steps)}` — ders adımını **tamamlandı**
  işaretliyor.

`click_square`'de tekrar deneme kaldırılınca, son soru yanlış cevaplanan
bir sporcu ortaya çıkabilir — bu durumda "tüm sorular doğru" hiç
gerçekleşmez. Eğer bu durumda da `onCorrect` çağrılırsa, **yanlış cevap
doğruymuş gibi puan sayılır** — "Kendini Test Et" puan gösterimini bozar.

**Karar (kullanıcı onayladı):** Bu durumda `onCorrect` **çağrılmaz**.
`BoardExercise` sadece kendi içinde, yerel bir "sorular bitti" terminal
ekranı gösterir (mevcut `done`/prop-tabanlı "Tüm egzersizler tamamlandı!"
ekranından **ayrı**, yeni bir internal state ile). Puanlama/ilerleme
kaydının bu senaryoda nasıl ele alınacağı **P6'nın kapsamına bırakılıyor**
— P6 zaten "20 soru, doğru/yanlış/boş tablosu, toplam puan" mantığını
baştan tasarlayacak; şimdiden yarım bir sinyal/prop icat etmek (YAGNI)
sonradan çakışma riski taşır.

## Veri modeli / state değişiklikleri

`BoardExercise` bileşenine 2 yeni state:

```ts
const [clickedSquare, setClickedSquare] = useState<string | null>(null);
const [allAttempted, setAllAttempted] = useState(false);
```

- `clickedSquare`: `click_square` tipinde tıklanan kareyi tutar (rengi
  belirlemek için). Soru değiştiğinde (`currentIdx` değiştiğinde) `null`'a
  sıfırlanır — mevcut per-exercise reset `useEffect`'ine eklenir.
- `allAttempted`: yalnızca "son `click_square` sorusu yanlış cevaplanıp
  dizi bittiğinde" `true` olur. `true` olduğunda component, tahta/soru
  yerine yerel bir "Bu bölümdeki tüm sorular cevaplandı." mesajı render
  eder (mevcut `done && !showNext` terminal branch'ine benzer ama ayrı).

## Davranış değişikliği — `fail()` fonksiyonu

Mevcut `fail(msg: string)`:

```ts
const fail = (msg: string) => {
  setStatus('fail');
  setFeedback(msg);
  setSelected(null);
  setTimeout(() => setStatus('idle'), 1800);
};
```

Yeni imza: `fail(msg: string, allowRetry: boolean = true)`. `allowRetry`
`false` verildiğinde (**sadece `click_square`'in `onSquareClick`
çağrısından**), `setTimeout` ile idle'a dönüş **atlanır** — bunun yerine
mevcut `succeed()`'in "ilerlet" mantığı çalıştırılır (ama `doneCount`
ARTIRILMADAN — yanlış cevap "doğru" sayılmamalı, ilerleme noktaları
sadece gerçek doğruları yansıtmaya devam etmeli):

- Son soru değilse: `setShowNext(true)` (mevcut "Sonraki Soru" butonu
  görünür, tıklanınca `goNext()` çalışır — hiçbir yeni buton/bileşen
  gerekmiyor).
- Son soruysa: `setAllAttempted(true)` (yeni terminal ekran, `onCorrect`
  ÇAĞRILMAZ).

`move_piece`, `identify_piece`, `sentence_question`/`image_question`'ın
`fail()` çağrıları **parametre eklemeden** aynen kalır (varsayılan
`allowRetry = true` ile mevcut davranış korunur — hiçbir kod değişikliği
gerekmiyor, sadece fonksiyon imzasına opsiyonel parametre eklenmiş olur).

## Davranış değişikliği — kare renklendirme

`click_square` için `succeed()`/`fail()` çağrılmadan HEMEN ÖNCE,
`onSquareClick`'in `click_square` dalında `setClickedSquare(square)`
çağrılır. Kare stilleri hesaplanırken (`styles` objesi) yeni bir blok:

```ts
if (exercise.type === 'click_square' && clickedSquare) {
  if (status === 'success') {
    styles[clickedSquare] = { backgroundColor: 'rgba(100,220,100,0.45)' }; // açık yeşil — move_piece'in başarı rengiyle aynı
  } else if (status === 'fail') {
    styles[clickedSquare] = { backgroundColor: 'rgba(239,68,68,0.45)' }; // açık kırmızı — fail banner'ının kırmızısıyla tutarlı
  }
}
```

Bu, mevcut hint_squares/selected renklendirme mantığıyla çakışmaz (farklı
bir koşul bloğu, aynı `styles` objesine ekleme yapar).

## Davranış değişikliği — tıklama sonrası kilit

`onSquareClick`'in en üstündeki mevcut koruma:

```ts
if (status === 'success' || !isBoardExercise(exercise)) return;
```

`status === 'success'` yerine `status !== 'idle'` olacak şekilde
genişletilir: `if (status !== 'idle' || !isBoardExercise(exercise))
return;`. Bu, `click_square`'de yanlış cevap sonrası `status` `'fail'`'de
kalırken (tekrar deneme yok, `allowRetry=false`) ek tıklamaların
yoksayılmasını sağlar. Diğer tipler için davranış değişmez — çünkü onlarda
`fail()` zaten 1.8 saniye içinde `status`'u `'idle'`'a döndürüyor, bu
pencere dışında ek tıklama zaten anlamlı değildi.

## Test stratejisi

Frontend (vitest + RTL, `apps/web/tests/board-exercise-click-square.test.tsx`):

- Doğru kareye tıklama → kare `rgba(100,220,100,0.45)` ile renklenir,
  başarı banner'ı görünür.
- Yanlış kareye tıklama → kare `rgba(239,68,68,0.45)` ile renklenir, hata
  banner'ı görünür, **1.8 saniye sonra bile** "Sonraki Soru" butonu
  görünür durumda kalır (idle'a dönmez).
- Yanlış cevap sonrası tekrar aynı veya başka bir kareye tıklama →
  hiçbir şey olmaz (durum değişmez, `onCorrect` çağrılmaz).
- Son soru yanlış cevaplanınca → yerel "sorular bitti" ekranı görünür,
  `onCorrect` **çağrılmaz** (mock ile doğrulanır).
- **Regresyon:** `move_piece` tipinde yanlış hamle sonrası hâlâ tekrar
  deneme hakkı var (1.8 saniye sonra idle'a döner, aynı soru devam eder).
- **Regresyon:** `identify_piece` ve `sentence_question`/`image_question`
  tiplerinde yanlış cevap sonrası hâlâ tekrar deneme hakkı var.
- **Regresyon:** son soru TÜM click_square sorular DOĞRU cevaplanarak
  bitirilirse, `onCorrect` hâlâ çağrılır (mevcut davranış korunuyor).

## Geriye uyumluluk (KURAL #3)

- `move_piece`/`identify_piece`/`sentence_question`/`image_question`
  tiplerinin öğrenci davranışı satır satır aynı kalır.
- `fail()`'e eklenen parametre opsiyonel ve varsayılan değeri mevcut
  davranışı korur — çağıran kodların çoğu hiç değişmez.
- `onCorrect`, `pratik/[mode]/page.tsx` ve `modules/[id]/page.tsx`'teki
  mevcut anlamıyla (yalnızca gerçekten tüm sorular doğruysa) çağrılmaya
  devam eder — puan sayacı ve ders ilerlemesi bu değişiklikten etkilenmez.
- Admin tarafı (`ExerciseForm.tsx`, `ChoiceExerciseFields.tsx`, backend
  doğrulama) bu spec kapsamında **hiç değişmiyor**.
