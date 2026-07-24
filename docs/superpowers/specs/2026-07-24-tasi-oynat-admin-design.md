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

`piece_square`/`target_squares` alanları **admin tarafı tipinden
kaldırılır** — yeni form bunları hiç üretmez. (Backend şeması zaten
serbest JSON `content_json` kolonu olduğundan, DB'deki eski satırlar
etkilenmez; sadece admin panelinin TypeScript tipinden çıkarılıyorlar.)

## Admin UI akışı

**Yeni dosyalar:**
- `apps/web/components/admin/MovePieceFields.tsx` — setup/kayıt fazlarını
  yöneten dış kabuk
- `apps/web/components/admin/MoveRecorderBoard.tsx` — "Konumu Kaydet"
  sonrası sürükle-oynat tahtası + Notasyon Tablosu

`ExerciseForm.tsx`'teki mevcut `BoardExerciseFields` içinde, 3 tip
butonundan (`Kareye tıkla` / `Taşı oynat` / `Taşı tanı`) `Taşı oynat`
seçiliyse, bugünkü `piece_square` dropdown + `SquarePicker` hedef-kare
grid'i **kaldırılır**, yerine `<MovePieceFields onSave={...} initial={...} />`
render edilir. `click_square`/`identify_piece` dalları **hiç değişmez**.

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

```ts
const chess = useMemo(() => {
  const c = new Chess(fen);
  for (const san of moves) c.move({ ...sanToMoveInput(san) }); // veya doğrudan c.move(san)
  return c;
}, [fen, moves]);
```

Aslında chess.js'in `.move()` fonksiyonu SAN string'ini DOĞRUDAN kabul
ediyor (`chess.move('e4')` gibi) — bu yüzden `moves` dizisini SAN
string'leri olarak saklamak, tahtayı yeniden oluştururken de doğrudan
`moves.forEach(san => chess.move(san))` ile yeniden oynatılabilir; ayrı
bir `sanToMoveInput` dönüşümüne gerek yok.

Sürükle-bırak (`onPieceDrop` — react-chessboard, `BotGame.tsx`'teki
`handleDrop` deseniyle birebir aynı yaklaşım):

```ts
function handleDrop(from: Square, to: Square): boolean {
  const next = new Chess(fen);
  moves.forEach((san) => next.move(san)); // güncel pozisyona kadar oynat
  let move;
  try {
    move = next.move({ from, to, promotion: 'q' }); // terfi her zaman vezir — BotGame/LiveGame ile tutarlı
  } catch {
    return false; // kural dışı hamle — sessizce reddedilir, taş yerine döner
  }
  if (!move) return false;
  onMovesChange([...moves, move.san]);
  return true;
}
```

Bu, `chess.js`'in kendi kural motorunu (rok, geçerken alma, terfi,
şah çekme kontrolü) kullanır — elle bir kural kontrolü yazılmıyor.
**Bilinen basitleştirme (mevcut `BotGame.tsx`/`LiveGame.tsx` ile
tutarlı):** terfi her zaman vezire yapılır, admin farklı bir taşa terfi
edecek bir hamle kaydedemez. Bu proje genelinde zaten var olan bir
kısıtlama, P4'e özgü değil.

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
- Geçerli hamle dizisi (`['e4', 'e5', 'Nf3']`) kabul edilir.
- Boş `moves` dizisi reddedilir.
- Kural dışı bir SAN (`'Qh8'`, mevcut pozisyonda imkansız) reddedilir.
- Anlamsız bir string (`'zz9'`) reddedilir.
- **Regresyon:** `click_square`/`identify_piece` doğrulaması hiç
  değişmedi — mevcut `test_board_exercises.py` testleri aynen geçmeli.

**Frontend (vitest):**
- `MoveRecorderBoard`: geçerli bir sürükle-bırak hamlesi Notasyon
  Tablosuna doğru SAN ile eklenir.
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
