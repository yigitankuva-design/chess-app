import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "7k/8/8/8/8/8/8/K7 w - - 0 1"


def _ex(**over):
    ex = {
        "type": "place_pieces",
        "instruction": "Veziri mat karesine koy",
        "fen": BASE_FEN,
        "pieces": [{"piece": "Q", "square": "h5"}],
    }
    ex.update(over)
    return ex


def test_gecerli_soru_kabul_edilir():
    _validate_board_exercises([_ex()])


def test_birden_fazla_tas_kabul_edilir():
    _validate_board_exercises([
        _ex(pieces=[{"piece": "Q", "square": "h5"}, {"piece": "N", "square": "c6"}])
    ])


def test_bos_tas_listesi_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(pieces=[])])
    assert e.value.status_code == 400


def test_dolu_kare_reddedilir():
    # a1'de beyaz sah var (BASE_FEN) — eksik tasin karesi BOS olmali.
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(pieces=[{"piece": "Q", "square": "a1"}])])
    assert "dolu" in e.value.detail


def test_ayni_kare_iki_kez_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([
            _ex(pieces=[{"piece": "Q", "square": "h5"}, {"piece": "R", "square": "h5"}])
        ])
    assert e.value.status_code == 400


def test_gecersiz_kare_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "Q", "square": "z9"}])])


def test_gecersiz_tas_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "X", "square": "h5"}])])


def test_bos_string_tas_reddedilir():
    # TUZAK: "" in "KQRBNP..." Python'da True doner — uzunluk kontrolu SART.
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=[{"piece": "", "square": "h5"}])])


def test_tas_yerine_sozluk_olmayan_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(pieces=["Qh5"])])


def test_talimatsiz_soru_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(instruction="  ")])


def test_zorluk_duzeyi_dogrulanir():
    _validate_board_exercises([_ex(difficulty=3)])
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(difficulty=9)])
