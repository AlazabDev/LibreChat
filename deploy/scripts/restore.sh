#!/usr/bin/env bash
# استعادة MongoDB من ملف نسخة:  ./deploy/scripts/restore.sh backups/mongo-XXXX.archive.gz
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 1 ] || { echo "usage: $0 <mongo-archive.gz>"; exit 1; }
# قراءة آمنة لقيم محددة من .env (بدون source حتى لا تُنفَّذ أسطر غير متوقعة)
envval() { { grep -E "^$1=" .env || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }
MONGO_USER="$(envval MONGO_USER)"; MONGO_PASSWORD="$(envval MONGO_PASSWORD)"
POSTGRES_USER="$(envval POSTGRES_USER)"; POSTGRES_DB="$(envval POSTGRES_DB)"
BACKUP_DIR="$(envval BACKUP_DIR)"; BACKUP_KEEP_DAYS="$(envval BACKUP_KEEP_DAYS)"
: "${MONGO_USER:?MONGO_USER missing in .env}" "${MONGO_PASSWORD:?MONGO_PASSWORD missing in .env}"
read -r -p "سيتم استبدال قاعدة LibreChat الحالية. اكتب YES للمتابعة: " ok
[ "$ok" = "YES" ] || exit 1
docker compose -f docker-compose.prod.yml exec -T mongodb mongorestore \
  -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive --gzip --drop < "$1"
echo "restored"
