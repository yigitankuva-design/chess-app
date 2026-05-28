import pytest
from chess_api.services.password import hash_password, verify_password


def test_hash_password_returns_different_hash_each_time():
    h1 = hash_password("secret123")
    h2 = hash_password("secret123")
    assert h1 != h2


def test_verify_password_correct():
    h = hash_password("secret123")
    assert verify_password("secret123", h) is True


def test_verify_password_wrong():
    h = hash_password("secret123")
    assert verify_password("wrong", h) is False


def test_hash_password_minimum_length():
    with pytest.raises(ValueError):
        hash_password("abc")
