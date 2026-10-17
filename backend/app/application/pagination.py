"""Opaque cursor helpers for keyset pagination (PRD §6.6, §9.1)."""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any

from app.core.exceptions import ValidationError


def encode_cursor(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str) -> dict[str, Any]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise ValidationError("Invalid pagination cursor") from exc
    if not isinstance(payload, dict):
        raise ValidationError("Invalid pagination cursor")
    return payload
