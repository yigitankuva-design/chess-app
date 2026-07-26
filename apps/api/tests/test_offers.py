import pytest
from chess_api.services.offers import (
    create_offer, cancel_offer, list_offers, take_offer, my_offer, _reset_for_tests,
)


def _make(child_id=1, name="Ayse", color="white"):
    return create_offer(
        child_id=child_id, display_name=name, tempo="Yildirim",
        tc_label="5+0", tc_base=300, tc_increment=0, color=color,
    )


def setup_function():
    _reset_for_tests()


def test_olusturulan_teklif_listede_gorunur():
    _make()
    offers = list_offers(exclude=None)
    assert len(offers) == 1
    assert offers[0]["display_name"] == "Ayse"
    assert offers[0]["tc_label"] == "5+0"
    assert offers[0]["color"] == "white"


def test_ayni_cocugun_ikinci_teklifi_ustune_yazar():
    _make(child_id=1, color="white")
    _make(child_id=1, color="black")
    offers = list_offers(exclude=None)
    assert len(offers) == 1
    assert offers[0]["color"] == "black"


def test_exclude_kendi_teklifini_gizler():
    _make(child_id=1)
    _make(child_id=2, name="Mehmet")
    offers = list_offers(exclude=1)
    assert [o["child_id"] for o in offers] == [2]


def test_take_offer_teklifi_dondurur_ve_panodan_siler():
    _make(child_id=1)
    taken = take_offer(1)
    assert taken is not None and taken["child_id"] == 1
    assert list_offers(exclude=None) == []


def test_take_offer_ikinci_cagride_none_doner():
    """YARIS DURUMU: iki sporcu ayni teklife bassa yalnizca biri alir."""
    _make(child_id=1)
    assert take_offer(1) is not None
    assert take_offer(1) is None


def test_cancel_offer_siler_ve_olmayan_icin_hata_vermez():
    _make(child_id=1)
    cancel_offer(1)
    assert list_offers(exclude=None) == []
    cancel_offer(999)  # patlamamali


def test_gecersiz_renk_valueerror():
    with pytest.raises(ValueError):
        _make(color="mor")


def test_my_offer_kendi_teklifini_dondurur():
    """Sunucu herkese KENDI teklifi HARIC liste gonderir; sporcunun kendi
    teklifini gorebilmesi icin ayri bir kapi gerekir."""
    _make(child_id=1)
    assert my_offer(1)["tc_label"] == "5+0"
    assert my_offer(2) is None
