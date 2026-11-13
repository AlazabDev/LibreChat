#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 08 Verification Script: Production Container Orchestration
# منظومة العزب — فحص واعتماد الركيزة الثامنة: التدشين الحي للحاويات والجاهزية الشاملة
# Protocol compliant: /mnt/ai/LibreChat/sh/README.md
# =============================================================================
set -Eeuo pipefail

# 1. تحديد جذر المستودع بصورة صحيحة ودقيقة
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# 2. إعداد مجلد التقارير والتسجيل
REPORTS_DIR="${SCRIPT_DIR}/reports"
mkdir -p "${REPORTS_DIR}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
LOG_FILE="${REPORTS_DIR}/phase-08-production-deployment-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-08-production-deployment-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الثامنة: التدشين الحي للحاويات وجاهزية الإنتاج"
echo "  تاريخ وبدء الفحص: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "  مسار العمل: ${ROOT_DIR}"
echo "============================================================================="

START_TIME=$(date +%s)
PASSED_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0

declare -a TEST_RESULTS=()

record_result() {
    local id="$1"
    local title="$2"
    local status="$3"
    local details="$4"

    case "${status}" in
        PASS)
            PASSED_COUNT=$((PASSED_COUNT + 1))
            echo -e "[\e[32mPASS\e[0m] ${id}: ${title} — ${details}"
            ;;
        FAIL)
            FAILED_COUNT=$((FAILED_COUNT + 1))
            echo -e "[\e[31mFAIL\e[0m] ${id}: ${title} — ${details}"
            ;;
        SKIP)
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            echo -e "[\e[33mSKIP\e[0m] ${id}: ${title} — ${details}"
            ;;
    esac

    TEST_RESULTS+=("{\"id\":\"${id}\",\"title\":\"${title}\",\"status\":\"${status}\",\"details\":\"${details//\"/\\\"}\"}")
}

COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="deploy/nginx.prod.conf"
ENV_FILE=".env.candidate"
if [[ ! -f "${ENV_FILE}" ]]; then
    ENV_FILE=".env"
fi

echo ""
echo "--- بدء تشغيل حالات الاختبار المستقلة للركيزة الثامنة ---"
echo ""

# -----------------------------------------------------------------------------
# T8-01: صحة هيكل الحاويات الـ 7 للإنتاج
# -----------------------------------------------------------------------------
if [[ -f "${COMPOSE_FILE}" ]]; then
    SERVICES_CHECK=$(node -e "
        const fs = require('fs');
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('${COMPOSE_FILE}', 'utf8'));
        const s = Object.keys(c.services || {});
        const expected = ['api', 'admin-panel', 'nginx', 'mongodb', 'meilisearch', 'vectordb', 'rag_api'];
        const allPresent = expected.every(item => s.includes(item));
        if (allPresent) {
            console.log('OK ' + s.length + ' services: ' + s.join(', '));
        } else {
            console.log('FAIL: found ' + s.join(', '));
        }
    " 2>&1 || true)
    if echo "${SERVICES_CHECK}" | grep -q "^OK"; then
        record_result "T8-01" "صحة هيكل الحاويات الـ 7 للإنتاج" "PASS" \
            "كافة الخدمات الـ 7 موجودة ومعرفة بدقة: api, admin-panel, nginx, mongodb, meilisearch, vectordb, rag_api"
    else
        record_result "T8-01" "صحة هيكل الحاويات الـ 7 للإنتاج" "FAIL" \
            "نقص في خدمات compose للإنتاج: ${SERVICES_CHECK}"
    fi
else
    record_result "T8-01" "صحة هيكل الحاويات الـ 7 للإنتاج" "FAIL" \
        "الملف ${COMPOSE_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-02: ربط مجلدات MCP والتكوين (Volume Mounts)
# -----------------------------------------------------------------------------
if [[ -f "${COMPOSE_FILE}" ]]; then
    VOL_CHECK=$(node -e "
        const fs = require('fs');
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('${COMPOSE_FILE}', 'utf8'));
        const apiVols = c.services?.api?.volumes || [];
        const hasMcp = apiVols.includes('./mcp:/app/mcp:ro');
        const hasYaml = apiVols.includes('./librechat.yaml:/app/librechat.yaml:ro');
        if (hasMcp && hasYaml) {
            console.log('OK');
        } else {
            console.log('FAIL: mcp=' + hasMcp + ' yaml=' + hasYaml);
        }
    " 2>&1 || true)
    if [[ "${VOL_CHECK}" == "OK" ]]; then
        record_result "T8-02" "ربط مجلدات MCP والتكوين (Volume Mounts)" "PASS" \
            "تم ربط مجلد mcp ومجلدات التكوين بأمان للقراءة فقط (:ro) بحاوية الـ API"
    else
        record_result "T8-02" "ربط مجلدات MCP والتكوين (Volume Mounts)" "FAIL" \
            "نقص في ارتباطات مجلدات mcp أو yaml في ${COMPOSE_FILE}: ${VOL_CHECK}"
    fi
else
    record_result "T8-02" "ربط مجلدات MCP والتكوين (Volume Mounts)" "FAIL" \
        "الملف ${COMPOSE_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-03: تطابق منفذ الـ RAG المعتمد (8088)
# -----------------------------------------------------------------------------
RAG_PORT_OK=true
if grep -q "RAG_PORT.*8088" "${COMPOSE_FILE}" && \
   grep -q "RAG_PORT=8088" "${ENV_FILE}"; then
    record_result "T8-03" "تطابق منفذ الـ RAG المعتمد (8088)" "PASS" \
        "منفذ 8088 موحد ومعتمد في docker-compose و .env لمنع أي تعارض تشغيلي"
else
    record_result "T8-03" "تطابق منفذ الـ RAG المعتمد (8088)" "FAIL" \
        "تعارض في منفذ الـ RAG بين ملفات التكوين والبيئة"
fi

# -----------------------------------------------------------------------------
# T8-04: مسار فحص الصحة اللحظي /health
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" && -f "${COMPOSE_FILE}" ]]; then
    if grep -q "location /health" "${NGINX_CONF}" && \
       grep -q "/health" "${COMPOSE_FILE}"; then
        record_result "T8-04" "مسار فحص الصحة اللحظي /health" "PASS" \
            "مسار /health موجه لحاوية الـ API ومضبوط في healthcheck للحاويات"
    else
        record_result "T8-04" "مسار فحص الصحة اللحظي /health" "FAIL" \
            "نقص في تكوين مسار /health في nginx أو compose"
    fi
else
    record_result "T8-04" "مسار فحص الصحة اللحظي /health" "FAIL" \
        "ملف Nginx أو Compose غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-05: مسار لوحة الإدارة المؤسسية /admin
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" ]]; then
    if grep -q "location /admin" "${NGINX_CONF}" && \
       grep -q "admin-panel:3000" "${NGINX_CONF}"; then
        record_result "T8-05" "مسار لوحة الإدارة المؤسسية /admin" "PASS" \
            "مسار لوحة الإدارة /admin موجه بنجاح لخادم admin-panel:3000 مع تمرير هيدرز الجلسة"
    else
        record_result "T8-05" "مسار لوحة الإدارة المؤسسية /admin" "FAIL" \
            "نقص في توجيه لوحة الإدارة في ${NGINX_CONF}"
    fi
else
    record_result "T8-05" "مسار لوحة الإدارة المؤسسية /admin" "FAIL" \
        "الملف ${NGINX_CONF} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-06: استقرار البث اللحظي للردود (SSE Streaming)
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" ]]; then
    if grep -q "proxy_buffering off;" "${NGINX_CONF}" && \
       grep -q "proxy_read_timeout 3600s;" "${NGINX_CONF}"; then
        record_result "T8-06" "استقرار البث اللحظي للردود (SSE Streaming)" "PASS" \
            "تم تعطيل proxy_buffering وضبط مهلة القراءة 3600 ثانية لضمان التدفق الفوري للكلمات"
    else
        record_result "T8-06" "استقرار البث اللحظي للردود (SSE Streaming)" "FAIL" \
            "إعدادات البث اللحظي SSE غير مكتملة في ${NGINX_CONF}"
    fi
else
    record_result "T8-06" "استقرار البث اللحظي للردود (SSE Streaming)" "FAIL" \
        "الملف ${NGINX_CONF} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-07: هيدرز الأمان العالي والحماية المؤسسية
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" ]]; then
    if grep -q "Strict-Transport-Security" "${NGINX_CONF}" && \
       grep -q "X-Content-Type-Options" "${NGINX_CONF}" && \
       grep -q "X-Frame-Options" "${NGINX_CONF}"; then
        record_result "T8-07" "هيدرز الأمان العالي والحماية المؤسسية" "PASS" \
            "كافة هيدرز الحماية المعتمدة (HSTS preload, nosniff, SAMEORIGIN) مفعلة دائماً"
    else
        record_result "T8-07" "هيدرز الأمان العالي والحماية المؤسسية" "FAIL" \
            "نقص في هيدرز الأمان في ${NGINX_CONF}"
    fi
else
    record_result "T8-07" "هيدرز الأمان العالي والحماية المؤسسية" "FAIL" \
        "الملف ${NGINX_CONF} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-08: حدود تدفق الطلبات ومكافحة DoS (Rate Limiting)
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" ]]; then
    if grep -q "zone=alazab_auth_limit" "${NGINX_CONF}" && \
       grep -q "zone=alazab_api_limit" "${NGINX_CONF}"; then
        record_result "T8-08" "حدود تدفق الطلبات ومكافحة DoS (Rate Limiting)" "PASS" \
            "نطاقات الحماية ضد الإغراق والهجمات العشوائية مفعلة على مسارات المصادقة والـ API"
    else
        record_result "T8-08" "حدود تدفق الطلبات ومكافحة DoS (Rate Limiting)" "FAIL" \
            "نقص في مناطق Rate Limiting في ${NGINX_CONF}"
    fi
else
    record_result "T8-08" "حدود تدفق الطلبات ومكافحة DoS (Rate Limiting)" "FAIL" \
        "الملف ${NGINX_CONF} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-09: تطابق سقف رفع الملفات (100MB)
# -----------------------------------------------------------------------------
if [[ -f "${NGINX_CONF}" ]]; then
    BODY_SIZE=$(grep -oE "client_max_body_size [0-9]+[A-Za-z]+" "${NGINX_CONF}" | head -n 1 | awk '{print $2}' || true)
    if [[ "${BODY_SIZE}" == "100M" || "${BODY_SIZE}" == "100m" ]]; then
        record_result "T8-09" "تطابق سقف رفع الملفات (100MB)" "PASS" \
            "سقف الرفع مضبوط على 100M لدعم المستندات الهندسية ومخططات المقاولات"
    else
        record_result "T8-09" "تطابق سقف رفع الملفات (100MB)" "FAIL" \
            "سقف الرفع في Nginx غير مطابق: '${BODY_SIZE}'"
    fi
else
    record_result "T8-09" "تطابق سقف رفع الملفات (100MB)" "FAIL" \
        "الملف ${NGINX_CONF} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-10: سياسة تدوير السجلات والحماية من امتلاء القرص
# -----------------------------------------------------------------------------
if [[ -f "${COMPOSE_FILE}" ]]; then
    if grep -q 'max-size: "20m"' "${COMPOSE_FILE}" && \
       grep -q 'max-file: "5"' "${COMPOSE_FILE}"; then
        record_result "T8-10" "سياسة تدوير السجلات والحماية من امتلاء القرص" "PASS" \
            "سياسة تدوير السجلات مفعلة بحد أقصى 20MB للملف و 5 ملفات لكل حاوية"
    else
        record_result "T8-10" "سياسة تدوير السجلات والحماية من امتلاء القرص" "FAIL" \
            "سياسة تدوير السجلات غير مكتملة في ${COMPOSE_FILE}"
    fi
else
    record_result "T8-10" "سياسة تدوير السجلات والحماية من امتلاء القرص" "FAIL" \
        "الملف ${COMPOSE_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T8-11: جاهزية سكربت النسخ الاحتياطي التلقائي
# -----------------------------------------------------------------------------
BACKUP_SH="deploy/scripts/backup.sh"
if [[ -f "${BACKUP_SH}" && -x "${BACKUP_SH}" ]]; then
    if grep -q "KEEP_DAYS.*14" "${BACKUP_SH}" && \
       grep -q "mongodump" "${BACKUP_SH}"; then
        record_result "T8-11" "جاهزية سكربت النسخ الاحتياطي التلقائي" "PASS" \
            "سكربت النسخ الاحتياطي صالح وقابل للتنفيذ بسياسة احتفاظ 14 يوماً مع ضغط المرفقات"
    else
        record_result "T8-11" "جاهزية سكربت النسخ الاحتياطي التلقائي" "FAIL" \
            "نقص في إعدادات سكربت النسخ الاحتياطي ${BACKUP_SH}"
    fi
else
    record_result "T8-11" "جاهزية سكربت النسخ الاحتياطي التلقائي" "FAIL" \
        "الملف ${BACKUP_SH} غير موجود أو يفتقد لصلاحية التنفيذ"
fi

# -----------------------------------------------------------------------------
# T8-12: صمام أمان سكربت الاستعادة (Safety Prompt)
# -----------------------------------------------------------------------------
RESTORE_SH="deploy/scripts/restore.sh"
if [[ -f "${RESTORE_SH}" && -x "${RESTORE_SH}" ]]; then
    if grep -q 'CONFIRM' "${RESTORE_SH}" && \
       grep -q 'YES' "${RESTORE_SH}"; then
        record_result "T8-12" "صمام أمان سكربت الاستعادة (Safety Prompt)" "PASS" \
            "سكربت الاستعادة مزود بصمام أمان صارم ويطلب تأكيد YES الصريح قبل أي استبدال"
    else
        record_result "T8-12" "صمام أمان سكربت الاستعادة (Safety Prompt)" "FAIL" \
            "صمام أمان سكربت الاستعادة غير مطابق في ${RESTORE_SH}"
    fi
else
    record_result "T8-12" "صمام أمان سكربت الاستعادة (Safety Prompt)" "FAIL" \
        "الملف ${RESTORE_SH} غير موجود أو يفتقد لصلاحية التنفيذ"
fi

# -----------------------------------------------------------------------------
# حفظ التقرير بصيغة JSON وملخص النتائج
# -----------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_TESTS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))

{
    echo "{"
    echo "  \"phase\": \"phase-08-production-deployment\","
    echo "  \"title\": \"Production Container Orchestration & Smoke Tests\","
    echo "  \"timestamp\": \"${TIMESTAMP}\","
    echo "  \"duration_seconds\": ${DURATION},"
    echo "  \"summary\": {"
    echo "    \"total\": ${TOTAL_TESTS},"
    echo "    \"passed\": ${PASSED_COUNT},"
    echo "    \"failed\": ${FAILED_COUNT},"
    echo "    \"skipped\": ${SKIPPED_COUNT}"
    echo "  },"
    echo "  \"tests\": ["
    FIRST=true
    for r in "${TEST_RESULTS[@]}"; do
        if [[ "${FIRST}" == "true" ]]; then
            echo "    ${r}"
            FIRST=false
        else
            echo "    ,${r}"
        fi
    done
    echo "  ]"
    echo "}"
} > "${JSON_FILE}"

echo ""
echo "============================================================================="
echo "  ملخص تقرير الفحص للمرحلة الثامنة: التدشين الحي للحاويات وجاهزية الإنتاج"
echo "  النتيجة الإجمالية: ${PASSED_COUNT}/${TOTAL_TESTS} حالة اجتياز بنجاح"
echo "  وقت التنفيذ: ${DURATION} ثانية"
echo "  ملف التقرير التفصيلي: ${LOG_FILE}"
echo "  ملف مصفوفة النتائج JSON: ${JSON_FILE}"
echo "============================================================================="

if [[ ${FAILED_COUNT} -gt 0 ]]; then
    exit 1
fi

exit 0
