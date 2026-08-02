# Bot Maçı — Cihazlar Arası Canlı Senkron (Tasarım)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this
> design into a step-by-step implementation plan before any code is written.

## Amaç

Bir sporcu, aynı hesapla birden fazla cihazdan (telefon/tablet/bilgisayar) aynı anda
oturum açabildiğinde, bota karşı sürmekte olan bir maçın **gerçek durumunu** her
cihazda anlık göstermek. Bugün bot maçının hamle geçmişi yalnızca o cihazın
`sessionStorage`'ında tutuluyor; başka bir cihaz aynı maçtan habersiz, kendi başına
yeni bir maç başlatıyor. Hedef: hangi cihaz açılırsa açılsın aynı, güncel maçı
göstermek; bir cihazdaki hamle diğerinde sayfa yenilemeden anında görünmek.

Kullanıcı onayıyla netleşen kapsam kararları:
- **Gerçek zamanlı** olacak (yalnızca "yenilemede görünsün" değil).
- Botun hamlesini artık **sunucu** hesaplayacak (tarayıcı değil) — iki cihazın aynı
  anda bot hamlesi hesaplamaya çalışıp çakışmasını baştan imkânsız kılmak için.
- Yayına çıkarken **o an açık olan eski bot maçları kendi cihazında olduğu gibi
  biter**; yayından SONRA başlayan her bot maçı yeni (senkron) sistemle çalışır.
  Geriye dönük göç/migrasyon gerektiren bir "eski maçı yeni sisteme taşı" işlemi
  YAPILMAZ (KURAL #3 — canlı kullanıcıyı riske atmadan en basit güvenli geçiş).

Bu iş, önceki 5 maddelik "Hızlı Erişim" grubundan ayrılmış, kullanıcının kendi
isteğiyle "ayrı bir iş olarak sonra ele al" dediği maddedir; şimdi bağımsız bir
spec/plan/uygulama döngüsü olarak ele alınıyor.

## Fizibilite (sistem-muhendisi ön incelemesi — özet)

- Backend'de `python-chess` zaten kurulu (`apps/api/requirements.txt`); UCI motoruyla
  konuşmak için gereken `chess.engine` modülü hazır. Eksik olan tek şey Stockfish
  **binary**'sinin kendisi — Railway'in Nixpacks derleyicisiyle (`nixPkgs = ["stockfish"]`)
  kurulabilir, bu standart ve yaygın kullanılan bir yöntemdir.
- Düşük/orta zorluk seviyelerinde (bugün istemcide kullanılan derinlikle aynı) tek bir
  Stockfish süreci hafif — ayrı bir sunucu/worker KURULMASINA gerek yok, mevcut API
  servisi üzerinde çalışır. `chess.engine`'in async (awaitable) arayüzü kullanılırsa
  FastAPI'nin olay döngüsünü bloklamaz.
- İnsan-insan canlı maçlarda zaten çalışan altyapı (`apps/api/chess_api/routers/live_game.py`
  içindeki `/ws/game/{game_id}` uç noktası + `GameRoom` yayın mekanizması, `apps/web/components/LiveGame.tsx`)
  büyük ölçüde yeniden kullanılabilir — ancak **olduğu gibi değil**, bkz. aşağıdaki
  "Gözden geçirmede bulunan engeller" bölümü (madde 1). Yeni bir WebSocket altyapısı
  kurmaya gerek yok, ama mevcut oda mekanizmasının çoklu-cihaz desteği YOK ve
  eklenmesi gerekiyor.
- Somut riskler: (1) Nixpacks derleme değişikliği önce test/staging'de denenmeli, canlı
  Railway servisine doğrudan uygulanmamalı; (2) yayın anında açık olan eski-usul bot
  maçları için net bir geçiş kuralı gerekiyor (yukarıda karara bağlandı); (3) eşzamanlı
  çok sayıda bot maçında sunucu kaynak kullanımı test edilmeden varsayılmamalı — küçük
  bir yük testiyle doğrulanmalı.

## Gözden geçirmede bulunan engeller (kod okunarak doğrulandı)

Bu belgenin ilk hâli, ön incelemeye dayanarak yazılmıştı. Sonrasında ilgili kaynak
dosyalar satır satır okunduğunda, tasarımın temelini etkileyen ÜÇ somut sorun bulundu.
Üçü de plan aşamasında ayrı birer iş kalemi olarak ele alınmalıdır.

### 1. Mevcut oda mekanizması çoklu-cihazı DESTEKLEMİYOR (temel varsayım hatası)

`apps/api/chess_api/services/game_room.py`:

```python
self.players: dict[int, Sender] = {}   # child_id -> sender

def join(self, child_id, sender):
    self.players[child_id] = sender    # AYNI child_id ikinci kez baglanirsa
                                       # birinci cihazin soketi USTUNE YAZILIR
def leave(self, child_id):
    self.players.pop(child_id, None)   # hangi cihazin koptugu bilinmiyor
```

Oda, bağlantıları **sporcu kimliğine göre** tutuyor, bağlantı başına değil. Sonuçları:

- Aynı sporcu ikinci bir cihazdan bağlanırsa, **birinci cihazın soketi sessizce
  yayın listesinden düşer** — bağlantı kapanmaz, ama o cihaz bir daha hiçbir mesaj
  almaz (ölü ekran). Yani "iki cihazda aynı anda görsün" hedefi bu hâliyle
  ÇALIŞMAZ; tasarımın ilk hâlindeki "oda birden fazla cihazı zaten destekliyor"
  ifadesi YANLIŞTI.
- İkinci cihaz kapanınca `leave(child_id)` kaydı tamamen siler; hâlâ açık olan
  birinci cihaz da yayın almaz hâle gelir.

Bu, yalnızca yeni bot akışını değil, **bugün canlıdaki insan-insan maçlarını da**
etkileyen mevcut bir kusurdur (bir sporcu aynı maçı iki cihazda açarsa ilk cihaz
sessizleşir). Kapsam: `GameRoom` bağlantı başına kimliğe geçirilmeli
(`child_id -> bağlantılar kümesi`), `leave` yalnızca kopan soketi düşürmeli,
`broadcast` bir sporcunun tüm bağlantılarına göndermeli, `send_to` de öyle.
`exclude=child_id` semantiği (insan-insan maçta "rakibe gönder") korunmalı.

### 2. `POST /games/bot/start` maçın parametrelerini HİÇ kaydetmiyor

`apps/api/chess_api/schemas/game.py` → `StartBotGameRequest` yalnızca `skill_level`
alıyor. `apps/api/chess_api/routers/games.py` → maçı her zaman
`white_child_id=child.id, black_bot_level=payload.skill_level` olarak açıyor.

Yani sunucu bugün şunları BİLMİYOR: sporcunun hangi renkle oynadığı (ön yüzde
`studentColor='b'` seçeneği var — bu durumda kayıt gerçeğe aykırı oluyor), maçın
başlangıç pozisyonu (`start_fen` — açılış pratiği), ve saat/tempo bilgisi. Bunların
hepsi bugün yalnızca tarayıcıda yaşıyor. Sunucu hamleyi kendisi üretecekse "sıra
kimde ve bot hangi renk" sorusunu doğru yanıtlayabilmek için bu üç bilginin de
başlangıçta kaydedilmesi ZORUNLU. Yani `/games/bot/start` genişletilmeli
(renk, `start_fen`, tempo) — eski istemciler bu alanları göndermeyeceği için hepsi
opsiyonel/varsayılanlı olmalı (KURAL #3).

### 3. `games.py::_current_fen` başlangıç pozisyonunu yok sayıyor (gizli hata)

```python
async def _current_fen(db, game_id) -> str:
    last = ...
    return last.fen_after if last else INITIAL_FEN   # game.start_fen HIC bakilmiyor
```

`live_game.py`'deki eşdeğeri (`_current_fen_and_ply`) `game.start_fen`'i doğru şekilde
dikkate alıyor; `games.py`'deki bu sürüm almıyor. Bugün bu göze batmıyor çünkü bot
maçında otorite istemci — sunucuya hamleler yalnızca kayıt amaçlı gönderiliyor ve
reddedilen hamlenin bir sonucu olmuyor. Ancak yeni tasarımda **sunucu otorite**
olacağı için, açılış pozisyonundan başlayan bir bot maçının ilk hamlesi standart
başlangıç konumuna göre doğrulanır ve geçerli hamle REDDEDİLİR. Sunucu tarafına
geçmeden önce düzeltilmesi gerekir.

## Mimari Karar

Bot maçını, insan-insan maçıyla **aynı** sunucu-yetkili WebSocket akışına taşımak.
Somut olarak:

0. **Önce `GameRoom` çoklu-cihaz destekler hâle getirilir** (yukarıdaki engel 1).
   Bu, geri kalan her şeyin ön koşuludur ve tek başına test edilebilir; ayrıca
   bugünkü insan-insan maçlarındaki aynı kusuru da düzeltir.
1. **Bot maçı artık bir "oda"dır (`GameRoom`)** — `Game.type == 'bot'` olan bir maça da
   `/ws/game/{game_id}` üzerinden bağlanılır. Aynı sporcunun birden fazla cihazı aynı
   `game_id`'ye bağlanır, hepsi aynı `game_info`'yu (mevcut hamle listesi, güncel FEN,
   saat bilgisi) görür. Not: `/ws/game/{game_id}`'nin mevcut katılımcı kontrolü
   (`child_id not in (game.white_child_id, game.black_child_id)`) bot maçlarında da
   çalışır — bot maçında `black_child_id` NULL, `white_child_id` sporcudur; ancak
   sporcu siyah oynadığında bu alanların doğru doldurulması engel 2'ye bağlıdır.
2. **Sporcu hamle yapar** → mevcut `_handle_move` akışıyla AYNI şekilde doğrulanır,
   kaydedilir, odaya `move_made` yayınlanır (tüm cihazlar anında görür).
3. **Sıra bota geldiyse**, sunucu — istemciden hiçbir mesaj beklemeden — motoru
   çağırır (bugünkü istemci tarafı zorluk/derinlik ayarlarıyla aynı seviyede), hamleyi
   aynı doğrulama+kayıt+yayın adımlarından geçirir (`by_child_id=None`, "bot" olarak
   işaretli). Sonuç yine `move_made` olarak TÜM cihazlara yayınlanır. Bu adım, iki
   cihazın aynı anda bot hamlesi üretmeye çalışmasını yapısal olarak imkânsız kılar —
   çünkü hamleyi hesaplayan tek yer sunucudur.
4. **Beraberlik teklifi, saat, hamle geçmişi** gibi insan-insan maçında zaten var olan
   mekanizmalar (mevcut `Game`/`GameMove` **tabloları**, `_apply_clock_on_move`, teklif
   sayaçları) bot maçlarında da kullanılır — bot maçları için ayrı bir veri modeli
   gerekmez. Ancak bu mekanizmaların ÇALIŞABİLMESİ için maç başlangıcında saat/renk/
   `start_fen` bilgisinin kaydedilmesi şart (engel 2). Beraberlik teklifine botun
   cevabı bugün istemcide `apps/web/lib/play/botDraw.ts` içindeki `botAcceptsDraw` saf
   fonksiyonuyla hesaplanıyor; bu mantık sunucuya taşınır (saf fonksiyon olduğu için
   birebir port edilebilir ve `apps/web/tests/bot-draw.test.ts`'teki senaryolar
   pytest'e aynen taşınabilir). Aksi hâlde yeni akışta beraberlik teklifi bozuk kalırdı.
5. **Ön yüzde `BotGame.tsx`'in yerini**, `LiveGame.tsx`'in kanıtlanmış WebSocket
   istemci mantığını temel alan bir bileşen alır (kod paylaşımı/ortak alt bileşen
   plan aşamasında netleşir). Motor artık tarayıcıda ÇALIŞMAZ; "bot düşünüyor" göstergesi
   sunucudan gelen bir sinyale (ör. bot'un sırası geldiğinde küçük bir "thinking"
   mesajı) bağlanır.

## Veri Modeli

`Game` tablosunda bugün bot her zaman "siyah" kabul ediliyor (`black_bot_level`
alanı) ve `white_child_id` her zaman sporcu — sporcu siyah oynamayı seçtiğinde bile
(engel 2). Yeni sunucu-taraflı mantığın "sıra kimde, bot hangi renk" kararını doğru
verebilmesi için bu netleştirilmeli.

Gerekli alanlar (hepsi **eklenen ve nullable/varsayılanlı** — mevcut satırlar ve eski
istemciler etkilenmez, KURAL #3):

- Botun rengi ve seviyesi: mevcut `black_bot_level`'ı genelleştirmek ya da yanına
  `white_bot_level` eklemek. (Hangisi olacağı plan aşamasında, mevcut kullanımlar
  taranarak seçilir; `black_bot_level` bugün başka yerlerde okunuyorsa kırılmamalı.)
- `engine_mode`: hangi maçların YENİ (sunucu-taraflı) akışla oynandığını işaretler.
  NULL = eski usul (istemci-taraflı), `'server'` = yeni akış. Geçiş planının dayanağı
  budur.
- Saat/tempo ve `start_fen`: `Game` tablosunda bu sütunlar ZATEN var (`base_ms`,
  `increment_ms`, `white_ms`, `black_ms`, `last_clock_at`, `start_fen`) — yeni sütun
  gerekmiyor; yalnızca `/games/bot/start` bunları artık DOLDURMALI (bugün boş bırakıyor).

Yani şema tarafında gereken ekleme küçüktür; asıl iş `/games/bot/start`'ın bu
bilgileri istemciden alıp kaydetmesidir.

## Geçiş / Yayın Planı

- Yeni sütun(lar) `nullable`/varsayılanlı eklenir — mevcut satırlar etkilenmez.
- `POST /games/bot/start` artık maçı `engine_mode='server'` olarak işaretler; ESKİ
  istemci sürümü bu alanı hiç bilmediği için zararsızca yok sayar.
- Yayından ÖNCE açılmış (yani `engine_mode` boş) bot maçları, ön yüzün ESKİ
  (sessionStorage + istemci-taraflı motor) yoluyla bitirilmeye devam eder — bu yüzden
  eski ön yüz kodu bir süre (o maçlar bitene kadar) kaldırılmaz, yalnızca YENİ maç
  başlatma yolu değiştirilir.
- Yeni Nixpacks/Stockfish bağımlılığı önce bir önizleme/staging ortamında denenir,
  yalnızca derleme başarılıysa canlıya alınır.

## Kapsam Dışı (bu iş için YAPILMAYACAK)

- Zaten devam eden eski-usul bot maçlarını yeni sisteme "taşımak" — yayın kararı
  gereği gerekmiyor.
- Bot zorluk/motor davranışını değiştirmek — yalnızca ÇALIŞTIĞI YER değişiyor
  (tarayıcı → sunucu), oynanış aynı kalmalı.
- Bota karşı yeni bir özellik eklemek (ör. yeni zorluk seviyesi, yeni ipucu sistemi).

## Test Yaklaşımı

- **`GameRoom` çoklu-cihaz (engel 1)** — en kritik test, çünkü bu düzelmezse özelliğin
  tamamı çalışmaz. Aynı `child_id` ile İKİ sahte bağlantı odaya katılır; `broadcast`
  sonrası **her ikisinin de** mesajı aldığı doğrulanır (bugünkü kodla bu test KIRMIZI
  olmalı — birinci bağlantı hiç mesaj almaz; testin gerçekten bu sebeple kaldığı
  yazmadan önce çalıştırılıp görülmeli). Ayrıca: bağlantılardan biri `leave` edince
  diğerinin yayın almaya DEVAM ettiği; insan-insan maçtaki `exclude=child_id`
  davranışının korunduğu (rakibe gider, kendi cihazlarına gitmez).
- **`_current_fen` başlangıç pozisyonu (engel 3)** — `start_fen` dolu bir bot maçında
  ilk hamlenin o pozisyona göre doğrulandığı; standart başlangıca göre reddedilmediği.
- **`/games/bot/start` yeni alanları (engel 2)** — renk/`start_fen`/tempo gönderildiğinde
  kaydedildiği; HİÇ gönderilmediğinde (eski istemci) eskisi gibi çalışmaya devam ettiği.
- **Bot hamlesi**: `_handle_move`'a paralel yeni bot-hamlesi mantığı için pytest — insan
  hamlesinden sonra sırada bot varsa otomatik hamle üretildiğini, doğru kaydedildiğini
  (`by_child_id=None`) ve odaya yayınlandığını doğrulayan testler (mevcut
  `test_audit_game_idor.py` ve `live_game` testleriyle aynı desende). Motor testlerde
  gerçek Stockfish yerine sahte/kısıtlı bir motorla değiştirilebilmeli — yoksa CI
  binary'ye bağımlı ve yavaş olur.
- **Beraberlik**: `botAcceptsDraw` sunucuya taşındığında, `apps/web/tests/bot-draw.test.ts`
  içindeki senaryoların pytest karşılıklarının aynı sonucu vermesi.
- Frontend: yeni WS-taban bot bileşeni için `LiveGame.tsx` testlerindeki desenle
  (mock WebSocket) hamle gönderme/alma, bot hamlesinin gelince tahtaya yansıması,
  aynı `game_id`'ye ikinci bir "sahte cihaz" (ikinci mock bağlantı) bağlanınca aynı
  durumu görmesi test edilir.
- Gerçek çoklu-cihaz testi (iki gerçek tarayıcı sekmesi, aynı `game_id`, biri hamle
  yapınca diğerinde anında görünmesi) KURAL #6 gereği gerçek tarayıcı sürüşüyle
  doğrulanır.

## Riskler ve Açık Noktalar

- Eşzamanlı bot maçı sayısı arttıkça sunucu kaynak kullanımı — küçük bir yük testiyle
  doğrulanmalı, bu planın kapsamında değilse ayrıca not edilecek.
- Nixpacks derleme değişikliği canlı API servisinin build sürecini etkiler; staging'de
  doğrulanmadan production'a alınmamalı.
- Sporcunun interneti anlık kesilirse (bugünkü insan-insan maçlarda olduğu gibi)
  yeniden bağlanma davranışı `LiveGame.tsx`'teki mevcut mantıkla aynı olacak — ayrıca
  bir şey icat edilmeyecek.
- **`GameRoom` değişikliği canlı insan-insan maçlarına dokunuyor.** Engel 1'in düzeltmesi
  bugün çalışan bir mekanizmayı değiştirir; yanlış yapılırsa canlı maçları bozar
  (KURAL #3). Bu yüzden ayrı, ilk ve tek başına test edilen bir adım olarak yapılmalı;
  mevcut insan-insan maç testleri bu adımdan sonra da yeşil kalmalı.
- **Bot maçında `game_info`/`player_joined` mesajlarının anlamı.** Bugünkü oda mantığı
  iki AYRI sporcu varsayıyor (`player_joined`, `opponent_disconnected`, `exclude`
  ile "rakibe gönder"). Bot maçında ikinci sporcu yok; aynı sporcunun ikinci CİHAZI
  var. Bu mesajların bot maçında ne anlama geleceği (ör. ikinci cihaz bağlanınca
  "rakip bağlandı" gibi yanlış bir bildirim çıkmaması) plan aşamasında netleştirilmeli.
