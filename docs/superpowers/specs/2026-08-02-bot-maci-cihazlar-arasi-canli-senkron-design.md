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
  **doğrudan yeniden kullanılabilir**: bir oyun odası birden fazla bağlantıyı (=cihazı)
  zaten destekliyor, her hamleden sonra odaya bağlı HERKESE (yani aynı sporcunun açık
  tüm cihazlarına) `move_made` yayını yapıyor. Yeni bir WebSocket altyapısı kurmaya
  gerek yok.
- Somut riskler: (1) Nixpacks derleme değişikliği önce test/staging'de denenmeli, canlı
  Railway servisine doğrudan uygulanmamalı; (2) yayın anında açık olan eski-usul bot
  maçları için net bir geçiş kuralı gerekiyor (yukarıda karara bağlandı); (3) eşzamanlı
  çok sayıda bot maçında sunucu kaynak kullanımı test edilmeden varsayılmamalı — küçük
  bir yük testiyle doğrulanmalı.

## Mimari Karar

Bot maçını, insan-insan maçıyla **aynı** sunucu-yetkili WebSocket akışına taşımak.
Somut olarak:

1. **Bot maçı artık bir "oda"dır (`GameRoom`)** — `Game.type == 'bot'` olan bir maça da
   `/ws/game/{game_id}` üzerinden bağlanılır. Aynı sporcunun birden fazla cihazı aynı
   `game_id`'ye bağlanır, hepsi aynı `game_info`'yu (mevcut hamle listesi, güncel FEN,
   saat bilgisi) görür.
2. **Sporcu hamle yapar** → mevcut `_handle_move` akışıyla AYNI şekilde doğrulanır,
   kaydedilir, odaya `move_made` yayınlanır (tüm cihazlar anında görür).
3. **Sıra bota geldiyse**, sunucu — istemciden hiçbir mesaj beklemeden — motoru
   çağırır (bugünkü istemci tarafı zorluk/derinlik ayarlarıyla aynı seviyede), hamleyi
   aynı doğrulama+kayıt+yayın adımlarından geçirir (`by_child_id=None`, "bot" olarak
   işaretli). Sonuç yine `move_made` olarak TÜM cihazlara yayınlanır. Bu adım, iki
   cihazın aynı anda bot hamlesi üretmeye çalışmasını yapısal olarak imkânsız kılar —
   çünkü hamleyi hesaplayan tek yer sunucudur.
4. **Beraberlik teklifi, saat, hamle geçmişi** gibi insan-insan maçında zaten var olan
   mekanizmalar (mevcut `Game`/`GameMove` modeli, `_apply_clock_on_move`, teklif
   sayaçları) bot maçlarında da AYNEN kullanılır — bot maçları için ayrı bir veri
   modeli gerekmez. Beraberlik teklifine botun cevabı (bugün istemcide
   `botAcceptsDraw` ile hesaplanıyor) sunucuya taşınır; aksi halde yeni akışta bozuk
   kalırdı.
5. **Ön yüzde `BotGame.tsx`'in yerini**, `LiveGame.tsx`'in kanıtlanmış WebSocket
   istemci mantığını temel alan bir bileşen alır (kod paylaşımı/ortak alt bileşen
   plan aşamasında netleşir). Motor artık tarayıcıda ÇALIŞMAZ; "bot düşünüyor" göstergesi
   sunucudan gelen bir sinyale (ör. bot'un sırası geldiğinde küçük bir "thinking"
   mesajı) bağlanır.

## Veri Modeli

`Game` tablosunda bugün bot her zaman "siyah" kabul ediliyor (`black_bot_level`
alanı) ve `white_child_id` her zaman sporcu — sporcu siyah oynamayı seçtiğinde bile
(ön yüzde `studentColor='b'` seçeneği var). Bu, yeni sunucu-taraflı mantığın "sıra
kimde" kararını doğru verebilmesi için netleştirilmesi gereken mevcut bir tutarsızlık.
Plan aşamasında şu şekilde çözülecek: hangi rengin bot olduğunu ve zorluk seviyesini
açıkça tutan bir alan (mevcut `black_bot_level`'ı genelleştirmek ya da yanına
`white_bot_level` eklemek) + hangi maçların YENİ (sunucu-taraflı) akışla oynandığını
işaretleyen bir alan (ör. `engine_mode` sütunu, `nullable`, varsayılan NULL = eski
usul). Bu, eklenen (additive) ve nullable sütunlarla yapılacağı için mevcut kayıtları
bozmaz (KURAL #3).

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

- Backend: `_handle_move`'a paralel yeni bot-hamlesi mantığı için pytest — insan
  hamlesinden sonra sırada bot varsa otomatik hamle üretildiğini, doğru kaydedildiğini
  ve odaya yayınlandığını doğrulayan testler (mevcut `test_audit_game_idor.py` ve
  `live_game` testleriyle aynı desende).
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
