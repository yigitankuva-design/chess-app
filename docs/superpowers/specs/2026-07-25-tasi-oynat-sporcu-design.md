# Taşı Oynat — sporcu tarafı (P5): kurallı hamle + rakip cevabı

## Bağlam

"Yeni Soru" bölümünün yeniden tasarımının **beşinci alt projesi (P5)**.
P1-P4 tamamlandı, canlıda. P4'te Zafer Hoca yeni formatta
(`moves: string[]`, SAN dizisi) soru hazırlayabilir hale geldi ama sporcu
tarafında geçici bir **"Bu soru türü yakında aktif olacak"** placeholder'ı
duruyor. P5 o placeholder'ı gerçek çözüm ekranıyla değiştirir.

Kapsanan maddeler — orijinal istekteki d6 ve d7:

> d6: "Hızlı erişim bölümünde sporcu cevaplamalarını yaparken taşları şu
> şekilde hareket ettirsin: Taşa ve Kareye Tıklama Şeklinde [...] veya
> Taşı Sürükleme Şeklinde [...] sporcu kendi hamlesini yaptıktan sonra
> rakibinin hamlesi otomatik olarak cevap anahtarındaki hamleye göre veya
> bir satranç analiz motorunun önereceği hamleye göre gerçekleşsin [...]
> Taşların hareket ettirilmesi Uluslararası satranç kurallarına uygun
> şekilde gerçekleşsin. Kuraldışı hamleler, rok kuralları, geçerken alma
> ve terfi etme kuralları soru çözümlerinde geçerli olsun."

> d7: "sporcu hamlesini yaptıktan sonra geribildirim yap. Geri bildirim
> yapıldıktan sonra sporcu diğer soruya geçiş yapsın. Aynı soruyu tekrar
> çözemesin."

**Kapsam dışı:** Puanlama, sonuç tablosu, kademeli kilit açma (**P6**).

## Ölçülmüş gerçekler (spec yazılmadan önce tarayıcıda çalıştırılarak doğrulandı)

Bu spec aşağıdaki davranışları **varsaymıyor**, gerçek Stockfish worker'ı ile ölçtü:

| Pozisyon | FEN | Motor sonucu |
|---|---|---|
| Şahlı (gerçek prod sorusu) | `6k1/8/5K2/8/5R2/8/8/8 w` | ✅ `bestmove f4h4` |
| **Şahsız**, siyahın piyonu var | `8/4p3/8/8/8/8/4P3/8 b` | ✅ `bestmove e7e6` |
| **Şahsız**, sadece beyaz piyon | `8/8/8/8/8/8/4P3/8 w` | ✅ `bestmove e2e4` |
| Oynayacak tarafın hiç taşı yok | `8/8/8/8/5R2/8/8/4K3 b` | `bestmove (none)` |

**Sonuç:** Stockfish, Zafer Hoca'nın **şahsız öğretim pozisyonlarında
sorunsuz çalışıyor** — çökmüyor, geçerli hamle üretiyor. `(none)` yalnızca
gerçekten legal hamle olmadığında dönüyor ve bu durum güvenle ele alınmalı
(soruyu bitir, çökme yok).

Ayrıca P4'te ölçülen ve burada da geçerli olan bulgu: **`chess.js` şahsız
FEN'i `{ skipValidation: true }` olmadan reddediyor** (`Invalid FEN: missing
white king`).

## Roller ve indeks eşlemesi

Kaydedilen `fen`'de **sırası gelen taraf = sporcunun tarafı**. Hamle dizisi
satranç kurallarına göre dönüşümlü olduğundan (P4 backend'i bunu zorluyor):

- Sporcu: `moves[0]`, `moves[2]`, `moves[4]`, … (çift indeksler)
- Rakip: `moves[1]`, `moves[3]`, … (tek indeksler)

`playedMoves` (o ana kadar oynanan tüm hamleler) dizisinin **uzunluğu**
sıranın kimde olduğunu belirler: çift ise sporcu, tek ise rakip.

## Akış kuralı

1. **Sporcu hamlesini yapar** — taşa tıkla + hedef kareye tıkla, **veya**
   taşı sürükle. Her iki yöntem de desteklenir.
2. Yapılan hamlenin SAN'ı, beklenen hamleyle (`moves[playedMoves.length]`)
   karşılaştırılır:
   - **Eşleşiyorsa:** hamle tahtaya işlenir. Sıra rakibe geçer →
     **rakip cevabı** oynanır (aşağıdaki kurala göre). Sonra sıra tekrar
     sporcuya geçer.
   - **Eşleşmiyorsa:** hamle tahtaya İŞLENMEZ (taş yerine döner),
     geri bildirim gösterilir ve **sonraki soruya geçilir** — tekrar deneme
     hakkı yoktur (P3'teki Kareye Tıkla ile aynı kural).
3. **Soru tamamlanma koşulu:** Sporcunun cevap anahtarında oynayacağı başka
   hamle kalmadıysa VE rakibin (varsa) son cevabı oynandıysa → "Aferin" +
   sonraki soru.

### Rakip cevabı — kaynak önceliği (kullanıcı onayladı)

```
Rakibin sırası geldiğinde:
  moves[playedMoves.length] VAR MI?
    ├─ EVET → cevap anahtarındaki hamleyi oyna
    └─ HAYIR → MOTORDAN sor (Stockfish)
                 ├─ geçerli hamle döndü → oyna
                 └─ "(none)" veya hata → hamle yok, soruyu tamamla
```

Bu, kullanıcının kuralının birebir karşılığıdır: *"Zafer Hoca cevap anahtarı
oluşturduysa onu baz al, oluşturmadıysa rakip hamlesini motor yapsın."*

**Motorun gerçekte ne zaman çalışacağı:** Cevap anahtarı her zaman dönüşümlü
olduğu için (backend zorluyor), motor **yalnızca dizinin tek sayıda hamle
içerdiği durumda, sporcunun SON hamlesinden sonra** devreye girer — yani
öğretmen kendi hamlesini kaydedip rakibin cevabını kaydetmediğinde. Örnek:

- `['Rh4']` → sporcu Rh4 oynar → anahtarda rakip cevabı yok → **motor** siyahın
  cevabını oynar → soru tamamlanır (sporcu sonucu görür)
- `['Rh4','Kf8']` → sporcu Rh4 → rakip Kf8 (anahtardan) → sporcunun başka
  hamlesi yok → tamamlanır (motor çalışmaz)
- `['Rh4','Kf8','Rh8']` → sporcu Rh4 → rakip Kf8 (anahtar) → sporcu Rh8 →
  anahtarda rakip cevabı yok → **motor** oynar → tamamlanır

## Satranç kuralları

Tüm kural denetimi `chess.js`'e bırakılır — elle kural yazılmaz. Rok,
geçerken alma, terfi ve şah çekme otomatik doğru çalışır. Kural dışı bir
sürükleme `chess.js` tarafından reddedilir ve taş yerine döner (bu, "yanlış
cevap" sayılmaz — sadece geçersiz bir hareket).

**Bilinen sınır (proje geneli, P4 ile aynı):** Terfi her zaman **vezire**
yapılır (`promotion: 'q'`). Öğretmen `e8=A` (ata terfi) gibi bir hamle
kaydettiyse sporcu bunu oynayamaz. `BotGame`/`LiveGame`/`MoveRecorderBoard`
zaten aynı kısıtlamaya sahip; P5'e özgü yeni bir sınır değildir.

## `ChessBoard` düzeltmesi (kullanıcı onayladı)

`apps/web/components/ChessBoard.tsx` içinde üç yardımcı fonksiyon
(`getValidDestinations`, `getPieceColor`, `getTurnColor`) `new Chess(chessFen)`
çağırıyor ve hepsi `try/catch` ile sarılı, hata durumunda güvenli varsayılan
döndürüyor (`[]`, `null`, `'w'`).

**Gizli hata (P4'te ölçülerek bulundu):** Şahsız pozisyonlarda bu çağrılar
her zaman fırlatıyor, dolayısıyla `validMoves` daima boş kalıyor ve
**tıkla-oynat sessizce çalışmıyor**. Ölçüm:

| FEN | Tıkla-oynat `onPieceDrop` çağrısı |
|---|---|
| `8/8/8/8/8/8/4P3/8 w` (şahsız) | **0 kez** — sessizce çalışmıyor |
| `6k1/8/5K2/8/5R2/8/8/8 w` (şahlı) | 1 kez — çalışıyor |

**Düzeltme:** Bu üç çağrıya `{ skipValidation: true }` eklenir:

```ts
const chess = new Chess(chessFen, { skipValidation: true });
```

**Neden güvenli:** `skipValidation` yalnızca FEN doğrulamasını atlar.
Geçerli bir FEN'de doğrulama zaten geçtiği için davranış **birebir aynı**
kalır; sadece daha önce fırlatan (şahsız) pozisyonlar artık çalışır. Yani
değişiklik yetenek **ekler**, hiçbir mevcut davranışı değiştirmez.
`try/catch` blokları yerinde bırakılır (başka bir sebeple fırlarsa yine
güvenli varsayılana düşer).

Bu düzeltme `BotGame`, `LiveGame` ve `PuzzleSolver`'ı da kapsar — hepsi
`ChessBoard` kullanıyor. Regresyon testleriyle bu üçünün davranışının
değişmediği kanıtlanacak.

## Bileşen yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/chess/movePlayer.ts` | **Yeni** — saf mantık: sıra kimde, beklenen hamle, hamle uygula, tamamlandı mı |
| `apps/web/components/lesson-steps/MovePieceSolver.tsx` | **Yeni** — sporcu arayüzü (ChessBoard + durum metni + motor çağrısı) |
| `apps/web/components/lesson-steps/BoardExercise.tsx` | Değişiklik — placeholder yerine gerçek çözücü; `MovePieceEx` tipine `moves?` eklenir |
| `apps/web/components/ChessBoard.tsx` | Değişiklik — `skipValidation` düzeltmesi (3 satır) |

Sürükle-bırak (dnd-kit) test ortamında güvenilir simüle edilemediğinden,
tüm karar mantığı `movePlayer.ts` içindeki **saf fonksiyonlara** çıkarılır
ve orada kapsamlı test edilir — P4'teki `moveRecorder.ts` ile aynı desen.

### `movePlayer.ts` arayüzü

```ts
/** Şahsız öğretim pozisyonları için skipValidation ZORUNLU. */
function newPlayerChess(fen: string): Chess;

/** Başlangıçtan itibaren oynanan hamleleri uygulayıp son durumu döndürür. */
export function playerState(fen: string, playedMoves: string[]): {
  fen: string;                    // güncel pozisyon
  turn: 'w' | 'b';                // sırası gelen taraf
  isStudentTurn: boolean;         // playedMoves.length çift mi?
};

/** Sporcunun sırasıysa beklenen SAN hamlesi, değilse null. */
export function expectedStudentMove(
  answerKey: string[], playedMoves: string[],
): string | null;

/**
 * Sporcunun sürüklediği/tıkladığı hamleyi dener.
 *  - Kural dışıysa: { kind: 'illegal' }         → taş yerine döner, ceza yok
 *  - Anahtara uymuyorsa: { kind: 'wrong', san } → yanlış cevap
 *  - Doğruysa: { kind: 'correct', playedMoves } → güncellenmiş dizi
 */
export function tryStudentMove(
  fen: string, answerKey: string[], playedMoves: string[], from: string, to: string,
): { kind: 'illegal' } | { kind: 'wrong'; san: string } | { kind: 'correct'; playedMoves: string[] };

/** Rakibin sırası mı ve anahtarda cevabı var mı? */
export function opponentKeyMove(
  answerKey: string[], playedMoves: string[],
): string | null;

/** Sporcunun oynayacağı başka hamle kaldı mı? */
export function isSequenceComplete(
  answerKey: string[], playedMoves: string[],
): boolean;

/** Motorun UCI cevabını ('e7e6') SAN'a çevirip diziye ekler; geçersizse null. */
export function appendUciMove(
  fen: string, playedMoves: string[], uci: string,
): string[] | null;
```

### `MovePieceSolver` davranışı

- `ChessBoard`'u `interactive={!disabled}` ile render eder (ChessBoard'un
  prop adı `disabled` değil `interactive`'tir).
- **Tek callback, iki giriş yöntemi:** `onPieceDrop` hem sürüklemeden hem
  tıkla-tıkla yolundan gelir. Kod okunarak doğrulandı: `ChessBoard.tsx:110`
  satırında tıkla-tıkla akışı `onPieceDrop?.(selectedSquare, square)`
  çağırıyor, `:204-205`'te sürükleme aynı callback'e bağlanıyor. Yani
  `MovePieceSolver` tek bir işleyici yazarak d6'daki her iki yöntemi de
  karşılar.
- Sporcu doğru oynadığında rakibin cevabı **450 ms** gecikmeyle oynanır
  (`PuzzleSolver`'daki mevcut desenle aynı — hamle gözle takip edilebilsin).
- Motor gerektiğinde `StockfishEngine` başlatılır, cevap alınınca
  `destroy()` edilir. Motor `(none)` dönerse veya hata olursa soru sessizce
  tamamlanır.
- Bileşen `disabled` iken (soru cevaplanmışsa) tahta etkileşimsizdir.

### `BoardExercise` entegrasyonu

P4'te eklenen placeholder dalı gerçek çözücüyle değiştirilir:

```tsx
{exercise.type === 'move_piece' && 'moves' in exercise ? (
  <MovePieceSolver
    exercise={exercise}
    disabled={status !== 'idle'}
    onSolved={() => succeed()}
    onWrong={(msg) => failNoRetry(msg)}
  />
) : isBoardExercise(exercise) ? ( /* mevcut tahta JSX'i, değişmez */ ) : ( /* ChoiceQuestionBody */ )}
```

`succeed()` ve `failNoRetry()` P3'te yazılmış mevcut fonksiyonlardır —
**değiştirilmez**. Böylece ilerleme noktaları, "Sonraki Soru" butonu, soru
kodu rozeti ve terminal ekran davranışı diğer soru tipleriyle birebir aynı
kalır.

### Tip modeli — ayrık birleşim (opsiyonel alan DEĞİL)

P4'te bırakılan geçici tip tutarsızlığı (`'moves' in exercise` kontrolünün
tip sisteminde karşılığı olmaması) burada giderilir.

**Alanları opsiyonel yapmak YANLIŞ olurdu:** `piece_square?`/`target_squares?`
yapılsaydı, eski format dalındaki mevcut kod (`exercise.target_squares.forEach(...)`,
`exercise.target_squares.includes(square)`) TypeScript hatası verir ve her
kullanım yerine `?.`/`!` eklemek gerekirdi — tip güvenliği kaybedilirdi.

Bunun yerine `MovePieceEx` **iki üyeli bir birleşime** ayrılır:

```ts
/** Eski format: tek hamle, "şu taşı şu karelerden birine taşı". */
export interface MovePieceLegacyEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;      // zorunlu kalır
  target_squares: string[];  // zorunlu kalır
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

/** Yeni format (P4): SAN hamle dizisi. */
export interface MovePieceSequenceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  moves: string[];           // zorunlu
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

export type MovePieceEx = MovePieceLegacyEx | MovePieceSequenceEx;
```

TypeScript'in `in` operatörü birleşimleri daraltır: `'moves' in exercise`
ifadesi pozitif dalda `MovePieceSequenceEx`'e, negatif dalda
`MovePieceLegacyEx`'e daraltır. Böylece **mevcut eski-format kodu hiç
değişmeden tip güvenli kalır** ve yeni dalda `exercise.moves` doğrudan
okunabilir.

## Geriye uyumluluk (KURAL #3)

- **Eski format `move_piece` soruları** (`piece_square`/`target_squares`,
  `moves` YOK) sporcu tarafında **birebir eskisi gibi** çalışmaya devam
  eder — `'moves' in exercise` kontrolü onları eski JSX dalına yönlendirir.
  Canlıda böyle 1 soru var.
- `click_square`, `identify_piece`, `sentence_question`, `image_question`
  davranışları **hiç değişmez**.
- `ChessBoard` düzeltmesi yetenek ekler, davranış değiştirmez (yukarıda
  gerekçelendirildi) — `BotGame`/`LiveGame`/`PuzzleSolver` etkilenmez.
- Backend'e **hiç dokunulmaz** (P4'te tamamlandı), migration yok.

## Test stratejisi

**Saf mantık (`movePlayer.ts`, vitest):**
- Şahsız pozisyonda `playerState` çökmeden çalışır (skipValidation kanıtı).
- `expectedStudentMove`: çift indekste sporcu hamlesi, tek indekste `null`.
- `tryStudentMove`: doğru hamle → `correct`; anahtardan farklı ama legal
  hamle → `wrong`; kural dışı hamle → `illegal`.
- `opponentKeyMove`: anahtarda varsa hamle, yoksa `null` (motor sinyali).
- `isSequenceComplete`: sporcunun son hamlesinden sonra `true`.
- `appendUciMove`: `'e7e6'` → SAN'a çevrilip eklenir; geçersiz UCI → `null`.
- Rok / geçerken alma / terfi hamlelerinin SAN karşılaştırmasının doğru
  çalıştığı (örn. `O-O`, `exd6`, `e8=Q`).

**Bileşen (`MovePieceSolver`, vitest):**
- Yeni format bir soruda tahta (64 kare) render edilir, placeholder yok.
- `disabled` iken tahta etkileşimsizdir.

**Regresyon (`ChessBoard` düzeltmesi):**
- **Şahsız** pozisyonda tıkla-oynat artık `onPieceDrop`'u çağırır
  (düzeltmeden önce 0 kez çağrılıyordu — bu test düzeltmenin kanıtı).
- **Şahlı** pozisyonda tıkla-oynat eskisi gibi çalışmaya devam eder.
- Mevcut `chess-board.test.tsx` (2 test) aynen geçer.

**Dürüst not — kapsam boşluğu:** `PuzzleSolver`, `BotGame` ve `LiveGame`
için repoda **hiç test dosyası yok** (kontrol edildi: `tests/` altında
yalnızca `chess-board.test.tsx` var). `ChessBoard` düzeltmesinin bu üçünü
bozmadığını otomatik testle kanıtlayamam; gerekçe kod analizine dayanıyor
(`skipValidation` yalnızca geçersiz FEN'lerde davranış değiştirir, geçerli
FEN'lerde doğrulama zaten geçiyordu). Canlı doğrulamada (KURAL #6) Bota
Karşı Oyna ekranı elle açılıp bir hamle oynanarak bozulmadığı gözlenecek.

**Regresyon (`BoardExercise`):**
- **Eski format** `move_piece` sorusu hâlâ tahtayı render eder ve hamle
  çözümü eskisi gibi çalışır.
- `click_square` / `identify_piece` / seçenek tipleri etkilenmez.

**Canlı doğrulama (KURAL #6):** Gerçek prod API'ye karşı:
1. Admin panelinde (P4 akışıyla) iki taraflı bir çoklu hamle sorusu
   oluşturulur, sporcu ekranında tıkla-tıkla ile çözülür.
2. **Şahsız öğretim pozisyonu** ile bir soru oluşturulup tıkla-oynatın
   çalıştığı doğrulanır (ChessBoard düzeltmesinin kanıtı).
3. **Motor yedeği** senaryosu: tek hamlelik bir anahtar kaydedilip rakibin
   cevabının motordan geldiği gözlenir.
4. **Yanlış hamle** → geri bildirim + sonraki soru davranışı doğrulanır.
5. **Regresyon:** Bota Karşı Oyna ekranı açılıp bir hamle oynanır
   (ChessBoard düzeltmesinin mevcut özellikleri bozmadığının kanıtı).
6. Test verisi silinir, yerel ortam temizlenir.
