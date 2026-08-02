import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

# e4'te beyaz sah, a1'de beyaz kale; digerleri BOS.
BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _ex(**over):
    ex = {
        "type": "click_piece",
        "instruction": "Beyaz şaha tıkla",
        "fen": BASE_FEN,
        "piece_squares": ["e4"],
    }
    ex.update(over)
    return ex


def test_gecerli_soru_kabul_edilir():
    _validate_board_exercises([_ex()])


def test_birden_fazla_tas_kabul_edilir():
    _validate_board_exercises([_ex(piece_squares=["e4", "a1"])])


def test_bos_liste_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=[])])


def test_bos_kare_reddedilir():
    # h8 bos — bu tipin cevabi TAS olmali.
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(piece_squares=["h8"])])
    assert "taş yok" in e.value.detail


def test_ayni_kare_iki_kez_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=["e4", "e4"])])


def test_gecersiz_kare_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=["z9"])])


def test_liste_olmayan_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares="e4")])


def test_talimatsiz_soru_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(instruction="   ")])
