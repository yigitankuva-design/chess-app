import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from chess_api.services.srs import update_card, SRSResult
from chess_api.models import SRSCard, SRSItemType


# ===== Algorithm Tests (Pure Function) =====

def test_first_correct_review_sets_1_day():
    new_state = update_card(interval_days=0, ease_factor=2.5, reps_count=0, result=SRSResult.correct)
    assert new_state["interval_days"] == 1.0
    assert new_state["reps_count"] == 1
    assert new_state["last_result"] == "correct"


def test_second_correct_advances_to_3_days():
    new_state = update_card(interval_days=1.0, ease_factor=2.5, reps_count=1, result=SRSResult.correct)
    assert new_state["interval_days"] == 3.0
    assert new_state["reps_count"] == 2


def test_third_correct_advances_to_7_days():
    new_state = update_card(interval_days=3.0, ease_factor=2.5, reps_count=2, result=SRSResult.correct)
    assert new_state["interval_days"] == 7.0


def test_fourth_correct_uses_ease_factor():
    new_state = update_card(interval_days=7.0, ease_factor=2.5, reps_count=3, result=SRSResult.correct)
    assert new_state["interval_days"] == pytest.approx(7.0 * 2.5)


def test_wrong_resets_interval():
    new_state = update_card(interval_days=14.0, ease_factor=2.5, reps_count=5, result=SRSResult.wrong)
    assert new_state["interval_days"] == 0.0
    assert new_state["reps_count"] == 0
    assert new_state["last_result"] == "wrong"


def test_wrong_reduces_ease_factor_with_floor():
    new_state = update_card(interval_days=14.0, ease_factor=1.4, reps_count=5, result=SRSResult.wrong)
    assert new_state["ease_factor"] >= 1.3  # floor


def test_due_at_is_in_future_on_correct():
    before = datetime.utcnow()
    new_state = update_card(interval_days=0, ease_factor=2.5, reps_count=0, result=SRSResult.correct)
    after = datetime.utcnow()
    assert new_state["due_at"] > before
    assert new_state["due_at"] <= after + timedelta(days=2)  # within ~1 day + small margin


# ===== Endpoint Tests =====

async def _parent_token_and_id(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "srs@t.com", "password": "guvenli12345", "name": "SRS",
    })
    data = r.json()
    return data["access_token"], data["user_id"]


async def test_due_endpoint_empty(client):
    token, _ = await _parent_token_and_id(client)
    response = await client.get("/srs/due", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


async def test_review_card_flow(client, db):
    token, principal_id = await _parent_token_and_id(client)
    # Seed a due card for this principal
    card = SRSCard(
        child_id=principal_id, item_type=SRSItemType.puzzle, item_id=1,
        due_at=datetime.utcnow() - timedelta(hours=1),
        interval_days=0.0, ease_factor=2.5, reps_count=0,
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)

    # It should appear in due
    due = await client.get("/srs/due", headers={"Authorization": f"Bearer {token}"})
    assert due.status_code == 200
    assert len(due.json()) == 1

    # Review correct
    resp = await client.post(
        f"/srs/{card.id}/review",
        headers={"Authorization": f"Bearer {token}"},
        json={"result": "correct"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated"] is True
    assert "next_due_at" in data
