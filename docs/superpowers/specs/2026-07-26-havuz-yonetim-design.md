# P9 — Görsel Havuzu Yönetim Ekranı

**Tarih:** 2026-07-26
**Durum:** Onaylandı (kullanıcı "evet" dedi)

## Amaç

P8'de görsel havuzu kuruldu (ekleme + seçim) ama **silme kasten kapsam dışı bırakılmıştı**.
Sonuç: Zafer Hoca yanlış/bozuk bir görsel eklerse onu havuzdan çıkarmanın hiçbir yolu yok,
kalıcı olarak orada kalıyor ve zamanla havuz kirleniyor. Bu iş o boşluğu kapatır.

## Kullanıcı kararları (bu brainstorming'de alındı)

| Karar | Seçim |
|---|---|
| Silme onayı | **"Emin misin?" sorulacak** — kartlar küçük ve yan yana, yanlış tıklama kolay |
| Ek özellikler | **Yok, sadece silme** — kategori değiştirme, toplu silme, sayı rozeti, bu sayfadan ekleme YOK |
| Konum | Ayrı admin sayfası (`/admin/pool-images`) |

## Kritik bulgu — silme mevcut soruları BOZMAZ

Kod incelendi (`ChoiceExerciseFields.tsx`, `admin.py` soru kaydetme yolu): bir soru
kaydedilirken görselin **data-URI'si sorunun kendi JSON'ına kopyalanıyor**; havuza referans
(foreign key, id) tutulmuyor. Yani:

- Havuzdan bir görseli silmek = "bu görsel bundan sonra seçilemez"
- Onu daha önce kullanan sorular **etkilenmez**, görselleri kendi içlerinde duruyor

Bu, silme özelliğini güvenli kılan yapısal gerçektir (KURAL #3). Uydurulmadı, koddan
doğrulandı.

---

## Backend

**Dosya:** `apps/api/chess_api/routers/admin.py` (değişir)

Tek yeni uç. Mevcut `delete_opening` ile birebir aynı desen:

```python
@router.delete("/pool-images/{image_id}")
async def delete_pool_image(
    image_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    row = await db.get(PoolImage, image_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pool image not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}
```

`admin.py`'nin router'ında zaten `prefix="/admin"` var, yol `/admin/pool-images/{id}` olur.

**Yeni tablo YOK, yeni migration YOK.** `PoolImage` modeli ve `pool_images` tablosu P8'de
oluşturuldu; bu iş yalnızca bir uç ekler.

---

## Frontend

### `poolApi.ts` (değişir)

Tek fonksiyon eklenir, mevcut `addPoolImage` ile aynı hata-yutma deseni:

```ts
/** Görseli havuzdan siler. Başarılıysa true döner. */
export async function deletePoolImage(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/admin/pool-images/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
```

### `app/admin/pool-images/page.tsx` (yeni)

`/admin/openings` sayfasıyla aynı görsel dil (`neon-card`, `n-muted`, admin renkleri).

**Yapı:**
1. Başlık + açıklama: "Havuzdaki görselleri buradan kaldırabilirsin. Bir görseli silmek,
   onu daha önce kullanan soruları etkilemez."
2. 12 kategori düğmesi (yatay sarmalı liste) — `POOL_CATEGORIES`'ten, seçili olan vurgulu
3. Seçili kategorinin görselleri `grid-cols-4` ızgarada; her hücrede:
   - `<img>` (96×96, `objectFit: contain`)
   - Altında **Sil** butonu
4. Sil'e basılınca **o hücrede** butonun yerine satır-içi onay çıkar:
   `Emin misin? [Evet, sil] [Vazgeç]`
   - Aynı anda yalnızca bir hücrede onay açık olabilir (`confirmingId: number | null`)

   **Neden `window.confirm` değil:** Projede `confirm()` kullanılıyor (örn.
   `app/admin/content/page.tsx:46` düzey silmede) — yani yerleşik desene aykırı değil.
   Buna rağmen satır-içi onay tercih ediliyor çünkü: (a) ızgarada onlarca küçük kart var,
   hangi görselin silineceğini metinle anlatmak zor ama satır-içi onay **doğrudan o
   kartın üstünde** çıkar, (b) `window.confirm` happy-dom'da otomatik test edilemez,
   davranış testsiz kalırdı. Bu, mevcut desenden **bilinçli ve gerekçeli** bir sapmadır.
5. Durum metinleri: yükleniyor / kategori seçilmedi / kategori boş / silme başarısız

**State:**
```ts
const [category, setCategory] = useState<string | null>(null);
const [images, setImages] = useState<PoolImage[] | null>(null);
const [loading, setLoading] = useState(false);
const [confirmingId, setConfirmingId] = useState<number | null>(null);
const [msg, setMsg] = useState<string | null>(null);
```

Silme başarılı olunca liste **yeniden çekilmez**, silinen öğe yerel state'ten çıkarılır
(`setImages(prev => prev.filter(...))`) — gereksiz ağ isteği yok, ekran anında güncellenir.

### `app/admin/layout.tsx` (değişir)

NAV_GROUPS'a bir satır: `{ href: '/admin/pool-images', label: 'Görsel Havuzu' }`.
Açılış Listesi'nin yanına, "Sporcu Paneli" grubuna.

---

## Neden PoolPicker'a gömülmedi

`PoolPicker` soru eklerken açılan bir **seçim** panelidir. Oraya silme koymak "seçeyim
derken sildim" riskini yaratır ve panelin tek amacını bulanıklaştırır. Ayrı sayfa = ayrı
niyet. (Kullanıcı da bu seçeneği onayladı.)

---

## Test stratejisi

**Backend (pytest) — `apps/api/tests/test_pool_images.py`'a eklenir:**
- Öğretmen görseli siler → 200, `{"deleted": True}`, liste boşalır
- Tokensiz silme → 401/403
- Olmayan id → 404
- Bir görseli silmek diğerlerini etkilemez (2 ekle, 1 sil, 1 kalır)

**Frontend (vitest):**
- `poolApi` — `deletePoolImage` doğru URL/method/token ile çağırır, ok→true, hata→false
- Sayfa — kategori tıklanınca liste gelir; Sil onay ister (`deletePoolImage` HENÜZ
  çağrılmaz); Vazgeç onayı kapatır ve silmez; Evet siler ve öğe listeden kalkar;
  aynı anda tek onay açık kalır; boş kategori notu görünür

**Kapı:**
```
apps/web: npx tsc --noEmit && npx next lint && npx vitest run && npm run build
apps/api: python -m pytest -q
```
(`alembic heads` gerekmez — yeni migration yok, ama zarar vermez.)

**Canlı doğrulama (KURAL #6):** Prod backend'e bağlı dev sunucuda: sayfayı aç, bir
kategoriyi gez, **P8'in canlı testinde Meslekler kategorisine bırakılan test görselini
gerçekten sil** (böylece hem özellik doğrulanır hem eski kalıntı temizlenir), silme
sonrası `GET /pool-images?category=Meslekler` ile 7→6'ya döndüğünü teyit et. Onay akışının
(Vazgeç'in gerçekten silmediğinin) da canlıda görülmesi gerekir.

## Riskler

| Risk | Önlem |
|---|---|
| Yanlışlıkla silme | Satır-içi "Emin misin?" onayı; aynı anda tek onay açık |
| Silinen görselin eski soruları bozması | Yapısal olarak imkânsız (data-URI kopyalanıyor) — yukarıda doğrulandı |
| Geri alma yok | Bilinçli: çöp kutusu/geri alma kapsam dışı (YAGNI). Onay adımı yeterli koruma. |
| Tohum ikonlarının yanlışlıkla silinmesi | Engellenmez — hoca isterse tohum ikonu da silebilir; gerekirse `python -m scripts.seed_pool_images` tekrar çalıştırılıp geri yüklenir (idempotent) |
