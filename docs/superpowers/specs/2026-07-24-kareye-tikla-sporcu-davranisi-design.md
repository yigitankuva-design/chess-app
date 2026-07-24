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
- `allAttempted`: dizinin sonuna gelindiğinde (aşağıdaki koşullarla)
  `true` olur ve terminal ekranı gösterir. **Reset `useEffect`'inde
  SIFIRLANMAZ** — terminal bir durumdur.

## KRİTİK — bitiş tespiti `doneCount` ile yapılamaz

Mevcut `succeed()` dizinin sonuna gelindiğini `doneCount` üzerinden anlıyor:

```ts
const next = doneCount + 1;
if (next >= total) { if (!done) onCorrect(); } else { setShowNext(true); }
```

Bu bugün doğru çalışıyor **çünkü** `click_square`'de her soru doğru
cevaplanmadan ilerlenemiyor — dolayısıyla `doneCount` her zaman
`currentIdx + 1`'e eşit. Yanlış cevapta da ilerleme getirildiğinde bu iki
değer **ayrışır** ve bitiş tespiti bozulur.

**Somut hata senaryosu (3 soru):** Q1 doğru (`doneCount`=1) → Q2 yanlış
(`doneCount`=1 kalır) → Q3 doğru → `next` = 2, `2 >= 3` false →
`setShowNext(true)`. Ama Q3 son soru; `goNext()` içindeki
`Math.min(i + 1, total - 1)` indeksi ilerletemez → **sporcu son soruda
kilitlenir, ölü bir "Sonraki Soru" butonuyla baş başa kalır.**

**Çözüm:** Bitiş tespiti indeks üzerinden yapılır:

```ts
const isLastQuestion = currentIdx === total - 1;
```

Bu değişiklik diğer tipler için **davranışsal olarak no-op**'tur: onlarda
her soru doğru cevaplanmak zorunda olduğundan `doneCount + 1 >= total`
ile `currentIdx === total - 1` matematiksel olarak eşdeğerdir.

`onCorrect()` ise **ayrı** bir koşula bağlanır — sadece gerçekten tüm
sorular doğruysa (`doneCount + 1 === total`) çağrılır. Böylece kullanıcının
onayladığı "yanlış cevap puan saydırmaz" kuralı korunur.

Yeni `succeed()`:

```ts
const succeed = (piece?: string | null) => {
  if (piece) playPieceSound(piece);
  setStatus('success');
  setSelected(null);
  const next = doneCount + 1;
  setDoneCount(next);
  if (!isLastQuestion) {
    setShowNext(true);
  } else if (next >= total) {
    if (!done) onCorrect();      // hepsi doğru — mevcut davranış aynen korunur
  } else {
    setAllAttempted(true);       // dizi bitti ama bazıları yanlıştı
  }
};
```

## Davranış değişikliği — yeni `failNoRetry()` fonksiyonu

Mevcut `fail(msg: string)` fonksiyonuna **hiç dokunulmaz** — imzası da
gövdesi de aynen kalır. Böylece `move_piece`, `identify_piece`,
`sentence_question`, `image_question` çağrı noktalarının etkilenme
ihtimali sıfırdır. (Boolean parametre eklemek yerine ayrı fonksiyon
tercih edildi: hem "boolean trap" antipattern'inden kaçınılıyor, hem
mevcut çağrı noktaları hiç dokunulmadığı için regresyon riski kalmıyor.)

Yanına yeni bir fonksiyon eklenir — **yalnızca `click_square` kullanır**:

```ts
// Kareye Tıkla'da yanlış cevapta tekrar deneme yok: geri bildirim gösterilir,
// sonra sporcu sonraki soruya geçer. doneCount ARTIRILMAZ — yanlış cevap
// ilerleme noktalarında doğru gibi görünmemeli.
const failNoRetry = (msg: string) => {
  setStatus('fail');
  setFeedback(msg);
  setSelected(null);
  if (!isLastQuestion) {
    setShowNext(true);
  } else {
    setAllAttempted(true);
  }
};
```

`setTimeout` ile idle'a dönüş **yoktur** — durum `'fail'`'de kalır, kare
kırmızı görünmeye devam eder, sporcu "Sonraki Soru" ile ilerler.

**"Sonraki Soru" butonunun mevcut gate'i (`showNext && doneCount < total`)
değiştirilmemelidir.** Yeni akışta `setShowNext(true)` yalnızca son soru
DEĞİLKEN çağrıldığından `doneCount ≤ currentIdx + 1 ≤ total - 1 < total`
her zaman sağlanır; buton hiçbir senaryoda yanlışlıkla gizlenmez.

## Davranış değişikliği — `click_square` dalı

`onSquareClick` içindeki `click_square` dalı:

```ts
if (exercise.type === 'click_square') {
  if (piece) playPieceSound(piece.pieceType);
  setClickedSquare(square);
  if (isTargetSquare(square, exercise.target_squares)) {
    succeed();
  } else {
    failNoRetry(exercise.fail_msg ?? 'Yanlış kare!');
  }
  return;
}
```

Varsayılan hata mesajı `'Yanlış kare! Tekrar dene.'` → `'Yanlış kare!'`
olarak değişir, çünkü artık tekrar deneme hakkı yok — eski metin sporcuyu
yanıltırdı. (Öğretmen adminde kendi `fail_msg`'ini yazdıysa o kullanılmaya
devam eder.)

## Davranış değişikliği — kare renklendirme

Kare stilleri hesaplanırken (`styles` objesi), mevcut
`isBoardExercise(exercise)` bloğunun **EN SONUNA**, mevcut tüm
renklendirme mantığından (hint_squares sarı, selected mavi, move_piece
başarı yeşili) **SONRA** eklenir — böylece tıklanan karenin rengi
diğerlerinin üzerine yazar:

```ts
    if (exercise.type === 'click_square' && clickedSquare) {
      if (status === 'success') {
        styles[clickedSquare] = { backgroundColor: 'rgba(100,220,100,0.45)' }; // açık yeşil — move_piece başarı rengiyle aynı
      } else if (status === 'fail') {
        styles[clickedSquare] = { backgroundColor: 'rgba(239,68,68,0.45)' };   // açık kırmızı — fail banner'ının kırmızısıyla tutarlı
      }
    }
```

Diğer tiplerin renklendirmesi (`hint_squares`, `selected`,
`move_piece` hedefleri) hiç değişmez.

## Davranış değişikliği — tıklama sonrası kilit (tipe özel olmalı)

`onSquareClick`'in en üstündeki mevcut koruma:

```ts
if (status === 'success' || !isBoardExercise(exercise)) return;
```

`click_square`'de yanlış cevaptan sonra `status` `'fail'`'de kalacağı için
(idle'a dönüş yok), ek tıklamaların yoksayılması gerekiyor.

**DİKKAT — bunu `status !== 'idle'` şeklinde genelleştirmek REGRESYONDUR.**
`move_piece`'te yanlış hamleden sonraki 1.8 saniyelik `'fail'` penceresi
boyunca sporcu şu an **hemen** tekrar deneyebiliyor (`fail()` `selected`'ı
`null`'ladığı için taşı yeniden seçip oynayabiliyor). Genel bir
`status !== 'idle'` koruması bu hakkı elinden alır ve sporcuyu 1.8 saniye
beklemeye zorlar — istenmeyen bir davranış değişikliği.

Bu yüzden koruma **tipe özel** yazılır:

```ts
if (!isBoardExercise(exercise)) return;
if (status === 'success') return;
// Kareye Tıkla'da yanlış cevaptan sonra soru kilitlenir (tekrar deneme yok).
if (exercise.type === 'click_square' && status === 'fail') return;
```

Böylece `move_piece`'in mevcut anında-tekrar-deneme davranışı satır satır
korunur; yalnızca `click_square` kilitlenir.

## Test stratejisi

Frontend (vitest + RTL, `apps/web/tests/board-exercise-click-square.test.tsx`):

- Doğru kareye tıklama → kare `rgba(100,220,100,0.45)` ile renklenir,
  başarı banner'ı görünür.
- Yanlış kareye tıklama → kare `rgba(239,68,68,0.45)` ile renklenir, hata
  banner'ı görünür, "Sonraki Soru" butonu çıkar.
- Yanlış cevap sonrası **sahte zamanlayıcı ile 2 saniye ilerletilse bile**
  (`vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)`) durum `'fail'`'de
  kalır, buton kaybolmaz — yani idle'a dönen bir `setTimeout` kurulmamış
  olduğu kanıtlanır.
- Yanlış cevap sonrası tekrar aynı veya başka bir kareye tıklama →
  hiçbir şey olmaz (`onCorrect` çağrılmaz, ilerleme noktası artmaz).
- Yanlış cevap `doneCount`'u artırmaz → ilerleme göstergesi (`0/3` gibi)
  yanlış cevaptan sonra da aynı kalır.
- **KİLİTLENME REGRESYONU (en kritik):** 3 soruluk dizide Q1 doğru →
  Q2 yanlış → Q3 doğru senaryosunda, Q3'ten sonra "Sonraki Soru" butonu
  görünMEZ ve terminal ekran görünür — sporcu son soruda takılı kalmaz.
  (Bu, `doneCount` yerine `currentIdx` tabanlı bitiş tespitinin çalıştığını
  kanıtlar.)
- Son soru yanlış cevaplanınca → yerel "sorular bitti" ekranı görünür,
  `onCorrect` **çağrılmaz** (mock ile doğrulanır).
- **Regresyon:** `move_piece` tipinde yanlış hamle sonrası hâlâ tekrar
  deneme hakkı var — `'fail'` penceresi içinde (1.8 saniye dolmadan)
  yapılan tıklama hâlâ işleniyor, sporcu beklemek zorunda değil.
- **Regresyon:** `identify_piece` ve `sentence_question`/`image_question`
  tiplerinde yanlış cevap sonrası hâlâ tekrar deneme hakkı var.
- **Regresyon:** tüm click_square sorular DOĞRU cevaplanarak bitirilirse,
  `onCorrect` hâlâ çağrılır (mevcut davranış korunuyor).

## Geriye uyumluluk (KURAL #3)

- `move_piece`/`identify_piece`/`sentence_question`/`image_question`
  tiplerinin öğrenci davranışı aynı kalır.
- `fail()` fonksiyonuna **hiç dokunulmaz** — yeni davranış ayrı bir
  `failNoRetry()` fonksiyonunda, yalnızca `click_square` onu çağırır.
- `onCorrect`, `pratik/[mode]/page.tsx` ve `modules/[id]/page.tsx`'teki
  mevcut anlamıyla (yalnızca gerçekten tüm sorular doğruysa) çağrılmaya
  devam eder — puan sayacı ve ders ilerlemesi bu değişiklikten etkilenmez.
- Admin tarafı (`ExerciseForm.tsx`, `ChoiceExerciseFields.tsx`, backend
  doğrulama) bu spec kapsamında **hiç değişmiyor**.

**Dürüst uyarı — bu iş "sadece ekleme" değil.** Paylaşılan iki kod yolu
gerçekten değişiyor:

1. `succeed()` — bitiş tespiti `doneCount` yerine `currentIdx` tabanlı
   olacak. Diğer tipler için matematiksel olarak eşdeğer (davranış
   değişmez) ama **kod tüm tipler için ortak**, dolayısıyla regresyon
   testleriyle korunmalı.
2. `onSquareClick` guard'ı — tipe özel bir koşul ekleniyor. Yanlış
   genelleştirilirse (`status !== 'idle'`) `move_piece`'in anında
   tekrar-deneme hakkı kaybolur.

Bu yüzden test stratejisindeki regresyon testleri (özellikle "kilitlenme"
ve "move_piece hâlâ hemen tekrar denenebiliyor") bu işin en kritik
parçasıdır. TDD sırası: önce mevcut davranışı kilitleyen regresyon
testleri, sonra `succeed()` refactoru, sonra yeni `click_square` akışı.
