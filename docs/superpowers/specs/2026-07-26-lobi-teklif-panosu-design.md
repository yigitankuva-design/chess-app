# Lobi Teklif Panosu (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Kullanıcının çok parçalı "Maç Yap" isteğindeki **(c)** maddesi.
**Alt proje sırası:** 3/4 (1: aktif sporcu rozeti ✓, 2: açılış pratiği akordiyon ✓, 4: arkadaşa karşı pratik + isim arama)

---

## 1. Problem

Kullanıcının isteği (birebir):

> "Arkadaşınla Oyna bir lobi olsun, teklif listesi (Sporcu Adı-Tempo-Süre-Renk + dairesel
> OYNA kartı), maç başlayınca teklif listeden çıksın, uygun teklif yoksa 'Maç Teklif Et'
> ile kendi teklifini oluştursun (Tempo-Süre-Renk yeterli)."

Bu bir **model değişikliğidir**. Bugünkü model **doğrudan davet**:

```
Sporcu A: kriterleri seç → aktif sporcu listesinden B'yi seç → davet gönder
Sporcu B: "A seni davet etti" → Kabul / Reddet
```

Sporcu B o an ekrana bakmıyorsa davet boşa gider. A, B'nin ne oynamak istediğini bilmez.

İstenen model **teklif panosu**:

```
Sporcu A: teklif bırakır (Tempo · Süre · Renk) → panoda durur
Sporcu B: panoyu görür → beğendiği teklifin OYNA'sına basar → maç ANINDA başlar
```

Kimse kimseyi beklemez; teklif zaten "evet"tir.

## 2. Onaylanan kararlar

Kullanıcıya tek tek soruldu, hepsi onaylandı:

| Konu | Karar |
|---|---|
| Teklifler nerede durur | **Sunucu belleğinde.** Sporcu lobiden çıkınca teklifi silinir. Yeni tablo/migration **yok**. |
| Bir sporcu kaç teklif bırakır | **Tek.** Yeni teklif eskisinin üstüne yazar. |
| Renk kuralı | **Karşıt renk.** Teklif "Beyaz" ise kabul eden Siyah olur. "Rastgele" ise maç başlarken çekiliş yapılır. |
| Eski doğrudan davet | **Kalır, silinmez.** 4. alt proje (madde f, "Arkadaşını Seç → Teklif Et") tam olarak onu kullanacak. |

## 3. Kapsam dışı (bilinçli)

- **(f) maddesi** — isim arama + belirli bir arkadaşa teklif. 4. alt projedir.
- Teklife düzey (skill/depth) **konmaz**. Düzey bota karşı anlamlıdır; iki insan arasında
  karşılığı yok. Kullanıcının "Tempo-Süre-Renk yeterli" ifadesi de bunu söylüyor.
- Teklife zaman aşımı (TTL) **konmaz**. Teklif sahibi lobideyken teklifi yaşar, bağlantı
  koptuğu an silinir — bu zaten doğal bir son. `presence.py`'deki 60 sn TTL burada gereksiz,
  çünkü lobi soketi canlılığı doğrudan bildirir.

## 4. Hedef ekran

`/play` → "Arkadaşla Oyna":

```
🤝 Arkadaşla Oyna                                   [← Maç Türü]

AÇIK TEKLİFLER (3)
┌──────────────────────────────────────────────┬───────┐
│ Ayşe        ⚡ Yıldırım · 5+0 · ⚪ Beyaz       │ (OYNA)│
├──────────────────────────────────────────────┼───────┤
│ Mehmet      🚀 Hızlı · 10+0 · 🎲 Rastgele     │ (OYNA)│
├──────────────────────────────────────────────┼───────┤
│ Zeynep      🐢 Klasik · 30+10 · ⚫ Siyah      │ (OYNA)│
└──────────────────────────────────────────────┴───────┘

          [ + Maç Teklif Et ]
```

- Teklif satırında **Ad · Tempo · Süre · Renk** ve sağda **dairesel OYNA** düğmesi.
- Sporcu kendi teklifini panoda **görmez**; onun yerine üstte
  `Teklifin panoda: ⚡ Yıldırım · 5+0 · ⚪ Beyaz  [Teklifini İptal Et]` satırı çıkar.
- Pano boşsa: `Şu an açık teklif yok. Sen bir teklif bırak, arkadaşların görsün.`
- "+ Maç Teklif Et"e basılınca aynı ekranda küçük bir form açılır: **Tempo/Süre** (mevcut
  `TIME_GROUPS`) + **Renk** (mevcut `COLOR_CHOICES`) + `Teklifi Yayınla`.
- Renk gösterimindeki emojiler mevcut `COLOR_CHOICES` verisinden gelir (⚪ / 🎲 / ⚫),
  tempo emojileri mevcut `TIME_GROUPS`'tan (⚡ / 🚀 / 🐢). Yeni sabit tanımlanmaz (DRY).

## 5. Mimari

### 5.1 `apps/api/chess_api/services/offers.py` — bellek içi pano (yeni)

`lobby.py` ve `presence.py` ile aynı desen: tek instance varsayımı, modül seviyesinde sözlük.

```python
# child_id -> Offer
_offers: dict[int, dict] = {}

def create_offer(child_id: int, display_name: str, tempo: str, tc_label: str,
                 tc_base: int, tc_increment: int, color: str) -> dict
def cancel_offer(child_id: int) -> None
def list_offers(exclude: int | None) -> list[dict]
def take_offer(child_id: int) -> dict | None
def _reset_for_tests() -> None
```

- `create_offer` aynı `child_id` için **üstüne yazar** (tek teklif kuralı).
- `take_offer` teklifi sözlükten **çekip döndürür** (`pop`). Teklif yoksa `None`.
  Bu, yarış durumunun tek savunmasıdır: iki kişi aynı anda bassa `pop` yalnızca birinde
  değer döner. Python'da tek olay döngüsü içinde `dict.pop` bölünmez olduğu için ek kilit
  gerekmez (`lobby.py` de aynı varsayımla yazılmıştır).
- `color` yalnızca `'white' | 'black' | 'random'` olabilir; başka değer `ValueError`.
- `tempo` yalnızca gösterim içindir (`'Yıldırım'`), doğrulanmaz.

### 5.2 `apps/api/chess_api/services/offer_sides.py` — saf renk çözümü (yeni)

Ayrı dosya, çünkü tek sorumluluğu var ve rastgeleliği enjekte edilebilir olmalı:

```python
def resolve_sides(owner_color: str, owner_id: int, taker_id: int,
                  coin: bool) -> tuple[int, int]:
    """(white_child_id, black_child_id) doner.
    owner_color 'random' ise 'coin' kullanilir: True -> teklif sahibi beyaz.
    """
```

`coin` parametre olduğu için testte `random` yamalanmaz — `presence.py`'deki `now`
enjeksiyonuyla aynı fikir. Çağıran taraf `random.random() < 0.5` üretir.

### 5.3 `/ws/lobby` protokol eklemeleri

`live_game.py:lobby_ws` içindeki `while` döngüsüne üç yeni mesaj tipi:

**İstemci → Sunucu**

| Mesaj | Alanlar |
|---|---|
| `offer_create` | `tempo`, `tc_label`, `tc_base`, `tc_increment`, `color` |
| `offer_cancel` | — |
| `offer_take` | `child_id` (teklif sahibi) |

**Sunucu → İstemci**

| Mesaj | Ne zaman | Alanlar |
|---|---|---|
| `offers` | Pano her değiştiğinde, lobideki **herkese** | `offers: [...]` |
| `matched` | Maç kurulduğunda, iki tarafa | `game_id`, `color` (mevcut mesaj, aynen) |
| `offer_gone` | `offer_take` geç kaldıysa, yalnızca basana | — |

- `lobby_joined` mesajına `offers` alanı eklenir (bağlanır bağlanmaz pano dolu gelsin).
  Mevcut `players` alanı **kaldırılmaz** — doğrudan davet akışı onu kullanıyor (§2).
- Yayın, lobideki her sokete `offers` göndermektir. Her istemci kendi listesini görür;
  `exclude` istemci tarafında değil **sunucuda** uygulanır (her sporcuya kendi hariç liste).
- **Bunun için `lobby.py`'ye tek satırlık bir ekleme gerekir:** `_players` sözlüğü modüle
  özeldir, dışarıdan gezilemez. Eklenecek:

  ```python
  def connected_ids() -> list[int]:
      """Lobideki tum cocuk id'leri. Yayin yapan taraf bunu gezip
      send_to_player ile HER SPORCUYA KENDI hariç listesini gonderir."""
      return list(_players.keys())
  ```

  Router'daki yayın yardımcısı (yeni, `live_game.py` içinde):

  ```python
  async def _broadcast_offers() -> None:
      for cid in connected_ids():
          await send_to_player(cid, {"type": "offers",
                                     "offers": list_offers(exclude=cid)})
  ```

  `send_to_player` kopmuş soketlerde sessizce `False` döndüğü için ayrı hata yönetimi
  gerekmez (mevcut davranış).
- Bağlantı koptuğunda `leave_lobby` yanında `cancel_offer` da çağrılır ve pano yayınlanır.

### 5.4 Maç kurulumu

`offer_take` geldiğinde sunucu sırayla:

1. `take_offer(owner_id)` → `None` ise basana `offer_gone` gönder, dur.
2. Teklif sahibi hâlâ lobide mi? Değilse basana `offer_gone` gönder, dur
   (teklif çekildiği için pano zaten temizlenmiş olur).
3. `resolve_sides(...)` ile beyaz/siyah belirle.
4. Mevcut `_create_human_game(white_id, black_id)` ile oyunu aç (yeni kod yazılmaz).
5. İki tarafa da `matched` gönder (her birine kendi rengiyle).
6. Güncel panoyu herkese yayınla.

### 5.5 Frontend

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/play/offers.ts` **(yeni)** | Saf: teklif satırı metni + kabul edenin rengi. `oppositeColor` (mevcut) yeniden kullanılır. |
| `apps/web/components/play/OfferBoard.tsx` **(yeni)** | Pano + OYNA + teklif formu + iptal satırı. |
| `apps/web/lib/hooks/use-lobby.ts` **(değişir)** | `offers` durumu + `createOffer` / `cancelOffer` / `takeOffer` + `offerGone` uyarısı. Mevcut `challenge/accept/decline` API'si **aynen kalır**. |
| `apps/web/app/(child)/play/page.tsx` **(değişir)** | `mode === 'friend'` dalı `ChallengeScreen` yerine `OfferBoard` render eder. |

`ChallengeScreen.tsx` **değişmez**; açılış pratiğinin 🤝 kartında kullanılmaya devam eder
ve 4. alt projenin temeli olur.

## 6. Veri akışı

```
A: "Teklifi Yayınla"
      │  ws: offer_create
      ▼
 offers.create_offer()  ──►  herkese ws: offers[]
                                   │
                                   ▼  B panoda görür
                              B: OYNA
                                   │  ws: offer_take {child_id: A}
                                   ▼
                            offers.take_offer(A)
                              │            │
                         None │            │ teklif
                              ▼            ▼
                    B'ye offer_gone   resolve_sides() → _create_human_game()
                                           │
                                    A ve B'ye matched  +  herkese offers[]
```

## 7. Hata durumları

| Durum | Davranış |
|---|---|
| İki kişi aynı teklife aynı anda basar | Biri maça girer; diğerine `offer_gone` → ekranda "Bu teklif alındı." Çökme yok, sahte maç yok. |
| Teklif sahibi maç kurulmadan hemen önce kopar | `offer_take` `offer_gone` döner (§5.4 adım 2). |
| Kendi teklifine basma | Sunucu kendi teklifini listeye koymadığı için mümkün değil; yine de sunucu `owner_id == taker_id` ise `offer_gone` döner. |
| Geçersiz `color` değeri | `ValueError` yakalanır, istemciye `offer_gone` yerine sessiz yok sayma: teklif oluşmaz, pano değişmez. |
| WS kopar | Mevcut `use-websocket` davranışı korunur; pano yeniden bağlanınca `lobby_joined` ile tazelenir. |

## 8. Test planı

**Backend (pytest)** — `apps/api/tests/test_lobby_connected_ids.py`
- `join_lobby` sonrası `connected_ids()` o çocuğu içerir; `leave_lobby` sonrası içermez.

`apps/api/tests/test_offers.py`
- `create_offer` sonrası `list_offers(exclude=None)` teklifi içerir.
- Aynı çocuk ikinci kez teklif verirse pano **tek** kayıt tutar (üstüne yazma).
- `list_offers(exclude=A)` A'nın teklifini **içermez**.
- `take_offer` teklifi döndürür ve panodan **siler**; ikinci çağrı `None` döner (yarış).
- `cancel_offer` panodan siler; olmayan çocuk için hata vermez.
- Geçersiz renk `ValueError` yükseltir.

`apps/api/tests/test_offer_sides.py`
- `owner_color='white'` → `(owner, taker)`.
- `owner_color='black'` → `(taker, owner)`.
- `owner_color='random', coin=True` → `(owner, taker)`; `coin=False` → `(taker, owner)`.

**Frontend (vitest + RTL)** — `apps/web/tests/offers.test.ts`
- Teklif satırı metni: ad, tempo, süre ve renk etiketi doğru birleşir.
- Kabul edenin rengi: teklif `white` → kabul eden `b`; `black` → `w`.

`apps/web/tests/offer-board.test.tsx`
- Pano boşken bilgilendirme metni görünür.
- Üç teklif listelenir, her satırda bir OYNA düğmesi vardır.
- OYNA'ya basınca `takeOffer` doğru `child_id` ile çağrılır.
- "Maç Teklif Et" formu açılır; süre ve renk seçilip yayınlanınca `createOffer` doğru
  değerlerle çağrılır.
- Kendi teklifi varken "Teklifini İptal Et" görünür ve `cancelOffer` çağrılır.
- `offer_gone` uyarısı ekranda gösterilir.

**Test kapısı:**
```
apps/api:  python -m pytest -q
apps/web:  npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```

**Canlı doğrulama (KURAL #6):** Bu özellik **iki ayrı sporcu oturumu** gerektirir; tek
tarayıcı oturumuyla panonun gerçek akışı (A teklif bırakır, B alır) tam doğrulanamaz.
Kullanıcıya bu sınır önceden bildirilir; ne doğrulandıysa o yazılır, gerisi için
"çalışıyor" DENMEZ (KURAL #1).

## 9. Riskler

- **Tek instance sınırı.** Pano bellekte; Railway'de birden çok kopya çalışırsa sporcular
  farklı panolar görür. Bu sınır `lobby.py`, `matchmaking.py`, `game_room.py` ve
  `presence.py` için de geçerli — yani yeni bir risk **değil**, mevcut mimarinin devamı.
  Çözüm (Redis pub/sub) bu projenin kapsamı dışında, ayrıca ele alınmalı.
- **Canlı sporcuya etki.** "Arkadaşla Oyna" ekranı değişiyor. Kaybolan yetenek yok:
  doğrudan davet altyapısı duruyor, iki sporcu yine eşleşebiliyor — üstelik artık
  karşı tarafın ekrana bakıyor olması gerekmiyor. Geriye dönük uyumlu (KURAL #3).
- **Sunucu yeniden başlarsa** pano boşalır. Sporcu teklifini yeniden bırakır; veri kaybı
  sayılmaz çünkü teklif kalıcı bir kayıt değil, anlık bir niyet beyanıdır.
