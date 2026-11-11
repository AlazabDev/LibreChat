#!/usr/bin/env bash
# =============================================================================
# Alazab Automated Backup Script — MongoDB + PgVector + Uploads
# منظومة العزب — سكربت النسخ الاحتياطي التلقائي اليومي
# cron: 0 3 * * * cd /opt/librechat && ./deploy/scripts/backup.sh >> logs/backup.log 2>&1
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

# تحديد ملف البيئة المتاح
ENV_FILE=".env"
if [ ! -f "${ENV_FILE}" ] && [ -f ".env.candidate" ]; then
    ENV_FILE=".env.candidate"
fi

envval() {
    { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

MONGO_USER="$(envval MONGO_USER)"
MONGO_PASSWORD="$(envval MONGO_PASSWORD)"
POSTGRES_USER="$(envval POSTGRES_USER)"
POSTGRES_DB="$(envval POSTGRES_DB)"
BACKUP_DIR="$(envval BACKUP_DIR)"
BACKUP_KEEP_DAYS="$(envval BACKUP_KEEP_DAYS)"

DEST="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
TS="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "${DEST}" logs
C="docker compose -f docker-compose.prod.yml"

echo "[${TS}] [START] بدء النسخ الاحتياطي لمنظومة العزب إلى: ${DEST}"

# 1. نسخ قاعدة بيانات MongoDB
if [ -n "${MONGO_USER}" ] && [ -n "${MONGO_PASSWORD}" ]; then
    echo "[${TS}] [MONGO] تشغيل mongodump لقاعدة LibreChat..."
    if $C exec -T mongodb mongodump -u "${MONGO_USER}" -p "${MONGO_PASSWORD}" \
      --authenticationDatabase admin --db LibreChat --archive --gzip > "${DEST}/mongo-${TS}.archive.gz" 2>/dev/null; then
        echo "[${TS}] [MONGO] تم بنجاح -> ${DEST}/mongo-${TS}.archive.gz"
    else
        echo "[${TS}] [MONGO] تحذير: تعذر الاتصال بحاوية mongodb المحلية (قد تكون تعمل على Atlas Cluster)"
    fi
fi

# 2. نسخ قاعدة متجهات المعرفة PgVector
if [ -n "${POSTGRES_USER}" ] && [ -n "${POSTGRES_DB}" ]; then
    echo "[${TS}] [POSTGRES] تشغيل pg_dump لقاعدة المتجهات ${POSTGRES_DB}..."
    if $C exec -T vectordb pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" 2>/dev/null | gzip > "${DEST}/pg-${TS}.sql.gz"; then
        echo "[${TS}] [POSTGRES] تم بنجاح -> ${DEST}/pg-${TS}.sql.gz"
    else
        echo "[${TS}] [POSTGRES] تحذير: تخطي تفريغ vectordb (الحاوية غير قيد التشغيل حالياً)"
    fi
fi

# 3. نسخ مجلدات الملفات والوسائط والصور المرفوعة
echo "[${TS}] [UPLOADS] ضغط مجلدات الملفات والوسائط..."
tar -czf "${DEST}/uploads-${TS}.tar.gz" uploads images 2>/dev/null || true
echo "[${TS}] [UPLOADS] تم حفظ وسائط ومرفقات المستخدمين -> ${DEST}/uploads-${TS}.tar.gz"

# 4. تنظيف النسخ القديمة التي تجاوزت فترة الاحتفاظ
echo "[${TS}] [CLEANUP] تنظيف النسخ الأقدم من ${KEEP_DAYS} يوماً..."
find "${DEST}" -type f -name "*.gz" -mtime +"${KEEP_DAYS}" -delete 2>/dev/null || true

echo "[${TS}] [COMPLETE] اكتمل النسخ الاحتياطي بنجاح في: ${DEST}"
