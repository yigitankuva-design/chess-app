from fastapi.testclient import TestClient
from chess_api.main import create_app
from chess_api.services.jwt import encode_token
from chess_api.services.matchmaking import _reset_for_tests


def test_queue_ws_rejects_bad_token():
    _reset_for_tests()
    app = create_app()
    client = TestClient(app)
    with client.websocket_connect("/ws/queue?token=not.a.real.token") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
    # connection closes after error


def test_queue_ws_valid_token_gets_waiting():
    _reset_for_tests()
    app = create_app()
    client = TestClient(app)
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/queue?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "waiting"
        # disconnect immediately; don't wait for 60s match timeout
