# Süresiz Pratik: İlerleme Noktaları Renklendirmesi + Taş Nerde Çemberi — Tasarım

## Kapsam

Hızlı Erişim > Süresiz Pratik (ve süreli/test modları, aynı `BoardExercise` bileşenini
kullandıkları için otomatik kapsanır) ekranında iki değişiklik:

1. Tahtanın üstündeki ilerleme noktaları artık doğru/yanlış bilgisini gösterir.
2. "Taş Nerde?" sorusunda taş yerleştirmede görsel geri bildirim (yeşil/kırmızı çember) eklenir.

## 1. İlerleme Noktaları (ProgressDots)

- Her nokta, o sorunun cevaplanma durumunu yansıtır:
  - Doğru cevaplanmış → yeşil (`#16a34a`, mevcut ton — değişmiyor).
  - Yanlış cevaplanmış (kilitlenip geçilmiş) → kırmızı (`RING_RED` ailesinden düz bir kırmızı, örn. `#dc2626`).
  - Mevcut soru → accent rengi (değişmiyor).
  - Henüz gelinmemiş → border rengi (değişmiyor).
- Kapsam: `BoardExercise.tsx` içindeki `succeed()` doğru olarak, `fail()`'in `noRetry` dalı ve
  `failNoRetry()` yanlış olarak işaretler. `noRetry=false` context'lerinde (ders içi alıştırma,
  tekrar deneme açık) geçici `fail` (1.8sn sonra sıfırlanan) durumu KALICI olarak işaretlenmez —
  yalnızca soru kilitlenip kesinleşince (`noRetry` dalı) renk sabitlenir.
- Bu bilgi yalnızca bu oturumda (sayfa açıkken) tutulur — sayfa yenilenince halihazırda var olan
  `initialDoneCount` mantığıyla aynı şekilde ilk `initialDoneCount` kadar nokta yeşil başlar, öncesindeki
  olası yanlışlar (mevcut davranışla aynı, regresyon yok) ayrıca işaretlenmez. Bu KURAL #3'e uygundur:
  hiçbir mevcut davranış bozulmaz, yalnızca yeni bilgi eklenir.

## 2. Taş Nerde — Yerleştirme Geri Bildirimi (PlacePiecesSolver)

- Doğru yerleştirilen HER taşın etrafında yeşil çember belirir ve soru bitene/sonraki soruya
  geçilene kadar kalıcı kalır (bileşen zaten her yeni soruda `key={currentIdx}` ile sıfırdan kuruluyor).
- Yanlış kareye taş denemesi: taş tahtaya işlenmez (mevcut davranış — `evaluatePlacement` `ok:false`
  dönünce state değişmez), ama denenen kare üzerinde kısa süreli (yaklaşık 1.5 saniye) kırmızı çember
  gösterilir. Bununla birlikte soru, mevcut "tek hak" kuralına göre hemen kilitlenir (`onWrong` çağrılır,
  üstteki kırmızı geri bildirim kartı çıkar) — bu davranış DEĞİŞMİYOR, yalnızca ek olarak kareye kısa
  süreli görsel işaret ekleniyor.
- Kareye Tıkla / Taşa Tıkla tiplerinde çemberlerin soru değişene kadar kalıcı kalması zaten mevcut
  kodda çalışıyor (`clickedSquare`/`multiClicked` yalnızca soru indeksi değişince sıfırlanıyor) —
  bu maddede ek değişiklik yok.

## Test Planı

- `BoardExercise.tsx`: yeni birim/entegrasyon testleri — doğru cevaplanan sorunun noktası yeşil,
  kilitlenip geçilen yanlış sorunun noktası kırmızı kalır (sonraki soruya geçilse bile).
- `PlacePiecesSolver.tsx`: doğru yerleştirmede kalıcı yeşil çember; yanlış yerleştirmede kırmızı
  çemberin belirmesi (zamanlayıcı ile ilgili testler `vi.useFakeTimers()` ile).
