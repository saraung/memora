"""Response schemas for search and hashtag browsing."""

from __future__ import annotations

from pydantic import BaseModel


class HashtagResponse(BaseModel):
    tag: str
    usage_count: int
