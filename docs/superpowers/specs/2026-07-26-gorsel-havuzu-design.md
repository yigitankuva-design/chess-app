# P8 — Görsel Havuzu

**Tarih:** 2026-07-26
**Durum:** Onaylandı (kullanıcı "DEVAM" dedi)

## Amaç

Admin > Dersler > Ders İçeriği > Soru Ekle > **Görüntü Ekle** ailesinde, her görsel seçim
noktasında ("Soru görseli" ve her şık için "Görsel seç") tek bir "Görsel seç" dosya seçici
var. Bunu ikiye ayırmak: **Bilgisayardan Seç** (mevcut) ve **Havuzdan Seç** (yeni — 12
kategoriye ayrılmış, önceden hazır görsellerden seçim). Bilgisayardan yüklenen görseller,
hoca isterse, aynı havuza da eklenebilsin.

## Kapsam Dışı (bilinçli)

- **Havuz yönetim ekranı (görüntüleme/silme):** Yok — kullanıcı onayı. "Havuzdan Seç"
  yalnızca gözat-ve-seç arayüzüdür. İleride ihtiyaç çıkarsa ayrı bir iş olarak eklenir.
- **Otomatik görsel sınıflandırma (AI ile "bu fotoğraf hangi kategori" tahmini):** Yok —
  bu sistemde görsel-içerik-anlama modeli yok, uydurma yapılmaz (KURAL #1). Kategori seçimi
  her zaman hoca tarafından, upload sonrası opsiyonel bir adımda yapılır.
- **Görsel benzerliği / akıllı tekrar tanıma:** Yok. "Havuzda zaten var mı" kontrolü
  **birebir bayt eşleşmesi** (`data_uri` string eşitliği) ile yapılır — görsel olarak
  neredeyse aynı ama farklı sıkıştırılmış iki dosya ayrı kayıt olarak eklenir. Bu bilinçli
  bir basitleştirme; daha "akıllı" bir tekrar tanıma bu projenin kapsamında değil.
- **"Cümle Ekle" bölümü:** Dokunulmuyor.
- **Cevap tipi "Görüntü" ile "Cümle" bağımsızlığı:** Kod incelendi, zaten bağımsız
  (`answer_kind` state'i her ikisini de destekliyor, birbirini etkilemiyor) — ek iş yok.

---

## Backend

### Yeni model: `PoolImage`

**Dosya:** `apps/api/chess_api/models/pool_image.py` (yeni)

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class PoolImage(Base):
    """Görsel havuzu — admin panelinde soru görseli seçerken kategoriye göre
    gözatılıp seçilebilen, önceden hazır veya hocanın eklediği görseller.

    Icerik kismen tohum veri (seed script), kismen Zafer Hoca'nin "Bilgisayardan
    Sec" sonrasi "havuza da ekle" ile eklediği kullanıcı verisidir.
    """

    __tablename__ = "pool_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(40))
    data_uri: Mapped[str] = mapped_column(Text)
```

`Text` kullanılır (`String` değil) — data-URI'ler 400KB'a kadar çıkabiliyor
(`MAX_EXERCISE_IMAGE_BYTES` ile aynı sınır burada da uygulanır), `String` sütun
uzunluk sınırına takılmasın diye.

### Kategori sabiti

**Dosya:** `apps/api/chess_api/pool_categories.py` (yeni) — hem migration/seed script
hem router bu listeyi kullanır, tek doğruluk kaynağı:

```python
POOL_CATEGORIES = [
    "Geometrik Şekiller", "Satranç Tahtası", "Satranç Taşları", "Hayvanlar",
    "Bitkiler", "Taşıtlar", "Gezegenler", "Meslekler", "Gök Cisimleri",
    "Satranç Şampiyonları", "Harfler", "Rakamlar",
]
```

### Migration

**Dosya:** `apps/api/alembic/versions/20260726_PoolImages_add.py` (yeni)

`upgrade()`: yalnızca `op.create_table('pool_images', ...)`. `downgrade()`: `op.drop_table`.
**TRUNCATE/DELETE yok** — bu tablo `modules`/`lessons`/... müfredat tablolarından değil,
KURAL #4 kapsamı dışında ama yine de disiplin aynı: migration veri silmez.

### Seed script (migration'dan AYRI, ayrı bir adımda çalıştırılır)

**Dosya:** `apps/api/scripts/seed_pool_images.py` (yeni) — 66 SVG ikonu (11 kategori × 6,
Satranç Şampiyonları hariç) doğrudan Python içinde tanımlı SVG string'leri olarak tutar,
her biri için `data:image/svg+xml;utf8,<...>` biçiminde data-URI üretip tabloya ekler.
Idempotent: `category+data_uri` zaten varsa atlar (migration'ı tekrar tekrar çalıştırmak
tekrar tekrar aynı 66 satırı eklemez).

**Neden migration içinde değil:** Alembic migration'ları şema değişikliği için; 66 satırlık
SVG içeriğini migration dosyasına gömmek onu okunaksız ve dev/prod ortamları arasında
senkron tutulması zor hale getirirdi. Ayrı script, deploy sonrası bir kere elle çalıştırılır
(tıpkı `_ensure_admin` gibi tek seferlik idempotent işlemler).

### Endpoint'ler

**Dosya:** `apps/api/chess_api/routers/pool_images.py` (yeni) — `openings.py` ile aynı desen:

```python
@router.get("/pool-images")
async def list_pool_images(category: str | None = None, db: AsyncSession = Depends(get_db)):
    # category verilirse filtrelenir, verilmezse hepsi döner (küçük veri seti, sorun değil)
    ...

@router.post("/admin/pool-images")
async def add_pool_image(body: PoolImageCreateRequest, ...):
    # _ensure_admin ile teacher-only
    # category POOL_CATEGORIES içinde değilse 400
    # data_uri _check_data_uri_size ile doğrulanır (mevcut fonksiyon yeniden kullanılır)
    # AYNI data_uri zaten o kategoride varsa: yeni satır eklenmez, mevcut kayıt döner (dedup)
    ...
```

`main.py`'a `pool_images_router` eklenir (openings_router gibi).

---

## Frontend

### `PoolPicker.tsx` (yeni, paylaşılan bileşen)

**Dosya:** `apps/web/components/admin/PoolPicker.tsx`

```tsx
interface Props {
  onSelect: (dataUri: string) => void;
  onClose: () => void;
}
```

- Açılır pencere (modal değil, satır-içi genişleyen panel — mevcut admin UI dilinde modal
  kullanılmıyor, tutarlılık için aynı desen)
- Üstte 12 kategori düğmesi (yatay kaydırmalı liste), seçili kategori vurgulu
- Kategori seçilince `GET /pool-images?category=X` çağrılır, sonuç küçük ızgara
  (`grid-cols-4`, `img` thumbnail, 60×60) halinde gösterilir
- Görsele tıklanınca `onSelect(dataUri)` çağrılır ve panel kapanır
- Kategori boşsa: "Bu kategoride henüz görsel yok. Bilgisayardan ekleyip havuza
  kaydedebilirsin." notu

### `ChoiceExerciseFields.tsx` değişikliği

Her görsel seçim noktası (soru görseli `promptImage`, her şık `options[i]`) için:

**Önce:** tek "Görsel seç" `<label htmlFor=...>` dosya girişi.

**Sonra:** iki buton yan yana — **Bilgisayardan Seç** (aynı mevcut `<input type=file>`
mekanizması, davranış değişmez) / **Havuzdan Seç** (yeni, `PoolPicker`'ı açar, `onSelect`
aynı state setter'ı çağırır — `setPromptImage` veya `options[i]` güncelleme fonksiyonu).

Aynı anda yalnızca **bir** `PoolPicker` açık olabilir (hangi slot için açıldığı bir
`openPoolFor: 'prompt' | number | null` state'iyle tutulur) — birden fazla şık için ayrı
ayrı panel açılırsa ekran karışır, sporcu ana sayfasındaki akordiyon deseniyle tutarlı
("tek seferde bir tane açık") bir kural bu da.

**Bilgisayardan seçim sonrası opsiyonel "havuza ekle" satırı:** `onPromptImageFile` /
`onOptionImageFile` başarıyla tamamlandıktan sonra, önizlemenin altında küçük bir satır
belirir:

```
Havuza da eklensin mi?  [Kategori seç ▾]  [Ekle]
```

- Kategori seçilmeden "Ekle" devre dışı
- "Ekle"ye basılınca `POST /admin/pool-images` çağrılır, başarı/"zaten var" mesajı gösterilir
- Bu satır **opsiyoneldir** — atlanabilir, soru kaydına hiçbir etkisi yok (sadece havuza
  ayrı bir kayıt ekler)
- Her görsel değiştiğinde (yeni dosya seçilince) bu satır sıfırlanır (yeniden gösterilir)

---

## Mimari kararlar

**Neden ayrı tablo, JSON içine gömme değil:** Havuz görselleri sorulardan bağımsız
yaşamalı (bir soru silinse bile havuzdaki görsel kalmalı, birden fazla soru aynı havuz
görselini kullanabilmeli). Bu, `Opening` modelinin `games`'ten bağımsız yaşamasıyla aynı
mantık.

**Neden dedup birebir bayt eşleşmesi:** Görsel benzerliği tespiti (perceptual hashing vb.)
bu projenin ölçeğine göre aşırı mühendislik olur (YAGNI) ve "hangi eşik kadar benzer
sayılsın" gibi belirsiz bir karar gerektirir ki bu KURAL #1 açısından net değil. Birebir
eşleşme basit, öngörülebilir ve yanlış negatif/pozitif riski yok.

## Test stratejisi

**Backend (pytest):**
- `POST /admin/pool-images` — teacher-only guard (401/403 sporcu/parent token ile)
- Geçersiz kategori → 400
- 400KB üstü data-URI → 400 (`_check_data_uri_size` yeniden kullanımı doğrulanır)
- Aynı `data_uri` ikinci kez postlanınca yeni satır eklenmez, mevcut id döner
- `GET /pool-images?category=X` — yalnızca o kategoriyi döner
- `GET /pool-images` (kategori yok) — hepsini döner
- Seed script — idempotent (iki kez çalıştırınca satır sayısı değişmez)

**Frontend (vitest + @testing-library/react):**
- `PoolPicker` — kategori tıklanınca doğru `GET` çağrısı, görsel tıklanınca `onSelect`
  doğru data-URI ile çağrılır, boş kategori notu
- `ChoiceExerciseFields` — Bilgisayardan Seç / Havuzdan Seç iki ayrı buton var, Havuzdan
  Seç tıklanınca `PoolPicker` açılır ve seçim `options[i]`/`promptImage`'e yazılır
  (regresyon: eski dosya-seçici davranışı bozulmadı)
- "Havuza ekle" satırı — dosya seçilince görünür, kategori seçilmeden buton kapalı,
  tıklanınca doğru `POST` gövdesi gider

**Kapı:**
```
apps/web: npx tsc --noEmit && npx next lint && npx vitest run && npm run build
apps/api: python -m pytest -q && python -m alembic heads
```

**Canlı doğrulama (KURAL #6):** Prod backend'e bağlı dev sunucuda: (1) seed'in gerçekten
çalıştığını — bir kategoriden görsel listelendiğini, (2) bir görsel bilgisayardan yükleyip
havuza eklemeyi, (3) başka bir soruda o görseli Havuzdan Seç ile bulup kullanmayı,
(4) aynı görseli tekrar eklemeye çalışınca dedup'ın çalıştığını doğrula. Test verisi
(eklenen havuz görseli) temizlenemez çünkü silme endpoint'i yok (kapsam dışı kararı) —
bu yüzden **canlı testte gerçek/anlamlı bir görsel** kullanılır (rastgele test verisi
prod havuzunda kalıcı kalacağı için baştan temiz olmalı), ve bu durum kullanıcıya
canlı doğrulamadan ÖNCE açıkça söylenir.

## Riskler

| Risk | Önlem |
|---|---|
| 66 SVG'nin tümü aynı kalitede/tutarlı olmaz | Tek bir basit stil (düz renk, tek path, 64×64 viewBox) sabitlenir, hepsi aynı üretici fonksiyonla yazılır |
| Havuz tablosu zamanla çok büyür (400KB × yüzlerce) | Şimdilik sorun değil (küçük ölçek); ileride sayfalama gerekirse ayrı iş |
| Canlı doğrulamada eklenen test görseli silinemiyor | Yukarıda not edildi — anlamlı/gerçek bir görsel kullanılacak, kullanıcıya önceden söylenecek |
