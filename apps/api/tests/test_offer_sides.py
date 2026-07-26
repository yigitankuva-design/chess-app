import pytest
from chess_api.services.offer_sides import resolve_sides

OWNER, TAKER = 10, 20


def test_teklif_beyaz_ise_sahibi_beyaz_olur():
    assert resolve_sides("white", OWNER, TAKER, coin=True) == (OWNER, TAKER)
    # coin degeri 'white'ta HIC kullanilmaz
    assert resolve_sides("white", OWNER, TAKER, coin=False) == (OWNER, TAKER)


def test_teklif_siyah_ise_kabul_eden_beyaz_olur():
    assert resolve_sides("black", OWNER, TAKER, coin=True) == (TAKER, OWNER)
    assert resolve_sides("black", OWNER, TAKER, coin=False) == (TAKER, OWNER)


def test_rastgele_cekilise_baglidir():
    assert resolve_sides("random", OWNER, TAKER, coin=True) == (OWNER, TAKER)
    assert resolve_sides("random", OWNER, TAKER, coin=False) == (TAKER, OWNER)


def test_gecersiz_renk_valueerror():
    with pytest.raises(ValueError):
        resolve_sides("mor", OWNER, TAKER, coin=True)
