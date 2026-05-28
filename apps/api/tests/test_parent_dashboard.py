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


async def test_surveys_empty_initially(client):
    token, _ = await _parent_with_child(client)
    r = await client.get("/parent/surveys", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []


async def test_respond_to_survey(client, db):
    from chess_api.models import ParentSurvey
    token, cid = await _parent_with_child(client)
    # seed a survey directly
    survey = ParentSurvey(title="Memnuniyet", questions_json=[{"q": "Beğendiniz mi?"}], created_by_teacher_id=1)
    db.add(survey)
    await db.commit()
    await db.refresh(survey)

    # appears in list
    lst = await client.get("/parent/surveys", headers={"Authorization": f"Bearer {token}"})
    assert any(s["id"] == survey.id for s in lst.json())

    # respond
    r = await client.post(f"/parent/surveys/{survey.id}/respond",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"answers": {"q1": "Evet"}, "child_id": cid})
    assert r.status_code == 200
    assert r.json()["submitted"] is True

    # now excluded from list
    lst2 = await client.get("/parent/surveys", headers={"Authorization": f"Bearer {token}"})
    assert all(s["id"] != survey.id for s in lst2.json())

    # duplicate response rejected
    dup = await client.post(f"/parent/surveys/{survey.id}/respond",
                            headers={"Authorization": f"Bearer {token}"},
                            json={"answers": {"q1": "Evet"}})
    assert dup.status_code == 409


async def test_delete_child(client, child_auth):
    child_token, child_id = child_auth
    # Get parent token using the credentials set up by child_auth fixture
    r = await client.post("/auth/login", json={"email": "childauth@t.com", "password": "guvenli12345"})
    parent_token = r.json()["access_token"]

    # Delete the child
    r = await client.delete(
        f"/parent/children/{child_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # Child should no longer appear in parent's children list
    r = await client.get(
        "/parent/children",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    children = r.json()
    assert not any(c["id"] == child_id for c in children)


async def test_delete_child_forbidden_for_other_parent(client, child_auth):
    _, child_id = child_auth
    # Second parent tries to delete first parent's child
    r = await client.post("/auth/parent/signup", json={
        "email": "hacker@t.com", "password": "guvenli12345", "name": "Hacker",
    })
    token2 = r.json()["access_token"]
    r = await client.delete(
        f"/parent/children/{child_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert r.status_code == 403
