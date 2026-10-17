# Memora Deployment & Operations

## Architecture (single deployable unit)

```
browser ──HTTPS──> reverse proxy ──> backend:8000 (FastAPI + uvicorn)
                    (nginx/caddy)      ├─> postgres:5432 (pgvector image)
                                       └─> redis:6379 (rate limits)
                    frontend: static build served by the same proxy or CDN
                    media: Cloudinary (no self-hosted bytes)
```

One backend process (add `--workers N` behind the proxy for production).
PostgreSQL is the source of truth; Redis holds only rate-limit counters
(safe to flush). Media lives in Cloudinary, never on local disk.

## Environments

| Concern | Development | Production |
|---|---|---|
| `APP_ENV` | `development` | `production` (enables HSTS) |
| `DEBUG` | `true` | `false` |
| `COOKIE_SECURE` | `false` | `true` (HTTPS only) |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | `["https://app.example.com"]` |
| `ALLOWED_HOSTS` | localhost + `testserver` | your domains only |
| `JWT_SECRET_KEY` | any long random string | long random secret, rotated on leak |
| `DATABASE_URL` | local/container Postgres | managed Postgres or maintained host |
| `REDIS_URL` | local/container Redis | managed Redis or maintained host |
| `CLOUDINARY_URL` | real or dummy (media 503s) | real product environment |

Never commit real secrets: `.env` files are git-ignored; production
secrets live in a manager (Vault/1Password/cloud secret store).

## Build & run

```bash
# Full stack locally (db + redis + backend + frontend dev server)
docker compose up --build

# Backend alone
cd backend
uv sync
uv run alembic upgrade head
uv run python scripts/seed_rbac.py
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend alone
cd frontend
npm ci
npm run dev
```

Migrations run automatically on backend container boot
(`alembic upgrade head` in the Docker CMD) and must also be applied
when deploying without containers.

## Backup & restore

Backups capture PostgreSQL (`pg_dump -Fc`). Media lives in Cloudinary
(versioned there); audit data lives in Postgres and is included.

```bash
./scripts/backup.sh [./backups]        # produces memora-<utc>.dump
./scripts/restore.sh <file> --yes      # interactive confirm, then restores
```

**Tested restore path:** the restore script stops the backend, drops
and recreates the database, restores, runs `alembic upgrade head`,
and restarts. Exercise this on a scratch database before relying on it:

```bash
docker compose exec -T db createdb -U memora memora_scratch
cat backups/memora-<ts>.dump | docker compose exec -T db pg_restore -U memora -d memora_scratch --no-owner
# expect: clean restore, then `docker compose exec -T db psql -U memora -d memora_scratch -c '\dt'`
```

## Rollback

1. Backend is stateless: roll back by deploying the previous image/tag.
2. Database migrations are forward-only. If a deploy must be reverted
   *after* a migration ran, restore the pre-deploy backup (see above)
   or write a compensating migration. Never edit applied migrations.

## Security checklist (pre-release)

- [ ] `DEBUG=false`, `APP_ENV=production`, HTTPS enforced at the proxy.
- [ ] `COOKIE_SECURE=true`, `CORS_ORIGINS` restricted to the app domain.
- [ ] Real `JWT_SECRET_KEY`, `CLOUDINARY_URL`, DB/Redis credentials.
- [ ] Rate limiting backed by Redis (no in-memory fallback warnings in logs).
- [ ] Staff roles granted only via audited paths; first admin via `seed_admin.py`.
- [ ] Backend logs contain no secrets; `X-Request-ID` present on errors.
- [ ] Backup taken and restore rehearsed on scratch.
- [ ] No unresolved critical/high security findings.

## Monitoring

- Liveness: `GET /health`. Readiness: `GET /health` + DB pool check
  (extend before production if connection storms are a risk).
- Structured logs include `request_id` on every line; alert on 5xx
  rate and on `RATE_LIMITED` spikes (possible abuse or misconfig).
- Review `audit_events` regularly (`GET /admin/audit-events`).
