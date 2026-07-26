# Açılış Pratiği — Açılır Kartlar (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Kullanıcının çok parçalı "Maç Yap" isteğindeki **(d)** ve **(e)** maddeleri.
**Alt proje sırası:** 2/4 (1: aktif sporcu rozeti ✓ tamamlandı, 3: lobi teklif panosu, 4: arkadaşa karşı pratik + isim arama)

---

## 1. Problem

Bugün `/play` → "Açılışı Pratiği Yap" bir **sihirbaz**: her adım bir öncekinin yerine geçer.

```
rakip türü  →  açılış seç  →  kriterler  →  maç
   (ekran 1)     (ekran 2)     (ekran 3)   (ekran 4)
```

Sporcu her adımda önceki seçimini göremez; geri gitmek için "← Rakip türü" / "← Açılış seç"
düğmelerini kullanmak zorundadır. Kullanıcının isteği:

- **(d)** Alt-sekmeler ayrı sayfa değil, **açılır kartlar** olsun.
- **(e)** "Bota Karşı Pratik Yap" içinde "Açılış Konumunu Seç" ve "Maç Kriterlerini Seç"
  açılır kartları **sırayla** açılsın.

## 2. Kapsam dışı (bilinçli)

- **(f) maddesi** — "Arkadaşına Karşı Pratik Yap" içindeki "Maç Kriterlerini Belirle" +
  "Arkadaşını Seç" + harf harf ARA + Teklif Et akışı. Bu **4. alt projedir**; yeni backend
  ucu (sporcu arama) ve bildirim akışı gerektirir. Bu projede arkadaş kartının içine
  **mevcut `ChallengeScreen` aynen** konur — davranış değişmez (KURAL #3).
- Backend'e hiç dokunulmaz. Yeni uç, yeni tablo, yeni migration **yoktur**.
- `MatchCriteria`, `ChallengeScreen`, `BotGame` bileşenlerinin davranışı değişmez.

## 3. Hedef ekran

`mode === 'opening'` dalı artık tek sayfa; sihirbaz yok.

```
📖 Açılışı Pratiği Yap                              [← Maç Türü]

┌─ 🤖 Bota Karşı Pratik Yap                       ▾ ─┐
│                                                     │
│   ┌─ 1. Açılış Konumunu Seç        ✓ İtalyan   ▴ ─┐│
│   │     (açılış listesi — GET /openings)          ││
│   └───────────────────────────────────────────────┘│
│   ┌─ 2. Maç Kriterlerini Seç                   ▾ ─┐│
│   │     (MatchCriteria + "▶️ Pratiğe Başla")       ││
│   └───────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘

┌─ 🤝 Arkadaşına Karşı Pratik Yap                 ▾ ─┐
│     (ChallengeScreen — bugünkü hâliyle)             │
└─────────────────────────────────────────────────────┘
```

"Pratiğe Başla"ya basılınca ekran `BotGame`'e geçer (bugünkü davranış aynen korunur).

## 4. Kararlar

Kullanıcıya sorulup **onaylanan** kararlar:

| Konu | Karar |
|---|---|
| İç kartların sırası | **Sıralı + kilitli.** Açılış seçilmeden kriter kartı açılamaz. |
| Arkadaş kartının içeriği | Şimdilik **mevcut `ChallengeScreen`**. (f) maddesi 4. alt projede. |

CEO'nun verdiği (kullanıcı soruyu yanıtlamadı, karar açıkça bildirildi) karar:

| Konu | Karar |
|---|---|
| Açma biçimi | **Kartın her yerine tıklanır + sağda ok** (▾ / ▴). Ek olarak iç kartlarda **1. / 2. numara** ve tamamlanınca **✓ özet**. |

### 4.1 Akordiyon kuralları

- **Dış katman:** aynı anda **tek** kart açık (bot **veya** arkadaş). Açık karta tekrar
  tıklamak onu kapatır.
- **İç katman:** aynı anda **tek** kart açık (açılış **veya** kriterler).
- **Kilit:** 2. kart, 1. kart tamamlanmadan (açılış seçilmeden) açılamaz. Kilitli kart
  soluk görünür ve `aria-disabled="true"` taşır; tıklama hiçbir şey yapmaz.
- **Otomatik ilerleme:** açılış seçilir seçilmez 1. kart kapanır, 2. kart açılır.
- **Geri dönüş:** 1. kart başlığına tekrar tıklanırsa açılır ve açılış değiştirilebilir.
  Seçilen açılış (`chosen`) korunur; yeni bir açılışa tıklanana kadar özet metni durur.
- **Kabul edilen sınır:** 1. karta geri dönüldüğünde 2. kart kapanır ve `MatchCriteria`
  DOM'dan çıkar; içindeki **düzey/tempo/renk seçimi sıfırlanır**. Sporcu 2. karta
  döndüğünde bunları yeniden seçer. Bunu engellemek `MatchCriteria`'yı kontrollü bileşene
  çevirmeyi gerektirirdi; o bileşen **üç ayrı akışta** (bota karşı, arkadaşla, açılış
  pratiği) paylaşılıyor ve bu proje ona dokunmuyor (§2). Kayıp küçük, risk büyüktü.
- **Özet:** tamamlanan kartın başlığında seçilen değer görünür (`✓ İtalyan Açılışı`).

### 4.2 Kilit yalnızca görsel değildir

Kilit hem karta (`aria-disabled`, tıklama yok) hem de **başlatma koşuluna** uygulanır:
`chosen === null` iken "Pratiğe Başla" akışı hiç çalıştırılmaz. Böylece klavye/erişilebilirlik
yolundan kilidin etrafından dolaşılamaz.

## 5. Mimari

Üç birim, üç net sorumluluk:

### 5.1 `apps/web/lib/play/openingSteps.ts` — saf mantık (yeni)

Tarayıcısız, React'siz, test edilebilir. Sorumluluğu: **hangi kart açılabilir, hangisi
tamamlandı, başlıkta ne yazar.**

```ts
export type BotStepKey = 'opening' | 'criteria';

/** 2. kart (Maç Kriterlerini Seç) açılabilir mi? Kilit kuralı TEK yerde. */
export function isCriteriaUnlocked(openingName: string | null): boolean;

/** 1. kartın başlığında görünecek özet; açılış seçilmediyse null. */
export function openingSummary(openingName: string | null): string | null;
```

Kurallar:
- `isCriteriaUnlocked(null) === false`; `isCriteriaUnlocked('İtalyan Açılışı') === true`.
- `openingSummary(null) === null`; `openingSummary('İtalyan Açılışı') === '✓ İtalyan Açılışı'`.
- Boş/boşluklu ad (`''`, `'   '`) seçilmemiş sayılır — her iki fonksiyon da öyle davranır.

**Neden bu kadar küçük?** Genel bir `isStepDone(state, key)` / `stepSummary(state, key)`
ikilisi yazmak cazipti, ama 2. kartın özeti **hiçbir zaman görünmez**: kriterler seçilir
seçilmez ekran `BotGame`'e geçer. Kullanılmayan API yazılmaz (YAGNI). `opening` kartı da
her zaman açılabildiği için ona ayrı bir "unlocked" fonksiyonu gerekmez.

### 5.2 `apps/web/components/play/StepCard.tsx` — sunum (yeni)

Tek sorumluluk: **bir açılır kartı çizmek.** İçinde iş mantığı yoktur; ne açık olduğuna
ne kilitli olduğuna kendi karar verir — hepsi prop olarak gelir (kontrollü bileşen).

```tsx
interface StepCardProps {
  title: string;
  emoji?: string;        // dış kartlar için (🤖 / 🤝)
  stepNumber?: number;   // iç kartlar için (1 / 2)
  summary?: string | null;
  open: boolean;
  locked?: boolean;
  onToggle: () => void;
  children: React.ReactNode;   // yalnızca open iken render edilir
}
```

- Başlık satırı bir `<button>`; `aria-expanded={open}`, kilitliyse `aria-disabled="true"`
  ve `onToggle` çağrılmaz.
- Sağda ok: kapalı `▾`, açık `▴`.
- Kilitli kart `opacity-50`.
- Gövde (`children`) yalnızca `open === true` iken DOM'a girer.

### 5.3 `apps/web/components/play/OpeningPractice.tsx` — akış (değişen)

Sihirbaz mantığı (`if (!opponent) return ...` zinciri) kaldırılır. Yerine tek render
ağacı gelir; durum aynı kalır (`opponent`, `openings`, `chosen`, `criteria`, `color`)
ve iki yeni durum eklenir:

```ts
const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
const [openInner, setOpenInner] = useState<BotStepKey | null>('opening');
```

- `criteria !== null` ise bugünkü gibi doğrudan `BotGame` render edilir (akordiyon gizlenir).
- Açılışlar `openOuter === 'bot'` olduğunda yüklenir (bugünkü `useEffect` koşulu
  `opponent`'tan `openOuter`'a taşınır) — gereksiz istek atılmaz.
- Açılış seçilince: `setChosen(o); setOpenInner('criteria');`

Not: mevcut `opponent` durumu artık akışı yönetmiyor; `openOuter` onun yerini alır.
`opponent` durumu **kaldırılır** (ölü kod bırakılmaz).

## 6. Veri akışı

```
GET /openings ──► openings[]  ──► 1. kart listesi
       │                                │ tıklama
       │                                ▼
       │                            chosen (Opening)
       │                                │
       │                                ▼  otomatik aç
       │                          2. kart: MatchCriteria
       │                                │ "Pratiğe Başla"
       │                                ▼
       └──────────────────────► BotGame(startFen = chosen.start_fen)
```

Yeni ağ isteği yoktur. `GET /openings` bugünkü hâliyle, aynı koşullarda çağrılır.

## 7. Hata durumları

Hepsi bugünkü davranışın korunmasıdır:

| Durum | Davranış |
|---|---|
| `GET /openings` başarısız / ağ hatası | `openings = []` (mevcut `catch` aynen kalır) |
| Açılış listesi boş | 1. kart açıkken "Zafer Hoca henüz açılış eklemedi." metni |
| Açılışlar henüz yüklenmedi | 1. kart açıkken "Yükleniyor…" metni |
| Kilitli karta tıklama | Hiçbir şey olmaz (sessiz; hata mesajı gösterilmez) |

## 8. Test planı

**Saf birim testleri** — `apps/web/tests/opening-steps.test.ts`
- `isCriteriaUnlocked(null)` → `false`.
- `isCriteriaUnlocked('İtalyan Açılışı')` → `true`.
- `isCriteriaUnlocked('   ')` → `false` (boşluk ad sayılmaz).
- `openingSummary(null)` → `null`.
- `openingSummary('İtalyan Açılışı')` → `'✓ İtalyan Açılışı'`.

**Bileşen testleri (vitest + RTL, happy-dom)** — `apps/web/tests/opening-practice-cards.test.tsx`
- Başlangıçta iki dış kart listelenir; ikisi de kapalıdır (gövdeleri DOM'da değil).
- 🤖 kartına tıklanınca açılır ve içinde "1. Açılış Konumunu Seç" görünür.
- 2. kart başlangıçta **kilitlidir**: `aria-disabled="true"` taşır ve tıklanınca
  `MatchCriteria` içeriği (örn. "Düzey (1 en kolay · 8 en zor)") DOM'a **girmez**.
- Bir açılış seçilince: 1. kart kapanır, başlığında `✓ <açılış adı>` görünür ve
  2. kart kendiliğinden açılır (Düzey metni DOM'a girer).
- 🤝 kartına tıklanınca `ChallengeScreen` render edilir (mock ile doğrulanır).
- **REGRESYON:** `GET /openings` boş dizi dönerse "Zafer Hoca henüz açılış eklemedi." görünür.
- **REGRESYON:** dış akordiyon tek-açık — 🤝 açılınca 🤖 kapanır.

`fetch` testlerde `vi.fn((_url: string, _init?: RequestInit) => ...)` biçiminde,
parametreleri **bildirilerek** mock'lanır (aksi hâlde `tsc --noEmit` `mock.calls` tuple
tipinde patlar — P8'de yaşandı).

**Test kapısı (pazarlık yok):**
```
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```
Backend'e dokunulmadığı için `pytest` çalıştırmaya gerek yoktur; yine de CI'da koşacaktır.

**Canlı doğrulama (KURAL #6):** dev sunucu + gerçek tarayıcı ile: 🤖 kartını aç, kilitli
2. karta tıkla (açılmamalı), bir açılış seç (1. kart kapanmalı, ✓ özet çıkmalı, 2. kart
açılmalı), tempo seç, "Pratiğe Başla" ile tahtanın açılış FEN'iyle geldiğini doğrula.
Doğrulanamayan hiçbir şey için "çalışıyor" denmez (KURAL #1).

## 9. Riskler

- **Canlı sporcuya etki:** Akış görsel olarak değişiyor ama **yetenek kaybı yok** —
  aynı seçimler, aynı sonuç. Backend değişmediği için mevcut oturumlar etkilenmez (KURAL #3).
- **`opponent` durumunun kaldırılması:** `ChallengeScreen`'e giden yol artık `openOuter`
  üzerinden. Testlerde her iki dış kart da ayrıca doğrulanır.
- **Mobil dokunma alanı:** kart başlığı tam genişlikte buton olduğu için dokunma hedefi
  büyür — bu bir iyileşme, risk değil.
