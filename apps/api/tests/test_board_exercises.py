import pytest
from chess_api.models.module import Module, Lesson


async def _teacher_token(client, email="be@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


async def _lesson(db, order=1):
    m = Module(order_index=order, name=f"M{order}", description="d", icon="pawn")
    db.add(m)
    await db.commit()
    await db.refresh(m)
    les = Lesson(module_id=m.id, order_index=1, title="Ders", estimated_minutes=10, published=False)
    db.add(les)
    await db.commit()
    await db.refresh(les)
    return les


async def _post_step(client, tok, lesson_id, exercises):
    return await client.post(
        f"/admin/lessons/{lesson_id}/steps",
        headers={"Authorization": f"Bearer {tok}"},
        json={"type": "explanation",
              "content_json": {"title": "T", "body": "b", "board_exercises": exercises}},
    )


@pytest.mark.asyncio
async def test_kingless_teaching_positions_accepted(client, db):
    """EN KRİTİK: Zafer'in gerçek FEN'leri şahsız — reddedilmemeli (is_valid kullanılmamalı)."""
    les = await _lesson(db, order=40)
    tok = await _teacher_token(client, email="be1@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "Koyu kareye tikla",
         "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1", "c3"]},
        {"type": "move_piece", "instruction": "Piyonu e4'e tasi",
         "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1", "piece_square": "e2", "target_squares": ["e4"]},
        {"type": "identify_piece", "instruction": "Bu tas ne?",
         "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1", "highlight_square": "e4",
         "options": ["Piyon", "At"], "correct_index": 1},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_explanation_without_exercises_still_ok(client, db):
    les = await _lesson(db, order=41)
    tok = await _teacher_token(client, email="be2@t.com")
    r = await client.post(f"/admin/lessons/{les.id}/steps",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"type": "explanation", "content_json": {"title": "T", "body": "b"}})
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_unparseable_fen_rejected(client, db):
    les = await _lesson(db, order=42)
    tok = await _teacher_token(client, email="be3@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "bu-fen-degil", "target_squares": ["a1"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_empty_instruction_rejected(client, db):
    les = await _lesson(db, order=43)
    tok = await _teacher_token(client, email="be4@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": ["a1"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_click_square_bad_targets_rejected(client, db):
    les = await _lesson(db, order=44)
    tok = await _teacher_token(client, email="be5@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": []},
    ])
    assert r.status_code == 400
    r2 = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
         "target_squares": ["z9"]},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_move_piece_validations(client, db):
    les = await _lesson(db, order=45)
    tok = await _teacher_token(client, email="be6@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1",
         "piece_square": "a1", "target_squares": ["a2"]},
    ])
    assert r.status_code == 400
    r2 = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "8/8/8/8/8/8/4P3/8 w - - 0 1",
         "piece_square": "e2", "target_squares": ["h8"]},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_promotion_move_rejected(client, db):
    """Terfi {from,to} ile ifade edilemiyor -> legal bulunmaz -> 400."""
    les = await _lesson(db, order=46)
    tok = await _teacher_token(client, email="be7@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "move_piece", "instruction": "x", "fen": "k7/4P3/8/8/8/8/8/4K3 w - - 0 1",
         "piece_square": "e7", "target_squares": ["e8"]},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_identify_piece_validations(client, db):
    les = await _lesson(db, order=47)
    tok = await _teacher_token(client, email="be8@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "e4", "options": ["A", "B"], "correct_index": 5},
    ])
    assert r.status_code == 400
    r2 = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "e4", "options": ["A"], "correct_index": 0},
    ])
    assert r2.status_code == 400
    r3 = await _post_step(client, tok, les.id, [
        {"type": "identify_piece", "instruction": "x", "fen": "8/8/8/8/4n3/8/8/8 b - - 0 1",
         "highlight_square": "a1", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r3.status_code == 400


@pytest.mark.asyncio
async def test_unknown_exercise_type_rejected(client, db):
    les = await _lesson(db, order=48)
    tok = await _teacher_token(client, email="be9@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sarki_soyle", "instruction": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1"},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_timed_and_test_mode_fields_accepted_and_validated(client, db):
    """3 pratik modu (board_exercises / _timed / _test) ayrı listelerde saklanır ve doğrulanır."""
    les = await _lesson(db, order=71)
    tok = await _teacher_token(client, email="be_modes@t.com")
    valid = {"type": "click_square", "instruction": "Koyu kareye tikla",
             "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1"]}
    # Üç mod da geçerli veriyle kabul edilir
    r = await client.post(
        f"/admin/lessons/{les.id}/steps",
        headers={"Authorization": f"Bearer {tok}"},
        json={"type": "explanation", "content_json": {
            "title": "T", "body": "b",
            "board_exercises": [valid],
            "board_exercises_timed": [valid],
            "board_exercises_test": [valid],
        }},
    )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_invalid_exercise_in_timed_mode_rejected(client, db):
    """Süreli mod listesindeki geçersiz soru da reddedilmeli (doğrulama tüm modlara uygulanır)."""
    les = await _lesson(db, order=72)
    tok = await _teacher_token(client, email="be_timedbad@t.com")
    r = await client.post(
        f"/admin/lessons/{les.id}/steps",
        headers={"Authorization": f"Bearer {tok}"},
        json={"type": "explanation", "content_json": {
            "title": "T", "body": "b",
            "board_exercises_timed": [
                {"type": "click_square", "instruction": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1"]},
            ],
        }},
    )
    assert r.status_code == 400


from chess_api.routers.admin import _check_data_uri_size
from fastapi import HTTPException


def test_data_uri_size_check_accepts_small_image():
    small = "data:image/jpeg;base64," + ("A" * 100)
    _check_data_uri_size(small, "Test görseli")  # exception atmamalı


def test_data_uri_size_check_rejects_oversized_image():
    huge = "data:image/jpeg;base64," + ("A" * 500_000)
    with pytest.raises(HTTPException) as exc:
        _check_data_uri_size(huge, "Test görseli")
    assert exc.value.status_code == 400


def test_data_uri_size_check_rejects_non_data_uri():
    with pytest.raises(HTTPException) as exc:
        _check_data_uri_size("https://example.com/img.png", "Test görseli")
    assert exc.value.status_code == 400


def test_data_uri_size_check_rejects_non_string():
    with pytest.raises(HTTPException):
        _check_data_uri_size(None, "Test görseli")


@pytest.mark.asyncio
async def test_sentence_question_accepted(client, db):
    les = await _lesson(db, order=90)
    tok = await _teacher_token(client, email="be_sentence@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "Atın hareket şekli nasıldır?",
         "answer_kind": "sentence", "options": ["L şeklinde", "Düz çizgide"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_sentence_question_without_text_rejected(client, db):
    les = await _lesson(db, order=91)
    tok = await _teacher_token(client, email="be_sentence2@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_requires_prompt_image(client, db):
    les = await _lesson(db, order=92)
    tok = await _teacher_token(client, email="be_image@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_accepted_with_empty_instruction(client, db):
    """Görüntü sorusunda instruction opsiyonel — boş olabilir."""
    les = await _lesson(db, order=93)
    tok = await _teacher_token(client, email="be_image2@t.com")
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_choice_question_bad_option_count_rejected(client, db):
    les = await _lesson(db, order=94)
    tok = await _teacher_token(client, email="be_optcount@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["Tek"], "correct_index": 0},
    ])
    assert r.status_code == 400
    r2 = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["1", "2", "3", "4", "5"], "correct_index": 0},
    ])
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_bad_correct_index_rejected(client, db):
    les = await _lesson(db, order=95)
    tok = await _teacher_token(client, email="be_ci@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 5},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_invalid_answer_kind_rejected(client, db):
    les = await _lesson(db, order=96)
    tok = await _teacher_token(client, email="be_ak@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "video", "options": ["A", "B"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_empty_sentence_option_rejected(client, db):
    les = await _lesson(db, order=97)
    tok = await _teacher_token(client, email="be_empty@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "sentence", "options": ["A", ""], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_choice_question_oversized_option_image_rejected(client, db):
    les = await _lesson(db, order=98)
    tok = await _teacher_token(client, email="be_optimg@t.com")
    huge_img = "data:image/jpeg;base64," + ("A" * 500_000)
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "sentence_question", "instruction": "x",
         "answer_kind": "image", "options": [huge_img, small_img], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_mixed_board_and_choice_types_in_same_pool_accepted(client, db):
    """Konum + Cümle + Görüntü soruları aynı havuzda karışık kabul edilmeli."""
    les = await _lesson(db, order=99)
    tok = await _teacher_token(client, email="be_mixed@t.com")
    small_img = "data:image/jpeg;base64," + ("A" * 100)
    r = await _post_step(client, tok, les.id, [
        {"type": "click_square", "instruction": "Koyu kareye tikla",
         "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "target_squares": ["a1"]},
        {"type": "sentence_question", "instruction": "Atın hareketi?",
         "answer_kind": "sentence", "options": ["L şeklinde", "Düz"], "correct_index": 0},
        {"type": "image_question", "instruction": "", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["A", "B"], "correct_index": 1},
    ])
    assert r.status_code == 201
