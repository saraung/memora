"""Password hashing and JWT / opaque-token helpers.

Passwords use Argon2id (argon2-cffi defaults). Refresh tokens, email
verification tokens and password-reset tokens are high-entropy opaque
strings; only a SHA-256 hash of each is stored in the database.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

_ph = PasswordHasher()  # Argon2id with OWASP-recommended defaults

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    """Hash a plaintext password with Argon2id."""
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if the password matches the stored hash."""
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def hash_token(token: str) -> str:
    """Hash an opaque token for storage (SHA-256, hex)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(*, user_id: str) -> str:
    """Create a short-lived JWT access token for a user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": ACCESS_TOKEN_TYPE,
        "iss": settings.JWT_ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token.

    Raises UnauthorizedError on any failure (bad signature, wrong
    algorithm/type/issuer, expiry).
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError(
            "Access token has expired", code="TOKEN_EXPIRED"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError(
            "Invalid access token", code="INVALID_TOKEN"
        ) from exc
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise UnauthorizedError("Invalid access token", code="INVALID_TOKEN")
    return payload


def generate_opaque_token(nbytes: int = 48) -> str:
    """Generate a high-entropy URL-safe token."""
    return secrets.token_urlsafe(nbytes)
