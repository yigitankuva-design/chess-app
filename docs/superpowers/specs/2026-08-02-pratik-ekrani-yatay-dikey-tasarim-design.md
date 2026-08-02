# Pratik Ekranı — Dikey/Yatay Tasarım

> Bu belge maç ekranı için yazılan `docs/superpowers/specs/2026-08-02-mac-ekrani-yatay-dikey-tasarim-design.md`
> ile AYNI mimari yaklaşımı, "Süresiz/Süreli Pratik Yap" ve "Kendini Test Et" ekranlarına uygular.

## Amaç

Sporcunun soru çözdüğü pratik ekranı (`apps/web/app/(child)/pratik/[mode]/page.tsx` →
`apps/web/components/lesson-steps/BoardExercise.tsx`) şu an sadece dikey (tahta üstte,
içerik altta) düzende. Tablet/telefon yatay çevrildiğinde veya bilgisayarda (her zaman
yatay ekran) kullanılırken de düzgün görünmesi gerekiyor.

Kullanıcı iki referans görsel verdi (OneDrive Masaüstü):
- `Süresiz Pratik Yap Sayfasının Tasarımı -Dikey Ekran.jpg.jpeg`
- `Süresiz Pratik Yap Sayfasının Tasarımı - Yatay Ekran.jpg.jpeg`

Görseller çoktan-seçmeli (A/B/C şıkkı) bir soruyu gösteriyor, ama **kapsam TÜM soru
tiplerini kapsar** (çoktan seçmeli, taş sürme, kareye tıklama, taş tanıma) — kullanıcı bunu
onayladı. Görseller sadece YERLEŞİM (tahta/içerik konumu, kod etiketi yeri) referansıdır;
renk/yazı tipi/görsel stil uygulamanın kendi tasarım diline (`t-card-i`, `t-btn` vb.) uyar.

## Mevcut Durum

`BoardExercise.tsx`'in döndürdüğü JSX (satır 441-640), her zaman dikey bir yığın:
1. İlerleme çubuğu + kod rozeti (`#004`) — üst satır
2. Tahta (veya `move_piece` tipinde `MovePieceSolver`)
3. Talimat kartı
4. Soru tipine özel içerik (şıklar / taş tanıma seçenekleri / ipucu metni)
5. Cevap sonrası: Geribildirim kartı + "Sonraki Soruya Geç" kartı (yan yana, `grid-cols-2`)

Sayfa başlığı (`pratik/[mode]/page.tsx`'teki `header`: emoji + "Süresiz Pratik Yap" +
alt konu + varsa süre) bu yapının DIŞINDA, her zaman en üstte — bu değişmiyor.

## Yaklaşım — Maç Ekranıyla Aynı Mimari

Maç ekranında (`MatchLayout.tsx` + `.match-grid`) kanıtlanan yöntem tekrar kullanılır:
**TEK DOM ağacı**, CSS Grid `grid-template-areas` ile dikey/yatay arasında yeniden
konumlama. Hiçbir buton/kart iki kez render edilmez — mevcut testler bunu bozulmadan
görür.

İki alan tanımlanır:
- **`board`** — tahta (veya `MovePieceSolver`) + kenarındaki KOD etiketi
- **`content`** — talimat kartı, soru tipine özel içerik, geribildirim/sonraki-soru kartları
  (bunların KENDİ İÇ yapısı DEĞİŞMİYOR — sadece bu "content" bloğunun tamamı tahtaya göre
  konum değiştiriyor)

**Dikey:** `board` üstte (tam genişlik), `content` altta (tam genişlik) — bugünkü
görünümle aynı, sadece iki isimli bloğa ayrılmış hali.

**Yatay:** `board` solda (sabit, makul genişlikte), `content` sağda — görsellerdeki gibi.

```
Dikey:                      Yatay:
┌─────────────┐             ┌───────┬─────────┐
│    board    │             │       │ content │
├─────────────┤             │ board │ (şıklar,│
│   content   │             │       │ geri-   │
└─────────────┘             │       │ bildirim)│
                             └───────┴─────────┘
```

## Kod Etiketi (KOD-004)

Şu an ilerleme çubuğunun yanında küçük bir rozet olarak duruyor. Kullanıcının kararı:
görsellerdeki gibi **tahtanın kenarında, yukarıdan aşağıya dönük yazı** olarak taşınacak
(CSS `writing-mode` ile döndürülmüş metin — ekstra bir görsel/resim değil, düz yazı).
İlerleme çubuğunun yanındaki eski rozet kaldırılır (tekrar olmasın diye).

## Genişlik Riski — Maç Ekranındaki Dersten Öğrenilen

Maç ekranı ilk sürümünde yatay modda kenar sütunlar ekran genişliğine (vw) göre
büyütülmüş, geniş bilgisayar ekranında tahtayı ezmişti (Zafer Hoca'nın bildirdiği hata).
Bu ekranda aynı hatayı YAPMAMAK için: yatay moddaki `board`/`content` sütun genişlikleri
sabit ölçü birimleriyle (rem) tanımlanacak, ekran genişliğine göre büyümeyecek. Ayrıca
sayfanın dış çerçevesi (`max-w-lg` — 512px sabit) yatay modda biraz genişletilecek ki
tahta ve içerik sıkışmasın.

## Soru Tipine Göre İçerik Değişmiyor

`content` bloğunun İÇİ (talimat kartı, şıklar, geribildirim/sonraki-soru satırı) bugünkü
mantığıyla aynı kalır — hangi soru tipinin ne gösterdiği değişmiyor, sadece bu blok artık
tahtanın altında değil (yatayda) yanında duruyor. `identify_piece` seçenekleri, çoktan
seçmeli şıklar, ipucu metni — hepsi olduğu gibi kalır.

## Kapsam Dışı

- Soru tiplerinin kendi iç mantığı/görünümü değişmiyor (sadece taşınıyor).
- Süreli mod (`sureli`) sayaç davranışı değişmiyor.
- `PracticeResult` (bitiş ekranı) bu değişikliğin dışında.

## Test Planı

- Mevcut `BoardExercise` testleri (board-exercise-*.test.tsx, click-mode-select.test.tsx,
  vb.) DEĞİŞMEDEN geçmeli — hiçbir eleman ikinci kez render edilmediği için buton/metin
  sayıları aynı kalır.
- Yeni test: dikey/yatay CSS sınıflarının doğru alanlara atandığını doğrulayan birkaç
  birim test (maç ekranındaki `match-layout.test.tsx` düzeyinde, DOM yapısı kontrolü).
- Tam test kapısı: `npx tsc --noEmit && npx next lint && npx vitest run`.
- Gerçek tarayıcıda dikey/yatay/masaüstü (geniş ekran) ölçümü — maç ekranındaki hatayı
  tekrarlamamak için genişlik ÖZELLİKLE masaüstü boyutunda (örn. 1600px) kontrol edilecek.
