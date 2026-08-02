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

## Gözden geçirmede bulunan iki ek sorun (kod çalıştırılarak doğrulandı)

Bu belgenin ilk hâli yazıldıktan sonra iddialar tek tek sınandı. İkisi doğrulandı
(aşağıdaki sıra-kontrolü hatası ve `popen_uci`'nin gerçekten async olduğu —
`python-chess 1.2.0` ile çalıştırılarak teyit edildi), ama İKİ YENİ sorun çıktı:

### A. Beraberliği REDDEDEN bot, sporcuya hiçbir şey söylemez

İlk tasarım "bot reddederse mevcut `_handle_decline_draw` çağrılır" diyordu.
Bu YANLIŞ:

```python
async def _handle_decline_draw(game_id, child_id, room):
    ...
    await room.broadcast({"type": "draw_declined", "by_child_id": child_id}, exclude=child_id)
```

Bu fonksiyon mesajı **teklif edeni HARİÇ TUTARAK** yayınlar (insan-insan maçında
doğru: red haberi rakibe gider). Bot maçında ise odadaki TEK katılımcı sporcunun
kendisidir — `exclude=child_id` onu da eleyince mesaj **hiç kimseye** gitmez.
Gerçek `GameRoom` ile çalıştırılarak doğrulandı: **sporcuya ulaşan mesaj sayısı 0**.
Sporcu beraberlik teklif eder, bot reddeder, sporcu bunu ASLA öğrenmez ve ekranda
bekler.

**Düzeltme:** bot maçında red, mevcut fonksiyon yeniden kullanılmadan, `exclude`
OLMADAN ve `by_child_id: None` (yani "bot") ile yayınlanır. Kabul yolunda
(`_handle_draw`) böyle bir sorun YOK — o zaten `exclude` kullanmadan `game_over`
yayınlıyor, sporcuya ulaşır.

### B. Botun gücü yalnızca `skill_level` değil — `depth` de var, ve sunucuda YOK

İlk tasarım "istemcideki AYNI ayarlar (`Skill Level`, `depth=8`)" diyordu; `depth=8`
sanki sabitmiş gibi. Değil. `apps/web/lib/play/levels.ts`'te 8 zorluk düzeyi var ve
her düzeyin AYRI bir derinliği:

| Düzey | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| skill | 0 | 3 | 6 | 9 | 12 | 15 | 18 | 20 |
| depth | 1 | 3 | 5 | 7 | 8 | 9 | 11 | 12 |

Sunucu bugün YALNIZCA `skill_level`'ı saklıyor (`Game.black_bot_level`); `depth`
hiç gönderilmiyor. Sunucu motoru `depth` olmadan çağırırsa bot, sporcunun seçtiği
düzeyden FARKLI (muhtemelen çok daha güçlü) oynar — özellikle 1. düzeyde
(depth=1 beklenirken varsayılan derinlik) yeni başlayan çocuğu ezer.

**Düzeltme:** yukarıdaki tablo `chess_api/services/bot_engine.py` içine Python
sabiti olarak taşınır ve `skill_level` → `depth` eşlemesi oradan yapılır. Tabloda
olmayan bir `skill_level` gelirse (uç nokta 0-20 arasını kabul ediyor, ör. 7),
**en yakın alt basamağın** derinliği kullanılır — bu, sessizce çok güçlü bir bot
üretmekten güvenlidir. Bu eşleme saf bir fonksiyon olarak ayrı test edilir.

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

İnsan-insan maçı için bu, MANTIKEN bugünküyle BİREBİR AYNI — bu bir varsayım
değil, **tüm girdi kombinasyonları (sıra × sporcu × beyaz × siyah, `None` değerler
dahil) çalıştırılarak sınandı: 0 fark**. Davranış değişmez, yalnızca tek bir
`if`'e toparlanır.

## Mimari Karar

1. **Motor soyutlaması** — `chess_api/services/bot_engine.py` (yeni). İki parça:
   - `depth_for_skill(skill_level: int) -> int` — saf fonksiyon, yukarıdaki
     (sorun B'deki) tabloyu uygular, tabloda olmayan değerde en yakın alt
     basamağa yuvarlar. Ayrı ve kolayca test edilir.
   - `async def get_bot_move(fen: str, skill_level: int) -> str | None` —
     production'da `python-chess`'in `chess.engine.popen_uci` (çalıştırılarak
     doğrulandı: bu gerçekten bir `async` fonksiyon, yani FastAPI'nin olay
     döngüsünü bloklamaz) ile Stockfish binary'sini (Nixpacks:
     `nixPkgs = ["stockfish"]`) çağırır; `Skill Level` UCI seçeneğini ve
     `depth_for_skill(...)` derinliğini uygular — böylece bot, sporcunun seçtiği
     düzeyde oynar.

   `get_bot_move` `live_game.py` içine import edilir; testler mevcut
   `get_session_factory` deseniyle AYNI şekilde `monkeypatch.setattr(...)` ile
   SAHTE bir motorla değiştirir. **Bu bilgisayarda gerçek Stockfish binary'si
   kurulu değil (doğrulandı) — testler HİÇBİR ZAMAN gerçek motoru çağırmaz,
   yalnızca "motor çağrıldığında akış doğru mu" sorusunu sınar.**

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
   `_handle_offer_draw`, bir bot maçında teklif işlendikten HEMEN SONRA güncel
   FEN'i (`_current_fen_and_ply`) ve botun rengini (`student_color`'ın tersi)
   kullanarak botun kararını sorar:
   - **Kabul** → mevcut `_handle_draw(game_id, room)` çağrılır. Bu güvenli:
     `game_over`'ı `exclude` KULLANMADAN yayınlar, sporcuya ulaşır.
   - **Red** → mevcut `_handle_decline_draw` **KULLANILMAZ** (sorun A: sporcuyu
     hariç tutup mesajı hiç kimseye göndermiyor, ölçüldü). Bunun yerine doğrudan
     `await room.broadcast({"type": "draw_declined", "by_child_id": None})` —
     `exclude` yok, `by_child_id: None` "reddeden bot" anlamına gelir.

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
- **Beraberlik reddi sporcuya ULAŞMALI** (sorun A): bot reddettiğinde sporcunun
  bağlantısının `draw_declined` mesajını GERÇEKTEN aldığını doğrulayan test.
  Mevcut `_handle_decline_draw` yeniden kullanılsaydı bu test 0 mesajla KALIRDI
  (ölçüldü) — bu yüzden bu test, doğru yaklaşımı zorunlu kılan koruma testidir.
- **`depth_for_skill` eşlemesi** (sorun B): tablodaki 8 düzeyin her birinin doğru
  derinliği verdiğini; tabloda olmayan bir değerin (ör. `skill=7`) en yakın ALT
  basamağa (skill 6 → depth 5) yuvarlandığını; uç değerlerin (0 ve 20) doğru
  çalıştığını doğrulayan testler.
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
