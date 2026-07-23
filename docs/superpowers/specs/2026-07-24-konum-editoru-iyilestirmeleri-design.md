# Konum editörü iyileştirmeleri (P2) — tıkla-ekle + sola yaslama

## Bağlam

Bu, "Yeni Soru" bölümünün yeniden tasarımının **ikinci alt projesi (P2)**.
P1 (Cümle & Görüntü soru tipleri) tamamlandı, canlıya alındı. P2, orijinal
istekteki d2 ve d4 maddelerini kapsar:

- d2: "Hem tıkla-seç ve tıkla-ekle ile hem de tut-seç ve sürükle-ekle
  yöntemlerinin ikisi de kullanılsın."
- d4: "Satranç taşlarını ve satranç tahtasını sola doğru kaydır (sola yasla)."

d3 ("Tahtaya eklenmiş bir taşın üzerine tıklama yapıldığında taşı silme
özelliği olsun") **zaten mevcut kodda var** (`BoardEditor.tsx`'teki
`handlePieceClick`) — bu spec'in kapsamında değil, dokunulmuyor.

Diğer alt projeler (P3-P6) ayrı spec'lerle, sırayla ilerleyecek.

## Kapsam

Tek dosya: `apps/web/components/BoardEditor.tsx` (admin panelinde "Konum
Ekle" formunun içinde kullanılan tahta editörü — hem P1'deki yeni form
yapısında hem de değişmeyen orijinal konumunda aynı bileşen).

1. **Tıkla-seç + tıkla-ekle:** Sol taraftaki taş paleti artık sadece
   sürüklenebilir değil, tıklanabilir de. Bir palet taşına tıklamak onu
   "seçili" yapar (görsel vurgu). Seçiliyken tahtada herhangi bir kareye
   tıklamak o taşı oraya yerleştirir — kare doluysa üzerindeki taşın yerine
   geçer. Seçim, palet taşına tekrar tıklanana kadar **aktif kalır** (aynı
   taştan art arda birden fazla yerleştirilebilir).
2. **Sola yaslama:** Palet + tahta bloğu şu an `margin: '0 auto'` ile
   kartın içinde ortalanmış. Bu kaldırılır, blok kartın sol kenarından
   başlar.

**Kapsam dışı:** Tıkla-sil (zaten var), sürükle-ekle (zaten var, dokunulmaz),
Taşı Oynat modu (P4/P5), notasyon tablosu (P4).

## Davranış — tıkla-seç + tıkla-ekle

```
selectedPaletteKey: string | null   (yeni state, örn. 'K' = Beyaz Şah)
```

- Palet taşına tıklama: `selectedPaletteKey === kod` ise `null`'a döner
  (seçim kalkar), değilse o koda set edilir (yeni seçim, öncekinin yerine
  geçer — aynı anda tek taş seçili olabilir).
- Seçili palet taşı görsel olarak vurgulanır (halka/kenarlık — mevcut
  admin tasarım diliyle tutarlı, örn. `ring-2 ring-cyan-400`).
- Tahtada bir kareye tıklama (`onSquareClick`):
  - Seçim **aktifse**: o karedeki mevcut taş (varsa) silinir, seçili taş
    oraya yerleştirilir. Seçim aktif kalır (tekrar tıklanabilir).
  - Seçim **aktif değilse**: hiçbir şey olmaz (mevcut davranış — boş kare
    tıklaması şu an zaten hiçbir etki yapmıyor).
- Tahtadaki bir taşa tıklama (`onPieceClick`, mevcut `handlePieceClick`):
  - Seçim **aktifse**: **silme yapılmaz** — bu tıklama artık "seçili taşı
    buraya yerleştir" anlamına gelir, bu yüzden `onSquareClick`'e devredilir
    (aynı tıklama için iki callback'in çakışmaması adına `handlePieceClick`
    seçim aktifken erken `return` eder, gerçek yerleştirme işini
    `onSquareClick` yapar).
  - Seçim **aktif değilse**: mevcut davranış birebir korunur — taş silinir.

Bu davranış modeli, react-chessboard'un aynı anda hem `onPieceClick` hem
`onSquareClick`'i tetikleyebileceği varsayımına dayanır (dolu bir kareye
tıklandığında). Çakışmayı önlemek için tek karar noktası `onSquareClick`
olur; `onPieceClick` sadece "seçim yokken" devrede kalır.

## Davranış — sola yaslama

`BoardEditor.tsx` içindeki palet+tahta sarmalayıcısı:

```tsx
<div className="flex items-start gap-2" style={{ maxWidth: 440, margin: '0 auto' }}>
```

satırındaki `margin: '0 auto'` kaldırılır:

```tsx
<div className="flex items-start gap-2" style={{ maxWidth: 440 }}>
```

Bu, bloğun kart içinde ortalanmak yerine sol kenardan başlamasını sağlar.
Başka hiçbir stil değişmez.

## Geriye uyumluluk (KURAL #3)

- Sürükle-ekle (`handleDrop`) **hiç değişmez**.
- Tıkla-sil (`handlePieceClick`) sadece seçim aktifken devre dışı kalır;
  seçim yokken (ki bu varsayılan durumdur — hiçbir palet taşı seçili
  değilken editör bugünkü gibi davranır) **birebir eskisi gibi** çalışır.
- Yeni `onSquareClick` prop'u eklenmesi, `ChessboardProvider`'ın var olan
  hiçbir davranışını değiştirmez — sadece boş kare tıklamalarını da
  yakalayan yeni bir callback.
- Bu bileşen sadece admin panelinde kullanılıyor (öğrenci tarafında değil),
  bu yüzden sporcu deneyimine hiçbir etkisi yok.

## Test stratejisi

Frontend (vitest + RTL, `apps/web/tests/board-editor-click-add.test.tsx`):

- Palet taşına tıklama → görsel vurgu (ring class) uygulanır.
- Aynı palet taşına tekrar tıklama → vurgu kalkar (seçim iptal).
- Seçiliyken boş bir kareye tıklama → o karede doğru taş görünür (FEN
  üzerinden `fenToMap` ile doğrulanır — mevcut `board-editor.test.ts`
  deseniyle).
- Seçiliyken dolu bir kareye tıklama → eski taş silinir, yeni taş yerine
  geçer (tek taş kalır, iki taş üst üste olmaz).
- Seçim aktifken aynı taştan iki farklı kareye art arda yerleştirme →
  seçim kalkmadan ikisi de yerleşir.
- **Regresyon:** seçim yokken tahtadaki bir taşa tıklama → hâlâ silinir
  (mevcut `handlePieceClick` davranışı).
- **Regresyon:** sürükle-bırak ile taş ekleme hâlâ çalışır (mevcut
  `handleDrop` testi varsa aynen; yoksa en az bir smoke test).
