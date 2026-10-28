#!/usr/bin/env bash
# استعادة MongoDB من ملف نسخة:  ./deploy/scripts/restore.sh backups/mongo-XXXX.archive.gz
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 1 ] || { echo "usage: $0 <mongo-archive.gz>"; exit 1; }
set -a; source .env; set +a
read -r -p "سيتم استبدال قاعدة LibreChat الحالية. اكتب YES للمتابعة: " ok
[ "$ok" = "YES" ] || exit 1
docker compose -f docker-compose.prod.yml exec -T mongodb mongorestore \
  -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive --gzip --drop < "$1"
echo "restored"
