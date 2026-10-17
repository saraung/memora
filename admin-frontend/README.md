# Memora Admin

Internal staff operations console (PRD §16) for administrators, moderators,
and support staff. Separate from the public `frontend/` app and deployed
independently. It talks only to the existing FastAPI backend — never to the
database directly.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · TanStack Query
· Axios · React Hook Form + Zod · Lucide · Vitest + Testing Library.

## Run

```bash
npm install
cp .env.example .env   # optional; defaults work in dev
npm run dev            # http://localhost:5174
```

In development the Vite dev server proxies `/api` to the backend
(`VITE_PROXY_TARGET`, default `http://localhost:8000`), so the backend must
allow the admin origin for credentialed requests (it is in the default
`CORS_ORIGINS`).

### Bootstrapping staff access

Staff sign in with the normal Memora account system; access is gated by
backend RBAC. Seed roles/permissions and grant the first administrator:

```bash
cd ../backend
.venv/bin/python scripts/seed_rbac.py
.venv/bin/python scripts/seed_admin.py --email you@example.com --role admin
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — type-check + production build
- `npm run lint` — oxlint
- `npm test` — Vitest

## Scope

Delivered (milestones A1–A3): foundation, staff auth + permission-gated
routing, overview dashboard, reports queue, report details and moderation
decisions. Later milestones (A4–A6) add user management, staff/roles,
analytics, audit logs, and settings.
