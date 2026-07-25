# Taşı Oynat — admin tarafı (P4): Konumu Kaydet + Notasyon Tablosu

## Bağlam

"Yeni Soru" bölümünün yeniden tasarımının **dördüncü alt projesi (P4)**.
P1-P3 tamamlandı, canlıda. P4, orijinal istekteki d5 maddesini kapsar:

> "Konum eklemesi ve cevabının oluşturulması şu sırayla olsun. Taşları
> tahtaya yerleştir. Yerleştirme bitince satranç tahtanın sağ tarafında
> - Konumu Kaydet - butonu olsun. Konum kaydedildikten sonra zafer hoca
> cevabı oluşturabilmek için tahtadaki taşları mause ile tutup sırayla
> hareket ettirebilsin. [...] hamleler sırayla [...] bir 'Notasyon
> Tablosu' içerisinde [...] otomatik olarak yazsın/kaydedilsin. Notasyon
> Tablosu 3 sütundan oluşsun. 1. Sütunda hamlelerin numarası [...] 2.
> Sütunda beyaz [...] 3. Sütunda siyah taşların hamlelerinin
> koordinatları [...]"

**P5** (Taşı Oynat — sporcu tarafı) bu spec'in kapsamı **dışında** —
ayrı bir spec'le, P4'ten hemen sonra gelecek. P4 ile P5 arasında
**zorunlu bir güvenlik önlemi** var (aşağıda "Sporcu tarafı" bölümünde).

## Kritik karar — veri modeli (kullanıcı onayladı)

Gerçek prod verisinde **1 adet** mevcut `move_piece` sorusu var (tek
hamle, `piece_square`/`target_squares` modeli — "taşı BU kareden ŞU
karelerden birine taşı" tipinde bir quiz). Yeni istenen akış ise
kavramsal olarak farklı: **çoklu hamleden oluşan bir dizi** (bir oyun/
taktik çizgisi) kaydediliyor.

**Karar:** Yeni format eskisinin **yerine geçer**. Mevcut 1 soru
otomatik taşınmaz — Zafer Hoca admin panelinden o soruyu açıp yeni
akışla yeniden oluşturana kadar DB'de eski haliyle kalır ve **öğrenci
tarafında eskisi gibi çalışmaya devam eder** (BoardExercise.tsx'in
`move_piece` dalına bu spec'te dokunulmuyor, sadece yeni format için bir
placeholder eklenir — aşağıya bakın).

## Kapsam

Üç dosya, `move_piece` tipi için:

1. **Admin formu** — yeni "Konumu Kaydet" + hamle kaydı akışı
2. **Backend doğrulama** — yeni `moves: string[]` alanı için SAN tabanlı
   kural kontrolü
3. **Öğrenci tarafı (minimal, güvenlik amaçlı)** — yeni format bir
   soruyla karşılaşılırsa çökme yerine "yakında" mesajı

**Kapsam dışı:** Öğrencinin bu hamle dizisini gerçekten çözmesi (P5),
puanlama/kilit sistemi (P6), `click_square`/`identify_piece` (hiç
değişmiyor).

## Veri modeli

Yeni `move_piece` şekli (eskisinin **yerine**):

```ts
interface MovePieceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;          // Konumu Kaydet anındaki BAŞLANGIÇ pozisyonu
  moves: string[];       // SAN hamle dizisi: ['e4', 'e5', 'Nf3', 'Nc6', ...]
  difficulty?: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}
```

`move_piece` **artık `piece_square`/`target_squares` üretmez** — bunların
yerini `moves` alır.

**DİKKAT:** Bu alanlar admin tarafındaki `BoardExercise` tipinden
**SİLİNMEZ** — `click_square` hâlâ `target_squares`'ı kullanıyor. Tipe
sadece `moves?: string[]` **eklenir**; mevcut opsiyonel alanlar olduğu
gibi kalır. (Backend şeması zaten serbest JSON `content_json` kolonu
olduğundan DB'deki eski satırlar da etkilenmez.)

## Admin UI akışı

**Yeni dosyalar:**
- `apps/web/components/admin/MovePieceFields.tsx` — setup/kayıt fazlarını
  yöneten dış kabuk
- `apps/web/components/admin/MoveRecorderBoard.tsx` — "Konumu Kaydet"
  sonrası sürükle-oynat tahtası + Notasyon Tablosu

### `ExerciseForm.tsx` / `BoardExerciseFields` entegrasyonu

**ÇİFT TAHTA HATASI (öz-denetimde bulundu).** Bugünkü `BoardExerciseFields`
JSX'inde `<BoardEditor .../>` **koşulsuz** render ediliyor — üç tip için de:

```tsx
<input ... placeholder="Talimat (örn. Piyonu e4'e taşı)" />
<BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />   {/* koşulsuz! */}
{type === 'click_square' && (...)}
{type === 'move_piece' && (...)}
{type === 'identify_piece' && (...)}
```

`MovePieceFields` kendi içinde bir `BoardEditor` render ettiğinden, bu
haliyle "Taşı oynat" seçilince ekranda **iki tahta** görünürdü. Bu yüzden
dış `BoardEditor` koşullu hale getirilmelidir:

```tsx
{type !== 'move_piece' && (
  <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
)}
```

`move_piece` dalındaki bugünkü `piece_square` dropdown + `SquarePicker`
hedef-kare grid'i tamamen kaldırılır, yerine `MovePieceFields` gelir.
`click_square`/`identify_piece` dalları **hiç değişmez**.

**State sahipliği.** `BoardExerciseFields` bugün `fen`/`turn` state'ini
tutuyor ve `submit()` içinde kullanıyor. `move_piece` için bu yetmez —
`savedFen` ve `moves` de gerekiyor. Karışıklığı önlemek için:
`MovePieceFields` fazları ve tahtayı kendi içinde yönetir, ama sonucu
yukarı bildirir; `BoardExerciseFields` iki yeni state tutar:

```ts
const [moveFen, setMoveFen] = useState<string | null>(initial?.fen ?? null);
const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
```

`<MovePieceFields fen={moveFen} moves={moves} onChange={(f, m) => { setMoveFen(f); setMoves(m); }} />`

`move_piece` seçiliyken `BoardExerciseFields`'in kendi `fen` state'i
kullanılmaz (dış `BoardEditor` da render edilmiyor zaten).

**`validate()` değişikliği** — `move_piece` dalı tamamen değişir:

```ts
if (type === 'move_piece') {
  if (!moveFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
  if (moves.length === 0) return 'En az bir hamle kaydedilmeli';
}
```

(Eski `piece_square`/`map[pieceSquare]`/`targets.length` kontrolleri silinir.)

**`submit()` değişikliği** — `move_piece` dalı tamamen değişir:

```ts
if (type === 'move_piece') {
  base.fen = moveFen!;        // Konumu Kaydet anındaki pozisyon
  base.moves = moves;
}
```

(Eski `base.piece_square = pieceSquare; base.target_squares = targets;`
satırı silinir.) `base` nesnesinin ortak kısmı (`type`, `instruction`,
`difficulty`, `code`, `success_msg`, `fail_msg`) değişmez — ancak ortak
kısımdaki `fen` ataması `move_piece` için yukarıdaki satırla üzerine
yazılır.

`BoardExercise` (admin tipi, `ExerciseForm.tsx` içinde) `moves?: string[]`
alanı kazanır; `piece_square?`/`target_squares?` alanları **kalır**
(`click_square` hâlâ `target_squares` kullanıyor).

**Faz state makinesi** (`MovePieceFields` içinde):

```ts
const [phase, setPhase] = useState<'setup' | 'recording'>('setup');
const [setupFen, setSetupFen] = useState(EMPTY_FEN);
const [turn, setTurn] = useState<'w' | 'b'>('w');
const [savedFen, setSavedFen] = useState<string | null>(null);
const [moves, setMoves] = useState<string[]>([]);
```

- **`setup` fazı:** Mevcut `BoardEditor` bileşeni (P2'de tamamlanan
  tıkla-ekle/sürükle-ekle/tıkla-sil, hiç değişmeden) taş dizilimi için
  kullanılır. Altında **"Konumu Kaydet"** butonu — tıklanınca
  `setSavedFen(setupFen); setPhase('recording');`.
- **`recording` fazı:** `<MoveRecorderBoard fen={savedFen} moves={moves} onMovesChange={setMoves} />` render edilir (aşağıda detay). Üstte
  **"Konumu Düzenle"** butonu — tıklanınca `setPhase('setup'); setMoves([]);`
  (hamle geçmişi sıfırlanır, çünkü pozisyon değişebilir ve eski hamleler
  artık geçerli olmayabilir).
- Notasyon Tablosunun altında **"Son Hamleyi Geri Al"** butonu —
  `setMoves(moves.slice(0, -1))`; `moves` boşsa buton devre dışı.

**`MoveRecorderBoard`'un iç mantığı:**

**ZORUNLU — `skipValidation: true`.** Bu projenin temeli, Zafer Hoca'nın
kasten **şahsız** öğretim pozisyonları kullanmasıdır (boş tahta + tek
piyon; backend'de bu konuda özel bir açıklama notu bile var). Gerçek
ortamda ölçüldü: `new Chess('8/8/8/8/8/8/4P3/8 w - - 0 1')` şu hatayla
**çöker**: `Invalid FEN: missing white king`. İkinci argüman verilince
sorunsuz çalışıyor ve şahsız tahtada SAN üretebiliyor:

```ts
new Chess(fen, { skipValidation: true }) // ← bu olmadan öğretim pozisyonlarında ÇÖKER
```

Bu bileşende `Chess` örneği oluşturulan HER yerde bu seçenek verilmelidir.

Sürükle-bırak (`onPieceDrop` — react-chessboard, `BotGame.tsx`'teki
`handleDrop` deseniyle aynı yaklaşım):

```ts
function handleDrop(from: Square, to: Square): boolean {
  const next = new Chess(fen, { skipValidation: true });
  moves.forEach((san) => next.move(san)); // güncel pozisyona kadar oynat
  try {
    const move = next.move({ from, to, promotion: 'q' }); // terfi her zaman vezir
    onMovesChange([...moves, move.san]);
    return true;
  } catch {
    return false; // kural dışı hamle — taş yerine döner
  }
}
```

Doğrulanmış davranışlar (gerçek ortamda ölçüldü):
- `.move()` SAN string'ini doğrudan kabul ediyor (`c.move('e4')` çalışıyor)
  → `moves` dizisi SAN olarak saklanıp `forEach` ile yeniden oynatılabilir.
- `.move({from, to})` dönen nesne `.san` alanı taşıyor (`e4`, `Rh4`).
- Kural dışı hamlede `.move()` **`Error` fırlatıyor** (null dönmüyor) →
  `try/catch` zorunlu, ayrıca `if (!move)` kontrolüne gerek yok.

**Bilinen basitleştirme (mevcut `BotGame.tsx`/`LiveGame.tsx` ile
tutarlı):** terfi her zaman vezire yapılır. Proje genelinde zaten var
olan bir kısıtlama, P4'e özgü değil.

### KRİTİK KISIT — sıra kuralı çoklu hamleyi sınırlar

Gerçek ortamda ölçüldü (hem chess.js hem python-chess **aynı** davranıyor):
tek renkli bir pozisyonda (örn. sadece beyaz piyon) beyaz hamlesini
yaptıktan sonra sıra siyaha geçer ve **siyahın 0 legal hamlesi olur** —
yani ikinci bir hamle kaydedilemez.

```
'8/8/8/8/8/8/4P3/8 w - - 0 1' → e4 → sıra: siyah, siyah legal hamle: 0  (KİLİT)
'6k1/8/5K2/8/5R2/8/8/8 w'     → Rh4 → siyah legal: 1 → Kf8 → beyaz legal: 19  (AKIYOR)
```

**Sonuç:** Çoklu hamle dizisi ancak pozisyonda **her iki tarafın da
oynayabilir taşı varsa** kaydedilebilir. Bu doğal bir satranç kuralı
sonucudur, bir hata değil — ve kullanıcının orijinal örneği de zaten
iki taraflı: *"1. Kh4 – Şf8, 2. Kh8 – Şf7"*. Gerçek prod'daki mevcut
`move_piece` sorusu da iki taraflı (`6k1/8/5K2/8/5R2/8/8/8`).

**Admin UI gereği:** Bu kısıt sessizce yaşanmamalı. `recording` fazında
sıradaki tarafın legal hamlesi kalmadıysa (`chess.moves().length === 0`),
Notasyon Tablosunun altında açıklayıcı bir uyarı gösterilir:

> "Sıra siyahta ama siyahın oynayabileceği taş yok. Daha fazla hamle
> eklemek için 'Konumu Düzenle' ile karşı tarafa da taş yerleştirin."

Böylece Zafer Hoca neden hamle yapamadığını anlar; tahtayı sürükleyip
hiçbir şey olmamasıyla baş başa kalmaz.

**Notasyon Tablosu render'ı** (3 sütun):

```tsx
<table>
  <thead><tr><th>#</th><th>Beyaz</th><th>Siyah</th></tr></thead>
  <tbody>
    {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
      <tr key={i}>
        <td>{i + 1}.</td>
        <td>{moves[i * 2] ?? ''}</td>
        <td>{moves[i * 2 + 1] ?? ''}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Kaydetme:** Mevcut submit akışıyla aynı — admin "Soruyu ekle"/"Soruyu
kaydet" butonuna bastığında (bu buton `MovePieceFields`'in dışında,
`BoardExerciseFields`'te zaten var — değişmiyor), o an `MovePieceFields`
`{ type: 'move_piece', instruction, fen: savedFen, moves, difficulty, ... }`
şeklindeki nesneyi üst forma bildirir. **Doğrulama:** en az 1 hamle
kaydedilmeden ("Konumu Kaydet"e basılıp `recording` fazına geçilmeden,
veya `moves.length === 0` iken) gönderim engellenir — "En az bir hamle
kaydedilmeli" hatası.

## Backend doğrulama

`apps/api/chess_api/routers/admin.py`'deki `_validate_board_exercises`'ın
`move_piece` dalı tamamen yeniden yazılır:

```python
elif ex_type == "move_piece":
    moves = ex.get("moves")
    if not isinstance(moves, list) or len(moves) < 1:
        raise HTTPException(status_code=400, detail="En az bir hamle kaydedilmeli")
    replay_board = chess.Board(fen)
    for i, san in enumerate(moves):
        if not isinstance(san, str):
            raise HTTPException(status_code=400, detail=f"{i + 1}. hamle geçersiz")
        try:
            move = replay_board.parse_san(san)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"{i + 1}. hamle kurallara uygun değil: {san}")
        replay_board.push(move)
```

**Doğrulanmış teknik detay:** kurulu `python-chess` sürümü (1.2.0),
`chess.InvalidMoveError`/`chess.IllegalMoveError` gibi alt sınıflar
İÇERMİYOR — hem geçersiz (yazım hatalı) hem kural dışı SAN için düz
`ValueError` fırlatıyor. Bu yüzden tek bir `except ValueError:` yeterli
ve doğru; daha spesifik alt sınıfları yakalamaya çalışmak
(`chess.IllegalMoveError` gibi) bu sürümde `AttributeError` ile
patlardı.

`fen` alanı ZATEN mevcut ortak kontrolle (tahta tiplerinin hepsi için
geçerli `if not fen: raise ...` ve `chess.Board(fen)` parse denemesi)
doğrulanıyor — `move_piece` dalına ayrıca eklenmiyor, üstündeki ortak
kod zaten çalışıyor.

## Sporcu tarafı — güvenlik placeholder'ı (zorunlu, P4 kapsamında)

`BoardExercise.tsx`'in render'ında bugün şu yapı var:

```tsx
{isBoardExercise(exercise) ? (
  <>
    {/* Board */}
    {/* Instruction */}
    {/* Multiple-choice for identify_piece */}
    {/* Helper hint for move_piece */}
  </>
) : (
  <ChoiceQuestionBody .../>
)}
```

Bu üç yollu dallanmaya çıkarılır — YENİ format `move_piece` (placeholder),
ESKİ format `move_piece`/`click_square`/`identify_piece` (mevcut tahta
JSX'i, değişmeden) ve seçenek tipleri (`ChoiceQuestionBody`, değişmeden):

```tsx
{exercise.type === 'move_piece' && 'moves' in exercise ? (
  <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
    style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
    <span className="text-xl leading-none flex-shrink-0">🚧</span>
    <p className="text-sm font-semibold flex-1">Bu soru türü yakında aktif olacak.</p>
  </div>
) : isBoardExercise(exercise) ? (
  <>
    {/* Board */}
    {/* Instruction */}
    {/* Multiple-choice for identify_piece */}
    {/* Helper hint for move_piece */}
  </>
) : (
  <ChoiceQuestionBody .../>
)}
```

`'moves' in exercise` kontrolü ilk sırada olmalı — aksi halde
`isBoardExercise(exercise)` zaten `move_piece`'i (yeni formatta bile)
true döndürüp eski JSX'e düşerdi ve `exercise.piece_square` okunmaya
çalışılıp çökerdi.

**Neden gerekli:** P4 canlıya çıktıktan sonra Zafer Hoca yeni formatta
bir soru oluşturabilir (admin formu artık bunu üretiyor) ama P5
(sporcunun bu diziyi gerçekten çözmesi) henüz yok. Bu placeholder
olmadan, öğrenci tarafı `exercise.piece_square`/`exercise.target_squares`
okumaya çalışıp `undefined` ile karşılaşır — çökme veya bozuk render.
Placeholder, P5 gelene kadar geçici ama güvenli bir durum sağlar.

`isBoardExercise`, `BoardTypeConfig`, mevcut `move_piece` tipi
(`MovePieceEx`) bu spec'te **değişmiyor** — TypeScript tipi hâlâ
`piece_square`/`target_squares`'ı zorunlu alan olarak tanımlı tutuyor
(öğrenci tarafı hâlâ SADECE eski formatı "biliyor"). Yeni formatta
gelen bir exercise (backend'den `moves` alanıyla, `piece_square` OLMADAN)
TypeScript'in bakış açısından geçersiz bir `MovePieceEx` olur ama
JavaScript çalışma zamanında sorun çıkarmaz — `'moves' in exercise`
kontrolü saf JS seviyesinde çalışır, TypeScript'in statik tipini
etkilemez. Bu, P5'te `MovePieceEx`'in kendisi güncellenene kadar geçici
kabul edilebilir bir tutarsızlık.

**İKİNCİ ÇÖKME NOKTASI (JSX dallanmasından bağımsız, öz-denetimde
bulundu):** `BoardExercise.tsx`'teki `styles` hesaplama bloğu, JSX
render'ından ÖNCE, component gövdesinde HER render'da senkron çalışır:

```ts
if (status === 'success' && exercise.type === 'move_piece') {
  exercise.target_squares.forEach((sq) => { ... }); // yeni formatta target_squares YOK → çöker
}
```

Bu satır, yeni formatlı bir `move_piece` sorusu `status === 'success'`
durumuna hiç ulaşmasa bile — sadece render edildiğinde bile değil,
`isBoardExercise(exercise)` true döndüğü için bu blok her zaman
değerlendirilmeye çalışılır (`target_squares` yoksa `undefined.forEach`
patlar, ama sadece `status==='success'` iken — yani pratikte bu asla
`success` olamayacağı için tetiklenmez GİBİ görünse de, savunmasız
kod bırakmak riskli). Güvenli hale getirmek için dış koşula
`!('moves' in exercise)` eklenir:

```ts
if (status === 'success' && exercise.type === 'move_piece' && !('moves' in exercise)) {
  exercise.target_squares.forEach((sq) => { ... });
}
```

Bu tek satırlık ek koşul, hem bu potansiyel çökmeyi önler hem de
mevcut eski-format `move_piece` davranışını birebir korur (`'moves' in
exercise` eski formatta her zaman `false`).

## Geriye uyumluluk (KURAL #3)

- `click_square`, `identify_piece`, `sentence_question`, `image_question`
  admin formları ve öğrenci render'ı **hiç değişmez**.
- Mevcut 1 adet prod `move_piece` sorusu, Zafer Hoca elle güncelleyene
  kadar eski haliyle DB'de kalır ve öğrenci tarafında **eskisi gibi
  çalışmaya devam eder** — hiçbir otomatik migration yok.
- Yeni formatta bir soru oluşturulursa (P4 sonrası, P5 öncesi), öğrenci
  tarafı çökme yerine güvenli bir placeholder gösterir.

## Test stratejisi

**Backend (pytest):**
- Geçerli hamle dizisi kabul edilir — iki taraflı pozisyonda
  (`6k1/8/5K2/8/5R2/8/8/8 w - - 0 1`, `['Rh4', 'Kf8']`; gerçek ortamda
  bu dizinin `parse_san` ile sorunsuz aktığı doğrulandı).
- **Şahsız öğretim pozisyonu** (`8/8/8/8/8/8/4P3/8 w - - 0 1`, `['e4']`)
  kabul edilir — `python-chess` şahsız tahtada `parse_san`'i sorunsuz
  çalıştırıyor (ölçüldü), bu davranış korunmalı.
- Boş `moves` dizisi reddedilir.
- Kural dışı bir SAN (`'Qh8'`, mevcut pozisyonda imkansız) reddedilir.
- Anlamsız bir string (`'zz9'`) reddedilir.
- Sıraya aykırı hamle (tek renkli pozisyonda ikinci bir beyaz hamle)
  reddedilir — frontend'in engellediği durumun backend'de de kapalı
  olduğunu kanıtlar.
- **Regresyon:** `click_square`/`identify_piece` doğrulaması hiç
  değişmedi — mevcut `test_board_exercises.py` testleri aynen geçmeli.

**Frontend (vitest):**
- **ŞAHSIZ POZİSYON (en kritik):** `MoveRecorderBoard`, şahsız bir
  öğretim FEN'iyle (`8/8/8/8/8/8/4P3/8 w - - 0 1`) çökmeden render olur
  ve e2→e4 sürüklemesi `e4` SAN'ıyla tabloya eklenir. (Bu test,
  `skipValidation: true` unutulursa hemen kırmızıya döner.)
- **SIRA KİLİDİ:** tek renkli pozisyonda ilk hamleden sonra "karşı tarafın
  oynayabileceği taş yok" uyarısı görünür.
- `MoveRecorderBoard`: geçerli bir sürükle-bırak hamlesi Notasyon
  Tablosuna doğru SAN ile eklenir.
- İki taraflı pozisyonda (`6k1/8/5K2/8/5R2/8/8/8 w - - 0 1`) art arda
  iki hamle (`Rh4`, `Kf8`) kaydedilir ve tablo `1. Rh4 | Kf8` satırını
  gösterir.
- Kural dışı bir sürükle-bırak hamlesi reddedilir, tabloya eklenmez.
- "Son Hamleyi Geri Al" son satırı siler, tahta bir önceki pozisyona
  döner.
- "Konumu Düzenle", `recording`'den `setup`'a döner ve `moves`'u sıfırlar.
- Notasyon Tablosu 2 hamlede 1 satır, 3 hamlede (yarım) 2. satırın siyah
  hücresi boş olacak şekilde doğru gruplanır.
- `BoardExercise.tsx`: `moves` alanlı bir `move_piece` sorusu placeholder
  gösterir, tahta render edilmez.
- **Regresyon:** eski formatlı (`piece_square`/`target_squares`) bir
  `move_piece` sorusu öğrenci tarafında hâlâ birebir eskisi gibi çalışır
  (tahta render edilir, hedef kareye sürükleme başarıyı tetikler).
