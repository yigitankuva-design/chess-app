from fastapi.testclient import TestClient
from chess_api.main import create_app
from chess_api.services.jwt import encode_token
from chess_api.services.lobby import _reset_for_tests


def test_lobby_ws_gecersiz_token_reddedilir():
    _reset_for_tests()
    client = TestClient(create_app())
    with client.websocket_connect("/ws/lobby?token=not.a.real.token") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_lobby_ws_gecerli_tokenda_katilim_onaylanir(monkeypatch):
    """NOT: lobby_ws baglaninca _resolve_display_name ile DB'ye gidiyor;
    gercek DATABASE_URL'e (localhost postgres) baglanmaya calisir ve
    ConnectionRefusedError firlatir (WS testleri TestClient/sync oldugu icin
    conftest'teki get_db override'i buraya uygulanmiyor — WS handler'lar
    get_session_factory()'yi DOGRUDAN cagiriyor). Bu smoke test isim
    cozumlemesini test etmiyor, o yuzden fonksiyonu sabit bir isimle taklit
    ediyoruz."""
    _reset_for_tests()

    async def _fake_name(child_id):
        return "Test Sporcu"

    monkeypatch.setattr(
        "chess_api.routers.live_game._resolve_display_name", _fake_name,
    )
    client = TestClient(create_app())
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/lobby?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "lobby_joined"
        assert msg["players"] == []  # kendisi haric kimse yok
