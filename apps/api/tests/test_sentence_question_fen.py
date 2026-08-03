import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _sentence_ex(**over):
    ex = {
        "type": "sentence_question",
        "instruction": "Hangi kare?",
        "answer_kind": "sentence",
        "options": ["a", "b"],
        "correct_index": 0,
    }
    ex.update(over)
    return ex


def test_gecerli_fen_kabul_edilir():
    _validate_board_exercises([_sentence_ex(fen=BASE_FEN)])


def test_bozuk_fen_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_sentence_ex(fen="bozuk-fen-degeri")])
    assert e.value.status_code == 400


def test_fen_olmadan_da_kabul_edilir():
    _validate_board_exercises([_sentence_ex()])
