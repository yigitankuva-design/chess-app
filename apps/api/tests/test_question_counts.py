import pytest
from fastapi import HTTPException

from chess_api.models.module import LessonStepType
from chess_api.routers.admin import _validate_step_content

BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _exercise(**over):
    ex = {
        "type": "click_square", "instruction": "e4'e tıkla", "fen": BASE_FEN,
        "target_squares": ["e4"],
    }
    ex.update(over)
    return ex


def _content(count, pool_size, field="board_exercises"):
    return {
        "title": "x",
        field: [_exercise() for _ in range(pool_size)],
        "question_counts": {field: count},
    }


def test_havuz_kadar_veya_azsa_kabul_edilir():
    _validate_step_content(LessonStepType.explanation, _content(5, 5))
    _validate_step_content(LessonStepType.explanation, _content(3, 5))


def test_havuzdan_fazla_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_step_content(LessonStepType.explanation, _content(10, 5))
    assert e.value.status_code == 400


def test_question_counts_olmadan_da_kabul_edilir():
    _validate_step_content(LessonStepType.explanation, {"title": "x", "board_exercises": []})


def test_sifir_veya_negatif_reddedilir():
    with pytest.raises(HTTPException):
        _validate_step_content(LessonStepType.explanation, _content(0, 5))
    with pytest.raises(HTTPException):
        _validate_step_content(LessonStepType.explanation, _content(-1, 5))


def test_tam_sayi_olmayan_deger_reddedilir():
    with pytest.raises(HTTPException):
        _validate_step_content(LessonStepType.explanation, _content(2.5, 5))


def test_uc_alan_da_ayri_ayri_dogrulanir():
    content = {
        "title": "x",
        "board_exercises": [_exercise() for _ in range(3)],
        "board_exercises_timed": [_exercise() for _ in range(2)],
        "question_counts": {"board_exercises": 3, "board_exercises_timed": 5},
    }
    with pytest.raises(HTTPException):
        _validate_step_content(LessonStepType.explanation, content)
