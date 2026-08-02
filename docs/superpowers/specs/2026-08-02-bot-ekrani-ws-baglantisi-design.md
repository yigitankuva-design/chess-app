# Bot Ekranını WS Akışına Bağlama (Tasarım)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this
> design into a step-by-step implementation plan before any code is written.

## Amaç

Ana spec'in ("Bot Maçı — Cihazlar Arası Canlı Senkron") beşinci parçası. Önceki üç
parça (`GameRoom` çoklu cihaz desteği, `/games/bot/start` renk/pozisyon/süre
kaydı, bot motoru sunucuda) tamamlandı ve yayında. Kullanıcı isteğiyle Stockfish
binary kurulumu (motor entegrasyonunun son ayağı) sona bırakıldı.

Bu parçada: mevcut ön yüz bileşeni `BotGame.tsx`'in yerini alacak, sunucudaki
yeni WebSocket akışını kullanan bir yol **hazırlanır ve test edilir** — ama
**canlıya bağlanmaz**. Motor kurulmadan bu yol devreye alınırsa, bota karşı
oynayan TÜM sporcularda bot hiç hamle yapamaz hale gelir (motor `None` döner,
sessizce hiçbir şey olmaz) — bu, KURAL #3'ü ihlal eder. Kullanıcı onayıyla
netleşti: bu parça yalnızca **hazırlık**tır.

## Kod okunarak bulunan kritik basitleştirme

İlk beklenti "LiveGame.tsx'in mantığını temel alan yeni bir bileşen" yazmaktı.
Ama `LiveGame.tsx` ve backend'in mesaj protokolünü satır satır karşılaştırınca
görüldü ki **`LiveGame.tsx` bot maçlarında HİÇBİR DEĞİŞİKLİK olmadan çalışır**:

- `move_made` mesajı insan/bot ayrımı yapmadan aynı şekilde işleniyor
  (`by_child_id` yalnızca bilgi amaçlı, ekran onu okumuyor bile).
- Beraberlik teklifine botun cevabı (`_resolve_bot_draw_response`, önceki
  parçada eklendi) `_handle_draw`/`draw_declined` üzerinden AYNI mesaj
  tiplerini üretiyor — `LiveGame.tsx` bunları zaten dinliyor (kabul ederse
  `game_over`, reddederse `draw_declined` → "Rakip beraberlik teklifini
  reddetti" satırı).
- Terk et, saat, ön-hamle, terfi, ses — hepsi zaten `LiveGame.tsx`'te var ve
  jenerik (insan/bot ayrımı gerektirmiyor).

Bu yüzden yeni bir "bot ekranı" YAZILMAYACAK — yalnızca `LiveGame.tsx`'i
**bota karşı maç kimliğiyle açan küçük bir giriş bileşeni** yazılacak.

## İki ek bulgu

1. **`onGameEnd` callback'i her iki kullanım yerinde de boş** —
   `apps/web/app/(child)/play/page.tsx:209` ve
   `apps/web/components/play/OpeningPractice.tsx:71` ikisi de
   `onGameEnd={() => {}}` geçiyor. Yani bu geri çağrının bugün gerçek bir işlevi
   YOK — yeni akışa taşınmasına gerek yoktur.
2. **Botun ismi sunucuda boş kalıyor.** `live_game.py`'deki `game_info`
   mesajı, `white_name`/`black_name`'i `ChildProfile` tablosundan okuyor; bot
   tarafının `ChildProfile` kaydı yok, bu yüzden `w`/`b` değişkeni `None` olup
   varsayılan `"Sporcu"` yazılır. Botun ekranda "Bot" görünmesi için küçük bir
   düzeltme gerekiyor (bkz. aşağıda).

## Mimari

**Yeni dosya:** `apps/web/components/BotGameLive.tsx` — küçük bir "giriş"
bileşeni:

1. Mount olduğunda `POST /games/bot/start` çağrılır — artık TÜM alanlarla
   (`skill_level`, `student_color`, `start_fen`, `tc_base_seconds`,
   `tc_increment_seconds` — hepsi 2. parçada eklendi).
2. Dönen `game_id` ile `<LiveGame gameId={...} myColor={...} />` render edilir
   — `LiveGame.tsx`'e TEK BİR SATIR bile dokunulmaz.
3. İstek tamamlanana kadar mevcut `BotGame.tsx`'teki AYNI yükleniyor
   iskeleti (`t-skel`) gösterilir.

**Backend düzeltmesi:** `live_game.py`'deki `game_ws`'in `game_info` gönderen
bölümünde, `game.type == GameType.bot` ise boş kalan ismin yerine `"Bot"`
yazılır — hangi taraf boşsa (`white_name` veya `black_name`) ona uygulanır.

## Kapsam Dışı (bilerek)

- `play/page.tsx` ve `OpeningPractice.tsx`'in `<BotGame>` yerine
  `<BotGameLive>` kullanması — bu, motor kurulduktan SONRA, ayrı ve küçük bir
  "devreye alma" görevidir. Bu parça yalnızca `BotGameLive.tsx`'i YAZAR ve
  TEST EDER; hiçbir gerçek sayfaya BAĞLAMAZ.
- "Bot düşünüyor..." göstergesi — sunucu şu an böyle bir ara mesaj
  göndermiyor (bot hamlesi tek adımda hesaplanıp yayınlanıyor). Bu küçük bir
  UX farkı; ayrı bir iyileştirme olarak ele alınabilir, bu parçanın kapsamında
  DEĞİL.
- Eski `BotGame.tsx`, `botGameSession.ts`, `stockfish.ts` (istemci motoru) —
  SİLİNMEZ, dokunulmaz. Devreye alma tamamlanana kadar (ve muhtemelen bir
  süre sonrasında da geriye dönüş için) canlı kalmalı.

## Test Yaklaşımı

- `BotGameLive`: `/games/bot/start`'a doğru gövdeyle (renk/pozisyon/süre)
  istek attığını, dönen `game_id` ile `LiveGame`'i doğru `myColor` ile render
  ettiğini doğrulayan bileşen testi (mock `fetch`, `LiveGame`'in kendisi mock
  EDİLMEZ — gerçek bileşen kullanılır, yalnızca WS bağlantısı test ortamında
  zaten mock'lanabilir bir hook üzerinden).
- Backend: bot maçında `game_info`'nun boş kalan ismi `"Bot"` olarak
  doldurduğunu, insan-insan maçında bu değişikliğin HİÇBİR ETKİSİ olmadığını
  (regresyon) doğrulayan testler.
- **Canlı ekran testi YAPILAMAZ** (KURAL #6 gereği dürüstçe belirtiliyor):
  `BotGameLive` hiçbir sayfaya bağlı olmadığı için gerçek tarayıcıda "bota
  karşı oyna" akışından erişilemez. Doğrulama yalnızca otomatik testlerle
  yapılır; gerçek uçtan uca deneme, devreye alma görevinde (motorla birlikte)
  yapılacaktır.
