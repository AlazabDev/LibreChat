#!/usr/bin/env bash
# نسخ احتياطي: MongoDB + uploads + (اختياري) Postgres. يُشغَّل من جذر المشروع.
# cron:  0 3 * * *  cd /opt/librechat && ./deploy/scripts/backup.sh >> logs/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
# قراءة آمنة لقيم محددة من .env (بدون source حتى لا تُنفَّذ أسطر غير متوقعة)
envval() { { grep -E "^$1=" .env || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }
MONGO_USER="$(envval MONGO_USER)"; MONGO_PASSWORD="$(envval MONGO_PASSWORD)"
POSTGRES_USER="$(envval POSTGRES_USER)"; POSTGRES_DB="$(envval POSTGRES_DB)"
BACKUP_DIR="$(envval BACKUP_DIR)"; BACKUP_KEEP_DAYS="$(envval BACKUP_KEEP_DAYS)"
: "${MONGO_USER:?MONGO_USER missing in .env}" "${MONGO_PASSWORD:?MONGO_PASSWORD missing in .env}"

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
