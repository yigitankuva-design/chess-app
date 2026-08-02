# Maç Ekranı — Yatay/Dikey Duyarlı Tasarım (Tasarım)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this
> design into a step-by-step implementation plan before any code is written.

## Amaç

Sporcu maç ekranını (bota karşı ve insana karşı), kullanıcının verdiği iki
görsele (`Maç Pratiği Sayfasının Tasarımı - Dikey Ekran.jpg.jpeg`,
`... - Yatay Ekran.jpg.jpeg`) göre yeniden düzenlemek. Cihaz döndürüldüğünde
(telefon/tablet dikey↔yatay) ekran OTOMATİK olarak iki düzen arasında geçiş
yapmalı — JavaScript ile algılama değil, CSS `orientation` medya sorgusuyla
(Tailwind'in yerleşik `portrait:`/`landscape:` sınıfları), böylece döndürme
anında, ekstra bir gecikme olmadan değişir.

Kullanıcı onayıyla netleşen kararlar:
- Görseller yalnızca **konum/yerleşim** (avatar, isim, süre, buton sırası)
  için referans — renkler/yazı tipi/buton görünümü uygulamanın KENDİ tasarım
  diliyle (`t-btn`, `t-card-i` vb. mevcut sınıflar) kalacak.
- Görseldeki "Yeniden Oyna" butonu bu parçada **gerçekten çalışacak** — ama
  yalnızca **bota karşı maçlarda**. İnsana karşı maçlarda (henüz bir
  "rematch" mekanizması yok) buton şimdilik gösterilmez.

## Kod okunarak bulunan mevcut yapılar (yeniden kullanılacak)

- **Avatar sistemi zaten var** — `apps/web/lib/avatars.ts` (`AVATARS`,
  `avatarEmoji`, `getSavedAvatar`), backend'de `ChildProfile.avatar` sütunu
  zaten kayıtlı (`apps/api/chess_api/models/child.py`) ve başka bir uç
  noktada (`/leaderboard`) zaten gönderiliyor. Maç ekranında hiç
  KULLANILMIYOR — bu parçada bağlanacak.
- **"Yeniden Oyna" karşılığı zaten var** — `apps/web/app/(child)/play/page.tsx`
  içinde bota karşı maç bittiğinde görünen **"Yeni Oyun"** butonu, tam olarak
  istenen işi yapıyor (`gameKey` artırarak `<BotGame>`'i sıfırdan başlatır).
  Bu parçada YENİ bir mekanizma İCAT EDİLMEYECEK — bu buton, yeni düzenin
  içine TAŞINACAK (isim: "Yeniden Oyna").
- **`MoveList.tsx` zaten kutulu ve kaydırılabilir** — yeni düzende olduğu
  gibi kullanılabilir, iç mantığına dokunulmaz.

## Mimari

**Yeni bileşen:** `apps/web/components/play/MatchLayout.tsx` — hem
`LiveGame.tsx` hem `BotGame.tsx` bu bileşeni kullanacak. Sorumluluğu SADECE
yerleşim; oyun mantığına dokunmaz.

```ts
interface PlayerInfo {
  avatarEmoji: string;
  name: string;
  ms: number | null;   // null => saatsiz, "—" gosterilir
  active: boolean;      // sirasi bu oyuncuda mi (kare/kutu vurgulanir)
}

interface Props {
  /** Tahtanin USTUNDE gorunen taraf (rakip / bot). */
  top: PlayerInfo;
  /** Tahtanin ALTINDA gorunen taraf (sporcunun kendisi). */
  bottom: PlayerInfo;
  board: React.ReactNode;
  moveList: React.ReactNode;
  drawLabel: string;         // "Beraberlik Teklif Et (3)"
  drawDisabled: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  /** Verilmezse "Yeniden Oyna" butonu HİÇ gösterilmez (insan-insan maçı). */
  onRematch?: () => void;
  /** Rematch'in AKTİF görünmesi için (ör. yalnızca maç bittiğinde). */
  rematchEnabled?: boolean;
  /** Maç bitince buton satırı yerine sonuç kartı gösterilecekse. */
  resultSlot?: React.ReactNode;
}
```

**Düzen mantığı — İKİ blok, CSS ile aç/kapa:**

Portre ve manzara için TAMAMEN AYRI iki JSX bloğu yazılır (tek blok +
`grid-template-areas` yeniden sıralaması DENENMEDİ — çünkü manzara görselinde
saat ile avatar/isim birbirinden AYRILIYOR, aynı öğelerin basit bir yeniden
sıralamasıyla elde edilemez). Görünürlük Tailwind'in yerleşik `portrait:`/
`landscape:` sınıflarıyla değişir (`hidden landscape:flex` / `flex
landscape:hidden`) — bu, saf CSS'tir, cihaz döndüğü AN devreye girer, hiçbir
JavaScript `matchMedia` dinleyicisi gerekmez.

- **Dikey:** üstte `[avatar][isim][süre]` satırı → tahta → altta
  `[avatar][isim][süre]` satırı → hamle kutusu → 3 buton yan yana
  (Beraberlik/Terk Et/Yeniden Oyna).
- **Yatay:** solda üstten alta `[süre-üst]` `[3 buton alt alta]`
  `[süre-alt]`; ortada tahta; sağda üstten alta `[avatar+isim-üst]`
  `[hamle kutusu, uzun]` `[avatar+isim-alt]`.

## Avatar Verisi

- **`LiveGame.tsx` (insan-insan + gelecekte `BotGameLive`):** `game_info`
  WS mesajına `white_avatar`/`black_avatar` eklenir (backend, küçük ek —
  `ChildProfile.avatar`; bot tarafı için sabit `"robot"`). İstemci HER ZAMAN
  sunucudan gelen avatarı gösterir — kendi cihazındaki `getSavedAvatar()`'ı
  KULLANMAZ, çünkü bu ekran zaten "sunucu otorite" prensibiyle çalışıyor
  (aynı sporcunun başka cihazında da doğru avatarı görmesi gerekir).
- **`BotGame.tsx` (bugün hâlâ canlı, REST tabanlı, `game_info` YOK):**
  sporcunun avatarı `getSavedAvatar()` (yerel) ile, botun avatarı sabit
  `"robot"` (🤖) ile gösterilir — bu ekran zaten sunucu-otorite DEĞİL, ek bir
  ağ isteği eklemeye gerek yok.

## Rematch (Yeniden Oyna)

- `apps/web/app/(child)/play/page.tsx`: mevcut "Yeni Oyun" butonunun
  `onClick` mantığı (`setBotColor(...); setGameKey((k) => k + 1);`)
  AYNEN korunur, yalnızca `<BotGame>`'e `onRematch` prop'u olarak geçirilir
  ve buton `MatchLayout`'un içine taşınır (sayfanın en altındaki ayrı
  buton KALDIRILIR).
- `apps/web/components/play/OpeningPractice.tsx`: benzer küçük bir
  `matchKey` state'i eklenir (bugün hiç yok) — `onRematch` aynı açılış
  pozisyonuyla yeni bir maç başlatır.
- `LiveGame.tsx`: `onRematch` prop'u VERİLMEZ — buton hiç görünmez.

## Kapsam Dışı (bilerek)

- İnsana karşı maçlarda rematch — ayrı, daha büyük bir görev (rakibe yeni
  maç teklifi göndermek gerekir).
- `BotGameLive.tsx`'in bu yeni düzeni kullanması — kendisi zaten hiçbir
  sayfaya bağlı değil (önceki parçada bilerek dondurulmuştu); `LiveGame.tsx`
  üzerinden düzeni otomatik MİRAS ALACAK, ayrıca bir şey yapılmasına gerek
  yok.
- Tablet/telefon DIŞINDAKİ ekran boyutları için özel ince ayar (ör. çok
  büyük masaüstü monitörler) — mevcut `max-width` sınırlamaları korunur.

## Test Yaklaşımı

- `MatchLayout`: portre ve manzara bloklarının İKİSİNİN DE DOM'da var
  olduğunu ama görünürlük sınıflarının doğru olduğunu (`landscape:hidden`
  vb.) doğrulayan bileşen testleri; `onRematch` verilmediğinde buton HİÇ
  render edilmediğini doğrulayan test.
- Backend: `game_info`'nun `white_avatar`/`black_avatar` alanlarını doğru
  gönderdiğini (insan-insan ve bot maçı için ayrı ayrı) doğrulayan testler.
- **Gerçek döndürme testi (KURAL #6):** Browser aracının `resize_window`
  fonksiyonuyla önce dikey (`375x812`), sonra yatay (`812x375`) boyutlara
  geçilip GERÇEKTEN her iki düzenin de doğru göründüğü ekran görüntüsüyle
  doğrulanır — yalnızca otomatik testlere güvenilmez.
