from datetime import datetime, timedelta, timezone
import pytest
from chess_api.services.jwt import encode_token, decode_token, TokenInvalid


def test_encode_decode_roundtrip():
    payload = {"user_id": 42, "role": "parent"}
    token = encode_token(payload)
    decoded = decode_token(token)
    assert decoded["user_id"] == 42
    assert decoded["role"] == "parent"
    assert "exp" in decoded


def test_decode_invalid_token_raises():
    with pytest.raises(TokenInvalid):
        decode_token("not.a.real.token")


def test_decode_expired_token_raises():
    expired_exp = datetime.now(timezone.utc) - timedelta(hours=1)
    token = encode_token({"user_id": 1}, custom_exp=expired_exp)
    with pytest.raises(TokenInvalid):
        decode_token(token)
