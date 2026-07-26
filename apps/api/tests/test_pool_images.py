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
