from chess_api.services.presence import (
    PRESENCE_TTL_SECONDS, touch, active_count, active_players, _reset_for_tests,
)

import pytest


@pytest.fixture(autouse=True)
def _clean():
    _reset_for_tests()
    yield
    _reset_for_tests()


def test_ttl_altmis_saniyedir():
    assert PRESENCE_TTL_SECONDS == 60.0


def test_bos_sistemde_sayi_sifirdir():
    assert active_count(exclude=None, now=1000.0) == 0


def test_tek_sporcu_kendini_saymaz():
    touch(1, "Ali", now=1000.0)
    assert active_count(exclude=1, now=1000.0) == 0


def test_iki_sporcu_birbirini_gorur():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1000.0) == 1
    assert active_count(exclude=2, now=1000.0) == 1


def test_ayni_sporcu_iki_kez_ping_atarsa_bir_kez_sayilir():
    touch(1, "Ali", now=1000.0)
    touch(1, "Ali", now=1005.0)
    touch(2, "Veli", now=1005.0)
    assert active_count(exclude=2, now=1005.0) == 1


def test_zaman_asimi_gecmis_sporcu_sayilmaz():
    """61 saniye once ping atmis sporcu artik aktif degildir (sleep YOK)."""
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1061.0) == 0


def test_sinir_tam_altmis_saniye_hala_sayilir():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1060.0) == 1


def test_sinir_altmis_virgul_bir_saniye_sayilmaz():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_count(exclude=1, now=1060.1) == 0


def test_ping_tazeleyince_sporcu_yeniden_aktif_olur():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    touch(2, "Veli", now=1050.0)          # Veli tazeledi
    assert active_count(exclude=1, now=1055.0) == 1


def test_active_players_isim_ve_id_doner():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    rows = active_players(exclude=1, now=1000.0)
    assert rows == [{"child_id": 2, "display_name": "Veli"}]


def test_active_players_zaman_asimini_filtreler():
    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1000.0)
    assert active_players(exclude=1, now=1061.0) == []


def test_touch_eski_kayitlari_temizler():
    """Sozluk sinirsiz buyumesin — touch sirasinda suresi gecenler atilir."""
    from chess_api.services import presence

    touch(1, "Ali", now=1000.0)
    touch(2, "Veli", now=1200.0)          # Ali'nin suresi coktan gecti
    assert 1 not in presence._seen
    assert 2 in presence._seen


async def _child_token(client, email: str, name: str, device: str) -> str:
    """Veli hesabi acar, cocuk ekler, cihaz kaydeder, cocuk token'i doner.

    Akis tests/conftest.py:58 'child_auth' fixture'indan BIREBIR alindi
    (dogrulandi): parent signup -> /children -> /auth/device/register ->
    /auth/child/pin. Hazir fixture kullanilmiyor cunku bu testler IKI ayri
    cocuk gerektiriyor (birbirini saymalilar), fixture ise tek cocuk doner.
    """
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Veli",
    })
    parent_token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {parent_token}"}

    r = await client.post("/children", headers=h,
                          json={"display_name": name, "age": 10, "pin": "1234"})
    child_id = r.json()["id"]

    await client.post("/auth/device/register", headers=h,
                      json={"device_fingerprint": device, "name": "Test"})

    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": device,
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_tokensiz_ping_reddedilir(client):
    r = await client.post("/presence/ping")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_tek_sporcu_ping_atinca_sayi_sifirdir(client):
    """Kendisi haric sayilir — tek sporcu varsa 0 gorur."""
    tok = await _child_token(client, "p1@t.com", "Ali", "dev1")
    r = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json() == {"count": 0}


@pytest.mark.asyncio
async def test_iki_sporcu_ping_atinca_birbirini_sayar(client):
    tok1 = await _child_token(client, "p2@t.com", "Ali", "dev2")
    tok2 = await _child_token(client, "p3@t.com", "Veli", "dev3")

    await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok1}"})
    r2 = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok2}"})
    assert r2.json() == {"count": 1}

    r1 = await client.post("/presence/ping", headers={"Authorization": f"Bearer {tok1}"})
    assert r1.json() == {"count": 1}
