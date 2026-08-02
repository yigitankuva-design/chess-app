# Bot Maçı — Başlangıç Bilgisi Kaydı (Tasarım)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this
> design into a step-by-step implementation plan before any code is written.

## Amaç

Bot maçı ana spec'inin ("Bot Maçı — Cihazlar Arası Canlı Senkron") ikinci parçası.
İlk parça (`GameRoom` çoklu cihaz desteği) tamamlandı ve yayında. Bu parça, o
belgenin "Gözden geçirmede bulunan engeller — madde 2 ve 3" bölümünde kod okunarak
tespit edilen iki eksiği kapatır:

1. `POST /games/bot/start` bugün yalnızca `skill_level` alıyor — sporcunun hangi
   renkle oynadığını, hangi pozisyondan başladığını (açılış pratiği) ve maç
   süresini HİÇ kaydetmiyor.
2. `games.py::_current_fen`, `game.start_fen`'i yok sayıyor — bugün göze
   batmıyor çünkü bot maçında istemci otorite (sunucuya yalnızca kayıt amaçlı
   hamle gönderiliyor); ama sunucu ileride kendi hamlesini üretmeye başladığında
   bu, açılış pratiğinden başlayan bot maçlarının İLK hamlesinin YANLIŞ
   pozisyona göre değerlendirilmesine yol açardı.

**Bu parça botun hamlesini SUNUCUDA hesaplamaz** (bir sonraki, ayrı parça) —
yalnızca gerekli bilgiyi doğru kaydeder ve mevcut bir hesaplama hatasını düzeltir.
Kullanıcı onayıyla netleşti: bu parça bitince cihazlar arası senkron GÖRÜNÜR
olarak henüz çalışmayacak.

## Kod okunarak bulunan ek bir kısıt (rozet sistemi)

`apps/api/chess_api/services/badge_engine.py`'deki `bot_wins` rozet kriteri şunu
varsayıyor:

```python
Game.white_child_id == child_id,
Game.result == GameResult.white_wins,
Game.black_bot_level <= max_level,
```

Yani bot maçı kazanma rozetleri, sporcunun HER ZAMAN "beyaz" olduğu ve botun HER
ZAMAN "siyah" (`black_bot_level`) olduğu varsayımıyla çalışıyor. Bugün bu doğru
görünüyor çünkü `/games/bot/start` sporcu hangi rengi seçerse seçsin
`white_child_id=child.id` yazıyor (renk seçimi yalnızca ekranda görsel olarak
uygulanıyor, sunucu kaydına hiç yansımıyor — bu da zaten madde 2'nin parçası).

**Karar:** Bu tutarsızlığı DÜZELTMEK (yani sporcu siyah seçtiğinde
`black_child_id=child.id, white_child_id=None` yazmak) bu parçanın kapsamı
DIŞINDA bırakılıyor — çünkü bu, `badge_engine.py`'yi de aynı anda değiştirmeyi
gerektirir ve kapsamı büyütür. Bunun yerine: `white_child_id`/`black_child_id`
mevcut semantiği (sporcu = beyaz) AYNEN KORUNUR; hangi rengi sporcunun EKRANDA
gördüğü ayrı, yeni bir bilgi olarak (`student_color`) eklenir. Böylece:

- Rozet sistemi (`badge_engine.py`) HİÇ değişmez, bugünkü gibi çalışmaya devam eder.
- Gelecekteki motor-entegrasyonu parçası "sırada kim var" sorusunu FEN'in kendi
  sıra bilgisinden (`fen.split()[1]`) ve yeni `student_color` alanından çözer —
  `white_child_id`/`black_child_id`'nin "gerçek" satranç rengini doğru
  yansıtmasına hiç ihtiyaç duymaz.

## Veri Modeli Değişiklikleri

`apps/api/chess_api/models/game.py` → `Game` tablosuna **eklenen, nullable**
sütunlar (KURAL #3 — mevcut satırlar etkilenmez):

- `student_color: str | None` — `'w'` veya `'b'`. `NULL` = eski kayıt, `'w'`
  varsayılır (bugünkü davranışla aynı).

Diğer gereken bilgiler (`start_fen`, `base_ms`, `increment_ms`, `white_ms`,
`black_ms`, `last_clock_at`) `Game` tablosunda **ZATEN VAR** (insan-insan maç
saati için önceki bir parçada eklenmişti) — yeni sütun gerekmiyor, yalnızca
`/games/bot/start`'ın bunları DOLDURMASI gerekiyor.

## API Değişikliği

`StartBotGameRequest`'e üç YENİ, opsiyonel alan eklenir (eski istemciler
göndermezse hiçbiri zorunlu değil, varsayılanlarla eski davranış korunur):

- `student_color: Literal['w', 'b'] = 'w'`
- `start_fen: str | None = None`
- `tc_base_seconds: int | None = None` (saniye — istemcideki `TimeControl.base`
  ile aynı birim; `Game.base_ms`'e çevrilirken `*1000` yapılır, insan-insan maç
  akışındaki `_handle_challenge_accept`'teki dönüşümle AYNI desen)
- `tc_increment_seconds: int = 0`

`start_bot_game` bu bilgileri `Game` satırına yazar; `white_child_id=child.id` ve
`black_bot_level=payload.skill_level` DEĞİŞMEDEN kalır (rozet uyumluluğu).

`StartBotGameResponse.your_color`, sabit `"white"` yerine `payload.student_color`
karşılığını döner (bugün istemci bu alanı hiç okumuyor — zararsız düzeltme, ileride
kullanılabilir).

## `_current_fen` Düzeltmesi

`apps/api/chess_api/routers/games.py::_current_fen`, hamle yoksa
`game.start_fen` doluysa onu, boşsa standart başlangıcı döndürecek şekilde
düzeltilir — `live_game.py::_current_fen_and_ply`'deki AYNI mantık.

## Kapsam Dışı

- Botun hamlesini sunucuda hesaplamak (motor entegrasyonu — ayrı, sonraki parça).
- `white_child_id`/`black_child_id` semantiğini "gerçek" satranç rengine göre
  düzeltmek ve `badge_engine.py`'yi buna göre güncellemek (yukarıda gerekçesiyle
  bilerek ertelendi).
- Ön yüzde (`BotGame.tsx`) bu yeni alanları GÖNDERMEK — bu ayrı bir küçük görev
  olarak uygulama planında yer alacak (istemci zaten `studentColor`/`startFen`/
  `timeControl` prop'larına sahip, yalnızca `/games/bot/start` çağrısına
  eklenmesi gerekiyor) ama davranış olarak GÖZLE GÖRÜLÜR bir fark yaratmaz —
  sunucu bu bilgileri henüz kullanmıyor (bir sonraki parçaya kadar).

## Test Yaklaşımı

- Backend: `student_color`/`start_fen`/tempo gönderildiğinde `Game` satırına
  doğru yazıldığını doğrulayan pytest; HİÇ gönderilmediğinde (eski istemci)
  eski davranışın (varsayılanlar) korunduğunu doğrulayan test.
- `_current_fen`: `start_fen` dolu bir bot maçında ilk hamlenin doğru pozisyona
  göre değerlendirildiğini doğrulayan test (bugünkü hatalı davranışı önce
  KIRMIZI olarak gösterip sonra düzeltme ile YEŞİL yapan TDD akışı).
- `badge_engine.py`'ye dokunulmadığı için mevcut rozet testleri (varsa) hiç
  değişmeden PASS etmeli — bu regresyon olarak doğrulanır.
