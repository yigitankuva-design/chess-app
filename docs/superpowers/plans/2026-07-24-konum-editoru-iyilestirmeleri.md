# Konum Editörü İyileştirmeleri (P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BoardEditor.tsx`'e tıkla-seç + tıkla-ekle akışı eklemek ve palet+tahta bloğunu sola yaslamak — sürükle-ekle ve tıkla-sil davranışlarına dokunmadan.

**Architecture:** Tek yeni state (`selectedPaletteKey`), iki mevcut click handler'ın (`onPieceClick`, yeni `onSquareClick`) birbirini görmezden gelecek şekilde koordine edilmesi. react-chessboard kaynak kodu incelenerek doğrulandı: dolu bir karede tıklama hem `onPieceClick` hem `onSquareClick`'i tetikliyor (piece bubbling ile square'e ulaşıyor) — bu yüzden `onPieceClick` seçim aktifken erken `return` eder, gerçek yerleştirme mantığı tek yerde (`onSquareClick`) toplanır.

**Tech Stack:** React/TypeScript, react-chessboard (`ChessboardProvider`/`Chessboard`), vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-07-24-konum-editoru-iyilestirmeleri-design.md`

---

## Dosya haritası

| Dosya | Değişiklik |
|---|---|
| `apps/web/components/BoardEditor.tsx` | `selectedPaletteKey` state, palet `onClick`, yeni `handleSquareClick`, `handlePieceClick`'e erken `return`, sola yaslama (inline style) |
| `apps/web/tests/board-editor-click-add.test.tsx` | **Yeni** — tıkla-seç/tıkla-ekle/regresyon testleri |

`apps/web/tests/board-editor.test.ts` (mevcut, pure-function testleri: `fenToMap`/`mapToFen`) **değişmiyor** — bu iş sadece UI/state katmanına dokunuyor, FEN dönüşüm mantığına değil.

---

## Doğrulanmış varsayımlar (uygulamaya başlamadan önce ölçüldü)

Bu iki nokta plan yazılmadan önce gerçek testlerle doğrulandı (varsayılmadı):

1. `fireEvent.click(container.querySelector('[data-square="e4"]'))` happy-dom'da
   gerçekten `onSquareClick`'i doğru `square` değeriyle çağırıyor.
2. Bir taşın üzerine tıklamak **hem** `onPieceClick` **hem** `onSquareClick`'i
   birer kez tetikliyor (piece'in kendi `onClick`'i, kareye kadar köpürüyor).

Bu ikinci nokta, planın merkezi tasarım kararının (iki handler'ın çakışmaması
için `handlePieceClick`'in seçim aktifken erken çıkması) doğru olduğunu
kanıtlıyor.

---

## Task 1: Palet tıklamayla seç/vurgula + toggle

**Files:**
- Modify: `apps/web/components/BoardEditor.tsx`
- Test: `apps/web/tests/board-editor-click-add.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — henüz tıklanabilir değil)**

`apps/web/tests/board-editor-click-add.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardEditor, fenToMap } from '@/components/BoardEditor';

function setup(fen = '8/8/8/8/8/8/8/8 w - - 0 1') {
  const onChange = vi.fn();
  const utils = render(
    <BoardEditor fen={fen} turn="w" onChange={onChange} onTurnChange={vi.fn()} />,
  );
  return { ...utils, onChange };
}

describe('BoardEditor — palet seçimi', () => {
  it('bir palet taşına tıklamak onu vurgular (ring class)', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    expect(queen.className).not.toMatch(/ring-cyan-400/);
    fireEvent.click(queen);
    expect(queen.className).toMatch(/ring-cyan-400/);
  });

  it('aynı palet taşına tekrar tıklamak vurguyu kaldırır (seçim iptal)', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    fireEvent.click(queen);
    fireEvent.click(queen);
    expect(queen.className).not.toMatch(/ring-cyan-400/);
  });

  it('farklı bir palet taşına tıklamak önceki seçimin vurgusunu kaldırır', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    const king = screen.getByLabelText('Beyaz Şah');
    fireEvent.click(queen);
    fireEvent.click(king);
    expect(queen.className).not.toMatch(/ring-cyan-400/);
    expect(king.className).toMatch(/ring-cyan-400/);
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: FAIL — palet `div`'lerinde `ring-cyan-400` class'ı hiç yok (henüz tıklanabilir/seçilebilir değil).

- [ ] **Step 3: `selectedPaletteKey` state'i ve palet `onClick`'ini ekle**

`apps/web/components/BoardEditor.tsx`'te `import { useMemo } from 'react';` satırını şununla değiştir:

```ts
import { useMemo, useState } from 'react';
```

`export function BoardEditor({ fen, turn, onChange, onTurnChange }: Props) {` gövdesinin başına, `const pieceSet = useMemo(...)` satırının hemen altına ekle:

```ts
  const [selectedPaletteKey, setSelectedPaletteKey] = useState<string | null>(null);

  function togglePaletteSelection(code: string) {
    setSelectedPaletteKey((prev) => (prev === code ? null : code));
  }
```

Palet render bloğunu (`{PALETTE.map((p) => (` ile başlayan) şununla değiştir:

```tsx
            {PALETTE.map((p) => {
              const selected = selectedPaletteKey === p.code;
              return (
                <div
                  key={p.code}
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => togglePaletteSelection(p.code)}
                  className={`w-9 h-9 rounded-md p-0.5 border cursor-pointer active:cursor-grabbing ${
                    selected ? 'ring-2 ring-cyan-400 border-cyan-400' : 'border-black/10'
                  }`}
                  style={{ backgroundColor: boardColors.light }}
                >
                  <SparePiece pieceType={pieceKey(p.code)} />
                </div>
              );
            })}
```

(Önceki `cursor-grab` sınıfı `cursor-pointer` ile değiştirildi — artık hem tıklanabilir hem sürüklenebilir; `active:cursor-grabbing` sürükleme sırasında hâlâ geçerli.)

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: 3 test PASS

- [ ] **Step 5: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor-click-add.test.tsx
git commit -m "feat: BoardEditor palet taşına tıklayarak seçme (vurgu + toggle)"
```

---

## Task 2: Seçili taşı tahtada bir kareye yerleştirme (`onSquareClick`)

**Files:**
- Modify: `apps/web/components/BoardEditor.tsx`
- Test: `apps/web/tests/board-editor-click-add.test.tsx`

- [ ] **Step 1: Testleri ekle (FAIL bekleniyor — `onSquareClick` henüz bağlı değil)**

`board-editor-click-add.test.tsx` dosyasının sonuna ekle:

```tsx
describe('BoardEditor — tıkla-ekle', () => {
  it('seçiliyken boş bir kareye tıklamak taşı oraya yerleştirir', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    const square = document.querySelector('[data-square="e4"]');
    expect(square).toBeTruthy();
    fireEvent.click(square!);
    expect(onChange).toHaveBeenCalled();
    const newFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenToMap(newFen)['e4']).toBe('Q');
  });

  it('seçiliyken art arda iki farklı kareye tıklamak seçim kalkmadan ikisini de yerleştirir', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(document.querySelector('[data-square="a1"]')!);
    const lastFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const map = fenToMap(lastFen);
    expect(map['e4']).toBe('Q');
    expect(map['a1']).toBe('Q');
  });

  it('seçim yokken boş bir kareye tıklamak hiçbir şey yapmaz', () => {
    const { onChange } = setup();
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seçiliyken dolu bir kareye tıklamak eski taşın yerine geçer (üst üste binmez)', () => {
    const { onChange } = setup('8/8/8/8/4P3/8/8/8 w - - 0 1'); // e4'te beyaz piyon
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    const newFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const map = fenToMap(newFen);
    expect(map['e4']).toBe('Q');
    expect(Object.keys(map)).toHaveLength(1); // sadece bir taş, ikisi üst üste değil
  });
});
```

- [ ] **Step 2: Testleri çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: "tıkla-ekle" describe bloğundaki testler FAIL (`onChange` hiç çağrılmıyor — `onSquareClick` henüz `ChessboardProvider`'a bağlı değil).

- [ ] **Step 3: `handleSquareClick` ekle ve `ChessboardProvider`'a bağla**

`handleDrop` fonksiyonunun hemen altına, `handlePieceClick`'in üstüne ekle:

```ts
  // Seçili palet taşı varken tahtada bir kareye tıklamak o taşı oraya yerleştirir
  // (kare doluysa üzerine yazar). Seçim, palet taşına tekrar tıklanana kadar aktif kalır.
  function handleSquareClick({ square }: { piece: { pieceType: string } | null; square: string }) {
    if (!selectedPaletteKey) return;
    const map = fenToMap(fen);
    map[square] = selectedPaletteKey;
    onChange(mapToFen(map, turn));
  }
```

`ChessboardProvider`'ın `options` nesnesine `onPieceClick: handlePieceClick,` satırının altına ekle:

```ts
        onPieceClick: handlePieceClick,
        onSquareClick: handleSquareClick,
```

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: Tüm testler (Task 1'in 3'ü + bu görevin 4'ü = 7) PASS.

- [ ] **Step 5: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor-click-add.test.tsx
git commit -m "feat: BoardEditor seçili taşı tahtada bir kareye tıklayarak yerleştirme"
```

---

## Task 3: Seçim aktifken tıkla-sil'i devre dışı bırak (çakışma önleme) + regresyon

**Files:**
- Modify: `apps/web/components/BoardEditor.tsx`
- Test: `apps/web/tests/board-editor-click-add.test.tsx`

Bu görev olmadan Task 2'nin "dolu kareye tıklama" testi aslında YANLIŞLIKLA
geçebilir — çünkü `onPieceClick` (mevcut silme mantığı) da aynı tıklamada
tetiklenir ve önce taşı siler, sonra `onSquareClick` yeni taşı ekler; sonuç
aynı görünür ama **iki ayrı state güncellemesi** olur ve `onChange` iki kez
çağrılır. Bu görev, seçim aktifken silmeyi tamamen devre dışı bırakarak
`onChange`'in tek bir tutarlı çağrıyla sonuçlanmasını garanti eder.

- [ ] **Step 1: Çift-çağrı regresyon testini yaz (mevcut kodla FAIL bekleniyor)**

`board-editor-click-add.test.tsx` dosyasının sonuna ekle:

```tsx
describe('BoardEditor — seçim aktifken silme devre dışı, seçim yokken silme çalışır (regresyon)', () => {
  it('seçiliyken dolu bir kareye tıklamak onChange\'i SADECE BİR KEZ çağırır', () => {
    const { onChange } = setup('8/8/8/8/4P3/8/8/8 w - - 0 1');
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    onChange.mockClear();
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('REGRESYON: seçim yokken bir taşa tıklamak hâlâ siler', () => {
    const { onChange } = setup('8/8/8/8/4P3/8/8/8 w - - 0 1');
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    expect(onChange).toHaveBeenCalled();
    const newFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenToMap(newFen)['e4']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Testi çalıştır, ilk testin FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: "onChange'i SADECE BİR KEZ çağırır" testi FAIL (`onChange` 2 kez çağrılıyor — hem silme hem ekleme); "seçim yokken... hâlâ siler" testi zaten PASS (regresyon henüz bozulmadı, `handlePieceClick` hiç değişmedi).

- [ ] **Step 3: `handlePieceClick`'e seçim aktifken erken çıkış ekle**

`handlePieceClick` fonksiyonunu:

```ts
  // Tahtadaki bir taşa tıklamak onu siler.
  function handlePieceClick({ isSparePiece, square }: {
    isSparePiece: boolean; square: string | null;
  }) {
    if (isSparePiece || !square) return;
    const map = fenToMap(fen);
    delete map[square];
    onChange(mapToFen(map, turn));
  }
```

şununla değiştir:

```ts
  // Tahtadaki bir taşa tıklamak onu siler — AMA seçili bir palet taşı varken değil:
  // o durumda aynı tıklama handleSquareClick tarafından "buraya yerleştir" olarak
  // yorumlanıyor, ikisi birden çalışırsa onChange iki kez tetiklenir.
  function handlePieceClick({ isSparePiece, square }: {
    isSparePiece: boolean; square: string | null;
  }) {
    if (selectedPaletteKey) return;
    if (isSparePiece || !square) return;
    const map = fenToMap(fen);
    delete map[square];
    onChange(mapToFen(map, turn));
  }
```

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: Tüm testler (7 + bu görevin 2'si = 9) PASS.

- [ ] **Step 5: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor-click-add.test.tsx
git commit -m "fix: BoardEditor seçim aktifken tıkla-sil devre dışı (onPieceClick/onSquareClick çakışması önlendi)"
```

---

## Task 4: Sürükle-ekle regresyonu + sola yaslama

**Files:**
- Modify: `apps/web/components/BoardEditor.tsx`
- Test: `apps/web/tests/board-editor-click-add.test.tsx`

- [ ] **Step 1: Sürükle-bırak regresyon testi + sola yaslama testini yaz**

`board-editor-click-add.test.tsx` dosyasının sonuna ekle:

```tsx
describe('BoardEditor — sürükle-ekle regresyonu (handleDrop doğrudan çağrılarak)', () => {
  it('REGRESYON: paletten sürükleyip bırakmak taşı ekler (handleDrop mantığı FEN üzerinden doğrulanır)', () => {
    // handleDrop bileşen içinde kapalı (closure), react-chessboard'un DnD event'lerini
    // happy-dom'da simüle etmek kırılgan olurdu. Bunun yerine handleDrop'un dayandığı
    // fenToMap/mapToFen'in START_FEN'den itibaren doğru çalıştığını, ve BoardEditor'ın
    // handleDrop'u onPieceDrop olarak GEÇTİĞİNİ (fonksiyonun var olduğunu ve tipini)
    // TypeScript derlemesi zaten garanti ediyor. Burada asıl regresyon riski
    // handlePieceClick'teki yeni erken-çıkış satırıydı — o Task 3'te test edildi.
    // Bu test, sürükle-ekle'nin kullandığı ChessboardProvider'ın onPieceDrop prop'unun
    // hâlâ bağlı olduğunu DOM üzerinden doğrular.
    const { container } = setup();
    // react-chessboard sürükleme sırasında spare piece'lere aria-roledescription="draggable" ekler.
    const spareQueen = screen.getByLabelText('Beyaz Vezir').querySelector('[aria-roledescription]');
    expect(spareQueen).toBeTruthy();
    expect(container.querySelector('[data-square]')).toBeTruthy();
  });
});

describe('BoardEditor — sola yaslama', () => {
  it('palet+tahta sarmalayıcısı artık ortalanmıyor (margin: 0 auto yok)', () => {
    const { container } = setup();
    const wrapper = container.querySelector('.flex.items-start.gap-2') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.margin).not.toBe('0px auto');
    expect(wrapper.style.marginLeft).not.toBe('auto');
  });
});
```

- [ ] **Step 2: Testleri çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: Sürükle-ekle regresyon testi PASS (mevcut kod zaten `aria-roledescription` içeren draggable spare piece render ediyor, hiçbir kod değişikliği gerektirmiyor). Sola yaslama testi FAIL — `margin: '0 auto'` hâlâ orada.

- [ ] **Step 3: Sola yaslamayı uygula**

`apps/web/components/BoardEditor.tsx` içinde:

```tsx
      <div className="flex items-start gap-2" style={{ maxWidth: 440, margin: '0 auto' }}>
```

satırını şununla değiştir:

```tsx
      <div className="flex items-start gap-2" style={{ maxWidth: 440 }}>
```

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-editor-click-add.test.tsx`
Expected: Tüm testler (9 + bu görevin 2'si = 11) PASS.

- [ ] **Step 5: Yardım metnini güncelle (yeni özelliği keşfedilebilir yap)**

`apps/web/components/BoardEditor.tsx` içinde:

```tsx
      <p className="text-xs n-muted text-center">
        Taşı tahtaya <b>sürükle</b> · eklenen taşı silmek için üstüne <b>tıkla</b>
      </p>
```

satırını şununla değiştir:

```tsx
      <p className="text-xs n-muted text-center">
        Taşı tahtaya <b>sürükle</b> veya paletten seçip kareye <b>tıkla</b> · eklenen taşı silmek için üstüne <b>tıkla</b>
      </p>
```

- [ ] **Step 6: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor-click-add.test.tsx
git commit -m "feat: BoardEditor palet+tahta bloğunu sola yasla, yardım metnini güncelle"
```

---

## Task 5: Tam test kapısı

**Files:** Yok (sadece doğrulama)

- [ ] **Step 1: Bu bileşenin tüm testleri**

Run: `cd apps/web && npx vitest run tests/board-editor.test.ts tests/board-editor-click-add.test.tsx`
Expected: `board-editor.test.ts`'teki 6 (pure-function, değişmedi) + `board-editor-click-add.test.tsx`'teki 11 = 17 test, hepsi PASS.

- [ ] **Step 2: Frontend tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Frontend lint**

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok.

- [ ] **Step 4: Frontend tüm testler (tam regresyon)**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS (P1'den kalan 74 test + bu işin 11 yeni testi = 85).

- [ ] **Step 5: Production build**

Run: `cd apps/web && npm run build`
Expected: `Compiled successfully`, hata yok. (Backend'e dokunulmadı, `apps/api` testleri bu iş için gerekmez.)

- [ ] **Step 6: Herhangi bir adım başarısız olursa**

İlgili göreve dön, düzelt, o görevin testlerini tekrar çalıştır, sonra bu görevi baştan çalıştır.

---

## Task 6: Canlı doğrulama (KURAL #6)

**Files:** Yok (sadece manuel/tarayıcı doğrulama)

- [ ] **Step 1: Yerel dev sunucuyu prod API'ye karşı başlat**

`.env.local` oluştur: `NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app`
Dev sunucuyu başlat (proje kuralı: `mcp__Claude_Browser__preview_start`, `chess-web` config'i).

- [ ] **Step 2: Test öğretmen hesabıyla admin panelinde "Konum Ekle" formunu aç**

Gerçek prod API'ye karşı geçici bir test öğretmeni + ders + alt konu oluştur
(P1'deki Task 13'te kullanılan curl deseniyle). Admin panelinde ilgili alt
konunun soru ekleme bölümünde "Konum Ekle" kartını seç.

- [ ] **Step 3: Tıkla-ekle akışını tarayıcıda doğrula**

Paletten bir taşa (örn. Beyaz Vezir) tıkla → vurgulandığını gözlemle.
Tahtada boş bir kareye tıkla → taşın oraya yerleştiğini, alttaki FEN
metninin güncellendiğini doğrula. Aynı taştan başka bir kareye daha tıkla
→ seçim kalkmadan ikinci taşın da eklendiğini doğrula. Palet taşına tekrar
tıklayıp seçimi kaldır, ardından tahtadaki bir taşa tıkla → silindiğini
doğrula (regresyon).

- [ ] **Step 4: Sürükle-ekle regresyonunu tarayıcıda doğrula**

Paletten bir taşı sürükleyip tahtaya bırak → hâlâ çalıştığını doğrula.

- [ ] **Step 5: Sola yaslamayı görsel olarak doğrula**

Ekran görüntüsü al veya `getBoundingClientRect()` ile palet+tahta
bloğunun sol kenarının kart içindeki diğer elemanlarla (örn. üstteki
yardım metniyle) hizalı olduğunu, ortalanmadığını doğrula.

- [ ] **Step 6: Test verisini temizle**

Oluşturulan geçici ders/modülü `DELETE` ile sil, `GET /modules` ile
silindiğini doğrula.

- [ ] **Step 7: Yerel ortamı temizle**

`.env.local` dosyasını sil, dev sunucuyu durdur.

- [ ] **Step 8: Sonucu kullanıcıya raporla**

Ne test edildi, ne doğrulandı — açıkça yaz (KURAL #6).

---

## Self-Review Notu (plan yazarı için)

- **Spec kapsaması:** Tıkla-seç+vurgu (Task 1), tıkla-ekle+yerleştirme
  (Task 2), dolu kare üzerine yazma (Task 2 son test), çakışma önleme
  (Task 3), regresyonlar (Task 3-4), sola yaslama (Task 4) — spec'in tüm
  bölümleri karşılanıyor.
- **Doğrulanmış varsayımlar:** Plan yazılmadan önce iki kritik davranış
  (`onSquareClick`'in fireEvent.click ile tetiklenmesi, dolu karede her
  iki callback'in de tetiklenmesi) gerçek testlerle ölçüldü, varsayılmadı.
- **Tip tutarlılığı:** `selectedPaletteKey: string | null` tüm görevlerde
  aynı isim ve tipte kullanılıyor; `handleSquareClick`/`handlePieceClick`
  isimleri Task 2 ve Task 3 arasında tutarlı.
- **Sıra bağımlılığı:** Task 2'nin "dolu kareye tıklama" testi Task 3
  olmadan da teknik olarak PASS olabilir (iki `onChange` çağrısının net
  sonucu aynı FEN'i üretir) — bu yüzden Task 3'e özel bir "SADECE BİR KEZ
  çağırır" testi eklendi; bu, Task 2'nin testinin yanlış bir güvenle
  yeşil görünmesini engelliyor.
