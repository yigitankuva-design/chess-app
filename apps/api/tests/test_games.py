from chess_api.services.game_validation import validate_move


# --- Pure validation unit tests ---

INITIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def test_validate_legal_move():
    res = validate_move(INITIAL, "e2e4")
    assert res is not None
    assert res["san"] == "e4"
    assert res["is_game_over"] is False


def test_validate_illegal_move():
    assert validate_move(INITIAL, "e2e5") is None


def test_validate_detects_checkmate():
    # Fool's mate position: after 1.f3 e5 2.g4 Qh4#
    fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    res = validate_move(fen, "d8h4")
    assert res is not None
    assert res["is_checkmate"] is True
    assert res["is_game_over"] is True


# --- Endpoint tests ---

async def test_start_bot_game_requires_child_token(client):
    """A request with no token should be rejected."""
    response = await client.post("/games/bot/start", json={"skill_level": 5})
    assert response.status_code in (401, 403)


async def test_parent_token_rejected_on_games(client):
    """A parent token must be rejected with 401 (child token required)."""
    r = await client.post("/auth/parent/signup", json={
        "email": "gameparent@test.com", "password": "guvenliSifre1", "name": "GameParent",
    })
    parent_token = r.json()["access_token"]
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 401


async def test_start_bot_game(client, child_auth):
    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert "game_id" in data
    assert data["your_color"] == "white"
    assert data["fen"] == INITIAL


async def test_start_bot_game_invalid_skill(client, child_auth):
    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 50},
    )
    assert response.status_code == 422


async def test_make_legal_move(client, child_auth):
    token, child_id = child_auth
    start = await client.post("/games/bot/start",
                              headers={"Authorization": f"Bearer {token}"},
                              json={"skill_level": 3})
    gid = start.json()["game_id"]
    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e2e4"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] is True
    assert "fen_after" in data


async def test_make_illegal_move_rejected(client, child_auth):
    token, child_id = child_auth
    start = await client.post("/games/bot/start",
                              headers={"Authorization": f"Bearer {token}"},
                              json={"skill_level": 3})
    gid = start.json()["game_id"]
    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e2e5"},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is False
