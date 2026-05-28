async def _parent_with_child(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "pd@t.com", "password": "guvenli12345", "name": "Veli",
    })
    token = r.json()["access_token"]
    rc = await client.post("/children", headers={"Authorization": f"Bearer {token}"},
                           json={"display_name": "Ali", "age": 10, "pin": "1234"})
    return token, rc.json()["id"]


async def test_parent_list_children(client):
    token, _ = await _parent_with_child(client)
    r = await client.get("/parent/children", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_child_summary(client):
    token, cid = await _parent_with_child(client)
    r = await client.get(f"/parent/children/{cid}/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["child_id"] == cid
    assert data["lessons_completed"] == 0
    assert data["activity_7days"] == []
    assert data["rank_name"] == "Piyon"


async def test_set_time_limit(client):
    token, cid = await _parent_with_child(client)
    r = await client.post(f"/parent/children/{cid}/time-limit",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"daily_minutes": 45})
    assert r.status_code == 200
    assert r.json()["daily_minutes"] == 45
    # verify it shows in summary
    s = await client.get(f"/parent/children/{cid}/summary", headers={"Authorization": f"Bearer {token}"})
    assert s.json()["daily_minutes_limit"] == 45


async def test_cannot_access_other_parents_child(client):
    token1, cid1 = await _parent_with_child(client)
    # second parent
    r = await client.post("/auth/parent/signup", json={
        "email": "other@t.com", "password": "guvenli12345", "name": "Other",
    })
    token2 = r.json()["access_token"]
    resp = await client.get(f"/parent/children/{cid1}/summary",
                            headers={"Authorization": f"Bearer {token2}"})
    assert resp.status_code == 403
