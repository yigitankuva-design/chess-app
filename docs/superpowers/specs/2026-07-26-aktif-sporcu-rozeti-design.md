# P10 — Aktif Sporcu Rozeti

**Tarih:** 2026-07-26
**Durum:** Onaylandı (kullanıcı "evet" dedi)

## Amaç

"Arkadaşla Oyna" kartında, o an uygulamada olan **diğer** sporcu sayısını göster:

- Sayı > 0 → ikon **açık yeşil**, kelimenin sonunda **açık yeşil daire içinde sayı**
- Sayı = 0 → ikon **kırmızı**, daire içinde **kırmızı `0`**

Böylece sporcu, "Arkadaşla Oyna"ya girmeden önce oynayacak kimse var mı görebilir.

## Bu iş, 4 parçalık bir serinin 1. parçasıdır

Kullanıcının "Maç Yap düzenlemeleri" isteği 4 bağımsız işe bölündü (kullanıcı onayladı):

| # | İş | Durum |
|---|---|---|
| **1** | **Aktif sporcu rozeti** | **BU SPEC** |
| 2 | Açılış Pratiği açılır kartlar (madde d + e) | Sonra |
| 3 | Lobi teklif panosu (madde c) | Sonra |
| 4 | Arkadaşa karşı pratik + isim arama (madde f) | Sonra |

Madde (a) — "4 bölüm bağımsız olsun" — kod incelendi, **zaten bağımsızlar** (her mod kendi
ekranına gidiyor, biri diğerini etkilemiyor). Kullanıcı da onayladı: yapacak iş yok.

## Kullanıcı kararı: "aktif" kimdir?

Soruldu ve **"uygulamada olan HERKES"** seçildi — ders çalışan, bota karşı oynayan, ana
sayfada duran, hepsi sayılır.

**Bu, mevcut davranıştan farklıdır.** Şu an sistemde "aktif" sayılan tek grup, `/ws/lobby`
bağlantısı açmış olanlar — yani yalnızca "Arkadaşla Oyna" ekranını açanlar. Bu yüzden yeni
bir varlık takibi (presence) kurulması gerekiyor.

**Dürüstlük notu (kullanıcıya söylendi):** Bu sayı "oynamaya hazır" demek değildir. Sayılan
sporcu dersin ortasında olabilir ve gönderilen teklifi görmeyebilir. Kullanıcı bunu bilerek
bu seçeneği seçti.

---

## Mimari: neden kalp atışı (heartbeat), neden WebSocket değil

Üç yaklaşım değerlendirildi:

**A) Kalp atışı (SEÇİLDİ)** — sporcu uygulamadayken 30 sn'de bir `POST /presence/ping`.
Sunucu son 60 sn içinde ping atanları sayar.

**B) Herkes `/ws/lobby`'ye bağlansın** — REDDEDİLDİ. İki sebep:
1. Her sporcu için kalıcı WebSocket bağlantısı (tek instance Railway'de gereksiz yük).
2. **Asıl sebep:** "lobide olmak" ile "uygulamada olmak" aynı şeye dönüşürdü. 3. iş (lobi
   teklif panosu) tam olarak bu ikisini ayrı tutmayı gerektiriyor — B seçilseydi 3. işte
   geri dönüp ayırmak zorunda kalırdık.

**C) Sunucusuz tahmini sayı** — REDDEDİLDİ, uydurma veri gösterilmez (KURAL #1).

### Sadeleştirme: tek uç

`POST /presence/ping` **cevabında sayıyı da döner** (`{"count": N}`). Ayrı bir
`GET /presence/count` ucu YOK — ping zaten sunucuya gidiyor, sayıyı da o taşır. Bir uç, bir
istek, daha az kod.

---

## Backend

### Yeni servis: `apps/api/chess_api/services/presence.py`

`lobby.py` ile aynı desen (in-memory, tek instance varsayımı):

```python
PRESENCE_TTL_SECONDS = 60.0

# child_id -> (display_name, last_seen_epoch)
_seen: dict[int, tuple[str, float]] = {}

def touch(child_id: int, display_name: str, now: float) -> None: ...
def active_count(exclude: int | None, now: float) -> int: ...
def active_players(exclude: int | None, now: float) -> list[dict]: ...
def _reset_for_tests() -> None: ...
```

**`now` parametresi zorunlu ve dışarıdan verilir** — `time.time()` fonksiyonun içinde
çağrılmaz. Sebep: zaman aşımı davranışı ancak böyle gerçekten test edilebilir (sahte saat
enjekte edilir, `sleep(61)` beklemeye gerek kalmaz).

`active_players` bu işte kullanılmıyor ama 4. iş (isim arama) onu kullanacak — şimdiden
yazılır çünkü `active_count` ile aynı filtreleme mantığını paylaşır (DRY), sonradan
eklemek kopyalama olurdu.

**Süresi geçmiş kayıtlar:** `active_count`/`active_players` çağrıldığında filtrelenir,
ayrıca `touch` sırasında sözlükten temizlenir (sözlük sınırsız büyümesin).

### Yeni router: `apps/api/chess_api/routers/presence.py`

```python
@router.post("/presence/ping")
async def presence_ping(child: ChildProfile = Depends(get_current_child)):
    now = time.time()
    touch(child.id, child.display_name, now)
    return {"count": active_count(exclude=child.id, now=now)}
```

- **Sporcu kimliği zorunlu** (`get_current_child`) — tokensiz ping 401 alır
- Sayı **kendisi hariç** döner (kullanıcı isteği: "kendisinden başka aktif sporcu yoksa 0")
- `main.py`'a router kaydı eklenir

**Doğrulandı:** `ChildProfile.display_name` gerçekten var (`models/child.py:13`,
`String(80)`) — varsayım değil.

---

## Frontend

### `apps/web/lib/presence/presenceApi.ts` (yeni)

```ts
export async function pingPresence(): Promise<number | null>
```
`POST /presence/ping` atar, `count` döner. Token yoksa veya hata olursa `null` döner
(ekran çökmez, rozet gizlenir).

### `apps/web/lib/presence/PresenceContext.tsx` (yeni)

- `PresenceProvider` — **tek yerde** (child layout) kurulur, 30 sn'de bir ping atar,
  ilk ping mount'ta hemen atılır (30 sn beklemez)
- `usePresenceCount(): number | null` — kartlar bunu okur

**Neden context:** Ping atma tek yerde olmalı (her kart ayrı ping atarsa gereksiz trafik),
ama sayıyı birden fazla yer okuyacak. Context bu ikisini ayırır.

`null` = henüz bilinmiyor veya hata → **rozet hiç gösterilmez.** Yanlış/uydurma sayı
gösterilmez (KURAL #1).

### `apps/web/app/(child)/layout.tsx` (değişir)

`<AppNav />` ve `{children}` `<PresenceProvider>` ile sarılır. Bu layout tüm sporcu
sayfalarını kapsar (home, play, lesson, pratik, …) — "uygulamada olan herkes" tanımı
tam olarak budur.

### `apps/web/components/play/ActivePlayersBadge.tsx` (yeni)

```tsx
export function ActivePlayersBadge({ count }: { count: number })
```
Daire içinde sayı; `count > 0` ise açık yeşil (`#4ade80`), `0` ise kırmızı (`#f87171`).
Renk sabitleri bu dosyada tek yerde durur, iki kullanım yeri de buradan alır.

Ayrıca aynı dosyadan `activeColor(count): string` dışa verilir — ikon rengi için.

### Kullanım yerleri (ikisi de)

1. **`apps/web/app/(child)/home/page.tsx`** — Maç Yap açılımındaki "Arkadaşla Oyna"
   satırı: `IconFriends`'in rengi `activeColor(count)`, metnin sonuna `ActivePlayersBadge`
2. **`apps/web/app/(child)/play/page.tsx`** — `MODE_CARDS`'taki `friend` kartı: emoji
   yerine renkli ikon değil, **başlığın sonuna** rozet (emoji korunur, dokunulmaz)

Her ikisinde de `count === null` iken rozet ve renk **değişmez** (varsayılan görünüm).

---

## Test stratejisi

**Backend (pytest) — `apps/api/tests/test_presence.py`:**
- `touch` + `active_count` — kendisi hariç sayar
- Zaman aşımı: 61 sn önce ping atmış sporcu sayılmaz (sahte `now` ile, `sleep` YOK)
- Sınır: tam 60 sn hâlâ sayılır, 60.1 sn sayılmaz
- Aynı sporcu iki kez ping atarsa bir kez sayılır
- `POST /presence/ping` tokensiz → 401
- Ping cevabı `count` içerir ve kendini saymaz (tek sporcu → 0)
- İki farklı sporcu ping atarsa her biri diğerini görür (count=1)

**Frontend (vitest):**
- `presenceApi` — doğru URL/method/token, hata→null
- `PresenceProvider` — mount'ta hemen ping atar; 30 sn sonra tekrar atar (sahte zamanlayıcı);
  `usePresenceCount` sayıyı döner
- `ActivePlayersBadge` — 0'da kırmızı, >0'da yeşil, sayıyı gösterir
- Home ve play sayfaları — `count` verilince rozet görünür, `null` iken görünmez (regresyon:
  mevcut kartlar bozulmadı)

**Kapı:**
```
apps/web: npx tsc --noEmit && npx next lint && npx vitest run && npm run build
apps/api: python -m pytest -q
```

**Canlı doğrulama (KURAL #6):** Prod backend'e bağlı dev sunucuda tek sporcu oturumuyla
rozetin **kırmızı 0** gösterdiğini doğrula (tek oturum olduğu için doğru sonuç budur).
İki oturumla yeşil sayıyı görmek ikinci bir gerçek sporcu hesabı gerektirir; bu ortamda
tarayıcı profili tek olduğu için **yapılamayabilir** — yapılamazsa raporda açıkça
"yeşil durum canlıda görülemedi, yalnızca otomatik testle doğrulandı" yazılır (KURAL #1).

## Kapsam dışı (bilinçli)

- **Sporcu isimlerinin listelenmesi** — yalnızca sayı. İsim listesi 4. işin konusu.
- **Anlık (gerçek zamanlı) güncelleme** — 30 sn'lik gecikme kabul edildi.
- **Diğer üç kart** (Bota Karşı, Açılış Pratiği, Turnuva) — rozet almaz.
- **`lobby.py`'ye dokunulmaz** — 3. iş onu kullanacak, presence ondan ayrı yaşar.

## Riskler

| Risk | Önlem |
|---|---|
| Her sporcu 30 sn'de bir istek → sunucu yükü | 12 testçilik ölçekte önemsiz; TTL/aralık tek sabitte, gerekirse artırılır |
| Sekme kapanınca sporcu listede kalır | TTL (60 sn) kendiliğinden düşürür — çıkış sinyali gerekmez |
| Tek instance varsayımı | `lobby.py` ile aynı bilinen sınır; çok instance'a geçilirse ikisi birlikte Redis'e taşınır |
| Sunucu yeniden başlarsa sayı sıfırlanır | Kabul edildi: in-memory yapının doğal sonucu, TTL zaten 60 sn — sporcular bir sonraki ping'de geri sayılır |
