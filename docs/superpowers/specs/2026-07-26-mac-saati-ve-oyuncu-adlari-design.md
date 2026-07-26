# Maç Saati ve Oyuncu Adları (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** İnsan-insan (online) maçlarda çalışan satranç saati + maç ekranında iki oyuncunun adı.

---

## 1. Problem

Sporcu "Arkadaşla Oyna"da tempo seçiyor (örn. 5+0) ama:

- **Saat yok.** Seçilen tempo sunucuya gidiyor, maç o bilgiyle açılıyor — sonra hiçbir yerde kullanılmıyor. Geri sayan bir sayaç, süre bitince maçı bitiren bir kural, hamlede saati durduran bir mantık: hiçbiri yazılmamış.
- **Tempo saklanmıyor.** `games` tablosunda tempo alanı **yok**; `_create_human_game(white_id, black_id)` yalnızca iki oyuncu alıyor. Yani seçilen 5+0 maç açılırken **kayboluyor**.
- **İsim yok.** Maç ekranı karşı tarafa yalnızca "Rakip" diyor; adı ne istiyor ne gösteriyor.

Ayrıca `game_moves.time_left_seconds` sütunu var ama insan maçlarında hiç doldurulmuyor — ölü alan.

## 2. Onaylanan kararlar

| Konu | Karar |
|---|---|
| Süreyi kim tutar | **Sunucu.** Ekrandaki sayı onun yansıması. |
| Süresi biten | **Maçı kaybeder.** (Yetersiz materyal istisnası **yapılmaz** — sade kural.) |
| Kapsam | **Saat + iki oyuncunun adı** birlikte. |
| Bot maçları | **Kapsam dışı** — ayrı düzen (tarayıcıda çalışıyor, sunucuda oyun kaydı yok). |

## 3. Mimari

### 3.1 Veritabanı — `games` tablosuna 5 sütun (migration)

```
base_ms         INTEGER  NULL   -- temel sure (ms), orn. 300000 = 5 dk
increment_ms    INTEGER  NULL   -- hamle basi eklenen (ms), orn. 0
white_ms        INTEGER  NULL   -- beyazin kalan suresi (ms)
black_ms        INTEGER  NULL   -- siyahin kalan suresi (ms)
last_clock_at   DATETIME NULL   -- saatin en son islendigi an (UTC)
```

**Hepsi `NULL` olabilir.** Bu, geriye dönük uyumun tek anahtarıdır: şu an devam eden
maçlarda bu alanlar boş kalır, `base_ms is None` görüldüğünde saat mantığı **hiç
çalışmaz** ve maç bugünkü gibi süresiz sürer (KURAL #3). Yeni maçlar dolu gelir.

Milisaniye kullanılır çünkü artırım ve geçen süre saniyenin altında birikir; saniyeyle
tutulursa her hamlede yuvarlama kaybı olur.

`game_moves.time_left_seconds` alanına **dokunulmaz** (silinmez, doldurulmaz) — kapsam dışı.

### 3.2 `apps/api/chess_api/services/clock.py` — saf mantık (yeni)

Zaman **parametre** olarak gelir (`presence.py`, `offer_sides.py` ile aynı desen):
testte `sleep` yok.

```python
@dataclass(frozen=True)
class ClockState:
    white_ms: int
    black_ms: int
    last_at: float          # epoch saniye
    increment_ms: int

def elapsed_ms(last_at: float, now: float) -> int
    """Gecen sure (ms), asla negatif degil."""

def apply_move(state: ClockState, white_to_move: bool, now: float) -> ClockState
    """Hamleyi yapanin saatinden gecen sureyi duser, artirimi ekler,
    last_at'i now yapar. Saat 0'in ALTINA DUSMEZ (0'da durur)."""

def is_flagged(state: ClockState, white_to_move: bool, now: float) -> bool
    """Sirasi gelen oyuncunun suresi bitti mi? (hamle beklerken de gecerli)"""
```

Kurallar:
- `apply_move` yalnızca **hamleyi yapanın** saatini işler; rakibin saati değişmez.
- Artırım hamleden **sonra** eklenir (Fischer usulü) — `5+3`'te 5 dakika ile başlanır,
  her hamleden sonra 3 saniye eklenir.
- Süre 0'a düşerse orada kalır; negatif saat gösterilmez.
- `is_flagged` **hamle beklerken** de doğru cevap verir: son hamleden bu yana geçen süre
  sıradaki oyuncunun kalanını aştıysa `True`.

### 3.3 Maç açılışı — tempo artık kaydedilir

`_create_human_game` imzası genişler:

```python
async def _create_human_game(white_child_id, black_child_id,
                             base_ms: int | None = None,
                             increment_ms: int | None = None) -> int
```

- Varsayılanlar `None` → **mevcut çağıranlar bozulmaz** (matchmaking/queue akışı).
- Teklif panosu (`offer_take`) ve doğrudan davet (`challenge_accept`) tempoyu buraya geçirir.
  İkisinde de bilgi zaten elde: teklifte `tc_base`/`tc_increment`, davette
  `criteria.tc_base`/`criteria.tc_increment` (saniye cinsinden → ms'e çevrilir).
- Saat, maç kaydı oluşurken başlar: `white_ms = black_ms = base_ms`,
  `last_clock_at = şimdi`.

### 3.4 `/ws/game/{game_id}` protokol eklemeleri

**Sunucu → İstemci**

| Mesaj | Ne zaman | Alanlar |
|---|---|---|
| `game_info` | Sporcu maça katılınca (mevcut `player_joined`'a ek, ayrı mesaj) | `white_name`, `black_name`, `white_ms`, `black_ms`, `increment_ms`, `white_to_move` |
| `clock` | Her geçerli hamleden sonra (mevcut `move_made` ile birlikte) | `white_ms`, `black_ms`, `white_to_move` |
| `game_over` | Süre bitince (mevcut mesaj) | `result`, `by_flag: true` |

**İstemci → Sunucu**

| Mesaj | Anlamı |
|---|---|
| `flag` | "Rakibimin süresi bitti." Sunucu **kendi hesabıyla doğrular**; doğruysa maçı kapatır, yanlışsa **hiçbir şey yapmaz** (sessiz). |

`flag` iddiasına asla güvenilmez — bu, istemcinin sunucuyu kandırmasını engelleyen tek
noktadır. Doğrulama `is_flagged` ile yapılır.

Süre bitişi ayrıca **her hamlede** kontrol edilir: hamle geldiğinde sırası gelen oyuncunun
süresi çoktan bitmişse hamle işlenmez, maç süre aşımıyla kapanır.

### 3.5 Frontend

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/play/clockFormat.ts` **(yeni)** | Saf: ms → `MM:SS` (son 10 sn'de `SS.d`). |
| `apps/web/components/play/PlayerClock.tsx` **(yeni)** | Bir oyuncunun satırı: ad + saat. Sırası gelense vurgulu. |
| `apps/web/components/LiveGame.tsx` **(değişir)** | İki `PlayerClock`, yerel geri sayım, `flag` gönderimi. |

**Yerel geri sayım sadece görseldir.** İstemci her saniye kendi kopyasından düşer; sunucudan
`clock` geldiğinde değer **üzerine yazılır**. Sayfa yenilenirse `game_info` doğru değeri
getirir. İstemcinin saatiyle oynanması bir işe yaramaz: sonucu sunucu belirler.

**`flag` ne zaman gönderilir:** yalnızca **sırası rakipteyken** ve rakibin saati ekranda
0'a indiğinde. Sporcu kendi süresi için `flag` göndermez — kimse kendi yenilgisini
bildirmek zorunda değil. Tekrarlı gönderim yapılmaz: bir kez gönderilir, sunucudan
`game_over` beklenir.

## 4. Ekran

```
┌────────────────────────────────┐
│ ⚫ Ayşe                  05:00 │  ← rakip
├────────────────────────────────┤
│           [ TAHTA ]            │
├────────────────────────────────┤
│ ⚪ Mehmet                04:37 │  ← sen (sıra sende: vurgulu)
└────────────────────────────────┘
```

- Üstte rakip, altta sporcunun kendisi (tahtanın yönüyle tutarlı).
- Sırası gelenin kutusu vurgulanır.
- Son 10 saniyede saat kırmızıya döner ve ondalık gösterir (`09.4`).
- Tempo bilgisi olmayan (eski) maçlarda saat kutuları **hiç çizilmez**, yalnızca isimler
  görünür — eski maçlar bozulmaz.

## 5. Hata durumları

| Durum | Davranış |
|---|---|
| Eski maç (tempo alanları boş) | Saat mantığı hiç çalışmaz; ekranda saat yok, isimler var. |
| İstemci sahte `flag` gönderir | Sunucu doğrular, tutmazsa **hiçbir şey yapmaz**. |
| İki istemci aynı anda `flag` gönderir | Maç zaten `finished` ise ikinci istek yok sayılır (mevcut `status != active` koruması). |
| Bağlantı kopar, sonra döner | `game_info` güncel saati getirir; geçen süre sunucuda işlenmiş olur. |
| Sunucu yeniden başlar | Saat veritabanında olduğu için kaybolmaz — `last_clock_at` üzerinden hesap devam eder. |
| Sporcu maçı terk eder | Mevcut `resign` akışı; saat işlenmez, sonuç terk kaydedilir. |
| **Süresi biten taraf yalnız kalır** | Süre bitişini yalnızca **rakip** bildirir. Rakip de bağlantıdan düşmüşse kimse `flag` göndermez ve maç açık kalır. Rakip geri döndüğünde `game_info` süreyi 0 gösterir ve `flag` gönderilir — maç o an kapanır. Kabul edilen sınır: arka planda tarayan bir görev **yoktur** (yaklaşım B reddedildi). |

## 6. Test planı

**Backend (pytest)** — `apps/api/tests/test_clock.py` (saf)
- `elapsed_ms` negatif dönmez (saat geri giderse 0).
- `apply_move` hamle yapanın saatinden düşer, rakibinkine dokunmaz.
- Artırım hamleden sonra eklenir (`5+3`: 300000 → hamle 2 sn sürdü → 301000).
- Saat 0'ın altına düşmez.
- `is_flagged` hamle beklerken de doğru: son hamleden çok zaman geçtiyse `True`.

`apps/api/tests/test_game_clock_ws.py`
- Tempolu maç açılınca `games` satırında `base_ms` dolu.
- Hamle sonrası `clock` mesajı gelir ve süre azalmıştır.
- Sahte `flag` (süre dolmamışken) maçı **bitirmez**.
- Gerçekten süresi dolmuşken `flag` maçı bitirir, sonuç doğru taraftadır.
- **REGRESYON:** tempo alanları boş olan maçta hamle akışı bugünkü gibi çalışır.

**Frontend (vitest)** — `apps/web/tests/clock-format.test.ts`
- `0 → '00:00'`, `300000 → '05:00'`, `59000 → '00:59'`.
- Son 10 sn: `9400 → '09.4'`.
- Negatif giriş `'00:00'` verir (asla eksi gösterilmez).

`apps/web/tests/player-clock.test.tsx`
- Ad ve saat görünür.
- Sırası gelen vurgulu (`data-active="true"`).
- Saat `null` ise (tempsuz maç) yalnızca ad çizilir.

**Test kapısı:**
```
apps/api:  python -m pytest -q  &&  python -m alembic heads
apps/web:  npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```

**Canlı doğrulama (KURAL #6):** Gerçek saat akışı **iki sporcu oturumu** ister; tek
oturumla doğrulanamaz. Bu sınır rapora açıkça yazılır.

## 7. Riskler

- **Migration.** `games` tablosuna sütun eklenir. Müfredat tablolarına dokunulmaz (KURAL #4).
  Tüm sütunlar `NULL` kabul ettiği için mevcut satırlar olduğu gibi kalır ve devam eden
  maçlar bozulmaz (KURAL #3). Geri alma (downgrade) sütunları düşürür.
- **Saat kayması.** Sunucu ile istemcinin saati farklı olabilir; bu yüzden istemci
  **hiçbir zaman** sonucu belirlemez, yalnızca gösterir.
- **Tek instance sınırı yok.** Saat veritabanında tutulduğu için lobi/pano gibi bellek
  bağımlılığı taşımaz — bu özellik çok kopyalı dağıtımda da doğru çalışır.
