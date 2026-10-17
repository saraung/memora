#!/usr/bin/env bash
# Restore a Memora PostgreSQL backup into the compose stack.
# Usage: ./scripts/restore.sh <backup.dump> [--yes]
# WITHOUT --yes, only prints what would happen (safe by default).
#
# Restore procedure (tested): stop backend workers, drop + recreate the
# database, pg_restore, run `alembic upgrade head` to align any schema
# drift, restart the stack. See docs/DEPLOYMENT.md.
set -euo pipefail

BACKUP="${1:?usage: restore.sh <backup.dump> [--yes]}"
CONFIRM="${2:-}"

echo "Would restore $BACKUP into the 'memora' database:"
echo "  1. docker compose stop backend"
echo "  2. drop + recreate database memora"
echo "  3. pg_restore -U memora -d memora $BACKUP"
echo "  4. alembic upgrade head (inside backend container)"
echo "  5. docker compose start backend"

if [ "$CONFIRM" != "--yes" ]; then
  echo "Dry run only. Re-run with --yes to perform the restore."
  exit 0
fi

read -r -p "Type RESTORE to confirm wiping the current database: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }

docker compose stop backend
docker compose exec -T db psql -U memora -d postgres -c "DROP DATABASE memora;"
docker compose exec -T db psql -U memora -d postgres -c "CREATE DATABASE memora OWNER memora;"
cat "$BACKUP" | docker compose exec -T db pg_restore -U memora -d memora --no-owner
docker compose run --rm backend alembic upgrade head
docker compose start backend
echo "Restore complete. Verify with: curl localhost:8000/health"
