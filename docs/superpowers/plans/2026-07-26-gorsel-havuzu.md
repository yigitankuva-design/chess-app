# P8 — Görsel Havuzu — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin soru ekleme ekranındaki "Görsel seç"i **Bilgisayardan Seç** / **Havuzdan Seç** olarak ikiye ayırmak; 12 kategoriye ayrılmış bir görsel havuzu (tablo + API + seçici bileşen) kurmak; bilgisayardan yüklenen görsellerin isteğe bağlı olarak havuza eklenmesini sağlamak.

**Architecture:** Yeni bir `pool_images` tablosu (id, category, data_uri) + herkese açık `GET /pool-images` + teacher-only `POST /admin/pool-images` (birebir bayt dedup'lu). Ön yüzde tek bir paylaşılan `PoolPicker` bileşeni hem soru görseli hem her şık için kullanılır. Tohum veri ayrı bir seed script ile yüklenir (migration değil) — mevcut `seed_badges.py` desenine birebir uyar.

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic · Next.js 15 / React 19 / TypeScript / Tailwind 3 · pytest · vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-07-26-gorsel-havuzu-design.md`

**KURAL #3 notu:** Migration yalnızca yeni tablo oluşturur; mevcut hiçbir tabloya, sütuna veya veriye dokunulmaz. Sporcu tarafı hiç değişmez — havuz sadece admin panelinde bir seçim kaynağıdır, kaydedilen soru verisinin biçimi (data-URI) aynı kalır.

---

## Dosya Yapısı

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `apps/api/chess_api/pool_categories.py` | 12 kategori sabiti — tek doğruluk kaynağı (backend) | **Yeni** |
| `apps/api/chess_api/models/pool_image.py` | `PoolImage` ORM modeli | **Yeni** |
| `apps/api/chess_api/models/__init__.py` | `PoolImage` export'u | Değişir |
| `apps/api/alembic/versions/20260726_PoolImages_add.py` | `pool_images` tablosu | **Yeni** |
| `apps/api/chess_api/routers/pool_images.py` | Herkese açık `GET /pool-images` | **Yeni** |
| `apps/api/chess_api/routers/admin.py` | `POST /admin/pool-images` (dedup + doğrulama) | Değişir |
| `apps/api/chess_api/main.py` | Router kaydı | Değişir |
| `apps/api/tests/test_pool_images.py` | Backend testleri | **Yeni** |
| `apps/api/scripts/build_pool_data.py` | 66 SVG'yi üretip JSON'a yazan araç | **Yeni** |
| `apps/api/scripts/pool-images-data.json` | Tohum veri (araç tarafından üretilir) | **Yeni (üretilmiş)** |
| `apps/api/scripts/seed_pool_images.py` | JSON'u tabloya yazan idempotent seed | **Yeni** |
| `apps/api/tests/test_pool_seed_data.py` | Tohum verinin bütünlük testleri | **Yeni** |
| `apps/web/lib/admin/poolApi.ts` | Kategori listesi + API istemcisi | **Yeni** |
| `apps/web/components/admin/PoolPicker.tsx` | Kategori sekmeli görsel seçici panel | **Yeni** |
| `apps/web/tests/pool-picker.test.tsx` | `PoolPicker` testleri | **Yeni** |
| `apps/web/components/admin/ChoiceExerciseFields.tsx` | İki buton + havuza-ekle satırı | Değişir |
| `apps/web/tests/choice-exercise-pool.test.tsx` | Entegrasyon + regresyon testleri | **Yeni** |

---

### Task 1: Backend — kategori sabiti, model, migration

**Files:**
- Create: `apps/api/chess_api/pool_categories.py`
- Create: `apps/api/chess_api/models/pool_image.py`
- Modify: `apps/api/chess_api/models/__init__.py`
- Create: `apps/api/alembic/versions/20260726_PoolImages_add.py`
- Test: `apps/api/tests/test_pool_images.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_pool_images.py`:

```python
import pytest

from chess_api.pool_categories import POOL_CATEGORIES

# Küçük ama geçerli bir data-URI (1x1 saydam PNG)
TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
)


def test_kategori_listesi_on_iki_tanedir():
    assert len(POOL_CATEGORIES) == 12


def test_kategori_listesi_kullanicinin_istedigi_adlardir():
    assert POOL_CATEGORIES == [
        "Geometrik Şekiller", "Satranç Tahtası", "Satranç Taşları", "Hayvanlar",
        "Bitkiler", "Taşıtlar", "Gezegenler", "Meslekler", "Gök Cisimleri",
        "Satranç Şampiyonları", "Harfler", "Rakamlar",
    ]


def test_pool_image_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import PoolImage

    assert PoolImage.__tablename__ == "pool_images"
    cols = set(PoolImage.__table__.columns.keys())
    assert cols == {"id", "category", "data_uri"}
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.pool_categories'`

- [ ] **Step 3: Kategori sabitini yaz**

`apps/api/chess_api/pool_categories.py`:

```python
"""Görsel havuzu kategorileri — tek doğruluk kaynağı.

Hem POST /admin/pool-images doğrulaması hem tohum verisi (scripts/) bu listeyi
kullanır. Sıra kullanıcının belirttiği sıradır, UI'da da bu sırayla gösterilir.
"Satranç Şampiyonları" KASTEN tohum verisi olmadan gelir — gerçek kişi
fotoğrafları telif riski taşır, uydurulmaz (KURAL #1); Zafer Hoca kendisi ekler.
"""

POOL_CATEGORIES = [
    "Geometrik Şekiller",
    "Satranç Tahtası",
    "Satranç Taşları",
    "Hayvanlar",
    "Bitkiler",
    "Taşıtlar",
    "Gezegenler",
    "Meslekler",
    "Gök Cisimleri",
    "Satranç Şampiyonları",
    "Harfler",
    "Rakamlar",
]
```

- [ ] **Step 4: Modeli yaz**

`apps/api/chess_api/models/pool_image.py`:

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class PoolImage(Base):
    """Görsel havuzu — soru görseli seçerken kategoriye göre gözatılan görseller.

    Kismen tohum veri (scripts/seed_pool_images.py), kismen Zafer Hoca'nin
    "Bilgisayardan Sec" sonrasi havuza ekledigi kullanici verisidir.

    data_uri Text'tir (String degil): data-URI'ler 400KB'a kadar cikabiliyor.
    """

    __tablename__ = "pool_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(40))
    data_uri: Mapped[str] = mapped_column(Text)
```

- [ ] **Step 5: Modeli `__init__.py`'a kaydet**

`apps/api/chess_api/models/__init__.py` — `from chess_api.models.opening import Opening`
satırının ALTINA ekle:

```python
from chess_api.models.pool_image import PoolImage
```

Ve `__all__` listesinde `"Opening",` satırının ALTINA ekle:

```python
    "PoolImage",
```

- [ ] **Step 6: Migration'ı yaz**

`apps/api/alembic/versions/20260726_PoolImages_add.py`:

```python
"""pool_images tablosu — görsel havuzu

Revision ID: PoolImages
Revises: PlayFeatures

Yalnizca YENI tablo olusturur. Mevcut hicbir tabloya/sutuna/veriye dokunmaz
(KURAL #3). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "PoolImages"
down_revision = "PlayFeatures"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pool_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("data_uri", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pool_images")
```

- [ ] **Step 7: Testlerin geçtiğini ve tek alembic head kaldığını doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q && python -m alembic heads`
Beklenen: 3 test PASS; `alembic heads` çıktısı tek satır: `PoolImages (head)`

- [ ] **Step 8: Migration guard testinin hâlâ geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_migration_guard.py -q`
Beklenen: 2 test PASS (yeni migration müfredat tablolarına dokunmadığı için)

- [ ] **Step 9: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/pool_categories.py apps/api/chess_api/models/pool_image.py apps/api/chess_api/models/__init__.py apps/api/alembic/versions/20260726_PoolImages_add.py apps/api/tests/test_pool_images.py
git commit -m "feat: pool_images tablosu + 12 kategori sabiti"
```

---

### Task 2: Backend — herkese açık `GET /pool-images`

**Files:**
- Create: `apps/api/chess_api/routers/pool_images.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_pool_images.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_pool_images.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_bos_havuz_bos_liste_doner(client):
    r = await client.get("/pool-images")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_havuz_listesi_kimlik_dogrulamasi_gerektirmez(client):
    """Liste admin panelinde token'lı çağrılır ama uç /openings gibi açıktır —
    ayrı bir yetki katmanı eklemenin faydası yok, veri gizli değil."""
    r = await client.get("/pool-images")
    assert r.status_code == 200
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: FAIL — `assert 404 == 200` (uç henüz yok)

- [ ] **Step 3: Router'ı yaz**

`apps/api/chess_api/routers/pool_images.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.pool_image import PoolImage

router = APIRouter(tags=["pool-images"])


@router.get("/pool-images")
async def list_pool_images(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Görsel havuzunu listeler; `category` verilirse yalnızca o kategoriyi döner.

    Kimlik dogrulamasi gerekmez (/openings ve /modules ile ayni desen) — veri
    gizli degil, admin panelinde secim kaynagi olarak kullanilir.
    """
    stmt = select(PoolImage).order_by(PoolImage.id)
    if category:
        stmt = stmt.where(PoolImage.category == category)
    rows = (await db.execute(stmt)).scalars().all()
    return [{"id": p.id, "category": p.category, "data_uri": p.data_uri} for p in rows]
```

- [ ] **Step 4: Router'ı kaydet**

`apps/api/chess_api/main.py` — 5. satırdaki import zincirinin SONUNA
(`openings as openings_router`'dan sonra) ekle:

```python
, pool_images as pool_images_router
```

Ve `app.include_router(openings_router.router)` satırının ALTINA ekle:

```python
    app.include_router(pool_images_router.router)
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: 5 test PASS

- [ ] **Step 6: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/routers/pool_images.py apps/api/chess_api/main.py apps/api/tests/test_pool_images.py
git commit -m "feat: GET /pool-images herkese acik liste ucu"
```

---

### Task 3: Backend — `POST /admin/pool-images` (dedup + doğrulama)

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_pool_images.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_pool_images.py` dosyasının SONUNA ekle:

```python
async def _teacher_token(client, email="pool@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_havuza_gorsel_ekler(client):
    tok = await _teacher_token(client, "pool1@t.com")
    r = await client.post("/admin/pool-images", headers={"Authorization": f"Bearer {tok}"},
                          json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    assert r.status_code == 201
    body = r.json()
    assert body["category"] == "Hayvanlar"
    assert body["created"] is True


@pytest.mark.asyncio
async def test_tokensiz_ekleme_engellenir(client):
    r = await client.post("/admin/pool-images",
                          json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_gecersiz_kategori_reddedilir(client):
    tok = await _teacher_token(client, "pool2@t.com")
    r = await client.post("/admin/pool-images", headers={"Authorization": f"Bearer {tok}"},
                          json={"category": "Uydurma Kategori", "data_uri": TINY_PNG})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_gorsel_olmayan_data_uri_reddedilir(client):
    tok = await _teacher_token(client, "pool3@t.com")
    r = await client.post("/admin/pool-images", headers={"Authorization": f"Bearer {tok}"},
                          json={"category": "Hayvanlar", "data_uri": "bu bir gorsel degil"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cok_buyuk_gorsel_reddedilir(client):
    tok = await _teacher_token(client, "pool4@t.com")
    huge = "data:image/png;base64," + ("A" * 400_001)
    r = await client.post("/admin/pool-images", headers={"Authorization": f"Bearer {tok}"},
                          json={"category": "Hayvanlar", "data_uri": huge})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ayni_gorsel_ikinci_kez_yeni_satir_eklemez(client):
    """Dedup = birebir bayt eslesmesi. Ikinci POST 200 doner ve created=False."""
    tok = await _teacher_token(client, "pool5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    first = await client.post("/admin/pool-images", headers=h,
                              json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    assert first.status_code == 201
    second = await client.post("/admin/pool-images", headers=h,
                               json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["id"] == first.json()["id"]
    listing = await client.get("/pool-images")
    assert len(listing.json()) == 1


@pytest.mark.asyncio
async def test_ayni_gorsel_farkli_kategoride_ayri_kayittir(client):
    tok = await _teacher_token(client, "pool6@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/pool-images", headers=h,
                      json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    await client.post("/admin/pool-images", headers=h,
                      json={"category": "Bitkiler", "data_uri": TINY_PNG})
    listing = await client.get("/pool-images")
    assert len(listing.json()) == 2


@pytest.mark.asyncio
async def test_kategori_filtresi_calisir(client):
    tok = await _teacher_token(client, "pool7@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    await client.post("/admin/pool-images", headers=h,
                      json={"category": "Hayvanlar", "data_uri": TINY_PNG})
    await client.post("/admin/pool-images", headers=h,
                      json={"category": "Bitkiler", "data_uri": TINY_PNG})
    only = await client.get("/pool-images?category=Bitkiler")
    assert [p["category"] for p in only.json()] == ["Bitkiler"]
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: FAIL — yeni 8 testin çoğu `assert 404 == 201` (uç henüz yok)

- [ ] **Step 3: Import ve şemayı ekle**

`apps/api/chess_api/routers/admin.py` — `from chess_api.models.opening import Opening`
satırının ALTINA ekle:

```python
from chess_api.models.pool_image import PoolImage
from chess_api.pool_categories import POOL_CATEGORIES
```

- [ ] **Step 4: Ucu yaz**

`apps/api/chess_api/routers/admin.py` — dosyanın SONUNA (`delete_opening`
fonksiyonundan sonra) ekle:

```python
class PoolImageCreateRequest(BaseModel):
    category: str
    data_uri: str


@router.post("/pool-images")
async def add_pool_image(
    payload: PoolImageCreateRequest,
    response: Response,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Görseli havuza ekler. Aynı kategoride aynı bayt dizisi zaten varsa YENİ
    satır eklenmez, mevcut kayıt döner (created=False).

    Dedup birebir bayt eslesmesidir; gorsel benzerligi tespiti YOKTUR (spec).
    """
    _ensure_admin(current)
    if payload.category not in POOL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")
    _check_data_uri_size(payload.data_uri, "Havuz görseli")

    existing = (
        await db.execute(
            select(PoolImage).where(
                PoolImage.category == payload.category,
                PoolImage.data_uri == payload.data_uri,
            )
        )
    ).scalars().first()
    if existing:
        return {"id": existing.id, "category": existing.category, "created": False}

    row = PoolImage(category=payload.category, data_uri=payload.data_uri)
    db.add(row)
    await db.commit()
    response.status_code = 201
    return {"id": row.id, "category": row.category, "created": True}
```

- [ ] **Step 5: `Response` import'unu ekle**

`apps/api/chess_api/routers/admin.py` — 3. satırdaki fastapi import'una `Response` ekle:

```python
from fastapi import APIRouter, Depends, HTTPException, Body, Response
```

- [ ] **Step 6: Testlerin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_images.py -q`
Beklenen: 13 test PASS

- [ ] **Step 7: Tüm backend testlerinin kırılmadığını doğrula**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS (P7 sonrası 233 + bu plandan 13 = 246 civarı), **sıfır başarısız**

- [ ] **Step 8: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_pool_images.py
git commit -m "feat: POST /admin/pool-images - dedup + kategori/boyut dogrulamasi"
```

---

### Task 4: Tohum veri — 66 SVG ikon üretimi ve seed script

**Files:**
- Create: `apps/api/scripts/build_pool_data.py`
- Create: `apps/api/scripts/pool-images-data.json` (araç tarafından üretilir)
- Create: `apps/api/scripts/seed_pool_images.py`
- Test: `apps/api/tests/test_pool_seed_data.py`

- [ ] **Step 1: Emoji-SVG'nin tarayıcıda GERÇEKTEN göründüğünü doğrula (erken risk kontrolü)**

Aşağıdaki tek dosyayı geçici olarak oluştur:

`apps/web/public/emoji-svg-probe.html`:

```html
<!doctype html>
<h1>Emoji SVG kontrolü</h1>
<p>Aşağıda bir kedi görünüyorsa emoji-SVG çalışıyor, boş kutu/hiçbir şey varsa çalışmıyor.</p>
<img id="probe" width="128" height="128" alt="emoji svg kontrolu">
<script>
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="8" fill="#f4f4f5"/>' +
    '<text x="32" y="46" font-size="40" text-anchor="middle">\u{1F431}</text>' +
    '</svg>';
  document.getElementById('probe').src =
    'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
</script>
```

`preview_start` ile dev sunucuyu başlat (`{ name: "chess-web" }`), `/emoji-svg-probe.html`
adresine git ve **ekran görüntüsü alarak** kedinin görünüp görünmediğini doğrula.

**Sonuç ne olursa olsun bu dosyayı sil** (`rm apps/web/public/emoji-svg-probe.html`) —
üretime sızmasın.

**Kedi GÖRÜNÜYORSA:** Step 2'ye devam et (11 kategori × 6 = 66 ikon).
**Kedi GÖRÜNMÜYORSA:** DUR ve kullanıcıya söyle. Bu durumda tohum verisi yalnızca
şekil/glif tabanlı 5 kategoriye (Geometrik Şekiller, Satranç Tahtası, Satranç Taşları,
Harfler, Rakamlar = 30 ikon) indirilir; 6 resimsel kategori boş bırakılır ve bu durum
kullanıcıya açıkça bildirilir. Uydurup "çalışıyor" DENMEZ (KURAL #1).

- [ ] **Step 2: Üretim aracını yaz**

`apps/api/scripts/build_pool_data.py`:

```python
"""66 tohum ikonunu üretip scripts/pool-images-data.json'a yazar.

Calistirma: python -m scripts.build_pool_data

Ikonlar iki teknikle uretilir:
  1. Sekil tabanli (SVG primitifleri)  — tarayici bagimsiz, kesin calisir
  2. Glif tabanli (<text> icinde karakter) — satranc tasi/harf/rakam icin
     standart Unicode karakterler, emoji kategorileri icin emoji karakterler

SVG'ler ;base64, ile gomulur, ;utf8, ile DEGIL: renk kodlarindaki '#'
karakteri utf8 data-URI'de fragment baslangici sayilir ve gorsel sessizce
bozulur.

"Satranc Sampiyonlari" kategorisi KASTEN bostur — gercek kisi fotografi telif
riski tasir, uydurulmaz (KURAL #1). Zafer Hoca kendisi ekler.
"""
import base64
import json
from pathlib import Path

OUT = Path(__file__).parent / "pool-images-data.json"

CARD = '<rect width="64" height="64" rx="8" fill="#f4f4f5"/>'


def _svg(body: str, color: str = "#334155") -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'{CARD}<g fill="{color}">{body}</g></svg>'
    )


def _uri(svg: str) -> str:
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


def _board(n: int) -> str:
    """n x n dama deseni — beyaz zemin, koyu kareler grup renginden."""
    cell = 48 // n
    parts = ['<rect x="8" y="8" width="48" height="48" fill="#ffffff"/>']
    for r in range(n):
        for c in range(n):
            if (r + c) % 2 == 1:
                parts.append(
                    f'<rect x="{8 + c * cell}" y="{8 + r * cell}" '
                    f'width="{cell}" height="{cell}"/>'
                )
    return "".join(parts)


def _glyph(ch: str, size: int = 40) -> str:
    """Bir karakteri ikon olarak ortalar. Satranc tasi/harf/rakam/emoji icin."""
    return (
        f'<text x="32" y="{32 + size // 3}" font-size="{size}" '
        f'text-anchor="middle" font-family="serif">{ch}</text>'
    )


SHAPES: list[tuple[str, str]] = [
    ("Geometrik Şekiller", '<circle cx="32" cy="32" r="20"/>'),
    ("Geometrik Şekiller", '<rect x="14" y="14" width="36" height="36"/>'),
    ("Geometrik Şekiller", '<polygon points="32,12 52,50 12,50"/>'),
    ("Geometrik Şekiller", '<polygon points="32,10 54,32 32,54 10,32"/>'),
    ("Geometrik Şekiller", '<polygon points="32,10 51,21 51,43 32,54 13,43 13,21"/>'),
    ("Geometrik Şekiller",
     '<polygon points="32,8 39,26 58,26 43,38 49,56 32,45 15,56 21,38 6,26 25,26"/>'),
    ("Satranç Tahtası", _board(2)),
    ("Satranç Tahtası", _board(4)),
    ("Satranç Tahtası", _board(8)),
    ("Satranç Tahtası",
     '<rect x="16" y="16" width="32" height="32" fill="#ffffff" '
     'stroke="#334155" stroke-width="2"/>'),
    ("Satranç Tahtası", '<rect x="16" y="16" width="32" height="32"/>'),
    ("Satranç Tahtası", _board(2) + '<circle cx="32" cy="32" r="6" fill="#ef4444"/>'),
]

# Standart Unicode satranç/harf/rakam karakterleri — emoji DEĞİL, her fontta var.
GLYPHS: list[tuple[str, str]] = [
    ("Satranç Taşları", "♔"), ("Satranç Taşları", "♕"),
    ("Satranç Taşları", "♖"), ("Satranç Taşları", "♗"),
    ("Satranç Taşları", "♘"), ("Satranç Taşları", "♙"),
    ("Harfler", "A"), ("Harfler", "B"), ("Harfler", "C"),
    ("Harfler", "D"), ("Harfler", "E"), ("Harfler", "F"),
    ("Rakamlar", "1"), ("Rakamlar", "2"), ("Rakamlar", "3"),
    ("Rakamlar", "4"), ("Rakamlar", "5"), ("Rakamlar", "6"),
]

# Emoji kategorileri — hepsi TEK kod noktası (ZWJ birleşimi yok, render riski düşük).
EMOJI: list[tuple[str, str]] = [
    ("Hayvanlar", "\U0001F431"), ("Hayvanlar", "\U0001F436"),
    ("Hayvanlar", "\U0001F981"), ("Hayvanlar", "\U0001F418"),
    ("Hayvanlar", "\U0001F426"), ("Hayvanlar", "\U0001F41F"),
    ("Bitkiler", "\U0001F333"), ("Bitkiler", "\U0001F338"),
    ("Bitkiler", "\U0001F335"), ("Bitkiler", "\U0001F343"),
    ("Bitkiler", "\U0001F33E"), ("Bitkiler", "\U0001F344"),
    ("Taşıtlar", "\U0001F697"), ("Taşıtlar", "\U0001F68C"),
    ("Taşıtlar", "\U0001F686"), ("Taşıtlar", "\U0001F680"),
    ("Taşıtlar", "\U0001F6A2"), ("Taşıtlar", "\U0001F6B2"),
    ("Gezegenler", "\U0001F30D"), ("Gezegenler", "\U0001FA90"),
    ("Gezegenler", "\U0001F315"), ("Gezegenler", "\U0001F319"),
    ("Gezegenler", "\U0001F506"), ("Gezegenler", "\U0001F534"),
    ("Meslekler", "\U0001F46E"), ("Meslekler", "\U0001F477"),
    ("Meslekler", "\U0001FA7A"), ("Meslekler", "\U0001F3A8"),
    ("Meslekler", "\U0001F4DA"), ("Meslekler", "\U0001F373"),
    ("Gök Cisimleri", "⭐"), ("Gök Cisimleri", "\U0001F31F"),
    ("Gök Cisimleri", "\U0001F320"), ("Gök Cisimleri", "\U0001F308"),
    ("Gök Cisimleri", "⚡"), ("Gök Cisimleri", "\U0001F30C"),
]


def build() -> list[dict]:
    rows: list[dict] = []
    for category, body in SHAPES:
        rows.append({"category": category, "data_uri": _uri(_svg(body))})
    for category, ch in GLYPHS + EMOJI:
        rows.append({"category": category, "data_uri": _uri(_svg(_glyph(ch)))})
    return rows


if __name__ == "__main__":
    rows = build()
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} ikon yazildi -> {OUT}")
```

- [ ] **Step 3: JSON'u üret**

Çalıştır: `cd apps/api && python -m scripts.build_pool_data`
Beklenen: `66 ikon yazildi -> ...pool-images-data.json`

- [ ] **Step 4: Tohum verisi testini yaz**

`apps/api/tests/test_pool_seed_data.py`:

```python
"""Tohum verinin bütünlük testleri — 66 ikon, doğru kategoriler, geçerli boyut."""
import base64
import json
from pathlib import Path

from chess_api.pool_categories import POOL_CATEGORIES

DATA = Path(__file__).resolve().parents[1] / "scripts" / "pool-images-data.json"
MAX_BYTES = 400_000


def _rows():
    return json.loads(DATA.read_text(encoding="utf-8"))


def test_tohum_dosyasi_vardir():
    assert DATA.exists(), "python -m scripts.build_pool_data ile üretilmeli"


def test_altmis_alti_ikon_vardir():
    assert len(_rows()) == 66


def test_her_kategoride_alti_ikon_vardir_sampiyonlar_haric():
    counts: dict[str, int] = {}
    for row in _rows():
        counts[row["category"]] = counts.get(row["category"], 0) + 1
    assert "Satranç Şampiyonları" not in counts, "Telif riski — kasten boş (KURAL #1)"
    for category in POOL_CATEGORIES:
        if category == "Satranç Şampiyonları":
            continue
        assert counts.get(category) == 6, f"{category}: {counts.get(category)}"


def test_tum_kategoriler_gecerlidir():
    for row in _rows():
        assert row["category"] in POOL_CATEGORIES


def test_tum_data_uriler_base64_svgdir():
    """;utf8, KULLANILMAZ — renk kodundaki '#' fragment sayılıp görseli bozar."""
    for row in _rows():
        assert row["data_uri"].startswith("data:image/svg+xml;base64,")


def test_tum_data_uriler_cozulebilir_ve_svg_icerir():
    for row in _rows():
        b64 = row["data_uri"].split(",", 1)[1]
        svg = base64.b64decode(b64).decode("utf-8")
        assert svg.startswith("<svg"), svg[:40]
        assert svg.endswith("</svg>")


def test_hicbir_ikon_boyut_sinirini_asmaz():
    for row in _rows():
        assert len(row["data_uri"].encode("utf-8")) <= MAX_BYTES


def test_ayni_data_uri_iki_kez_gecmez():
    """Tohum veride birebir tekrar olmamalı — dedup mantığı boşa çalışmasın."""
    seen = {(r["category"], r["data_uri"]) for r in _rows()}
    assert len(seen) == 66
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_seed_data.py -q`
Beklenen: 8 test PASS

- [ ] **Step 6: Seed script'ini yaz**

`apps/api/scripts/seed_pool_images.py`:

```python
"""Görsel havuzu tohum verisini yükler. Idempotent (category+data_uri ile atlar).

Calistirma: python -m scripts.seed_pool_images

Migration DEGILDIR — sema degisikligi migration'da, veri burada (mevcut
seed_badges.py / seed_curriculum.py ile ayni desen).
"""
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from chess_api.database import get_session_factory
from chess_api.models import PoolImage

DATA = Path(__file__).parent / "pool-images-data.json"


async def seed() -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    session_factory = get_session_factory()
    added = 0
    async with session_factory() as db:
        for row in rows:
            existing = await db.execute(
                select(PoolImage).where(
                    PoolImage.category == row["category"],
                    PoolImage.data_uri == row["data_uri"],
                )
            )
            if existing.scalars().first():
                continue
            db.add(PoolImage(category=row["category"], data_uri=row["data_uri"]))
            added += 1
        await db.commit()
    print(f"Havuz tohumlandi: {added} yeni, {len(rows) - added} zaten vardi.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 7: Seed script'inin import edilebildiğini ve verisiyle uyumlu olduğunu doğrula**

`apps/api/tests/test_pool_seed_data.py` dosyasının SONUNA ekle:

```python
def test_seed_scripti_ayni_dosyayi_okur():
    """Seed script ile bu testin okuduğu dosya AYNI olmalı — yol kayarsa
    seed sessizce boş/eski veri yükler."""
    from scripts import seed_pool_images

    assert seed_pool_images.DATA.resolve() == DATA.resolve()


def test_seed_scripti_beklenen_alanlari_kullanir():
    """Script'in okuduğu anahtarlar ile üretilen JSON'un anahtarları uyuşmalı."""
    for row in _rows():
        assert set(row.keys()) == {"category", "data_uri"}
```

Çalıştır: `cd apps/api && python -m pytest tests/test_pool_seed_data.py -q`
Beklenen: 10 test PASS

> **Bilinçli kapsam notu:** Seed script'inin *veritabanına karşı* idempotency'si
> birim testiyle DOĞRULANMIYOR. Sebep: script `get_session_factory()`'yi doğrudan
> çağırır (mevcut `seed_badges.py` / `seed_curriculum.py` ile aynı desen), pytest'in
> `db` fixture'ı bu yolu geçersiz kılmıyor. Aynı atlama davranışı (`select ... where
> category+data_uri` → varsa geç) `POST /admin/pool-images` üzerinde Task 3'te
> testleniyor. Script'in kendi idempotency'si **Task 10 Step 4'te canlıda, script'i
> iki kez çalıştırıp çıktıyı okuyarak** doğrulanır. Bu, spec'in "seed idempotent
> testi" maddesinden bilinçli bir sapmadır ve raporda böyle bildirilir.

- [ ] **Step 8: Backend test paketinin tamamının geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: hepsi PASS, **sıfır başarısız**

- [ ] **Step 9: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/api/scripts/build_pool_data.py apps/api/scripts/pool-images-data.json apps/api/scripts/seed_pool_images.py apps/api/tests/test_pool_seed_data.py
git commit -m "feat: 66 tohum ikonu + idempotent seed script"
```

---

### Task 5: Frontend — `poolApi.ts` (kategori listesi + API istemcisi)

**Files:**
- Create: `apps/web/lib/admin/poolApi.ts`
- Test: `apps/web/tests/pool-api.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/pool-api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POOL_CATEGORIES, fetchPoolImages, addPoolImage } from '@/lib/admin/poolApi';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

const TINY = 'data:image/png;base64,AAAA';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('POOL_CATEGORIES', () => {
  it('on iki kategori vardır ve backend ile AYNI sıradadır', () => {
    expect(POOL_CATEGORIES).toEqual([
      'Geometrik Şekiller', 'Satranç Tahtası', 'Satranç Taşları', 'Hayvanlar',
      'Bitkiler', 'Taşıtlar', 'Gezegenler', 'Meslekler', 'Gök Cisimleri',
      'Satranç Şampiyonları', 'Harfler', 'Rakamlar',
    ]);
  });
});

describe('fetchPoolImages', () => {
  it('kategoriyi URL-kodlayarak sorgular', async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
    global.fetch = spy as never;
    await fetchPoolImages('Gök Cisimleri');
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain('/pool-images?category=');
    expect(url).toContain(encodeURIComponent('Gök Cisimleri'));
  });

  it('gelen listeyi döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => [{ id: 1, category: 'Hayvanlar', data_uri: TINY }],
    })) as never;
    const list = await fetchPoolImages('Hayvanlar');
    expect(list).toHaveLength(1);
    expect(list[0].data_uri).toBe(TINY);
  });

  it('istek başarısızsa boş liste döner (ekran çökmez)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await fetchPoolImages('Hayvanlar')).toEqual([]);
  });

  it('ağ hatası fırlatırsa boş liste döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await fetchPoolImages('Hayvanlar')).toEqual([]);
  });
});

describe('addPoolImage', () => {
  it('token ve doğru gövde ile POST eder', async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ created: true }) }));
    global.fetch = spy as never;
    await addPoolImage('Bitkiler', TINY);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/admin/pool-images');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body as string)).toEqual({
      category: 'Bitkiler', data_uri: TINY,
    });
  });

  it('başarıda true döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ created: true }) })) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(true);
  });

  it('başarısızlıkta false döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(false);
  });

  it('ağ hatası fırlatırsa false döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-api.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/admin/poolApi"`

- [ ] **Step 3: İstemciyi yaz**

`apps/web/lib/admin/poolApi.ts`:

```ts
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Görsel havuzu kategorileri — backend'deki `chess_api/pool_categories.py`
 * listesinin AYNISI ve AYNI SIRADA olmalı. İki dilde iki kopya olmasının
 * sebebi: backend doğrulama yapar, ön yüz seçim listesi gösterir; ortak bir
 * uç ekleyip her açılışta ağ isteği yapmak bu 12 sabit için gereksiz.
 * Biri değişirse ikisi birlikte değişmeli (test bunu kilitliyor).
 */
export const POOL_CATEGORIES = [
  'Geometrik Şekiller',
  'Satranç Tahtası',
  'Satranç Taşları',
  'Hayvanlar',
  'Bitkiler',
  'Taşıtlar',
  'Gezegenler',
  'Meslekler',
  'Gök Cisimleri',
  'Satranç Şampiyonları',
  'Harfler',
  'Rakamlar',
] as const;

export type PoolCategory = (typeof POOL_CATEGORIES)[number];

export interface PoolImage {
  id: number;
  category: string;
  data_uri: string;
}

/** Bir kategorinin görsellerini getirir. Hata durumunda boş liste döner. */
export async function fetchPoolImages(category: string): Promise<PoolImage[]> {
  try {
    const r = await fetch(`${API_BASE}/pool-images?category=${encodeURIComponent(category)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Görseli havuza ekler. Başarılıysa (veya zaten varsa) true döner. */
export async function addPoolImage(category: string, dataUri: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/admin/pool-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ category, data_uri: dataUri }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-api.test.ts`
Beklenen: 9 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/lib/admin/poolApi.ts apps/web/tests/pool-api.test.ts
git commit -m "feat: poolApi istemcisi + kategori listesi"
```

---

### Task 6: Frontend — `PoolPicker` bileşeni

**Files:**
- Create: `apps/web/components/admin/PoolPicker.tsx`
- Test: `apps/web/tests/pool-picker.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/pool-picker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return { ...actual, fetchPoolImages: (c: string) => fetchPoolImages(c) };
});

import { PoolPicker } from '@/components/admin/PoolPicker';

const A = 'data:image/png;base64,AAAA';
const B = 'data:image/png;base64,BBBB';

beforeEach(() => {
  fetchPoolImages.mockReset();
  fetchPoolImages.mockResolvedValue([]);
});

describe('PoolPicker', () => {
  it('on iki kategori düğmesi gösterir', async () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    for (const c of ['Hayvanlar', 'Bitkiler', 'Satranç Şampiyonları', 'Rakamlar']) {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    }
  });

  it('açılışta hiçbir kategori seçili değil, yönlendirme metni görünür', () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/kategori seç/i)).toBeInTheDocument();
    expect(fetchPoolImages).not.toHaveBeenCalled();
  });

  it('kategori tıklanınca o kategori için istek atar', async () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(fetchPoolImages).toHaveBeenCalledWith('Hayvanlar'));
  });

  it('gelen görselleri küçük resim olarak listeler', async () => {
    fetchPoolImages.mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: A },
      { id: 2, category: 'Hayvanlar', data_uri: B },
    ]);
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
  });

  it('görsele tıklanınca onSelect data-URI ile çağrılır ve onClose tetiklenir', async () => {
    fetchPoolImages.mockResolvedValue([{ id: 1, category: 'Hayvanlar', data_uri: A }]);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<PoolPicker onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('img')[0]);
    expect(onSelect).toHaveBeenCalledWith(A);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('boş kategoride yönlendirici not gösterir', async () => {
    fetchPoolImages.mockResolvedValue([]);
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Satranç Şampiyonları' }));
    await waitFor(() =>
      expect(screen.getByText(/henüz görsel yok/i)).toBeInTheDocument(),
    );
  });

  it('yükleme sırasında bilgi verir', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    fetchPoolImages.mockReturnValue(new Promise((res) => { resolveFn = res; }));
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
    resolveFn([]);
    await waitFor(() => expect(screen.queryByText(/yükleniyor/i)).not.toBeInTheDocument());
  });

  it('Kapat düğmesi onClose çağırır', () => {
    const onClose = vi.fn();
    render(<PoolPicker onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-picker.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/admin/PoolPicker"`

- [ ] **Step 3: Bileşeni yaz**

`apps/web/components/admin/PoolPicker.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

interface Props {
  onSelect: (dataUri: string) => void;
  onClose: () => void;
}

/**
 * Kategoriye göre havuzdan görsel seçme paneli.
 *
 * Modal DEĞİL, satır-içi genişleyen panel — admin panelinde hiçbir yerde modal
 * kullanılmıyor (kontrol edildi), tutarlılık için aynı dil.
 */
export function PoolPicker({ onSelect, onClose }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest flex-1">
          Havuzdan Seç
        </p>
        <button type="button" onClick={onClose}
          className="px-2.5 py-1 rounded-md text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Kapat
        </button>
      </div>

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

      {category === null && (
        <p className="text-xs n-muted">Yukarıdan bir kategori seç.</p>
      )}
      {loading && <p className="text-xs n-muted">Yükleniyor...</p>}
      {!loading && images?.length === 0 && (
        <p className="text-xs n-muted">
          Bu kategoride henüz görsel yok. &ldquo;Bilgisayardan Seç&rdquo; ile ekleyip
          havuza kaydedebilirsin.
        </p>
      )}
      {!loading && images && images.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          {images.map((img) => (
            <img
              key={img.id}
              src={img.data_uri}
              alt={`${img.category} havuz görseli`}
              onClick={() => { onSelect(img.data_uri); onClose(); }}
              className="cursor-pointer rounded-md bg-white/5 border border-white/10 hover:border-cyan-400 transition-colors"
              style={{ width: 56, height: 56, objectFit: 'contain' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/pool-picker.test.tsx`
Beklenen: 8 test PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/PoolPicker.tsx apps/web/tests/pool-picker.test.tsx
git commit -m "feat: PoolPicker - kategori sekmeli havuz secici panel"
```

---

### Task 7: Frontend — `ChoiceExerciseFields` iki-buton entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-pool.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/choice-exercise-pool.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
const addPoolImage = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return {
    ...actual,
    fetchPoolImages: (c: string) => fetchPoolImages(c),
    addPoolImage: (c: string, d: string) => addPoolImage(c, d),
  };
});

import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

const POOL_IMG = 'data:image/png;base64,POOL';

beforeEach(() => {
  fetchPoolImages.mockReset();
  addPoolImage.mockReset();
  fetchPoolImages.mockResolvedValue([{ id: 1, category: 'Hayvanlar', data_uri: POOL_IMG }]);
  addPoolImage.mockResolvedValue(true);
});

/** Görüntü sorusu + cevap tipi Görüntü — tüm görsel seçim noktalarını açar. */
function renderImageQuestion() {
  render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Görüntü' }));
}

describe('ChoiceExerciseFields — soru görseli için iki kaynak', () => {
  it('Bilgisayardan Seç ve Havuzdan Seç birlikte gösterilir', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Bilgisayardan Seç')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Havuzdan Seç' })).toBeInTheDocument();
  });

  it('REGRESYON: eski dosya girişi hâlâ var (Bilgisayardan Seç onu tetikler)', () => {
    const { container } = render(
      <ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('Havuzdan Seç panel açar, seçim soru görselini doldurur', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() => {
      const preview = screen.getByAltText('Soru görseli önizleme') as HTMLImageElement;
      expect(preview.src).toBe(POOL_IMG);
    });
  });

  it('seçim sonrası panel kapanır', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument(),
    );
  });
});

describe('ChoiceExerciseFields — şık görselleri için iki kaynak', () => {
  it('her şık için Havuzdan Seç düğmesi vardır', () => {
    renderImageQuestion();
    // 1 soru görseli + 2 şık = 3 adet
    expect(screen.getAllByRole('button', { name: 'Havuzdan Seç' })).toHaveLength(3);
  });

  it('bir şık için havuzdan seçim o şıkkın görselini doldurur', async () => {
    renderImageQuestion();
    const buttons = screen.getAllByRole('button', { name: 'Havuzdan Seç' });
    fireEvent.click(buttons[1]); // 1. şık
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() => {
      const preview = screen.getByAltText('1. şık önizleme') as HTMLImageElement;
      expect(preview.src).toBe(POOL_IMG);
    });
  });

  it('AYNI ANDA TEK PANEL: ikinci Havuzdan Seç ilkini kapatır', async () => {
    renderImageQuestion();
    const buttons = screen.getAllByRole('button', { name: 'Havuzdan Seç' });
    fireEvent.click(buttons[1]);
    expect(screen.getAllByRole('button', { name: 'Kapat' })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Havuzdan Seç' })[2]);
    expect(screen.getAllByRole('button', { name: 'Kapat' })).toHaveLength(1);
  });
});

describe('ChoiceExerciseFields — regresyon', () => {
  it('Cümle sorusunda görsel seçici hiç görünmez', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Havuzdan Seç' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
  });

  it('cevap tipi Cümle iken şıklar metin girişi kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    // varsayılan cevap tipi 'sentence'
    expect(screen.getByPlaceholderText('1. şık')).toBeInTheDocument();
    // yalnızca soru görseli için havuz düğmesi olmalı
    expect(screen.getAllByRole('button', { name: 'Havuzdan Seç' })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-pool.test.tsx`
Beklenen: FAIL — `Unable to find an accessible element with the role "button" and name "Havuzdan Seç"`

- [ ] **Step 3: Import ve panel state'ini ekle**

`apps/web/components/admin/ChoiceExerciseFields.tsx` — dosya başındaki import
bloğuna ekle (`import { DIFFICULTY_LABELS, ... }` satırının ALTINA):

```tsx
import { PoolPicker } from './PoolPicker';
```

Ve `const [saving, setSaving] = useState(false);` satırının ALTINA ekle:

```tsx
  /**
   * Hangi görsel slotu için havuz paneli açık? 'prompt' = soru görseli,
   * sayı = o indeksli şık, null = kapalı. Aynı anda YALNIZCA BİR panel açık
   * olabilir — birden fazla şık için ayrı ayrı panel açılırsa ekran karışır.
   */
  const [openPoolFor, setOpenPoolFor] = useState<'prompt' | number | null>(null);
```

- [ ] **Step 4: Soru görseli bloğunu iki butona çevir**

Aynı dosyada şu bloğu bul:

```tsx
          <input type="file" accept="image/*" className="hidden" id="prompt-image-input"
            onChange={(e) => onPromptImageFile(e.target.files?.[0])} />
          <label htmlFor="prompt-image-input"
            className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
            Görsel seç
          </label>
```

ve TAMAMINI aşağıdakiyle değiştir:

```tsx
          <input type="file" accept="image/*" className="hidden" id="prompt-image-input"
            onChange={(e) => onPromptImageFile(e.target.files?.[0])} />
          <label htmlFor="prompt-image-input"
            className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
            Bilgisayardan Seç
          </label>
          <button type="button"
            onClick={() => setOpenPoolFor((p) => (p === 'prompt' ? null : 'prompt'))}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
            Havuzdan Seç
          </button>
```

- [ ] **Step 5: Soru görseli için paneli render et**

Aynı blokta, `{promptImage && (` ile başlayan önizleme satırının HEMEN ÜSTÜNE ekle:

```tsx
          {openPoolFor === 'prompt' && (
            <PoolPicker
              onSelect={(uri) => setPromptImage(uri)}
              onClose={() => setOpenPoolFor(null)}
            />
          )}
```

- [ ] **Step 6: Şık görseli bloğunu iki butona çevir**

Aynı dosyada şu bloğu bul:

```tsx
              <div className="flex-1 flex items-center gap-2">
                <input type="file" accept="image/*" className="hidden" id={`option-image-${i}`}
                  onChange={(e) => onOptionImageFile(i, e.target.files?.[0])} />
                <label htmlFor={`option-image-${i}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                  {o ? 'Değiştir' : 'Görsel seç'}
                </label>
                {o && <img src={o} alt={`${i + 1}. şık önizleme`} style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />}
              </div>
```

ve TAMAMINI aşağıdakiyle değiştir:

```tsx
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" accept="image/*" className="hidden" id={`option-image-${i}`}
                    onChange={(e) => onOptionImageFile(i, e.target.files?.[0])} />
                  <label htmlFor={`option-image-${i}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                    {o ? 'Değiştir' : 'Bilgisayardan Seç'}
                  </label>
                  <button type="button"
                    onClick={() => setOpenPoolFor((p) => (p === i ? null : i))}
                    className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
                    Havuzdan Seç
                  </button>
                  {o && <img src={o} alt={`${i + 1}. şık önizleme`} style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />}
                </div>
                {openPoolFor === i && (
                  <PoolPicker
                    onSelect={(uri) => setOptions((prev) => prev.map((x, j) => (j === i ? uri : x)))}
                    onClose={() => setOpenPoolFor(null)}
                  />
                )}
              </div>
```

- [ ] **Step 7: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-pool.test.tsx`
Beklenen: 9 test PASS

- [ ] **Step 8: Mevcut ChoiceExerciseFields testlerinin kırılmadığını doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-fields.test.tsx tests/choice-exercise-paste-image.test.tsx`
Beklenen: hepsi PASS.

> **Not:** Bu testlerden biri `getByText('Görsel seç')` gibi ESKİ etikete bakıyorsa
> kırılır. Kırılırsa etiketi `'Bilgisayardan Seç'` olarak güncelle — davranış aynı,
> yalnızca metin değişti. Testi ZAYIFLATMA (silme/skip etme), yalnızca yeni etikete
> güncelle.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/choice-exercise-pool.test.tsx apps/web/tests/choice-exercise-fields.test.tsx apps/web/tests/choice-exercise-paste-image.test.tsx
git commit -m "feat: gorsel secimi Bilgisayardan Sec / Havuzdan Sec olarak ikiye ayrildi"
```

---

### Task 8: Frontend — "Havuza da eklensin mi?" satırı

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-pool.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/choice-exercise-pool.test.tsx` dosyasının SONUNA ekle:

```tsx
describe('ChoiceExerciseFields — havuza da ekle satırı', () => {
  /**
   * Dosya yükleme akışı canvas/Image gerektirdiği için happy-dom'da gerçekten
   * çalışmıyor; bunun yerine havuzdan seçim yapılır — her iki yol da aynı
   * `promptImage` state'ini doldurur, satırın görünme koşulu odur.
   */
  async function pickFromPool() {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Havuzdan Seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() =>
      expect(screen.getByAltText('Soru görseli önizleme')).toBeInTheDocument(),
    );
  }

  it('görsel yokken satır görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByText(/Havuza da eklensin mi/i)).not.toBeInTheDocument();
  });

  it('görsel seçilince satır görünür', async () => {
    await pickFromPool();
    expect(screen.getByText(/Havuza da eklensin mi/i)).toBeInTheDocument();
  });

  it('kategori seçilmeden Havuza Ekle düğmesi kapalıdır', async () => {
    await pickFromPool();
    expect(screen.getByRole('button', { name: 'Havuza Ekle' })).toBeDisabled();
  });

  it('kategori seçilince düğme açılır', async () => {
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    expect(screen.getByRole('button', { name: 'Havuza Ekle' })).toBeEnabled();
  });

  it('Havuza Ekle doğru kategori ve görselle addPoolImage çağırır', async () => {
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(addPoolImage).toHaveBeenCalledWith('Bitkiler', POOL_IMG));
  });

  it('başarıda onay mesajı gösterir', async () => {
    addPoolImage.mockResolvedValue(true);
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(screen.getByText(/havuza eklendi/i)).toBeInTheDocument());
  });

  it('başarısızlıkta hata mesajı gösterir', async () => {
    addPoolImage.mockResolvedValue(false);
    await pickFromPool();
    fireEvent.change(screen.getByLabelText('Havuz kategorisi'), {
      target: { value: 'Bitkiler' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Havuza Ekle' }));
    await waitFor(() => expect(screen.getByText(/eklenemedi/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-pool.test.tsx`
Beklenen: FAIL — yeni 7 testin çoğu `Unable to find an element with the text: /Havuza da eklensin mi/i`

- [ ] **Step 3: State'leri ekle**

`apps/web/components/admin/ChoiceExerciseFields.tsx` — `openPoolFor` state'inin
ALTINA ekle:

```tsx
  /** "Havuza da eklensin mi?" satırı — yalnızca soru görseli için, opsiyonel. */
  const [poolAddCategory, setPoolAddCategory] = useState('');
  const [poolAddMsg, setPoolAddMsg] = useState<string | null>(null);
```

- [ ] **Step 4: `addPoolImage` import'unu ekle**

Aynı dosyada, `import { PoolPicker } from './PoolPicker';` satırının ALTINA ekle:

```tsx
import { POOL_CATEGORIES, addPoolImage } from '@/lib/admin/poolApi';
```

- [ ] **Step 5: Ekleme fonksiyonunu yaz**

Aynı dosyada, `async function onPromptImageFile(` fonksiyonunun ÜSTÜNE ekle:

```tsx
  async function saveToPool() {
    setPoolAddMsg(null);
    const ok = await addPoolImage(poolAddCategory, promptImage);
    setPoolAddMsg(ok ? 'Havuza eklendi ✓' : 'Havuza eklenemedi');
  }
```

- [ ] **Step 6: Satırı render et**

Aynı dosyada, soru görseli bloğundaki `{promptImage && (` önizleme bloğunun HEMEN
ALTINA (aynı `<div className="space-y-2">` içinde, açıklama girişinden ÖNCE) ekle:

```tsx
          {promptImage && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="n-muted">Havuza da eklensin mi?</span>
              <select
                aria-label="Havuz kategorisi"
                value={poolAddCategory}
                onChange={(e) => { setPoolAddCategory(e.target.value); setPoolAddMsg(null); }}
                className="neon-input py-1 text-xs"
              >
                <option value="">Kategori seç</option>
                {POOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={saveToPool} disabled={!poolAddCategory}
                className="px-3 py-1 rounded-lg text-xs bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40">
                Havuza Ekle
              </button>
              {poolAddMsg && <span className="n-muted">{poolAddMsg}</span>}
            </div>
          )}
```

- [ ] **Step 7: Görsel değişince mesajı sıfırla**

Aynı dosyada `onPromptImageFile` fonksiyonunda, `setPromptImage(await compressImageToDataUri(file));`
satırının ALTINA ekle:

```tsx
      setPoolAddMsg(null);
```

Ve soru görseli için `PoolPicker`'ın `onSelect`'ini güncelle (Task 7 Step 5'te eklenen blok):

```tsx
          {openPoolFor === 'prompt' && (
            <PoolPicker
              onSelect={(uri) => { setPromptImage(uri); setPoolAddMsg(null); }}
              onClose={() => setOpenPoolFor(null)}
            />
          )}
```

- [ ] **Step 8: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-pool.test.tsx`
Beklenen: 16 test PASS

- [ ] **Step 9: Commit**

```bash
cd /c/Users/muham/chess-app
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/choice-exercise-pool.test.tsx
git commit -m "feat: yuklenen gorseli opsiyonel olarak havuza ekleme satiri"
```

---

### Task 9: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: Backend**

Çalıştır: `cd apps/api && python -m pytest -q && python -m alembic heads`
Beklenen: hepsi PASS; `alembic heads` tek satır: `PoolImages (head)`

- [ ] **Step 2: TypeScript**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: çıktı yok (hata yok)

- [ ] **Step 3: Lint**

Çalıştır: `cd apps/web && npx next lint`
Beklenen: yalnızca ÖNCEDEN var olan uyarılar (`no-img-element`, `saveScroll`,
`_score`/`_max`). `PoolPicker.tsx` yeni bir `no-img-element` uyarısı ekleyecek —
bu kabul edilebilir çünkü data-URI görsellerde `next/image` kullanılamıyor ve dosyanın
tamamı zaten bu desende (`ChoiceExerciseFields.tsx` de aynı uyarıyı veriyor).
**Yeni bir HATA (error) çıkmamalı.**

- [ ] **Step 4: Tüm frontend testleri**

Çalıştır: `cd apps/web && npx vitest run`
Beklenen: tüm dosyalar PASS. P7 sonrası 385 test vardı; bu plan +33 test getirir
(`pool-api` 9, `pool-picker` 8, `choice-exercise-pool` 16). Toplam **418** olmalı ve
**sıfır başarısız test**.

Sayı tutmazsa panik yok — önemli olan sıfır başarısız. Beklenenden AZ ise bir dosya
çalışmıyor olabilir, kontrol et.

- [ ] **Step 5: Üretim derlemesi**

Çalıştır: `cd apps/web && npm run build`
Beklenen: `✓ Compiled successfully`

- [ ] **Step 6: Commit (yalnızca düzeltme yapıldıysa)**

```bash
cd /c/Users/muham/chess-app
git add -A apps/web apps/api
git commit -m "test: P8 tam test kapisi"
```

Düzeltme gerekmediyse bu adım atlanır.

---

### Task 10: Canlı doğrulama (KURAL #6)

**Files:** yok (tarayıcıda gerçek sürüş)

Bu iş **yeni bir migration ve yeni backend uçları** içeriyor. Bu yüzden canlı
doğrulamadan ÖNCE prod'a push gerekir (Railway `alembic upgrade head` ile tabloyu
oluşturacak) ve tohum script'i prod'da çalıştırılacak.

- [ ] **Step 1: Kullanıcıdan push onayı al**

Kullanıcıya şunları açıkça söyle ve onay bekle:
- Yeni tablo (`pool_images`) prod veritabanına eklenecek (mevcut hiçbir veriye
  dokunulmuyor, yalnızca CREATE TABLE)
- Tohum script'i prod'da çalıştırılacak (66 ikon eklenecek)
- **Havuzdan görsel SİLME özelliği yok** (kapsam dışı kararı) — canlı testte havuza
  eklenen görsel prod'da KALICI kalır. Bu yüzden test için rastgele/anlamsız bir görsel
  değil, gerçekten kullanışlı bir görsel eklenecek.

Onay gelmezse DUR.

- [ ] **Step 2: Push ve CI**

```bash
cd /c/Users/muham/chess-app
git push origin main
```

`gh run list --limit 1` ile CI çalışmasını bul, `gh run watch <id> --exit-status` ile
bekle, `gh run view <id> --json status,conclusion,jobs` ile üç işin de (API, Web, E2E)
`success` olduğunu doğrula.

- [ ] **Step 3: Prod'da migration'ın uygulandığını doğrula**

Çalıştır:
```bash
curl -s "https://chess-app-production-1dab.up.railway.app/pool-images"
```
Beklenen: `[]` (tablo var, henüz tohumlanmadı). `500`/`404` dönerse Railway deploy'unu
bekle ve tekrar dene.

- [ ] **Step 4: Prod'da tohum script'ini çalıştır**

Bu adım prod veritabanına yazar. `DATABASE_URL`'e erişim gerektirir; Railway MCP
araçları veya Railway paneli üzerinden şu komut çalıştırılır:

```bash
python -m scripts.seed_pool_images
```

Beklenen çıktı: `Havuz tohumlandi: 66 yeni, 0 zaten vardi.`

**Sonra script'i İKİNCİ KEZ çalıştır** (idempotency'nin canlı doğrulaması — Task 4
Step 7'de birim testiyle yapılamadı):

```bash
python -m scripts.seed_pool_images
```
Beklenen çıktı: `Havuz tohumlandi: 0 yeni, 66 zaten vardi.`

İkinci çalıştırma `66 yeni` derse **idempotency BOZUK** — DUR, `select ... where
category+data_uri` sorgusunu incele, tekrar tekrar aynı satırları eklemesin.

Sonra satır sayısını doğrula:
```bash
curl -s "https://chess-app-production-1dab.up.railway.app/pool-images?category=Hayvanlar" | head -c 300
```
Beklenen: **6** kayıt içeren JSON (12 değil — ikinci çalıştırma kopya eklememiş olmalı).

> **Bu adım çalıştırılamazsa** (prod'da script koşturma erişimi yoksa) DUR ve kullanıcıya
> söyle: havuz mekanizması çalışır ama boş gelir; hoca kendi görsellerini
> "Bilgisayardan Seç → Havuza Ekle" ile ekleyerek doldurabilir. Uydurup
> "66 ikon eklendi" DEME.

- [ ] **Step 5: Ortamı hazırla ve dev sunucusunu başlat**

`apps/web/.env.local` oluştur:
```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```
**UYARI:** Bu dosya ASLA commit edilmez, doğrulama bitince silinir.

`preview_start` aracını `{ name: "chess-web" }` ile çağır (Bash ile sunucu başlatılmaz).
`preview_logs` ile derlemenin temiz olduğunu doğrula.

- [ ] **Step 6: Emoji ikonlarının GERÇEKTEN göründüğünü doğrula**

`/admin/content` → bir düzey → bir ders → bir alt konu → pratik modu → **Görüntü ekle**
→ **Havuzdan Seç** → **Hayvanlar**. `computer{action:"screenshot"}` ile ekran görüntüsü al.

- Kedi/köpek/aslan emojileri görünüyorsa: emoji-SVG çalışıyor ✓
- Boş kutu/hiçbir şey görünüyorsa: Task 4 Step 1'deki risk gerçekleşmiş demektir —
  bunu **rapora açıkça yaz**, "çalışıyor" deme.

**Geometrik Şekiller** ve **Satranç Tahtası** kategorilerini de kontrol et (bunlar
şekil tabanlı, kesin çalışmalı).

- [ ] **Step 7: Havuzdan seçimin çalıştığını doğrula**

Bir görsele tıkla. Doğrula:
- Panel kapanıyor
- "Soru görseli" önizlemesinde seçilen görsel görünüyor

- [ ] **Step 8: Şık görselleri için de doğrula**

Cevap tipini **Görüntü** yap. Doğrula:
- Her şıkta **Bilgisayardan Seç** ve **Havuzdan Seç** birlikte var
- Bir şık için Havuzdan Seç → görsel seç → o şıkkın önizlemesi doluyor
- İkinci bir şık için Havuzdan Seç açılınca ilki kapanıyor (tek panel kuralı)

- [ ] **Step 9: "Havuza Ekle" akışını doğrula**

Bilgisayardan gerçek bir görsel seç (Step 1'de anlaşıldığı gibi anlamlı bir görsel).
Doğrula:
- "Havuza da eklensin mi?" satırı görünüyor
- Kategori seçmeden "Havuza Ekle" kapalı
- Kategori seçince açılıyor, tıklayınca "Havuza eklendi ✓" çıkıyor
- Aynı görseli aynı kategoriye tekrar eklemeyi dene → yine "Havuza eklendi ✓" çıkar
  (backend dedup ettiği için yeni satır oluşmaz)
- Havuzdan Seç → o kategori → eklenen görselin listede olduğunu doğrula

Ardından `curl -s ".../pool-images?category=<kategori>"` ile satır sayısının
**yalnızca 1 arttığını** doğrula (dedup çalıştı).

- [ ] **Step 10: Regresyon — Cümle Ekle bozulmadı**

**Cümle ekle** seç. Doğrula:
- Hiçbir yerde "Havuzdan Seç" yok
- Soru cümlesi girişi ve şık metin girişleri eskisi gibi çalışıyor

`read_console_messages` ile konsol hatası olmadığını doğrula.

- [ ] **Step 11: Temizlik**

- `apps/web/.env.local` dosyasını **sil**
- `preview_stop` ile sunucuyu durdur
- Havuza eklenen görsel prod'da KALIR (silme özelliği yok) — bu Step 1'de kullanıcıya
  söylenmiş olmalı, raporda tekrar hatırlat

- [ ] **Step 12: Dürüst rapor yaz**

Neyin tarayıcıda **gerçekten** görüldüğünü, neyin yalnızca otomatik testle doğrulandığını
açıkça ayır. Özellikle şu iki noktayı net söyle:
1. Emoji ikonları gerçekten göründü mü, görünmedi mi?
2. Prod tohumlama yapılabildi mi, yapılamadıysa havuz boş mu geldi?

Doğrulanamayan hiçbir şey için "çalışıyor" DENMEZ (KURAL #1). Rapor CLAUDE.md'deki
ekip ağzıyla yazılır.

---

## Kapsam Notları

- Havuz **yönetim ekranı (silme/düzenleme) YOK** — kullanıcı kararı, kapsam dışı.
- **Otomatik kategori tahmini YOK** — görüntü-anlama modeli yok, kategori hoca seçer.
- **Dedup birebir bayt eşleşmesi** — görsel benzerliği tespiti yok.
- **"Satranç Şampiyonları" tohum verisi YOK** — telif riski (KURAL #1), hoca kendisi ekler.
- **"Cümle Ekle" bölümüne dokunulmuyor.**
- **Sporcu tarafı değişmiyor** — kaydedilen soru verisinin biçimi (data-URI) aynı.
