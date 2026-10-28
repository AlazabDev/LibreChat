#!/usr/bin/env bash
# نسخ احتياطي: MongoDB + uploads + (اختياري) Postgres. يُشغَّل من جذر المشروع.
# cron:  0 3 * * *  cd /opt/librechat && ./deploy/scripts/backup.sh >> logs/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a

DEST="${BACKUP_DIR:-./backups}"; KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"; mkdir -p "$DEST"
C="docker compose -f docker-compose.prod.yml"

echo "[$TS] mongodump"
$C exec -T mongodb mongodump -u "$MONGO_USER" -p "$MONGO_PASSWORD" \
  --authenticationDatabase admin --db LibreChat --archive --gzip > "$DEST/mongo-$TS.archive.gz"

echo "[$TS] postgres (RAG)"
$C exec -T vectordb pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$DEST/pg-$TS.sql.gz"

echo "[$TS] uploads"
tar -czf "$DEST/uploads-$TS.tar.gz" uploads images 2>/dev/null || true

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "[$TS] done -> $DEST"
