import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _click_square_ex(**over):
    ex = {
        "type": "click_square", "instruction": "e4'e tıkla", "fen": BASE_FEN,
        "target_squares": ["e4"],
    }
    ex.update(over)
    return ex


def _text_item(**over):
    item = {"id": "a1", "kind": "text", "x": 50, "y": 50, "rotation": 0, "color": "#ef4444", "text": "Not", "fontSize": 24}
    item.update(over)
    return item


def _shape_item(**over):
    item = {"id": "a2", "kind": "shape", "shape": "circle", "x": 30, "y": 30, "w": 15, "h": 15, "rotation": 0, "color": "#3b82f6"}
    item.update(over)
    return item


def test_gecerli_annotations_kabul_edilir():
    _validate_board_exercises([_click_square_ex(annotations=[_text_item(), _shape_item()])])


def test_annotations_olmadan_da_kabul_edilir():
    _validate_board_exercises([_click_square_ex()])


def test_gecersiz_renk_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(color="#123456")])])
    assert e.value.status_code == 400


def test_gecersiz_kind_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(kind="video")])])


def test_gecersiz_sekil_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(shape="triangle")])])


def test_x_araligini_asan_deger_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(x=150)])])


def test_dondurme_araligini_asan_deger_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(rotation=400)])])


def test_cok_uzun_yazi_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(text="a" * 201)])])


def test_gecersiz_punto_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(fontSize=5)])])


def test_gecersiz_genislik_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(w=1)])])
