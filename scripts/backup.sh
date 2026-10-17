#!/usr/bin/env bash
# PostgreSQL backup for the Memora stack.
# Usage: ./scripts/backup.sh [backup_dir]
# Tested restore path: see docs/DEPLOYMENT.md and scripts/restore.sh.
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/memora-$STAMP.dump"

echo "Backing up memora database to $OUT ..."
docker compose exec -T db pg_dump -U memora -d memora -Fc -f "/tmp/backup.dump"
docker compose cp "db:/tmp/backup.dump" "$OUT"
docker compose exec -T db rm -f /tmp/backup.dump

echo "Backup complete: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Verify with: ./scripts/restore.sh --dry-run (see docs/DEPLOYMENT.md)"
