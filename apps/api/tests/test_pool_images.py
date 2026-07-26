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
