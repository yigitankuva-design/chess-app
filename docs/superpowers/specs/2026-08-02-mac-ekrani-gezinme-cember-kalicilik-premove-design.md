# Maç Ekranı: Geçmiş Gezinme, Çember İşaretleme, Yenileme Kalıcılığı, Premove

**Tarih:** 2026-08-02
**Kapsam:** Hızlı Erişim → maç ekranları (Bot + İnsan) ve hamle tabanlı pratik soruları.
**Kapsam dışı:** "Süresiz Pratik'te 20 soru gelmiyor" maddesi — kullanıcı isteğiyle ertelendi.

---

## Amaç

Sporcunun maç ve pratik sırasında yaşadığı dört sorunu çözmek:

1. Oynanmış hamlelere geri bakamıyor (mouse tekerleği / notasyona tıklama ile).
2. Sağ-tık işaretlemesi kareyi tamamen boyuyor; çember istenmiyor.
3. Bot maçında sayfa yenilenince oyun sıfırdan başlıyor.
4. Rakip düşünürken önceden hamle verilemiyor (premove yok).

---

## Teslim Sırası

Küçük ve düşük riskli maddeler önce teslim edilir:

| Sıra | Madde | Risk |
|---|---|---|
| A | Madde 2 — çember işaretleme | Düşük (yalnız görsel) |
| B | Madde 3 — bot maçı yenileme kalıcılığı | Düşük (yalnız istemci) |
| C | Madde 1 — geçmiş gezinme | Orta (paylaşılan bileşen) |
| D | Madde 5 — premove | Orta (etkileşim modeli) |

Her madde kendi test kapısını geçtikten sonra bir sonrakine geçilir. A ve B tamamlandığında ara teslim yapılabilir.

---

## A. Madde 2 — Kare işaretlemesi: dolgu yerine çember

### Mevcut durum

`lib/chess/useSquareAnnotations.ts` sağ-tıkta kareye yarı saydam **dolgu rengi** uyguluyor
(`squareStyles[sq] = { backgroundColor: COLORS[color] }`). Ctrl/Alt kombinasyonlarıyla dört
renk seçilebiliyor (yeşil / kırmızı / mavi / sarı).

**Kontrolde doğrulandı:** İstenilen temizleme davranışı ZATEN çalışıyor —
`ChessBoard.tsx` sol tıkta `clearAnnotations()` çağırıyor, hook da `resetKey` (FEN)
değişince işaretleri siliyor. Bu maddede yeni temizleme mantığı YAZILMAZ.

### Değişiklik

Dolgu yerine kare sınırına oturan çember çizilir:

```ts
squareStyles[sq] = {
  boxShadow: `inset 0 0 0 3px ${COLORS[color]}`,
  borderRadius: '50%',
};
```

`inset` gölge kutunun İÇİNE çizilir; kare dışına taşmaz. `borderRadius: 50%` gölgeyi
daireye çevirir. Kare zemin rengi (`buildSquareStyles`'ten gelen `backgroundColor`)
KORUNUR — çember zeminin üstüne biner, zemin görünür kalır.

Renkler tam opak yapılır (`0.55` → `1`), çünkü ince bir çember yarı saydam olduğunda
zor seçiliyor. Dört renkli Ctrl/Alt sistemi aynen korunur.

### Etkilenen testler

`tests/use-square-annotations.test.tsx` ve `tests/chess-board-annotations.test.tsx`
toplam 10+ yerde `backgroundColor` değeri doğruluyor. Bunlar `boxShadow` beklentisine
çevrilir. Testlerin doğruladığı DAVRANIŞ (renk seçimi, aynı renge ikinci tıkta silme,
FEN değişince temizlenme) aynen korunur — yalnız assert edilen CSS özelliği değişir.

---

## B. Madde 3 — Bot maçında sayfa yenilemesi

### Kök neden (doğrulandı)

`components/BotGame.tsx` oyun durumunu tamamen React state/ref'te tutuyor:
`chessRef`, `fen`, `whiteTime`/`blackTime`, `drawOffersUsed`, `gameIdRef`. Bileşen her
mount olduğunda `POST /games/bot/start` çağırıp **yeni bir oyun** açıyor. Backend'e her
hamle `persistMove()` ile yazılıyor ama mount sırasında geri OKUNMUYOR.

`components/LiveGame.tsx`'te bu sorun YOK: WebSocket bağlanınca sunucudan `game_info`
mesajı `current_fen`, `moves`, `status` ve saatlerle geliyor ve tahta doğru kuruluyor.
İnsan-insan maçlarına DOKUNULMAZ.

### Çözüm

Yeni saf modül: `lib/play/botGameSession.ts` — `lib/play/practiceSession.ts` ile aynı
desende (sessionStorage, sekmeye özel, bozuk kayda dayanıklı).

```ts
export interface StoredBotGame {
  gameId: number | null;
  /** Oynanmış hamleler, UCI. Tahta bunlardan yeniden kurulur. */
  moves: string[];
  whiteTime: number;
  blackTime: number;
  drawOffersUsed: number;
}

export function botGameKey(skillLevel: number, studentColor: 'w' | 'b', startFen?: string): string;
export function loadBotGame(key: string): StoredBotGame | null;
export function saveBotGame(key: string, data: StoredBotGame): void;
export function clearBotGame(key: string): void;
```

Anahtar `skillLevel`, `studentColor` ve `startFen`'i içerir; sporcu farklı seviye/renk
veya farklı açılış seçtiğinde eski kayıt karışmaz.

`BotGame.tsx` davranışı:

- **Mount:** Önce `loadBotGame()` denenir. Kayıt varsa `chessRef` başlangıç FEN'inden
  kayıttaki UCI hamleleri oynatılarak kurulur, saatler ve teklif hakkı geri yüklenir,
  `gameIdRef` kayıttaki id olur — `POST /games/bot/start` **çağrılmaz**. Kayıt yoksa
  mevcut davranış aynen sürer (yeni oyun açılır).
- **Her hamleden sonra** (sporcu ve bot) `saveBotGame()` çağrılır.
- **Oyun bitince** (`finish`, `resignToBot`, süre bitimi, bot beraberliği kabul)
  `clearBotGame()` çağrılır — sporcu "yeniden oyna" dediğinde bitmiş maçla karşılaşmaz.

Bozuk/eksik kayıt (`loadBotGame` null döner veya hamleler oynatılamaz) sessizce yok
sayılır ve yeni oyun açılır. Ekran hiçbir durumda kilitlenmez.

### Sınır (bilinçli kabul)

Sekme kapatılırsa oyun kaybolur. Bu, pratik oturumlarında zaten kabul edilmiş sınırdır
ve kullanıcı tarafından onaylandı. Sunucudan geri okuma (yeni endpoint) YAPILMAZ.

---

## C. Madde 1 — Hamle geçmişinde gezinme (salt-okunur)

### Kapsam

Üç yerde çalışır: `BotGame.tsx`, `LiveGame.tsx`, `MovePieceSolver.tsx` (hamle tabanlı
pratik soruları). Kullanıcı "hem maç hem pratik" seçeneğini onayladı.

### Saf mantık: `lib/play/moveNavigation.ts`

```ts
/** startFen + SAN listesinden her yarı-hamle sonrası FEN üretir.
 *  Dönen dizinin 0. elemanı başlangıç konumu, i. elemanı i. hamleden sonraki konum.
 *  Uzunluk = san.length + 1. Şahsız pozisyonlar için skipValidation ZORUNLU. */
export function fensFromSan(startFen: string | undefined, san: string[]): string[];

/** Tekerlek/tıklama sonrası yeni görüntüleme sırası; sınırların dışına taşmaz. */
export function clampViewIndex(index: number, total: number): number;
```

Üç bileşen de bu fonksiyonu besleyebilir (kontrolde doğrulandı):
BotGame → `chessRef.history()`, LiveGame → `sanList` + `startFen`,
MovePieceSolver → `playedMoves` + `exercise.fen`.

### Hook: `lib/chess/useMoveHistoryNav.ts`

`useSquareAnnotations` / `useBoardArrows` ile aynı desende, `ChessBoard.tsx` içinde
kullanılır.

- Girdi: `fens: string[]` (canlı konum dahil).
- Çıktı: `viewIndex`, `isLive` (`viewIndex === fens.length - 1`), `viewFen`,
  `goTo(i)`, `goLive()`, `wheelRef` (tahta elementine bağlanacak ref).
- Canlı konuma yeni hamle eklendiğinde (`fens.length` artınca) **otomatik canlıya
  dönülmez** — kullanıcı bu kararı verdi: sporcu geçmişte kalır, kendisi döner.
  Ancak `viewIndex` yeni sınıra göre `clampViewIndex` ile korunur.

### Tekerlek — mevcut kaydırma düzeltmesiyle çakışma

`ChessBoard.tsx:69-77`'de `wheel` olayı kaydırma kilidini **bilerek serbest bırakıyor**
(daha önce "telefonda/farede sayfa kaydırılamıyor" şikayeti bu şekilde düzeltilmişti).
Tekerleği hamle gezinmesine bağlamak bu düzeltmeyle çelişir.

**Çözüm:** Tekerlek dinleyicisi yalnızca **tahta elementine** `{ passive: false }` ile
bağlanır ve `preventDefault()` edilir. Sayfa gövdesindeki kaydırma davranışı ve
`lockScroll`'un `wheel`'de serbest bırakma mantığı DEĞİŞTİRİLMEZ. Bu bir regresyon
riski olduğu için ayrı test yazılır: tahta dışındaki bir `wheel` olayı hâlâ kilidi
serbest bırakmalı.

Dokunmatik cihazda tekerlek yoktur; oradaki gezinme yolu notasyona dokunmaktır.

### Notasyon tıklaması — `MoveList` ve `sanTr` değişikliği

`lib/play/sanTr.ts`'in `turkishMovePairs` fonksiyonu şu an beyaz+siyah hamlesini tek
bir string'e birleştiriyor (`"e4 – e5"`), bu yüzden hamleler ayrı ayrı tıklanamıyor.
Dönüş tipi değişir:

```ts
export interface TurkishMove { san: string; ply: number; }
export interface TurkishMovePair {
  no: number;
  white: TurkishMove | null;   // siyahın başladığı pozisyonlarda null
  black: TurkishMove | null;
}
```

`ply`, `fensFromSan` dizisindeki indeks ile birebir eşleşir (1 tabanlı: ply=1 → fens[1]).

`MoveList.tsx`'e opsiyonel `onSelectPly?: (ply: number) => void` ve `activePly?: number`
eklenir. `onSelectPly` verilmezse hamleler bugünkü gibi düz metin kalır — mevcut çağrı
noktaları bozulmaz. Aktif hamle görsel olarak vurgulanır.

**Etkilenen testler:** `tests/san-tr.test.ts`, `tests/move-list.test.ts`,
`tests/move-list-render.test.tsx` yeni tipe göre güncellenir.

### Salt-okunurluk

`viewIndex` canlı değilken:

- `ChessBoard` tahtayı `interactive={false}` gibi davranmaya zorlar (dışarıdan gelen
  `interactive` prop'u ne olursa olsun) — taş sürüklenemez, tıkla-oynat çalışmaz.
- Hiçbir hamle geri alınmaz, hiçbir hamle değiştirilemez. Yalnızca görüntü değişir.
- Tahtanın altında "Hamle N inceleniyor — **Canlıya dön**" satırı çıkar; butona
  basınca `goLive()` çalışır.

---

## D. Madde 5 — Premove

### Kapsam

Yalnız maç ekranları: `BotGame.tsx` ve `LiveGame.tsx`. Pratik sorularında premove YOK —
orada rakip cevabı sabit cevap anahtarından geliyor, "rakibi beklerken önceden komut
verme" kavramı uymuyor (YAGNI).

### Saf mantık: `lib/play/premove.ts`

```ts
export interface Premove { from: Square; to: Square; promotion?: PromotionPiece; }

/** Sıra sporcuya geldiğinde premove'u dener.
 *  Geçerliyse uygulanacak hamleyi, geçersizse null döndürür.
 *  Tahtayı DEĞİŞTİRMEZ — çağıran taraf uygular. */
export function resolvePremove(fen: string, pm: Premove | null): Premove | null;
```

Geçersiz premove **sessizce** iptal edilir (kullanıcı kararı) — uyarı gösterilmez, sıra
sporcuda kalır, normal hamlesini yapar.

### Etkileşim modeli

**Kontrolde bulunan engel:** `ChessBoard.tsx:131` `if (!interactive) return;` ile sıra
rakipteyken tıklama akışını tamamen kapatıyor; BotGame'de bot düşünürken
`interactive=false` oluyor. Bu yüzden `canDragPiece` tek başına yetmez.

`ChessBoard`'a yeni opsiyonel prop eklenir:

```ts
/** Sıra rakipteyken sporcunun ÖN-HAMLE vermesine izin verir.
 *  Verilirse tahta kendi taşlarının sürüklenmesine/tıklanmasına izin verir,
 *  ama hamleyi OYNAMAZ — seçimi bu geri çağrıya bildirir. */
onPremove?: (from: Square, to: Square) => void;
/** Ön-hamle olarak seçilmiş kareler — görsel işaretlenir. */
premoveSquares?: { from: Square; to: Square } | null;
```

Davranış:

- Sıra rakipteyken (`interactive=false` ama `onPremove` verilmiş) sporcu kendi taşını
  sürükler/tıklarsa `onPremove` çağrılır. Gerçek hamle YAPILMAZ; `onPieceDrop` `false`
  döner, taş yerine geri döner.
- Seçilen iki kare belirgin bir renkle işaretlenir (`premoveSquares`).
- Sıra sporcuya geldiğinde bileşen `resolvePremove()` çağırır; geçerliyse hamleyi normal
  akışıyla oynar (ses, saat artışı, backend'e yazma dahil), geçersizse premove silinir.
- Sporcu tahtaya normal tıklarsa veya `Esc`'e basarsa premove iptal olur.
- Tek premove tutulur (zincir yok — YAGNI).
- **C maddesiyle ilişki:** geçmiş konumu incelenirken premove verilemez; salt-okunurluk
  premove'un da önüne geçer.

`LiveGame.tsx`'te premove sunucuya ancak sıra geldiğinde `send({type:'move'})` ile
gider; sunucu protokolü DEĞİŞMEZ, backend'e dokunulmaz.

---

## Hata Yönetimi

| Durum | Davranış |
|---|---|
| Bozuk sessionStorage kaydı (madde 3) | Yok sayılır, yeni oyun açılır, ekran kilitlenmez |
| `fensFromSan` bozuk SAN'a rastlarsa | Oynatılabildiği yere kadar üretir (`movePlayer.replay` deseni) |
| Şahsız öğretim pozisyonu | `skipValidation: true` — mevcut kural aynen korunur |
| Geçersiz premove | Sessizce silinir |
| Motor/ağ hatası | Mevcut davranış korunur; bu iş hiçbir yeni ağ çağrısı eklemiyor |

## Test Stratejisi

Projenin yerleşik deseni: önce saf mantık (`lib/*.ts`) vitest ile kapsamlı test edilir,
sonra bileşene minimal entegrasyon testiyle bağlanır.

- Yeni saf modüller: `moveNavigation.ts`, `botGameSession.ts`, `premove.ts` — her biri
  sınır durumlarıyla (boş liste, taşan indeks, bozuk kayıt, geçersiz hamle) test edilir.
- Güncellenen testler: `use-square-annotations`, `chess-board-annotations`, `san-tr`,
  `move-list`, `move-list-render`.
- Regresyon testi (zorunlu): tahta DIŞINDAKİ `wheel` olayının kaydırma kilidini hâlâ
  serbest bıraktığı doğrulanır.
- Bileşen testleri: BotGame yenilemede aynı pozisyondan devam ediyor; geçmişe bakarken
  taş oynatılamıyor; premove sıra gelince uygulanıyor, geçersizse sessizce siliniyor.
- Test kapısı (`CLAUDE.md`): `npx tsc --noEmit && npx next lint && npx vitest run`.
  Backend'e dokunulmadığı için pytest gerekmez, yine de regresyon amaçlı çalıştırılır.

## Geriye Uyumluluk (KURAL #3)

- Backend'e, veritabanına, WebSocket protokolüne DOKUNULMAZ. Migration YOK.
- `ChessBoard`, `MoveList` ve `useSquareAnnotations`'a eklenen tüm yeni proplar
  opsiyoneldir; mevcut çağrı noktaları değişmeden çalışır.
- `LiveGame`'in sunucudan durum kurma akışı korunur.
- Devam eden canlı bot maçları etkilenmez: kayıt yoksa bugünkü davranış aynen sürer.
