# Maç Yap Bölümü Genişletme (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Hızlı Erişim → Maç Yap bölümünü 2 sekmeden 4 sekmeye çıkarma,
gerçek arkadaş davet sistemi, terk etme/beraberlik teklifi cilası, zorluk/renk/tempo
ayarları, açılış pratiği, turnuva placeholder'ı. Kullanıcı tercihiyle **tek bir
plan** olarak uygulanacak (normalde ayrı alt projelere bölünürdü — bkz. "Kapsam
riski" bölümü).

---

## Doğrulanmış mevcut durum (KURAL #1)

Bu bölümdeki her iddia kod okunarak doğrulandı.

- **`/play` sayfası** (`apps/web/app/(child)/play/page.tsx`): Şu an tek
  bileşen, 3 adımlı state makinesi (Düzey seçimi → Tempo seçimi → oyun).
  "Arkadaşla Oyna" ayrı bir link (`/play/online`, satır 78-85), rastgele
  eşleştirmeye götürüyor.
- **Zorluk düzeyi**: 5 seviye (satır 9-15), `skill`/`depth` çiftleri Stockfish'e
  istemci tarafında (`BotGame.tsx`) uygulanıyor, backend'e sadece kayıt için
  gönderiliyor (`skill_level` alanı, 0-20 aralığı doğrulanıyor).
- **Tempo**: Yıldırım/Hızlı/Klasik grupları + "Süresiz" (satır 148-159, `tc===null`).
- **Renk**: `BotGame.tsx:185` — sporcu **her zaman beyaz** (`chess.turn()==='w'`
  sabit varsayım). Renk seçimi gerçek bir mantık değişikliği gerektiriyor.
- **Terk Et / Beraberlik Teklif Et — BÜYÜK ÖLÇÜDE ZATEN VAR:**
  `apps/api/chess_api/routers/live_game.py` içinde `resign`, `offer_draw`,
  `accept_draw` mesaj tipleri tam çalışır durumda (satır 116-121, 187-206).
  `LiveGame.tsx` içinde "Teslim ol" ve "Beraberlik teklif et" butonları,
  "Kabul et" bildirimi **zaten render ediliyor**. **Eksik olanlar:** "Kabul
  Etme" (red) butonu ve rakibe bildirimi, 3-teklif sınırı (şu an sınırsız),
  sonuç metninin kullanıcının istediği "1 – 0 (Beyaz Kazandı)" formatına
  uymaması (şu an "Kazandın! 🎉" gibi serbest metin).
- **Rastgele eşleştirme altyapısı**: `services/matchmaking.py` (in-memory
  kuyruk, reyting toleransı) + `services/game_room.py` (in-memory oda,
  child_id→WebSocket eşlemesi, broadcast/send_to). **Belirli bir arkadaşı
  davet etme yok** — sadece rastgele kuyruk var.
- **Online/aktif durumu**: Sistemde hiçbir yerde yok (araştırıldı, bulunamadı).
- **`GameResult` enum**: sadece 3 değer (`1-0`, `0-1`, `1/2-1/2`) — resign de
  draw da bu 3 değere eşleniyor, yeni enum değeri gerekmiyor.
- **`expire_on_commit=False`** (`database.py:42`) — commit sonrası ORM
  nesnesi özelliklerine erişim güvenli, `live_game.py`'deki `game.result.value`
  kullanımı bug değil.

---

## Kapsam riski (kullanıcıya açıkça belirtildi, onaylandı)

Bu, normalde 5 ayrı alt projeye bölünürdü (arayüz/ayarlar, terk-beraberlik
cilası, arkadaş davet sistemi, açılış pratiği, turnuva placeholder). Kullanıcı
tek plan istedi; bunu saygıyla uyguluyoruz ama büyüklüğü açıkça not ediyoruz:
**yeni bir WebSocket kanalı (lobi/davet), yeni bir veri modeli (Opening), yeni
bir migration, admin CRUD ekranı ve `/play` sayfasının baştan yapılandırılması**
tek planda yer alacak. Görev sayısı fazla olacak; her görev yine TDD ve küçük
adımlarla ilerleyecek.

---

## Blok 1 — Arayüz + basit ayarlar (madde a, e, f, g)

### a) 4 sekme
`/play/page.tsx` yeniden yapılandırılır: giriş ekranı artık 4 kart gösterir
(Arkadaşla Oyna, Bota Karşı Oyna, Açılışı Pratiği Yap, Turnuvaya Katıl).
Her kart kendi alt akışına girer. Açılışı Pratiği Yap → Blok 3. Turnuvaya
Katıl → sadece "Yakında" placeholder'ı (`ComingSoon` bileşeni zaten var,
P4'te kullanıldığı görüldü).

### e) Zorluk 1-8
`LEVELS` sabiti 8 elemana çıkar:

| Düzey | skill_level | depth |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 3 | 3 |
| 3 | 6 | 5 |
| 4 | 9 | 7 |
| 5 | 12 | 8 |
| 6 | 15 | 9 |
| 7 | 18 | 11 |
| 8 | 20 | 12 |

Backend `skill_level` doğrulaması zaten 0-20 aralığını kabul ediyor, değişiklik
gerekmiyor.

### f) Renk seçimi
Düzey→Tempo→Süre→**Renk** sırasıyla yeni bir adım. Seçenekler: Beyaz, Rastgele,
Siyah. `BotGame` bileşenine `studentColor: 'w' | 'b'` prop'u eklenir:
- Tahta yönü (`boardOrientation`) sporcunun rengine göre ayarlanır.
- `childTurn` hesaplaması `chess.turn() === studentColor` olur (şu an sabit `'w'`).
- Sporcu siyahsa, motor oyunun başında **otomatik ilk hamleyi oynar** (mevcut
  "motor hamlesi" tetikleme mantığı, sadece başlangıçta da çağrılır).
- "Rastgele" seçilirse maç başlamadan `Math.random() < 0.5 ? 'w' : 'b'` ile
  atanır (yalnızca frontend'de, backend'e etkisi yok — bot rengi zaten hep
  `black_bot_level` alanıyla temsil ediliyor, bu değişmiyor; sadece kimin
  hangi taşları sürdüğü değişiyor).

### g) Süresiz kaldırma
`page.tsx` satır 148-159'daki "Süresiz" butonu ve `tc===null` dalı silinir.
Varsayılan tempo seçimi zorunlu hale gelir (bir tempo seçilene kadar "Oyuna
Başla" aktif olmaz).

---

## Blok 2a — Terk Et / Beraberlik Teklif Et cilası (madde c, d — mevcut altyapı üzerine)

**Not:** Bu blok "sıfırdan yazma" değil, var olan çalışan sistemi kullanıcının
istediği tam davranışa **cilalama**.

### Etiket ve format değişiklikleri
- "Teslim ol" → **"Terk Et"** (kullanıcının kelimesi).
- Sonuç metni formatı değişir. `LiveGame.tsx`'teki `info` state'i artık şu
  üç sabit metinden birini üretir:
  - `1 – 0 (Beyaz Kazandı)`
  - `0 – 1 (Siyah Kazandı)`
  - `1/2 – 1/2 (Beraberlik)`
  Hangi tarafın kazandığı `game.result` alanından (`'1-0'`/`'0-1'`/`'1/2-1/2'`)
  doğrudan eşlenir — yeni bir backend alanı gerekmez.

### "Kabul Etme" (red) butonu
Şu an sadece "Kabul et" var; reddetme = sessizce yok saymak. Kullanıcı açık bir
red istiyor. Backend'e yeni mesaj tipi: `decline_draw` → karşı tarafa
`{"type": "draw_declined"}` broadcast edilir (oyun bitmez, devam eder).
`LiveGame.tsx`'e "Kabul Etme" butonu eklenir, tıklanınca `drawOffered` state'i
`false` olur ve `decline_draw` gönderilir.

### 3 teklif hakkı sınırı
Şu an sınırsız. `Game` modeline iki yeni sütun eklenir:
`white_draw_offers: int, default=0` ve `black_draw_offers: int, default=0`
(migration: sadece `ADD COLUMN`, `games` tablosu KURAL #4 kapsamında değil —
müfredat tablosu değil). `offer_draw` mesajı işlenirken sayaç artırılır; 3'e
ulaşmışsa istek reddedilir, teklif eden tarafa
`{"type": "draw_offer_rejected", "reason": "limit"}` gönderilir (UI'da "3
beraberlik hakkın bitti" uyarısı).

---

## Blok 2b — Arkadaşla gerçek davet/teklif sistemi (madde b)

**Bu, planın en büyük parçası.**

### Yeni backend: lobi WebSocket'i
`apps/api/chess_api/services/lobby.py` (YENİ) — `game_room.py` ile aynı
in-memory desen: `child_id → (Sender, display_name)` sözlüğü.

`apps/api/chess_api/routers/live_game.py`'ye yeni uç:
`@router.websocket("/ws/lobby")` — bağlanınca sporcu "aktif" listesine eklenir,
kopunca çıkarılır. Mesaj tipleri:
- `{"type": "challenge", "target_child_id": int, "criteria": {...}}` → hedefe
  `{"type": "challenge_received", "from_child_id", "from_name", "criteria"}`
  iletilir.
- `{"type": "challenge_accept", "from_child_id": int, "criteria": {...}}` →
  `_create_human_game` çağrılır. **Rengi yalnızca teklifi gönderen (challenger)
  belirler** — hedef oyuncu sadece kabul/red eder, kendi renk tercihi sormaz.
  Challenger "Beyaz" seçtiyse kendisi `white_child_id`, hedef `black_child_id`
  olur (ve tam tersi); "Rastgele" seçtiyse `Math.random()` ile atanır. Her iki
  tarafa `{"type":"matched","game_id","color","opponent_id"}` gönderilir
  (`ticket.color` alanıyla aynı format, mevcut `/ws/queue` yanıtıyla tutarlı).
- `{"type": "challenge_decline", "from_child_id": int}` → teklif edene
  `{"type": "challenge_declined"}`.

Yeni HTTP uç: `GET /lobby/online` — o an bağlı sporcuların listesini döner
(id + display_name), teklif ekranında liste göstermek için (WebSocket bağlantısı
kurulmadan önce ilk yüklemede kullanılır; canlı güncelleme WS üzerinden gelir).

### Yeni frontend
- `apps/web/lib/hooks/use-lobby.ts` (YENİ) — `/ws/lobby`'ye bağlanan, aktif
  liste + gelen teklif bildirimlerini yöneten hook (`useWebSocket` üzerine
  kurulu, mevcut deseni takip eder).
- `apps/web/components/ChallengeScreen.tsx` (YENİ) — "Arkadaşınla Oyna" akışı:
  Düzey/Tempo/Süre/Renk seç → aktif sporcu listesi → birine teklif gönder →
  bekleme ekranı → kabul edilirse `LiveGame`'e yönlendirilir (mevcut bileşen,
  değişmiyor).
- Karşı tarafta gelen teklif bildirimi: `/play` açıkken herhangi bir ekranda
  görünen bir toast/banner (basit: sayfanın üstünde sabit bir bildirim kartı,
  "Kabul Et" / "Kabul Etme" butonlarıyla).

### Kapsam dışı (kullanıcı onayladı)
Arkadaşlık/takip sistemi yok — herkes "aktif sporcu" listesinde görünür.

---

## Blok 3 — Açılış Pratiği Yap (madde h.3)

### Yeni veri modeli
`apps/api/chess_api/models/opening.py` (YENİ):
```python
class Opening(Base):
    __tablename__ = "openings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    start_fen: Mapped[str] = mapped_column(String(120))
```
Migration: yalnızca `CREATE TABLE` (KURAL #4 dışı, yeni tablo).

### Admin CRUD
`apps/api/chess_api/routers/admin.py`'ye eklenir: `POST /admin/openings`,
`GET /admin/openings`, `DELETE /admin/openings/{id}` — mevcut modül/ders CRUD
deseniyle birebir aynı (teacher-only, `_ensure_admin`).
Frontend: `apps/web/app/admin/openings/page.tsx` (YENİ) — basit liste + ekleme
formu (isim + FEN girişi; FEN için `BoardEditor` yeniden kullanılabilir ama bu
opsiyonel bir iyileştirme, minimal sürüm düz metin FEN girişi).

### Sporcu akışı
`/play` → "Açılışı Pratiği Yap" kartı → Bota Karşı / Arkadaşına Karşı seçimi
→ "Açılış Konumu Belirle" (liste boşsa "Zafer Hoca henüz açılış eklemedi"
mesajı) → "Maç Kriterlerini Belirle" (Düzey/Tempo/Süre/Renk, Blok 1'deki
bileşenler yeniden kullanılır) → maç başlar. Bot dalı `BotGame`'e, arkadaş
dalı Blok 2b'nin teklif akışına **`startFen` parametresiyle** yönlendirilir
(hem `BotGame` hem `_create_human_game`/`live_game.py` başlangıç FEN'i şu an
sabit `INITIAL_FEN` — bu parametrik hale getirilir, ekstra bir alan `Game`
modeline **eklenmez**, ilk `GameMove` yerine oyunun başlangıç FEN'i `Game`
tablosuna `start_fen: str | None = None` alanıyla eklenir, boşsa standart
başlangıç pozisyonu varsayılır — geriye uyumlu).

---

## Blok 3 devamı — Turnuvaya Katıl (madde h.4)

Sadece `ComingSoon` bileşeniyle "Yakında" kartı. Kullanıcı özelliklerin sonra
belirleneceğini söyledi — başka hiçbir şey yapılmaz (KURAL #2).

---

## Geriye uyumluluk (KURAL #3)

- `Game` modeline eklenen sütunlar (`white_draw_offers`, `black_draw_offers`,
  `start_fen`) hepsi nullable/default'lu — mevcut satırlar etkilenmez.
- Yeni `Opening` tablosu, mevcut hiçbir tabloya dokunmaz.
- `/play` sayfasının yeniden yapılandırılması görsel bir değişiklik ama URL
  yapısı korunur (`/play`, `/play/online/[gameId]`); Hızlı Erişim'den gelen
  `skill`/`tc` query-param akışı (satır 59-71) yeni 4-kart yapısında da
  çalışır durumda tutulur (Bota Karşı Oyna dalına yönlendirilir).
- Rastgele eşleştirme (`/play/online`, mevcut matchmaking) **dokunulmadan**
  kalır — arkadaş davet sistemi ona ek, onun yerine geçmiyor.

---

## Test stratejisi

- **Saf mantık**: zorluk tablosu (skill/depth eşlemesi), renk ataması
  (rastgele→w/b), sonuç metni formatlama (`formatGameResult(result, byResign)`),
  3-teklif sınırı sayaç mantığı — hepsi ayrı `.ts` dosyalarında, vitest.
- **Backend**: `decline_draw` mesajı, 3-teklif sınırı (limit aşılınca reddedilme),
  lobi WS (bağlan→aktif listede görün→teklif gönder→kabul et→oyun oluştu),
  Opening CRUD endpoint'leri, `start_fen` ile oyun başlatma — pytest.
- **Bileşen**: `ChallengeScreen`, `LiveGame`'in yeni "Kabul Etme" butonu,
  yeni 8 seviyeli zorluk seçimi, renk seçim ekranı — vitest + RTL.
- **Canlı doğrulama (KURAL #6)**: iki farklı sporcu hesabıyla (iki sekme/iki
  tarayıcı) gerçek bir arkadaş daveti, kabul, terk etme, beraberlik teklifi/red
  ve açılış pratiği akışı uçtan uca sürülür.

---

## Kapsam dışı

- Gerçek arkadaşlık/takip listesi (kullanıcı onayladı: herkese açık aktif liste yeterli)
- Turnuva özelliklerinin kendisi (kullanıcı: sonra belirlenecek)
- Reyting/Elo sistemi değişiklikleri (mevcut sabit 800 reyting matchmaking'e dokunulmuyor)
- Zaman aşımı (flag) olaylarının backend'de işlenmesi (mevcut sınır, bu istekle ilgisiz)
