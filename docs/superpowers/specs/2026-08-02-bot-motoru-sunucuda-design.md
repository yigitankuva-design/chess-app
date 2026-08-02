# Bot Maçı — Motor Sunucuda (Tasarım)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this
> design into a step-by-step implementation plan before any code is written.

## Amaç

Ana spec'in ("Bot Maçı — Cihazlar Arası Canlı Senkron") üçüncü ve mimari olarak en
önemli parçası. İlk iki parça (`GameRoom` çoklu cihaz desteği, `/games/bot/start`
renk/pozisyon/süre kaydı) tamamlandı ve yayında.

Bu parçada: botun hamlesini hesaplayan motor **tarayıcıdan sunucuya taşınır**.
Sporcu bir hamle yaptığında ve sıra bota geldiğinde, sunucu artık botun hamlesini
KENDİSİ hesaplar, doğrular, kaydeder ve odaya (aynı sporcunun açık tüm cihazlarına)
yayınlar — insan-insan maçında zaten çalışan `/ws/game/{game_id}` +
`GameRoom` mekanizmasıyla AYNI yol.

**Bu parça bitince** bot maçının hamlesi gerçekten sunucuda hesaplanmış olacak
(otomatik testlerle doğrulanmış) — ama `BotGame.tsx` (mevcut ön yüz) henüz bu WS
akışına bağlı DEĞİL, hâlâ eski REST + tarayıcı-motoru yolunu kullanıyor olacak.
Ön yüzün bağlanması ayrı, sonraki (son) parça.

## Kod okunarak bulunan bir hata: `student_color` sıra kontrolünde kullanılmıyor

`live_game.py::_handle_move`, "sıra kimde" kararını `Game.white_child_id`/
`Game.black_child_id`'ye bakarak veriyor. Bot maçlarında (2. parçanın BİLEREK
verdiği karar gereği, rozet uyumluluğu için) `white_child_id` HER ZAMAN sporcu,
`black_child_id` HER ZAMAN `NULL`'dur — sporcunun gerçekte hangi rengi seçtiğine
(`Game.student_color`) bakılmaksızın.

Sonuç: bugünkü `_handle_move` mantığı bir bot maçına AYNEN uygulansaydı, sporcu
`student_color='b'` seçtiğinde SIRASI GELDİĞİNDE (siyahın sırası, `child_id !=
black_id` çünkü `black_id` `NULL`) hamlesi "sırası değil" diye REDDEDİLİRDİ —
sporcu siyah oynayan bir bot maçında HİÇ hamle yapamazdı.

**Düzeltme:** bot maçlarında sıra kontrolü `white_child_id`/`black_child_id`
yerine `Game.student_color`'a bakacak şekilde ayrılır:

```python
whites_turn = current_fen.split()[1] == "w"
if game.type == GameType.bot:
    student_is_white = (game.student_color or "w") == "w"
    human_may_move = whites_turn == student_is_white
else:
    human_may_move = (whites_turn and child_id == white_id) or (not whites_turn and child_id == black_id)
```

İnsan-insan maçı için bu, MANTIKEN bugünküyle BİREBİR AYNI (De Morgan eşdeğeri) —
davranış değişmez, yalnızca tek bir `if`'e toparlanır.

## Mimari Karar

1. **Motor soyutlaması** — `chess_api/services/bot_engine.py` (yeni): tek bir
   fonksiyon, `async def get_bot_move(fen: str, skill_level: int) -> str | None`.
   Production'da `python-chess`'in `chess.engine.popen_uci` ile Stockfish
   binary'sini (Nixpacks: `nixPkgs = ["stockfish"]`) çağırır — bugün istemcide
   kullanılan AYNI ayarlarla (`Skill Level` UCI seçeneği, `depth=8` arama
   limiti; bkz. `apps/web/lib/chess/stockfish.ts`). Bu fonksiyon `live_game.py`
   içinde `chess_api.routers.live_game.get_bot_move` olarak import edilir —
   testler mevcut `get_session_factory` deseniyle AYNI şekilde
   `monkeypatch.setattr(...)` ile SAHTE bir motorla değiştirebilir. **Bilgisayarımda
   gerçek Stockfish binary'si kurulu değil (doğrulandı) — bu yüzden testler HİÇBİR
   ZAMAN gerçek motoru çağırmaz, yalnızca "motor çağrıldığında ne olur" akışını
   sınar.**

2. **`_handle_move` sonuna bot-hamlesi tetikleyicisi** — insan hamlesi işlenip
   yayınlandıktan SONRA, maç hâlâ aktifse VE `game.type == bot` VE artık sıra
   botta ise, yeni bir `_play_bot_move(game_id, room)` fonksiyonu çağrılır. Bu
   fonksiyon motoru çağırır, dönen UCI hamleyi `validate_move` ile doğrular
   (motor kural dışı bir şey döndürürse — beklenmez ama savunma amaçlı —
   sessizce hiçbir şey yapılmaz, maç kilitlenmez), `GameMove` olarak kaydeder
   (`by_child_id=None`), saat varsa işletir, mat/pat kontrolü yapar, `move_made`
   (+ gerekirse `clock`/`game_over`) yayınlar — insan hamlesindeki AYNI adımlar.

3. **Beraberlik teklifine bot cevabı** — `apps/web/lib/play/botDraw.ts`'teki
   `materialDiff`/`botAcceptsDraw` saf fonksiyonları `chess_api/services/
   bot_draw.py`'ye BİREBİR aynı mantıkla taşınır (Python'a çevrilir).
   `_handle_offer_draw`, bir bot maçında teklif işlendikten HEMEN SONRA botun
   kararını sorar ve `_handle_draw` (kabul) veya `_handle_decline_draw` (red)
   çağrısını KENDİSİ tetikler — insan-insan maçında bunu yapan ikinci bir
   oyuncu yokken, bot maçında "ikinci oyuncu" sunucunun kendisidir.

## Kapsam Dışı

- `BotGame.tsx`'in bu WS akışına bağlanması (son, ayrı parça).
- Nixpacks/Stockfish'in GERÇEKTEN Railway'e kurulup denenmesi — bu parçanın
  kodu motor çağrısını doğru YAPILANDIRIR, ama binary'nin production'a kurulup
  test edilmesi, uygulama planında AYRI, dikkatle işaretlenmiş bir adım olarak
  ele alınır (staging'de önce denenmeden production'a alınmaz).
- Zaman aşımı/motor hatası durumunda "botun hamlesi gelmezse ne olur" gibi
  dayanıklılık senaryoları — motor çağrısı başarısız olursa (bugünkü istemci
  davranışıyla TUTARLI şekilde, bkz. `BotGame.tsx`'teki `try { } catch { /* motor
  hatasi oyunu kilitlemez */ }`) sessizce hiçbir hamle oynanmaz, maç kilitlenmez
  ama ilerlemez de — bu bilinen bir sınırlama, bu parçanın kapsamında
  GENİŞLETİLMEZ.

## Test Yaklaşımı

- `bot_engine.get_bot_move` HER ZAMAN testlerde `monkeypatch` ile sahte bir
  fonksiyona değiştirilir (sabit, geçerli bir UCI hamle döndüren) — gerçek
  Stockfish binary'sine test ortamında hiç ihtiyaç yoktur.
- Sıra-kontrolü düzeltmesi: `student_color='b'` olan bir bot maçında sporcunun
  siyah hamlesinin KABUL edildiğini gösteren test (bugünkü kodla bu KIRMIZI
  olurdu — kod yazılmadan önce bu gerçekten doğrulanacak).
- Bot hamlesi: insan hamlesinden sonra sırada bot varsa, sahte motorun döndürdüğü
  hamlenin kaydedildiğini ve `move_made` (`by_child_id: null`) olarak
  yayınlandığını doğrulayan test.
- Beraberlik: bot geride/eşit durumdaysa teklifi kabul ettiğini, bot bir
  piyondan fazla öndeyse reddettiğini doğrulayan testler — `bot-draw.test.ts`
  (mevcut frontend testi) ile AYNI senaryolar Python tarafında.
- İnsan-insan maçı regresyonu: sıra-kontrolü refactoru sonrası MEVCUT tüm
  `live_game` testleri (`test_live_two_moves.py`, `test_draw_offers_ws.py`,
  `test_game_info_moves.py`, vb.) değişmeden PASS etmeli.

## Riskler

- Sıra-kontrolü refactoru `_handle_move`'un KALBİNE dokunuyor — insan-insan
  maçları bozma riski en yüksek nokta. Bu yüzden bu adım TEK BAŞINA, kendi
  regresyon testleriyle doğrulanmadan bir sonraki adıma geçilmez.
- Motor soyutlaması doğru kurulsa bile, GERÇEK Stockfish binary'sinin
  Railway/Nixpacks üzerinde çalışıp çalışmayacağı bu parçada TEST EDİLMEZ —
  yalnızca kod hazırlanır. Kapsam dışı bölümünde belirtildiği gibi, gerçek
  kurulum ayrı, dikkatli bir adım.
