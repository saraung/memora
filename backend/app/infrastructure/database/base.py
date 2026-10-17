"""Declarative base metadata for Alembic and schema tooling."""

from sqlmodel import SQLModel

from app.infrastructure.database import models  # noqa: F401  (registers tables)

metadata = SQLModel.metadata
