# Memora Backend — Phase 1 (Foundation + Auth/RBAC)

FastAPI backend implementing PRD milestones **M1** (foundation) and **M2**
(authentication + basic authorization).

## Prerequisites

- Python 3.10, `uv`
- PostgreSQL 16 (a Docker container `memora-postgres` on port **5433**
  is used for local dev; see `.env`)

## Setup

```bash
uv sync
uv run alembic upgrade head
uv run python scripts/seed_rbac.py
uv run uvicorn app.main:app
```

API docs: http://localhost:8000/docs — all endpoints under `/api/v1`.

## Auth model

- `POST /api/v1/auth/register|login` → short-lived JWT access token (JSON)
  + rotating refresh token in an `HttpOnly` cookie.
- `POST /api/v1/auth/refresh` rotates; reuse of an old token revokes the
  whole token family.
- `POST /api/v1/auth/logout|logout-all`, `GET /api/v1/auth/me`,
  `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/password/forgot|reset`.
- Passwords: Argon2id. Email sending is stubbed (logged to console).

## Authorization

- Staff roles/permissions live in DB tables (`roles`, `permissions`,
  `user_roles`, `role_permissions`); seed with `scripts/seed_rbac.py`.
- Enforce with `require_permission("<code>")` (deny by default).
- Ordinary users get no staff role on registration.

## Tests

```bash
uv run pytest
```

Tests run against the `memora_test` database on the same container.

## Deferred (per plan)

- Rate limiting (Redis) — P0 follow-up.
- Real email provider, admin/moderation endpoints, profiles/follows (M3+).
