# Arkadaşa Karşı Pratik + İsim Arama (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Kullanıcının çok parçalı "Maç Yap" isteğindeki **(f)** maddesi.
**Alt proje sırası:** 4/4 — **son** (1: aktif sporcu rozeti ✓, 2: açılış pratiği akordiyon ✓, 3: lobi teklif panosu ✓)

---

## 1. Problem

Kullanıcının isteği (birebir):

> "Arkadaşına Karşı Pratik Yap → 'Maç Kriterlerini Belirle' ve 'Arkadaşını Seç' açılır
> kartları, ARA bölümünde harf harf filtreleme, isme tıklayarak seçim, 'Teklif Et' ile
> bildirim (Evet/Hayır)."

Bugünkü `ChallengeScreen` bunun yarısını yapıyor: kriter seç → **o an aktif** sporcu
listesinden birine dokun → teklif → bekle. Eksik olan üç şey:

1. İki **açılır kart** (sıralı) yerine ekran değiştiren sihirbaz var.
2. **ARA** kutusu yok; liste kısa olduğu için arama hiç düşünülmemiş.
3. Bildirim yalnızca karşı taraf **aynı ekranda duruyorsa** görünüyor. Sporcu ders
   yaparken kendisine gelen teklifi asla görmüyor — teklif eden boşuna bekliyor.

## 2. Onaylanan kararlar

Kullanıcıya tek tek soruldu:

| Konu | Karar |
|---|---|
| Listede kim görünür | **Tüm sporcular**, aktif olanlar işaretli (yeşil nokta). |
| Liste kapsamı | **Aynı hocanın** sporcuları (`teacher_user_id` eşleşmesi). |
| Aktif olmayana teklif | **Gönderilemez.** İsim soluk görünür, "çevrimdışı" yazar, seçilemez. |
| Bildirim nerede görünür | **Uygulamanın her yerinde.** |

## 3. Kararın mimari sonucu (önemli)

"Bildirim her yerde görünsün" kararı, tek başına bir bileşen eklemekle çözülmez.

Bugün lobi bağlantısını `OfferBoard` **kendi içinde** açıyor (`useLobby`). Bildirimi
global yapmak için ikinci bir bağlantı açılırsa, sunucudaki `join_lobby` **tek sekme
kuralı** gereği aynı çocuğun eski kaydının üstüne yazar (`lobby.py:19`) — yani ikinci
bağlantı ilkini düşürür ve teklif panosu ölür.

Bu yüzden lobi bağlantısı **tek bir yere** taşınır: `LobbyProvider`. `PresenceProvider`
ile aynı desen, aynı yer (`app/(child)/layout.tsx`). Tüketiciler (`OfferBoard`,
`FriendChallenge`, bildirim şeridi) context'ten okur. Bağlantı sayısı: **bir**.

## 4. Kapsam dışı (bilinçli)

- Kalıcı/gecikmeli bildirim (çevrimdışı sporcuya teklif biriktirme). Karar gereği
  çevrimdışına teklif gönderilemez; kalıcı bildirim tablosu **yazılmaz** (YAGNI).
- Push notification (telefon bildirimi). Uygulama açıkken çalışan bir şerit yeterli.
- Teklif panosu (P12) davranışı değişmez; yalnızca bağlantıyı context'ten alır.

## 5. Hedef ekran

Açılış Pratiği → 🤝 "Arkadaşına Karşı Pratik Yap" kartının içi:

```
┌─ 1. Maç Kriterlerini Belirle        ✓ 5+0 · ⚪ Beyaz   ▴ ─┐
│    (mevcut MatchCriteria — "Kriterleri Onayla")           │
└───────────────────────────────────────────────────────────┘
┌─ 2. Arkadaşını Seç                                   ▾ ─┐
│   ┌───────────────────────────────────────────────────┐  │
│   │ 🔍 ARA: ay                                        │  │
│   └───────────────────────────────────────────────────┘  │
│    🟢 Ayşe                                    [seçili]   │
│    🟢 Ayhan                                              │
│    ⚪ Aysel — çevrimdışı                     (soluk)     │
│                                                          │
│              [ Teklif Et ]                               │
└──────────────────────────────────────────────────────────┘
```

Her sayfanın üstünde (teklif gelince):

```
┌──────────────────────────────────────────────────────┐
│ 🤝 Ayşe sana maç teklif etti — 5+0        [Evet] [Hayır] │
└──────────────────────────────────────────────────────┘
```

Kurallar:
- 2. kart, kriterler onaylanmadan **açılamaz** (P11'deki `StepCard` kilidi).
- ARA kutusuna yazıldıkça liste **harf harf** daralır.
- Çevrimdışı isimler listede durur ama `aria-disabled` taşır ve tıklama seçim yapmaz.
- "Teklif Et", **aktif** bir isim seçilmeden basılamaz.

## 6. Mimari

### 6.1 `GET /athletes` (yeni uç)

`apps/api/chess_api/routers/athletes.py` — yeni dosya (proje deseni: herkese açık/sporcu
GET uçları kendi router dosyasında; `pool_images.py` ve `presence.py` böyle).

```
GET /athletes          (sporcu kimliği zorunlu — get_current_child)
→ [{"child_id": 12, "display_name": "Ayşe"}, ...]
```

- Yalnızca **aynı `teacher_user_id`** değerine sahip sporcular döner.
- İsteği yapan sporcu listede **yer almaz**.
- İsteği yapan sporcunun `teacher_user_id` değeri `None` ise **boş liste** döner.
  Gerekçe: hangi akademiye ait olduğu bilinmeyen bir çocuğa başka çocukların adları
  gösterilmez. Sessiz ve güvenli taraf seçilir.
- Ad'a göre sıralı döner (`display_name`), böylece liste her açılışta aynı sırada olur.
- Aktiflik bilgisi bu uçta **yoktur** — o bilgi lobi soketinden (`players`) gelir ve
  istemcide birleştirilir. Böylece iki farklı canlılık kaynağı çakışmaz.

### 6.2 `LobbyProvider` (yeni) — tek lobi bağlantısı

`apps/web/lib/lobby/LobbyContext.tsx`

```tsx
export function LobbyProvider({ children }: { children: ReactNode })
export function useLobbyContext(): ReturnType<typeof useLobby>
```

- İçinde `useLobby({ onMatched })` **bir kez** çağrılır.
- `onMatched` burada `router.push('/play/online/<id>?color=<c>')` yapar — maç nerede
  kabul edilirse edilsin sporcu tahtaya gider. (Bugün bu yönlendirme `/play` sayfasında
  duruyor; provider'a taşınır.)
- `app/(child)/layout.tsx` içinde `PresenceProvider`'ın yanına konur.

**Tüketici değişiklikleri — `onMatched` zinciri tamamen sökülür.**
Yönlendirme tek yerde (provider) toplandığı için bu prop'u elden ele taşıyan zincirin
**her halkası** temizlenir; yoksa kullanılmayan prop'lar kalır ve `tsc` uyarır:

| Dosya | Değişiklik |
|---|---|
| `components/play/OfferBoard.tsx` | `useLobby` → `useLobbyContext`; `Props.onMatched` **silinir** |
| `components/play/OpeningPractice.tsx` | `Props.onMatched` **silinir** (tek kullanıcısı `ChallengeScreen`'di) |
| `app/(child)/play/page.tsx` | `OfferBoard`'a ve `OpeningPractice`'a `onMatched` geçilmez; `router` yalnızca hâlâ gerekiyorsa kalır |
| `components/FriendChallenge.tsx` | `onMatched` prop'u **almaz** |

### 6.3 `IncomingChallengeBanner` (yeni)

`apps/web/components/play/IncomingChallengeBanner.tsx` — layout'ta, `AppNav` altında.

- `useLobbyContext().incoming` doluysa görünür; boşsa **hiç render edilmez**.
- İçerik: `<ad> sana maç teklif etti` + tempo etiketi + **Evet** / **Hayır**.
- Tempo etiketi `incoming.criteria` içinden gelir. Bu alan `Record<string, unknown>`
  olduğu için **tip kontrolüyle** okunur; alan yoksa etiket hiç gösterilmez (uydurulmaz):

  ```ts
  const tc = typeof c.criteria.tc_label === 'string' ? c.criteria.tc_label : null;
  ```
- Evet → `acceptChallenge`, Hayır → `declineChallenge` (ikisi de mevcut, P12'de korundu).

### 6.4 `athleteFilter.ts` (yeni, saf)

`apps/web/lib/play/athleteFilter.ts`

```ts
export interface Athlete { child_id: number; display_name: string }
export interface AthleteRow extends Athlete { online: boolean }

/** Turkce duyarli kucultme: I/İ/ı/i karismasin. */
export function trLower(s: string): string

/** Harf harf filtre. Bos sorgu tum listeyi dondurur. */
export function filterAthletes(rows: AthleteRow[], query: string): AthleteRow[]

/** /athletes listesi + lobideki aktif id'ler -> tek liste (aktifler ustte). */
export function mergeOnline(all: Athlete[], onlineIds: number[]): AthleteRow[]
```

Türkçe kuralı boş bir titizlik değil: `'İSTANBUL'.toLowerCase()` İngilizce kurallarla
`i̇stanbul` üretir ve "ist" araması tutmaz. `toLocaleLowerCase('tr')` kullanılır.
`mergeOnline` aktifleri başa alır, her grubu ada göre sıralı bırakır.

### 6.5 `FriendChallenge.tsx` (yeni) — `ChallengeScreen` yerine

`apps/web/components/play/FriendChallenge.tsx`

- P11'deki `StepCard` ile iki sıralı kart (§5).
- `GET /athletes` bir kez yüklenir; aktiflik `useLobbyContext().players` ile birleştirilir.
- Seçim + "Teklif Et" → `challenge(child_id, criteriaPayload)`; ardından
  "**\<ad\> bekleniyor…**" durumu ve **Vazgeç**.
- `ChallengeScreen.tsx` **silinir**. Tek kullanıcısı açılış pratiğinin 🤝 kartıydı; o kart
  artık `FriendChallenge` açıyor. Ölü kod bırakılmaz.

`criteriaPayload` (renk/skill/tempo alanlarını WS'e çeviren fonksiyon) `ChallengeScreen`
içinde yaşıyordu; `FriendChallenge`'a taşınır — davranışı **aynen** korunur, çünkü
sunucudaki `_handle_challenge_accept` bu alan adlarını okuyor.

## 7. Veri akışı

```
A (teklif eden)                      Sunucu                    B (teklif alan)
──────────────                       ──────                    ───────────────
GET /athletes ──────────────────────►
     ◄── ayni hocanin sporculari
lobi players (WS) ──► aktiflik
kriter + isim sec
"Teklif Et" ─ ws:challenge ─────────► send_to_player(B) ─────► incoming (context)
                                                               BANNER (her sayfada)
                                                                    │ Evet
     ◄──── matched ◄──── _create_human_game ◄─ ws:challenge_accept ─┘
     tahtaya git                                     tahtaya git
```

"Hayır" → `challenge_declined` → A'da "Teklifin reddedildi." (mevcut davranış).

## 8. Hata durumları

| Durum | Davranış |
|---|---|
| `GET /athletes` başarısız | Liste boş kalır + "Sporcu listesi yüklenemedi." Ekran çökmez. |
| Hocası atanmamış sporcu | Boş liste + "Listede sporcu yok." (uç boş dizi döndürür) |
| Aday çevrimdışı olurken teklif gönderilir | Sunucu `send_to_player` ile sessizce `False` döner; A "bekleniyor"da kalır ve **Vazgeç** ile çıkar (mevcut davranış korunur). |
| B başka sayfada | Banner layout'ta olduğu için yine görünür — bu projenin asıl amacı. |
| Aynı anda hem panodan hem davetten maç | Sunucu her ikisinde de ayrı `Game` açar; bu senaryo bugün de mümkün ve kapsam dışı. Değişiklik yapılmaz. |

## 9. Test planı

**Backend (pytest)** — `apps/api/tests/test_athletes.py`
- Aynı hocanın iki sporcusundan biri istek yapar → diğerini görür, kendini görmez.
- Farklı hocanın sporcusu listede **çıkmaz**.
- `teacher_user_id` `None` olan sporcu → **boş liste**.
- Kimliksiz istek → 401/403.

**Frontend (vitest)** — `apps/web/tests/athlete-filter.test.ts`
- `trLower('İSTANBUL')` → `'istanbul'`; `trLower('IŞIK')` → `'ışık'`.
- `filterAthletes` boş sorguda tüm listeyi döndürür.
- "ay" → Ayşe ve Ayhan gelir, Mehmet gelmez.
- Türkçe: "şey" araması "Şeyma"yı bulur; "IŞ" araması "ışık"ı bulur.
- `mergeOnline` aktifleri başa alır ve `online` bayrağını doğru koyar.

`apps/web/tests/friend-challenge.test.tsx`
- 2. kart, kriter onaylanmadan kilitlidir.
- Kriter onaylanınca 2. kart açılır ve isimler listelenir.
- ARA kutusuna yazınca liste daralır.
- Çevrimdışı isim `aria-disabled` taşır; tıklayınca seçilmez.
- Aktif isme tıklanınca seçilir; "Teklif Et" `challenge`'ı doğru `child_id` ile çağırır.
- İsim seçilmeden "Teklif Et" basılamaz.

`apps/web/tests/incoming-challenge-banner.test.tsx`
- `incoming` boşken banner **render edilmez**.
- Doluyken ad ve iki düğme görünür; Evet → `acceptChallenge`, Hayır → `declineChallenge`.

**Test kapısı:**
```
apps/api:  python -m pytest -q
apps/web:  npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```

**Canlı doğrulama (KURAL #6):** Teklif akışının tamamı (A teklif eder, B görür, Evet der)
**iki ayrı sporcu oturumu** ister; tek tarayıcı oturumuyla doğrulanamaz. Bu sınır
kullanıcıya önceden bildirilir. Doğrulanabilenler: ekranın açılması, ARA'nın harf harf
süzmesi, çevrimdışı isimlerin seçilememesi, "Teklif Et"in kilidi. Doğrulanamayan için
"çalışıyor" DENMEZ (KURAL #1).

## 10. Riskler

- **Bağlantının taşınması (§3) canlıyı etkiler.** Bugün lobi soketi yalnızca Arkadaşla
  Oyna ekranı açıkken kuruluyor; provider'a taşınınca **her sporcu sayfasında** kurulur.
  Sunucu tarafında bu, lobideki oyuncu sayısını artırır — `lobby.py` ve `offers.py` zaten
  bunu kaldırır (sözlükte bir satır). Kaybolan yetenek yok, geriye dönük uyumlu (KURAL #3).
- **Gizlilik.** Yeni uç çocuk adlarını döndürüyor. Kapsam `teacher_user_id` ile
  sınırlandığı ve hocasız sporcuya boş liste döndüğü için sızıntı yolu kapalı.
- **Tek instance sınırı** (lobi/pano bellekte) bu projede de geçerli; yeni bir risk değil,
  P12'de belgelendi.
- **`ChallengeScreen` siliniyor.** Tek çağıranı açılış pratiğinin 🤝 kartı; o da bu
  projede `FriendChallenge`'a geçiyor. Testlerde kalan mock'lar temizlenir.
