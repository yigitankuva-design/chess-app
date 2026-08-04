# Pratik Yap — Alt Sekmelerde Bot ile Konum Pratiği — Tasarım

Tarih: 2026-08-04

## Amaç

"Pratik Yap" özel sekmesinin 6 alt sekmesinde (Açılış Pratiği Yap hariç), sporcu bota
karşı belirli bir satranç konumundan pratik maçı yapabilsin. Konumları Zafer hoca admin
panelinden bir havuza girer; sporcu alt sekmeye tıkladığında havuzdan rastgele bir konum
gelir ve bota karşı maça başlar.

## Kapsam

- Sadece "Pratik Yap" adlı özel sekmenin alt sekmeleri için geçerli (genel bir mekanizma
  değil — diğer özel sekmelerde bu özellik görünmeyecek).
- Açılış Pratiği Yap'a dokunulmuyor, mevcut davranışı aynen korunuyor.
- Puan/skor kaydı yok — tamamen pratik amaçlı (Açılış Pratiği Yap ile aynı mantık).

## 1) Admin tarafı — Konum Havuzu

Her alt sekmenin admin akordiyon kartında yeni bir "Konum Ekle" bölümü olacak:

1. **Konum Diz** — mevcut tahta editörü (BoardEditor bileşeni) ile taşlar serbestçe
   yerleştirilir. Talimat/açıklama metni YOK, cümle/görüntü ekleme adımı YOK.
2. **Hamle Sırasını Belirle** — sırada beyaz mı siyah mı oynayacak seçilir.
3. **Konumu Kaydet** — konum (FEN) havuza eklenir.

Hamle dizisi (moves) KAYDEDİLMEZ — bu, mevcut "Taşı Oynat" (move_piece) akışından farklı
bir noktadır; move_piece akışı hamle dizisini zorunlu kıldığı için burada kullanılmıyor,
bunun yerine click_square'deki gibi sade "sadece konum kaydet" deseni kullanılıyor.

Zorluk düzeyi (Kolay/Orta/Zor) İSTENMEYECEK — bu havuzda ağırlıklı seçim yapılmıyor,
seçim tamamen rastgele.

Hoca, kaydedilen konumları bir liste halinde görür (küçük tahta önizlemesi + sıra bilgisi)
ve her birini silebilir. Havuz boşsa sporcu tarafında "Henüz konum eklenmedi" mesajı
gösterilir (alt sekmeye tıklandığında maç başlamaz).

### Veri modeli

`CustomTabSection` tablosuna yeni bir JSON kolon eklenir: `practice_positions`.
Varsayılan değer boş liste `[]` — mevcut kayıtlar etkilenmez (geriye dönük uyumlu).

Her öğe: `{ id: string, fen: string, turn: "w" | "b" }`

Yeni bir Alembic migration dosyası gerekiyor (mevcut `20260803_CustomTabs_add.py`
deseniyle aynı biçimde).

### Backend

- `PATCH /admin/custom-tab-sections/{id}` endpoint'i zaten var; `practice_positions`
  alanını da kabul edecek şekilde genişletilecek (validasyon: liste, her öğede fen/turn
  string olmalı).

## 2) Sporcu tarafı — Bot ile Pratik

Sporcu Pratik Yap sekmesinde bir alt sekmeye tıklayınca:

1. Havuzda konum yoksa: "Henüz konum eklenmedi" mesajı gösterilir, maç başlamaz.
2. Havuzda konum varsa: **Maç Kriterlerini Seç** ekranı gelir (mevcut `MatchCriteria`
   bileşeni, Açılış Pratiği Yap'takiyle aynı).
3. Seçim yapılınca havuzdan RASTGELE bir konum seçilir, bot ile maç başlar
   (`BotGame` bileşeni, `startFen` = seçilen konum, `studentColor` = konumun sırası).
4. Maç biter bitmez (kazanma/kaybetme/berabere/terk), tahtanın altında 3 kart belirir:
   - **Terk Et** (kare kart) — maç sürerken de tıklanabilir, mevcut `resignToBot()` davranışı
     (maçı kaybetmiş sayılır).
   - **Aynı Konumu Pratik Et** (dikdörtgen kart) — SADECE maç bitince aktif, aynı FEN ile
     yeni bir `BotGame` başlatır (mevcut "Yeniden Oyna" / key-increment deseni).
   - **Farklı Bir Konumu Pratik Yap** (dikdörtgen kart) — SADECE maç bitince aktif, havuzdan
     rastgele YENİ bir konum seçer; havuzda 2+ konum varsa az önce oynanan konum ardı ardına
     tekrar gelmez (havuzda tek konum varsa istisnasız aynısı gelir).
   - "Beraberlik Teklif Et" butonu YOK.
5. Skor/puan hiçbir yerde kaydedilmez (`onGameEnd` no-op, Açılış Pratiği Yap ile aynı).

### Bileşen yaklaşımı

`MatchLayout`'un mevcut 3-buton alanı (draw/resign/rematch) bu akışın ihtiyacını
karşılamıyor (2 farklı "yeniden başlat" davranışı + draw yok). Bu yüzden `MatchLayout`'a
dokunulmadan, bu pratik modu için YENİ bir sarmalayıcı bileşen (örn.
`PositionPoolPractice.tsx`, `OpeningPractice.tsx`'in eşdeğeri) yazılacak; kendi 3-kart
alt panelini render edip `BotGame`'i saracak. `MatchLayout` mevcut hâliyle korunur,
mevcut Açılış Pratiği Yap ve gerçek maçlar (LiveGame) etkilenmez.

## Test Kapsamı (özet)

- Backend: `practice_positions` validasyonu (liste, fen/turn zorunlu) — yeni testler.
- Admin: Konum Diz → Hamle Sırası → Kaydet akışı, havuz listesi, silme — yeni testler.
- Sporcu: boş havuzda mesaj, MatchCriteria → BotGame başlatma, 3 kart görünürlük/aktiflik
  kuralları, "Farklı Bir Konumu Pratik Yap" tekrar-önleme mantığı (saf fonksiyon olarak
  test edilecek, örn. `pickDifferentPosition(pool, excludeId)`).
- Tam test kapısı: `apps/web` (tsc/lint/vitest) + `apps/api` (pytest), migration dahil.
- Canlı doğrulama: admin konum ekleme + sporcu bot maçı + 3 kart davranışı (KURAL #6,
  önce kullanıcıya sorulacak).
