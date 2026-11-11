#!/usr/bin/env bash
# =============================================================================
# Alazab Restore Script — MongoDB + PgVector Restore
# منظومة العزب — سكربت استعادة النسخ الاحتياطية
# الاستخدام: ./deploy/scripts/restore.sh <mongo-archive.gz>
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

if [ $# -lt 1 ]; then
    echo "الاستخدام الصحيح: $0 <مسار_ملف_النسخة_الاحتياطية.archive.gz>"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "خطأ: الملف المحدد غير موجود: ${BACKUP_FILE}"
    exit 1
fi

ENV_FILE=".env"
if [ ! -f "${ENV_FILE}" ] && [ -f ".env.candidate" ]; then
    ENV_FILE=".env.candidate"
fi

envval() {
    { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

MONGO_USER="$(envval MONGO_USER)"
MONGO_PASSWORD="$(envval MONGO_PASSWORD)"
: "${MONGO_USER:?MONGO_USER missing in .env}" "${MONGO_PASSWORD:?MONGO_PASSWORD missing in .env}"

echo "⚠️ تحذير: سيتم استبدال قاعدة بيانات LibreChat الحالية بالبيانات الموجودة في: ${BACKUP_FILE}"
read -r -p "هل أنت متأكد تماماً من المتابعة؟ اكتب YES للتنفيذ: " CONFIRM
if [ "${CONFIRM}" != "YES" ]; then
    echo "تم إلغاء عملية الاستعادة."
    exit 0
fi

echo "جاري استعادة البيانات عبر mongorestore..."
docker compose -f docker-compose.prod.yml exec -T mongodb mongorestore \
  -u "${MONGO_USER}" -p "${MONGO_PASSWORD}" --authenticationDatabase admin \
  --archive --gzip --drop < "${BACKUP_FILE}"

echo "✅ تمت استعادة قاعدة البيانات بنجاح!"
