# Admin "Yeni Soru" İyileştirmeleri (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Yedi bağımsız küçük iyileştirme (a–g), admin panelindeki "Yeni Soru"
formunda ve (madde a özelinde) sporcunun soru çözerken gördüğü tahtada.

---

## Genel yaklaşım

Bu yedi madde birbirinden bağımsız, çoğu tek dosyalık değişiklikler. Ayrı
alt projelere bölünmeye gerek yok — tek bir plan ve tek bir uygulama turunda
hepsi yapılabilir. Sıra: önce paylaşılan hook (a), sonra küçük CSS
düzeltmeleri (c, d, f), sonra veri etkileşimli değişiklikler (e), en son
yeni bileşen (g).

---

## a) Sağ-tık kare renklendirme — hem admin hem sporcu tahtası

**Amaç (kullanıcının kendi ifadesiyle):** "renklerin bir görevi yok, Zafer
Hoca veya sporcu için sadece tahtada hesap yapabilme adına dikkatini
toplayabilmesi ve odaklanma amacı ile kullanılacak." Yani bu **kaydedilmeyen,
tamamen geçici bir görsel araç** — lichess/chess.com'daki sağ-tık kare/ok
işaretleme özelliğinin sade bir versiyonu.

**Doğrulanmış teknik zemin:** `react-chessboard` (`node_modules/react-chessboard/dist/ChessboardProvider.d.ts`)
`onSquareRightClick?: ({ piece, square }) => void` ve `squareStyles?: Record<string, CSSProperties>`
seçeneklerini native destekliyor; kütüphane tarayıcının varsayılan sağ-tık
menüsünü de kendisi engelliyor (`index.esm.js:1728`, `windowListeners.add(EventName.ContextMenu, preventDefault)`).
Yani ek bir `contextmenu` event yönetimine gerek yok.

`onSquareRightClick` callback'i klavye tuşlarını (`ctrlKey`/`altKey`) vermiyor
— bu yüzden Ctrl/Alt durumunu ayrı `window` `keydown`/`keyup` dinleyicileriyle
takip edeceğiz.

**Yeni dosya:** `apps/web/lib/chess/useSquareAnnotations.ts`

```ts
export type AnnotationColor = 'green' | 'red' | 'blue' | 'yellow';

export function useSquareAnnotations(resetKey: unknown): {
  squareStyles: Record<string, React.CSSProperties>;
  onSquareRightClick: (args: { square: string }) => void;
}
```

- İçeride `useRef` ile `ctrlDown`/`altDown` durumu, `window.addEventListener('keydown'/'keyup', ...)` ile güncellenir (component unmount'ta temizlenir).
- Renk seçimi: sade sağ-tık → yeşil, Ctrl+sağ-tık → kırmızı, Alt+sağ-tık →
  mavi, Ctrl+Alt+sağ-tık → sarı.
- `onSquareRightClick`: aynı kareye aynı renkle tekrar tıklanırsa o karenin
  rengi silinir (toggle); farklı renkle tıklanırsa üzerine yazılır.
- `resetKey` değiştiğinde (`useEffect`) işaretler tamamen temizlenir — yeni
  soru açılınca veya FEN değişince eski işaretler sporcuyu/hocayı yanıltmasın.
- **Hiçbir yere kaydedilmez, hiçbir API çağrısı yapmaz.** Tamamen bileşen
  içi state.

**Renk değerleri (yarı saydam, mevcut tahta temasıyla uyumlu):**
```ts
const COLORS: Record<AnnotationColor, string> = {
  green:  'rgba(74, 222, 128, 0.55)',
  red:    'rgba(248, 113, 113, 0.55)',
  blue:   'rgba(96, 165, 250, 0.55)',
  yellow: 'rgba(250, 204, 21, 0.55)',
};
```

**Kullanım yerleri:**
- `apps/web/components/BoardEditor.tsx` — `ChessboardProvider` options'a
  `squareStyles` ve `onSquareRightClick` eklenir, `resetKey` olarak `fen`
  (yeni soruya geçince/tahta değişince temizlensin) verilir.
- `apps/web/components/ChessBoard.tsx` — aynı hook, `resetKey` olarak `fen`
  prop'u kullanılır (bileşen zaten `fen` alıyor). Bu, `BotGame`, `BoardExercise`,
  `MovePieceSolver`, `puzzle` gibi `ChessBoard`'u kullanan **tüm** ekranlara
  otomatik olarak yayılır — ek entegrasyon gerekmez, tek noktadan eklenir.

**Geriye uyumluluk (KURAL #3):** Bu değişiklik hiçbir veri modelini,
hiçbir kaydetme akışını etkilemiyor. Sadece sağ-tık davranışı eskiden "hiçbir
şey yapmıyordu" (tarayıcı context menüsü açılıyordu), şimdi kare boyayacak.
Var olan sol-tık/sürükle-bırak akışlarına dokunulmuyor.

---

## b) Taşa tıklayınca silme — ZATEN YAPILMIŞ

`BoardEditor.tsx:124-132` (`handlePieceClick`), P2'de eklenmiş: palet seçili
değilken tahtadaki bir taşa tıklamak onu siler. Bu maddede yeni kod
YAZILMAYACAK — sadece canlı doğrulamada (KURAL #6) tekrar teyit edilecek.

---

## c) "Başlangıç konumu" / "Tahtayı temizle" ortalama

`BoardEditor.tsx:214`:
```tsx
<div className="flex flex-wrap items-center gap-2">
```
→
```tsx
<div className="flex flex-wrap items-center justify-center gap-2" style={{ maxWidth: 440 }}>
```
`maxWidth: 440`, tahtanın sarmalayıcısıyla aynı genişlik (satır 159) —
böylece butonlar görsel olarak tahtanın altında ortalanmış görünür.

---

## d) "Doğru kare(ler)" isimlerini %50 büyüt

`ExerciseForm.tsx:64`, `SquarePicker` içindeki buton class'ı:
```tsx
className={`text-[10px] py-1 rounded transition-colors ${...}`}
```
→
```tsx
className={`text-[15px] py-1.5 rounded transition-colors ${...}`}
```
(`10px→15px` tam %50; `py-1→py-1.5` metin büyüyünce buton orantılı büyüsün diye.)

---

## e) Zorluk düzeyi: Kolay / Orta / Zor

**Veri modeli değişmiyor** — `difficulty` hâlâ 1-5 arası `number`. Sadece UI,
3 etiketli butona dönüşüyor: **Kolay→1, Orta→3, Zor→5**.

**Geriye uyumluluk (KURAL #3):** var olan bir soru `difficulty: 2` veya `4`
ile kayıtlıysa, formu açınca en yakın etikete göre görsel olarak vurgulanır
(2→Kolay vurgulu, 4→Zor vurgulu) ama kullanıcı o butona **tıklamadan**
kaydederse `difficulty` alanı değişmeden (2 veya 4 olarak) gönderilir. Sadece
kullanıcı bilfiil bir etikete tıklarsa değer 1/3/5'e güncellenir. Bu, hiçbir
eski sorunun sessizce değiştirilmemesini garanti eder.

**Aynı desen iki dosyada tekrarlandığı için ikisi de değişecek:**
- `apps/web/components/admin/ExerciseForm.tsx:270-281` (Konum Ekle formu)
- `apps/web/components/admin/ChoiceExerciseFields.tsx:183-194` (Cümle/Görüntü Ekle formu)

Yeni buton grubu (ikisinde de aynı):
```tsx
const DIFFICULTY_LABELS: [number, string][] = [[1, 'Kolay'], [3, 'Orta'], [5, 'Zor']];

function nearestLabel(d: number): number {
  if (d <= 2) return 1;
  if (d === 3) return 3;
  return 5;
}
```
```tsx
<div className="flex gap-2">
  {DIFFICULTY_LABELS.map(([val, label]) => (
    <button key={val} type="button" onClick={() => setDifficulty(val)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
        nearestLabel(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
      }`}>{label}</button>
  ))}
</div>
```
`nearestLabel(difficulty)` ile karşılaştırma sayesinde `difficulty=2` iken
"Kolay" butonu vurgulu görünür ama `difficulty` state'i tıklanana kadar `2`
kalır.

---

## f) Dairesel soru kodu kartları — küçült + kodu büyüt

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx:302-325`:
- Grid: `gridTemplateColumns: 'repeat(10, minmax(0,1fr))'` → `'repeat(12, minmax(0,1fr))'`
  (aynı genişlikte daha fazla/küçük hücre → kartlar küçülür).
- Kod numarası font-size (satır 314, inline style): `0.65rem` → `0.85rem`.

---

## g) Ctrl+V ile görsel yapıştırma (sadece ana soru görseli)

`ChoiceExerciseFields.tsx:108-122` (`image_question` dalı), "Görsel seç"
etiketinin (satır 113-116) yanına yeni bir yapıştırma alanı eklenir:

```tsx
<div
  role="button"
  tabIndex={0}
  onPaste={handlePaste}
  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs
    border border-dashed border-white/25 text-white/50 cursor-text
    focus:border-cyan-400 focus:text-cyan-200 outline-none"
>
  📋 Buraya tıkla, sonra Ctrl+V ile yapıştır
</div>
```

```ts
async function handlePaste(e: React.ClipboardEvent) {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  const file = item.getAsFile();
  if (!file) return;
  await onPromptImageFile(file); // MEVCUT fonksiyon — dosya seçmekle birebir aynı yol
}
```

`onPromptImageFile` zaten `compressImageToDataUri` üzerinden geçiyor
(`imageCompress.ts:6-25` — max 800px, JPEG kalite kademeli düşürme, max
400KB) — yapıştırılan görsel de **aynı boyut/format sınırlamasından** geçer,
ayrı bir kod yolu açılmıyor.

**Kapsam dışı (kullanıcı onayladı):** cevap seçeneklerinin görselleri
(`option-image-*`, satır 161-166) bu turda değişmiyor.

---

## Test stratejisi

- **`useSquareAnnotations.ts`**: saf mantık, vitest ile — sade/Ctrl/Alt/Ctrl+Alt
  renk ataması, aynı renkle toggle temizleme, farklı renkle üzerine yazma,
  `resetKey` değişince temizlenme.
- **`BoardEditor.tsx` / `ChessBoard.tsx`**: mevcut render testlerine sağ-tık
  senaryosu eklenir (`fireEvent.contextMenu`), `squareStyles` doğru rengi
  içeriyor mu kontrol edilir.
- **Zorluk eşlemesi**: `nearestLabel` fonksiyonu için saf birim testleri
  (1,2→Kolay; 3→Orta; 4,5→Zor) + "tıklanmadan kaydedilirse değer değişmez"
  senaryosu.
- **Ctrl+V**: `fireEvent.paste` ile sahte `DataTransfer` — `onPromptImageFile`
  çağrıldığını doğrular (gerçek clipboard API'si jsdom'da tam simüle
  edilemez, bu sınır açıkça belirtilecek).
- **Canlı doğrulama (KURAL #6)**: admin panelinde gerçek sağ-tık ile 4 rengi,
  taşa tıklayınca silmeyi, buton hizalamasını, zorluk seçimini, dairesel kart
  boyutunu ve gerçek bir ekran görüntüsü yapıştırmayı tarayıcıda sürerek
  doğrularım. Sporcu tarafında `ChessBoard` kullanan bir ekranda (örn. Bota
  Karşı Oyna) sağ-tık renklendirmeyi ayrıca test ederim.

---

## Kapsam dışı

- Sağ-tık renklerinin kaydedilmesi/öğrenciye farklı bir anlamla gösterilmesi
  (kullanıcı açıkça "görevi yok" dedi)
- Cevap seçeneklerinin görsellerine yapıştırma desteği
- Ok çizme (arrow) özelliği — sadece kare renklendirme istendi
