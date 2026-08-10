# Açılış Pratiği — Kategoriler (e4 / d4 / Diğerleri)

**Tarih:** 2026-08-11
**Kapsam:** 5 maddelik admin isteğinin son maddesi (madde 2).

## Amaç

Açılışlar üç gruba ayrılsın. Hoca admin panelinde "Pratik Yap → Açılış Pratiği Yap"a
tıklayınca aynı sayfada üç açılır kart görsün ve açılışları o kartların içine girsin.
Sporcu tarafında açılış seçimi önce "tür", sonra "konum" olacak şekilde bir adım uzasın.

## Veri modeli

`Opening` tablosuna `category` sütunu eklenir:

- Tip: `String(20)`, `default="diger"`, `server_default="'diger'"`, NOT NULL.
- Geçerli değerler: `e4`, `d4`, `diger`.
- **Migration yalnızca sütun ekler.** Hiçbir satır silinmez/güncellenmez; mevcut tüm
  açılışlar `server_default` sayesinde `diger` olur, yani "Diğerleri" kartında görünür
  (kullanıcı kararı). KURAL #3 ve #4 korunur.

Bilinmeyen bir değer okunursa (elle veri girişi vb.) ön yüz onu `diger` sayar —
açılış hiçbir zaman kaybolmaz.

## Backend

- `GET /openings` yanıtına `category` eklenir. Sıralama değişmez (`sort_order, id`).
- `POST /admin/openings` gövdesinde isteğe bağlı `category` (varsayılan `diger`).
  Geçersiz değer → 400.
- `PATCH /admin/openings/{id}` isteğe bağlı `category` günceller.
- `POST /admin/openings/{id}/move` değişmez. Sıralama global kalır; kategori içinde
  görünen sıra bu global sıranın süzülmüş hâlidir. Komşusu farklı kategorideyse
  yer değiştirme kategori içindeki görünür sırayı değiştirmeyebilir — hoca oku
  tekrar kullanır. (Basit tutuldu; YAGNI.)

## Ortak mantık — `apps/web/lib/play/openingCategories.ts`

Tek kaynak; admin ve sporcu aynı listeyi okur.

```ts
export type OpeningCategory = 'e4' | 'd4' | 'diger';
export const OPENING_CATEGORIES: { key: OpeningCategory; title: string; emoji: string }[]
// e4 → "e4 ile Başlayanlar" ♟️ | d4 → "d4 ile Başlayanlar" ♙ | diger → "Diğerleri" ♞
export function normalizeCategory(raw: string | null | undefined): OpeningCategory
export function categoryTitle(key: OpeningCategory): string
export function groupOpenings<T extends { category?: string | null }>(list: T[]): Record<OpeningCategory, T[]>
```

## Admin arayüzü

- `/admin/openings` sayfası **kaldırılır** (kullanıcı kararı). Sekmeler sayfasındaki
  ona giden bağlantı da kaldırılır.
- Yerine `components/admin/OpeningCategoryCards.tsx`: üç açılır kart, aynı anda biri
  açık. Her kartın başlığında o kategorideki açılış sayısı görünür.
- Açık kartın içinde: "Açılış adı" + "Başlangıç FEN'i" alanları ve "Açılış ekle"
  düğmesi; altında o kategorinin listesi (Düzenle / Sil / ▲ / ▼) — mevcut sayfadaki
  davranışın aynısı, sadece kategoriye süzülmüş hâli.
- Kart bileşen bu üçlüyü `/admin/settings/tabs` içinde, Pratik Yap açıldığında,
  "Açılış Pratiği Yap" başlığının altında çizer.

## Sporcu arayüzü

**Bota karşı (2 adım → 3 adım):**
1. Açılış Türünü Seç → üç kategori kartı
2. Açılış Konumunu Seç → seçilen kategorideki açılışlar (kilitli: tür seçilmeden açılmaz)
3. Maç Kriterlerini Seç (kilitli: açılış seçilmeden açılmaz)

**Arkadaşa karşı (3 adım → 4 adım):**
1. Açılış Türünü Seç
2. Açılış Konumunu Seç
3. Maç Kriterlerini Belirle
4. Arkadaşını Seç

Kategori değiştirilirse seçili açılış sıfırlanır — yanlış kategoriden kalan bir
açılışla maç başlamaz.

Seçilen kategoride hiç açılış yoksa: "Bu türde henüz açılış yok."

## Testler

- `tests/opening-categories.test.ts` — `normalizeCategory` (bilinmeyen/boş → `diger`),
  `groupOpenings` (üç anahtar hep var, boşlar boş dizi), `categoryTitle`.
- `tests/opening-practice-steps.test.tsx` — bot dalında 3 adım, tür seçilmeden konum
  kilitli, tür değişince seçili açılış sıfırlanır.
- `tests/friend-challenge-steps.test.tsx` — açılış adımı verildiğinde numaralar
  1-2-3-4 olur; verilmezse eski 1-2 davranışı korunur.
- `apps/api/tests/test_openings.py` — `category` yanıtta döner, geçersiz değer 400,
  varsayılan `diger`.
- Migration guard testi mevcut hâliyle geçmeye devam eder (silme yok).
