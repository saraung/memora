"""Unit tests for hashing and JWT helpers."""

from __future__ import annotations

import pytest

from app.core.exceptions import UnauthorizedError
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_password_hash_and_verify() -> None:
    hashed = hash_password("supersecret1")
    assert hashed != "supersecret1"
    assert verify_password("supersecret1", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_access_token_roundtrip() -> None:
    token = create_access_token(user_id="123e4567-e89b-12d3-a456-426614174000")
    payload = decode_access_token(token)
    assert payload["sub"] == "123e4567-e89b-12d3-a456-426614174000"
    assert payload["type"] == "access"


def test_decode_rejects_tampered_token() -> None:
    token = create_access_token(user_id="some-user-id")
    with pytest.raises(UnauthorizedError):
        decode_access_token(token + "tampered")


def test_opaque_tokens_are_unique_and_hashed() -> None:
    first, second = generate_opaque_token(), generate_opaque_token()
    assert first != second
    assert hash_token(first) != first
    assert len(hash_token(first)) == 64
