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
