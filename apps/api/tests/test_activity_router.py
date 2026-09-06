"""Madde 2026-09-06: Sporcu Profili "Bu Hafta" — /activity/log-time ve
/activity/day-summary uçları."""
import pytest_asyncio
from datetime import date
from chess_api.models import ChildActivityLog


@pytest_asyncio.fixture
async def child_token_id(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "activity_parent@t.com", "password": "guvenli12345", "name": "Parent",
    })
    parent_token = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    await client.post("/auth/device/register",
                      headers={"Authorization": f"Bearer {parent_token}"},
                      json={"device_fingerprint": "actdev", "name": "Test"})
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "actdev",
    })
    return r.json()["access_token"], child_id


async def test_log_time_updates_category(client, child_token_id, db):
    token, child_id = child_token_id
    r = await client.post("/activity/log-time",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"category": "play", "seconds": 90})
    assert r.status_code == 204

    from sqlalchemy import select
    log = (await db.execute(select(ChildActivityLog).where(ChildActivityLog.child_id == child_id))).scalar_one()
    assert log.play_seconds == 90
    assert log.total_seconds == 90


async def test_log_time_invalid_category_rejected(client, child_token_id):
    token, _ = child_token_id
    r = await client.post("/activity/log-time",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"category": "unknown", "seconds": 10})
    assert r.status_code == 400


async def test_log_time_negative_seconds_rejected(client, child_token_id):
    token, _ = child_token_id
    r = await client.post("/activity/log-time",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"category": "play", "seconds": -5})
    assert r.status_code == 422


async def test_day_summary_week_days_has_activity(client, child_token_id, db):
    token, child_id = child_token_id
    # 2026-09 icin: 7 Eylul 2026 Pazartesi (deterministik referans).
    db.add(ChildActivityLog(child_id=child_id, date=date(2026, 9, 7), play_seconds=100))
    db.add(ChildActivityLog(child_id=child_id, date=date(2026, 9, 9), lessons_seconds=50))
    await db.commit()

    r = await client.get("/activity/day-summary?date_str=2026-09-07",
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["week_start"] == "2026-09-07"
    week_map = {d["date"]: d["has_activity"] for d in data["week_days"]}
    assert week_map["2026-09-07"] is True
    assert week_map["2026-09-09"] is True
    assert week_map["2026-09-08"] is False
    assert data["daily"]["play_seconds"] == 100


async def test_day_summary_monthly_same_weekday_sum(client, child_token_id, db):
    token, child_id = child_token_id
    # Eylul 2026'daki TUM Pazartesiler: 7, 14, 21, 28.
    for d, secs in [(7, 100), (14, 200), (21, 300), (28, 400)]:
        db.add(ChildActivityLog(child_id=child_id, date=date(2026, 9, d), play_seconds=secs))
    # Ayni ay, FARKLI gun (Sali) - toplama KATILMAMALI.
    db.add(ChildActivityLog(child_id=child_id, date=date(2026, 9, 8), play_seconds=9999))
    await db.commit()

    r = await client.get("/activity/day-summary?date_str=2026-09-14",
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["monthly"]["play_seconds"] == 100 + 200 + 300 + 400


async def test_day_summary_defaults_to_today(client, child_token_id):
    token, _ = child_token_id
    r = await client.get("/activity/day-summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["date"] == date.today().isoformat()


async def test_day_summary_requires_auth(client):
    r = await client.get("/activity/day-summary")
    assert r.status_code in (401, 403)
