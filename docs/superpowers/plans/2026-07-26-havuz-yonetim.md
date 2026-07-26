# P9 — Görsel Havuzu Yönetim Ekranı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer Hoca'nın havuza eklediği bir görseli silebilmesi — tek yeni backend ucu (`DELETE /admin/pool-images/{id}`) ve tek yeni admin sayfası (`/admin/pool-images`).

**Architecture:** Mevcut `DELETE /admin/openings/{id}` deseni birebir kopyalanır. Ön yüzde `poolApi.ts`'e tek fonksiyon eklenir, yeni sayfa `PoolPicker`'ın kategori-gezme mantığını tekrar kullanmaz (o bir seçim bileşeni) ama aynı görsel dili kullanır. Silme satır-içi "Emin misin?" onayı ister.

**Tech Stack:** FastAPI + SQLAlchemy 2 async · Next.js 15 / React 19 / TypeScript / Tailwind 3 · pytest · vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-07-26-havuz-yonetim-design.md`

**Yeni tablo YOK, yeni migration YOK.** P8'de oluşturulan `pool_images` tablosu kullanılır. Silme mevcut soruları bozmaz — soru kaydedilirken data-URI'nin kendisi kopyalanıyor, havuz id'si referans tutulmuyor (`ChoiceExerciseFields.tsx:114` ile doğrulandı).

---

## Dosya Yapısı

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `apps/api/chess_api/routers/admin.py` | `DELETE /admin/pool-images/{id}` | Değişir |
| `apps/api/tests/test_pool_images.py` | Silme testleri | Değişir |
| `apps/web/lib/admin/poolApi.ts` | `deletePoolImage(id)` | Değişir |
| `apps/web/tests/pool-api.test.ts` | İstemci testleri | Değişir |
| `apps/web/app/admin/pool-images/page.tsx` | Yönetim sayfası | **Yeni** |
| `apps/web/tests/admin-pool-images-page.test.tsx` | Sayfa testleri | **Yeni** |
| `apps/web/app/admin/layout.tsx` | Yan menüye link | Değişir |

---

### Task 1: Backend — `DELETE /admin/pool-images/{id}`

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_pool_images.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_pool_images.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_ogretmen_havuzdan_gorsel_siler(client):
    tok = await _teacher_token(client, "pooldel1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/pool-images", headers=h,
                                json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    image_id = created.json()["id"]

    r = await client.delete(f"/admin/pool-images/{image_id}", headers=h)
    assert r.status_code == 200
    assert r.json() == {"deleted": True}

    listing = await client.get("/pool-images")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_tokensiz_silme_engellenir(client):
    tok = await _teacher_token(client, "pooldel2@t.com")
    created = await client.post("/admin/pool-images",
                                headers={"Authorization": f"Bearer {tok}"},
                                json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    image_id = created.json()["id"]

    r = await client.delete(f"/admin/pool-images/{image_id}")
    assert r.status_code in (401, 403)

    # Silinmemiş olmalı
    listing = await client.get("/pool-images")
    assert len(listing.json()) == 1


@pytest.mark.asyncio
async def test_olmayan_gorsel_silinmeye_calisilirsa_404(client):
    tok = await _teacher_token(client, "pooldel3@t.com")
    r = await client.delete("/admin/pool-images/999999",
                            headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bir_gorseli_silmek_digerlerini_etkilemez(client):
    """İki kayıt ekle, birini sil — diğeri yerinde kalmalı.

    Dedup (category, data_uri) ÇİFTİ üzerinden çalıştığı için aynı görseli iki
    FARKLI kategoriye eklemek iki ayrı satır üretir — sahte bir ikinci görsel
    uydurmaya gerek yok.
    """
    tok = await _teacher_token(client, "pooldel4@t.com")
    h = {"Authorization": f"Bearer {tok}"}

    first = await client.post("/admin/pool-images", headers=h,
                              json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    second = await client.post("/admin/pool-images", headers=h,
                               json={"category": "Bitkiler", "data_uri": TINY_PNG})
    assert first.json()["id"] != second.json()["id"]

    await client.delete(f"/admin/pool-images/{first.json()['id']}", headers=h)

    listing = await client.get("/pool-images")
    remaining = listing.json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == second.json()["id"]
    assert remaining[0]["category"] == "Bitkiler"
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: FAIL — 4 yeni test, çoğu `assert 405 == 200` (uç yok, method not allowed)

- [ ] **Step 3: Ucu yaz**

`apps/api/chess_api/routers/admin.py` — dosyanın SONUNA (`add_pool_image`
fonksiyonundan sonra) ekle:

```python
@router.delete("/pool-images/{image_id}")
async def delete_pool_image(
    image_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Görseli havuzdan siler.

    Bu islem mevcut sorulari BOZMAZ: soru kaydedilirken gorselin data-URI'si
    sorunun kendi JSON'ina kopyalanir, havuz id'si referans tutulmaz. Silme
    yalnizca "bu gorsel bundan sonra secilemez" anlamina gelir.
    """
    _ensure_admin(current)
    row = await db.get(PoolImage, image_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pool image not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: 17 test PASS (13 mevcut + 4 yeni)

- [ ] **Step 5: Tüm backend testlerinin kırılmadığını doğrula**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS (P8 sonrası 256 + 4 = 260 civarı), **sıfır başarısız**

- [ ] **Step 6: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_pool_images.py
git commit -m "feat: DELETE /admin/pool-images/{id}"
```

---

### Task 2: Frontend — `deletePoolImage` istemcisi

**Files:**
- Modify: `apps/web/lib/admin/poolApi.ts`
- Test: `apps/web/tests/pool-api.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/pool-api.test.ts` — dosya başındaki import satırını değiştir:

```ts
import { POOL_CATEGORIES, fetchPoolImages, addPoolImage, deletePoolImage } from '@/lib/admin/poolApi';
```

Ve dosyanın SONUNA ekle:

```ts
describe('deletePoolImage', () => {
  it('doğru URL, method ve token ile DELETE eder', async () => {
    const spy = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => ({ deleted: true }) }));
    global.fetch = spy as never;
    await deletePoolImage(42);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/admin/pool-images/42');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('başarıda true döner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ deleted: true }) })) as never;
    expect(await deletePoolImage(1)).toBe(true);
  });

  it('başarısızlıkta false döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await deletePoolImage(1)).toBe(false);
  });

  it('ağ hatası fırlatırsa false döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await deletePoolImage(1)).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-api.test.ts`
Beklenen: FAIL — `deletePoolImage is not a function`

- [ ] **Step 3: Fonksiyonu yaz**

`apps/web/lib/admin/poolApi.ts` — dosyanın SONUNA ekle:

```ts
/**
 * Görseli havuzdan siler. Başarılıysa true döner.
 *
 * Bu işlem mevcut soruları bozmaz — soru kaydedilirken görselin data-URI'si
 * sorunun içine kopyalanır, havuza referans tutulmaz.
 */
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

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-api.test.ts`
Beklenen: 13 test PASS (9 mevcut + 4 yeni)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/lib/admin/poolApi.ts apps/web/tests/pool-api.test.ts
git commit -m "feat: deletePoolImage istemcisi"
```

---

### Task 3: Frontend — yönetim sayfası

**Files:**
- Create: `apps/web/app/admin/pool-images/page.tsx`
- Test: `apps/web/tests/admin-pool-images-page.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/admin-pool-images-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
const deletePoolImage = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return {
    ...actual,
    fetchPoolImages: (c: string) => fetchPoolImages(c),
    deletePoolImage: (id: number) => deletePoolImage(id),
  };
});

import AdminPoolImagesPage from '@/app/admin/pool-images/page';

const A = 'data:image/png;base64,AAAA';
const B = 'data:image/png;base64,BBBB';

beforeEach(() => {
  fetchPoolImages.mockReset();
  deletePoolImage.mockReset();
  fetchPoolImages.mockResolvedValue([
    { id: 1, category: 'Hayvanlar', data_uri: A },
    { id: 2, category: 'Hayvanlar', data_uri: B },
  ]);
  deletePoolImage.mockResolvedValue(true);
});

/** Kategoriyi seçip görsellerin yüklenmesini bekler. */
async function openCategory(name = 'Hayvanlar') {
  render(<AdminPoolImagesPage />);
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
}

describe('Admin Görsel Havuzu sayfası', () => {
  it('on iki kategori düğmesi gösterir', () => {
    render(<AdminPoolImagesPage />);
    for (const c of ['Hayvanlar', 'Bitkiler', 'Satranç Şampiyonları', 'Rakamlar']) {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    }
  });

  it('açılışta kategori seçili değildir, istek atılmaz', () => {
    render(<AdminPoolImagesPage />);
    expect(fetchPoolImages).not.toHaveBeenCalled();
    expect(screen.getByText(/kategori seç/i)).toBeInTheDocument();
  });

  it('kategori tıklanınca o kategorinin görselleri listelenir', async () => {
    await openCategory();
    expect(fetchPoolImages).toHaveBeenCalledWith('Hayvanlar');
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('boş kategoride bilgi notu gösterir', async () => {
    fetchPoolImages.mockResolvedValue([]);
    render(<AdminPoolImagesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Satranç Şampiyonları' }));
    await waitFor(() =>
      expect(screen.getByText(/bu kategoride görsel yok/i)).toBeInTheDocument(),
    );
  });

  it('ONAY: Sil tıklanınca HENÜZ silmez, önce onay sorar', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    expect(deletePoolImage).not.toHaveBeenCalled();
    expect(screen.getByText(/emin misin/i)).toBeInTheDocument();
  });

  it('Vazgeç onayı kapatır ve silmez', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(deletePoolImage).not.toHaveBeenCalled();
    expect(screen.queryByText(/emin misin/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('"Evet, sil" doğru id ile siler ve görsel listeden kalkar', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(deletePoolImage).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
  });

  it('AYNI ANDA TEK ONAY: ikinci Sil ilk onayı kapatır', async () => {
    await openCategory();
    const silButtons = screen.getAllByRole('button', { name: 'Sil' });
    fireEvent.click(silButtons[0]);
    expect(screen.getAllByText(/emin misin/i)).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    expect(screen.getAllByText(/emin misin/i)).toHaveLength(1);
  });

  it('silme başarısız olursa hata mesajı gösterir ve görsel listede kalır', async () => {
    deletePoolImage.mockResolvedValue(false);
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(screen.getByText(/silinemedi/i)).toBeInTheDocument());
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('silmenin soruları bozmadığını açıklayan not vardır', () => {
    render(<AdminPoolImagesPage />);
    expect(screen.getByText(/soruları etkilemez/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/admin-pool-images-page.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/app/admin/pool-images/page"`

- [ ] **Step 3: Sayfayı yaz**

`apps/web/app/admin/pool-images/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages, deletePoolImage } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

/**
 * Görsel havuzu yönetimi — kategorileri gez, yanlış/bozuk görseli sil.
 *
 * Silme SATIR-ICI onay ister (window.confirm degil): izgarada onlarca kucuk
 * kart var, hangisinin silinecegini metinle anlatmak zor; ayrica window.confirm
 * happy-dom'da test edilemez. Ayni anda yalnizca BIR onay acik olabilir.
 */
export default function AdminPoolImagesPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    setConfirmingId(null);
    setMsg(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  async function remove(id: number) {
    setMsg(null);
    const ok = await deletePoolImage(id);
    if (!ok) {
      setMsg('Görsel silinemedi');
      setConfirmingId(null);
      return;
    }
    // Listeyi yeniden çekmek yerine yerel state'ten çıkar — gereksiz ağ isteği yok.
    setImages((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setConfirmingId(null);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold n-text text-lg">Görsel Havuzu</h2>
      <p className="text-xs n-muted">
        Soru eklerken &ldquo;Havuzdan Seç&rdquo; ile kullanılan görseller. Yanlış veya
        bozuk bir görseli buradan kaldırabilirsin. Bir görseli silmek, onu daha önce
        kullanan <b>soruları etkilemez</b> — o sorular görseli kendi içlerinde saklar.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {POOL_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => pick(c)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
              category === c
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {msg && <p className="text-rose-400 text-sm">{msg}</p>}

      {category === null && (
        <p className="text-xs n-muted">Yukarıdan bir kategori seç.</p>
      )}
      {loading && <p className="text-xs n-muted">Yükleniyor...</p>}
      {!loading && images?.length === 0 && (
        <p className="text-xs n-muted">Bu kategoride görsel yok.</p>
      )}

      {!loading && images && images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="neon-card p-2 space-y-2 flex flex-col items-center">
              <img src={img.data_uri} alt={`${img.category} havuz görseli`}
                className="rounded-md bg-white/5"
                style={{ width: 96, height: 96, objectFit: 'contain' }} />
              {confirmingId === img.id ? (
                <div className="w-full space-y-1">
                  <p className="text-[0.7rem] text-center n-muted">Emin misin?</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => remove(img.id)}
                      className="flex-1 px-2 py-1 rounded-md text-[0.7rem] bg-rose-400/20 text-rose-200 border border-rose-400/50">
                      Evet, sil
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)}
                      className="flex-1 px-2 py-1 rounded-md text-[0.7rem] bg-white/5 text-white/80 border border-white/15">
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingId(img.id)}
                  className="w-full px-2 py-1 rounded-md text-[0.7rem] bg-rose-400/10 text-rose-300 border border-rose-400/40 hover:bg-rose-400/20">
                  Sil
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/admin-pool-images-page.test.tsx`
Beklenen: 10 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/app/admin/pool-images/page.tsx apps/web/tests/admin-pool-images-page.test.tsx
git commit -m "feat: admin gorsel havuzu yonetim sayfasi"
```

---

### Task 4: Yan menüye link

**Files:**
- Modify: `apps/web/app/admin/layout.tsx`

- [ ] **Step 1: Linki ekle**

`apps/web/app/admin/layout.tsx` — `{ href: '/admin/openings', label: 'Açılış Listesi' },`
satırının ALTINA ekle:

```tsx
      { href: '/admin/pool-images', label: 'Görsel Havuzu' },
```

- [ ] **Step 2: Sayfanın gerçekten derlendiğini doğrula**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: çıktı yok (hata yok)

- [ ] **Step 3: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/app/admin/layout.tsx
git commit -m "feat: yan menuye Gorsel Havuzu linki"
```

---

### Task 5: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: Backend**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS, **sıfır başarısız**

- [ ] **Step 2: TypeScript**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: çıktı yok

- [ ] **Step 3: Lint**

Çalıştır: `cd apps/web && npx next lint`
Beklenen: yalnızca ÖNCEDEN var olan uyarılar. Yeni sayfa bir `no-img-element`
uyarısı ekleyecek — kabul edilebilir (data-URI görsellerde `next/image`
kullanılamıyor, `PoolPicker.tsx` ve `ChoiceExerciseFields.tsx` de aynı uyarıyı
veriyor). **Yeni bir HATA (error) çıkmamalı.**

- [ ] **Step 4: Tüm frontend testleri**

Çalıştır: `cd apps/web && npx vitest run`
Beklenen: tüm dosyalar PASS. P8 sonrası 418 test vardı; bu plan +14 getirir
(`pool-api` +4, `admin-pool-images-page` +10). Toplam **432** olmalı,
**sıfır başarısız**.

- [ ] **Step 5: Üretim derlemesi**

Çalıştır: `cd apps/web && npm run build`
Beklenen: `✓ Compiled successfully`

- [ ] **Step 6: Commit (yalnızca düzeltme yapıldıysa)**

```bash
cd /c/Users/muham/chess-app
git add -A apps/web apps/api
git commit -m "test: P9 tam test kapisi"
```

Düzeltme gerekmediyse bu adım atlanır.

---

### Task 6: Canlı doğrulama (KURAL #6)

**Files:** yok (tarayıcıda gerçek sürüş)

Bu iş **yeni bir backend ucu** içeriyor, bu yüzden canlı doğrulamadan önce prod'a push
gerekir. Yeni migration YOK — Railway yalnızca kodu deploy eder, şema değişmez.

- [ ] **Step 1: Kullanıcıdan push onayı al**

Kullanıcıya açıkça söyle ve onay bekle:
- Yeni bir silme ucu prod'a çıkacak (`DELETE /admin/pool-images/{id}`)
- Yeni tablo/migration YOK, mevcut veriye dokunulmuyor
- Canlı testte **P8'in bıraktığı test görseli silinecek** (Meslekler kategorisindeki
  7. görsel) — yani bu sefer prod'da kalıntı bırakılmayacak, tersine temizlenecek

Onay gelmezse DUR.

- [ ] **Step 2: Push ve CI**

```bash
cd /c/Users/muham/chess-app
git push origin main
```

`gh run list --limit 1` ile çalışmayı bul, `gh run watch <id> --exit-status` ile bekle,
`gh run view <id> --json status,conclusion,jobs` ile üç işin de (API, Web, E2E)
`success` olduğunu doğrula.

- [ ] **Step 3: Prod'da ucun yayında olduğunu doğrula**

Silme öncesi mevcut durumu kaydet:
```bash
curl -s "https://chess-app-production-1dab.up.railway.app/pool-images?category=Meslekler" | grep -o '"id"' | wc -l
```
Beklenen: `7` (6 tohum + P8'in test görseli)

- [ ] **Step 4: Ortamı hazırla ve dev sunucusunu başlat**

`apps/web/.env.local` oluştur:
```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```
**UYARI:** Bu dosya ASLA commit edilmez, doğrulama bitince silinir.

`preview_start` aracını `{ name: "chess-web" }` ile çağır (Bash ile sunucu başlatılmaz).
`preview_logs` ile derlemenin temiz olduğunu doğrula.

- [ ] **Step 5: Sayfayı aç ve yan menü linkini doğrula**

`/admin/pool-images` adresine git. Doğrula:
- Başlık "Görsel Havuzu" ve "soruları etkilemez" açıklaması görünüyor
- 12 kategori düğmesi var
- Yan menüde "Görsel Havuzu" linki var (`/admin/openings`'in altında)

- [ ] **Step 6: Kategori gezmeyi doğrula**

**Hayvanlar**'a tıkla → 6 görsel ızgarada görünmeli, her birinin altında **Sil**.
**Satranç Şampiyonları**'na tıkla → "Bu kategoride görsel yok." notu görünmeli.

- [ ] **Step 7: ONAY akışını doğrula (Vazgeç)**

**Meslekler**'e tıkla → 7 görsel görünmeli. Bir görselin **Sil**'ine bas. Doğrula:
- O kartta "Emin misin?" + "Evet, sil" / "Vazgeç" çıkıyor
- **Vazgeç**'e bas → onay kapanıyor, görsel HÂLÂ orada (7 görsel)

`curl` ile de doğrula: sayı hâlâ **7** olmalı (Vazgeç gerçekten silmedi).

- [ ] **Step 8: Gerçek silmeyi doğrula — P8 kalıntısını temizle**

**Önce test görselini KESİN olarak belirle.** Gözle ayırt etmeye çalışma — kesin bir
ayırt edici var: tohum ikonlarının hepsi `data:image/svg+xml;base64,` ile başlar
(scripts/build_pool_data.py öyle üretti), P8'de yüklenen test görseli ise
`compressImageToDataUri`'den geçtiği için `data:image/jpeg;base64,` ile başlar.

Tarayıcı konsolunda (javascript_tool) çalıştır:

```js
fetch('https://chess-app-production-1dab.up.railway.app/pool-images?category=Meslekler')
  .then(r => r.json())
  .then(rows => JSON.stringify(rows.map(r => ({ id: r.id, prefix: r.data_uri.slice(0, 24) }))));
```

Beklenen: 7 satır — 6 tanesi `data:image/svg+xml;b`, 1 tanesi `data:image/jpeg;base6`.
**Silinecek olan, jpeg olan tek satırdır.** Onun id'sini not al.

Sayfada o id'ye karşılık gelen kartın **Sil** → **Evet, sil**'ine bas. Doğrula:
- Görsel ızgaradan anında kalkıyor (6 görsel kaldı)
- Hata mesajı çıkmıyor

`curl` ile teyit et:
```bash
curl -s "https://chess-app-production-1dab.up.railway.app/pool-images?category=Meslekler" | grep -o '"id"' | wc -l
```
Beklenen: **6**

> **jpeg ile başlayan satır bulunamazsa** (örn. birden fazla ya da hiç yoksa) DUR ve
> kullanıcıya sor. Tahminle tohum ikonu silme. Yanlışlıkla tohum silinirse
> `python -m scripts.seed_pool_images` (idempotent) ile geri gelir, ama önce sorulmalı.

- [ ] **Step 9: Regresyon — havuz seçimi hâlâ çalışıyor**

`/admin/content` → bir düzey → bir ders → alt konu → pratik modu → **Görüntü ekle** →
**Havuzdan Seç** → **Meslekler**. Doğrula:
- 6 görsel listeleniyor (silinen artık yok)
- Bir görsele tıklayınca soru görseli doluyor

`read_console_messages` ile konsol hatası olmadığını doğrula.

- [ ] **Step 10: Temizlik**

- `apps/web/.env.local` dosyasını **sil**
- `preview_stop` ile sunucuyu durdur
- `git status` ile başıboş dosya kalmadığını doğrula

- [ ] **Step 11: Dürüst rapor yaz**

Neyin tarayıcıda **gerçekten** görüldüğünü, neyin yalnızca otomatik testle doğrulandığını
açıkça ayır. Özellikle: Vazgeç'in gerçekten silmediği ve gerçek silmenin gerçekten
sildiği (curl sayılarıyla) belirtilmeli. Doğrulanamayan hiçbir şey için "çalışıyor"
DENMEZ (KURAL #1). Rapor CLAUDE.md'deki ekip ağzıyla yazılır.

---

## Kapsam Notları

- **Yalnızca silme** — kategori değiştirme, toplu silme, sayaç rozeti, bu sayfadan
  görsel ekleme: hepsi kapsam dışı (kullanıcı kararı).
- **Geri alma / çöp kutusu yok** — onay adımı yeterli koruma sayıldı (YAGNI).
- **Yeni tablo / migration YOK** — P8'in `pool_images` tablosu kullanılıyor.
- **Sporcu tarafı değişmiyor** — havuz yalnızca admin panelinde bir kaynak.
- **Tohum ikonları da silinebilir** — engellenmiyor; gerekirse
  `python -m scripts.seed_pool_images` (idempotent) ile geri yüklenir.
