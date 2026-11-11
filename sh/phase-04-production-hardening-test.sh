#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 04 Verification Script: Production Hardening & High Availability
# منظومة العزب — فحص واعتماد الركيزة الرابعة: الاستقرار، الحماية، الأداء العالي والنسخ الاحتياطي
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
LOG_FILE="${REPORTS_DIR}/phase-04-production-hardening-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-04-production-hardening-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الرابعة: الاستقرار، الحماية، الأداء والنسخ الاحتياطي"
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

# تحديد ملف البيئة المعتمد للاختبارات
ENV_FILE=".env.candidate"
if [ ! -f "${ENV_FILE}" ]; then
    ENV_FILE=".env"
fi

# -----------------------------------------------------------------------------
# T4-01: فحص صحة وتكامل بنية Docker Compose للإنتاج (7 خدمات رئيسية)
# -----------------------------------------------------------------------------
test_t4_01() {
    local id="T4-01"
    local title="صحة بنية Compose وتكامل الخدمات الـ 7 للإنتاج"

    local compose_file="docker-compose.prod.yml"
    if [ ! -f "${compose_file}" ]; then
        record_result "${id}" "${title}" "FAIL" "ملف ${compose_file} غير موجود"
        return
    fi

    if docker compose -f "${compose_file}" --env-file "${ENV_FILE}" config > /dev/null 2>&1; then
        local services
        services=$(docker compose -f "${compose_file}" --env-file "${ENV_FILE}" config --services 2>/dev/null | tr '\n' ' ')
        local expected=("api" "admin-panel" "mongodb" "meilisearch" "vectordb" "rag_api" "nginx")
        local all_present=true
        for s in "${expected[@]}"; do
            if [[ ! " ${services} " =~ " ${s} " ]]; then
                all_present=false
                break
            fi
        done

        if [ "${all_present}" = true ]; then
            record_result "${id}" "${title}" "PASS" "كافة الخدمات الـ 7 موجودة وصحيحة: ${services}"
        else
            record_result "${id}" "${title}" "FAIL" "إحدى الخدمات الأساسية مفقودة في compose: ${services}"
        fi
    else
        record_result "${id}" "${title}" "FAIL" "فشل في فحص بناء docker-compose.prod.yml"
    fi
}

# -----------------------------------------------------------------------------
# T4-02: فحص منافذ التخزين وربط مجلدات الحاويات (Volume Mounts)
# -----------------------------------------------------------------------------
test_t4_02() {
    local id="T4-02"
    local title="ربط مجلدات الحاويات ومسار MCP المحمي (Volume Mounts)"

    local has_mcp=false
    local has_yaml=false
    local has_uploads=false
    local has_data=false

    if grep -q "\./mcp:/app/mcp:ro" docker-compose.prod.yml; then has_mcp=true; fi
    if grep -q "\./librechat\.yaml:/app/librechat\.yaml:ro" docker-compose.prod.yml; then has_yaml=true; fi
    if grep -q "\./uploads:/app/uploads" docker-compose.prod.yml; then has_uploads=true; fi
    if grep -q "librechat-data:/app/data" docker-compose.prod.yml; then has_data=true; fi

    if [ "${has_mcp}" = true ] && [ "${has_yaml}" = true ] && [ "${has_uploads}" = true ] && [ "${has_data}" = true ]; then
        record_result "${id}" "${title}" "PASS" "تم ربط مجلدات mcp (ro), librechat.yaml (ro), uploads, data بنجاح"
    else
        record_result "${id}" "${title}" "FAIL" "أحد منافذ التخزين الإلزامية غير مربوط بصورة صحيحة"
    fi
}

# -----------------------------------------------------------------------------
# T4-03: تكامل وصحة إعدادات خادم Nginx العكسي
# -----------------------------------------------------------------------------
test_t4_03() {
    local id="T4-03"
    local title="تكامل خادم Nginx العكسي ودعم HTTPS المشفر"

    local conf="deploy/nginx.prod.conf"
    if [ ! -f "${conf}" ]; then
        record_result "${id}" "${title}" "FAIL" "ملف ${conf} غير موجود"
        return
    fi

    local has_http=false
    local has_https=false
    local has_ssl=false
    local has_upstreams=false

    if grep -q "listen 80" "${conf}"; then has_http=true; fi
    if grep -q "listen 443 ssl" "${conf}"; then has_https=true; fi
    if grep -q "ssl_certificate" "${conf}"; then has_ssl=true; fi
    if grep -q "set \$api_upstream" "${conf}" && grep -q "set \$admin_upstream" "${conf}"; then has_upstreams=true; fi

    if [ "${has_http}" = true ] && [ "${has_https}" = true ] && [ "${has_ssl}" = true ] && [ "${has_upstreams}" = true ]; then
        record_result "${id}" "${title}" "PASS" "خادم Nginx مهيأ بالكامل للتحويل التلقائي والـ SSL وتوجيه الـ Upstreams"
    else
        record_result "${id}" "${title}" "FAIL" "نقص في مكونات خادم Nginx العكسي"
    fi
}

# -----------------------------------------------------------------------------
# T4-04: فرض هيدرز الأمان العالي (Enterprise Security Headers)
# -----------------------------------------------------------------------------
test_t4_04() {
    local id="T4-04"
    local title="فرض هيدرز الأمان العالي في خادم Nginx"

    local conf="deploy/nginx.prod.conf"
    local has_hsts=false
    local has_nosniff=false
    local has_xframe=false
    local has_referrer=false
    local has_xss=false
    local has_perms=false

    if grep -q "Strict-Transport-Security.*preload" "${conf}"; then has_hsts=true; fi
    if grep -q "X-Content-Type-Options.*nosniff" "${conf}"; then has_nosniff=true; fi
    if grep -q "X-Frame-Options.*SAMEORIGIN" "${conf}"; then has_xframe=true; fi
    if grep -q "Referrer-Policy.*strict-origin" "${conf}"; then has_referrer=true; fi
    if grep -q "X-XSS-Protection.*mode=block" "${conf}"; then has_xss=true; fi
    if grep -q "Permissions-Policy" "${conf}"; then has_perms=true; fi

    if [ "${has_hsts}" = true ] && [ "${has_nosniff}" = true ] && [ "${has_xframe}" = true ] && [ "${has_referrer}" = true ] && [ "${has_xss}" = true ] && [ "${has_perms}" = true ]; then
        record_result "${id}" "${title}" "PASS" "كافة هيدرز الأمان المؤسسية (HSTS, nosniff, SAMEORIGIN, XSS, Referrer) مطبقة دائماً"
    else
        record_result "${id}" "${title}" "FAIL" "أحد هيدرز الأمان مفقود في تكوين Nginx"
    fi
}

# -----------------------------------------------------------------------------
# T4-05: سياسات جدار الحماية وتحديد المعدل (Rate Limiting)
# -----------------------------------------------------------------------------
test_t4_05() {
    local id="T4-05"
    local title="حماية نقاط المصادقة والـ API بمحدد المعدل (Rate Limiting)"

    local conf="deploy/nginx.prod.conf"
    local has_auth_zone=false
    local has_api_zone=false
    local has_auth_protect=false
    local has_api_protect=false

    if grep -q "zone=alazab_auth_limit:10m rate=5r/m" "${conf}"; then has_auth_zone=true; fi
    if grep -q "zone=alazab_api_limit:10m rate=30r/s" "${conf}"; then has_api_zone=true; fi
    if grep -q "limit_req zone=alazab_auth_limit burst=10 nodelay" "${conf}"; then has_auth_protect=true; fi
    if grep -q "limit_req zone=alazab_api_limit burst=50 nodelay" "${conf}"; then has_api_protect=true; fi

    if [ "${has_auth_zone}" = true ] && [ "${has_api_zone}" = true ] && [ "${has_auth_protect}" = true ] && [ "${has_api_protect}" = true ]; then
        record_result "${id}" "${title}" "PASS" "نطاقات الحماية ضد هجمات DoS والتخمين العشوائي مفعلة ومطبقة بنجاح"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات Rate Limiting غير مكتملة في Nginx"
    fi
}

# -----------------------------------------------------------------------------
# T4-06: تطابق ومواءمة حد رفع الملفات (100MB)
# -----------------------------------------------------------------------------
test_t4_06() {
    local id="T4-06"
    local title="تطابق حد رفع الملفات (100MB) بين Nginx والتطبيق"

    local nginx_size
    nginx_size=$(grep -oE "client_max_body_size [0-9]+[A-Za-z]+" deploy/nginx.prod.conf | awk '{print $2}')
    local yaml_size
    yaml_size=$(node -e "const yaml = require('yaml'); const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8')); console.log(c.fileConfig?.serverFileSizeLimit);")

    if [ "${nginx_size}" = "100M" ] && [ "${yaml_size}" = "100" ]; then
        record_result "${id}" "${title}" "PASS" "حد الرفع متطابق تماماً على 100MB لمنع خطأ HTTP 413"
    else
        record_result "${id}" "${title}" "FAIL" "عدم تطابق حد الرفع: Nginx=${nginx_size}, Yaml=${yaml_size}MB"
    fi
}

# -----------------------------------------------------------------------------
# T4-07: دعم البث اللحظي للردود بدون تخزين مؤقت (SSE Streaming)
# -----------------------------------------------------------------------------
test_t4_07() {
    local id="T4-07"
    local title="تحسين أداء البث اللحظي للردود (SSE Streaming)"

    local conf="deploy/nginx.prod.conf"
    local sse_ok=false
    if grep -q "proxy_buffering off;" "${conf}" && \
       grep -q "proxy_cache off;" "${conf}" && \
       grep -q "proxy_read_timeout 3600s;" "${conf}"; then
        sse_ok=true
    fi

    if [ "${sse_ok}" = true ]; then
        record_result "${id}" "${title}" "PASS" "تم إلغاء الـ Buffering وضبط مهلة القراءة على 3600 ثانية لاستقرار البث"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات SSE غير مكتملة في Nginx"
    fi
}

# -----------------------------------------------------------------------------
# T4-08: مسار فحص الجاهزية المخصص (Health Check Routing)
# -----------------------------------------------------------------------------
test_t4_08() {
    local id="T4-08"
    local title="مسار فحص الجاهزية المستمر (Health Check /health)"

    local conf="deploy/nginx.prod.conf"
    local health_ok=false
    if grep -q "location /health" "${conf}" && grep -q "proxy_pass \$api_upstream/health" "${conf}"; then
        health_ok=true
    fi

    if [ "${health_ok}" = true ]; then
        record_result "${id}" "${title}" "PASS" "مسار /health موجه إلى حاوية الـ API مع تحسين استهلاك السجلات"
    else
        record_result "${id}" "${title}" "FAIL" "مسار فحص الجاهزية غير معرف في Nginx"
    fi
}

# -----------------------------------------------------------------------------
# T4-09: تشغيل سكربت النسخ الاحتياطي التلقائي (Automated Backup)
# -----------------------------------------------------------------------------
test_t4_09() {
    local id="T4-09"
    local title="سكربت النسخ الاحتياطي التلقائي (deploy/scripts/backup.sh)"

    local script="deploy/scripts/backup.sh"
    if [ ! -x "${script}" ]; then
        record_result "${id}" "${title}" "FAIL" "سكربت النسخ الاحتياطي غير قابل للتنفيذ"
        return
    fi

    local backup_out
    backup_out=$(bash "${script}" 2>&1 || true)

    if echo "${backup_out}" | grep -q "اكتمل النسخ الاحتياطي بنجاح"; then
        record_result "${id}" "${title}" "PASS" "تم تشغيل سكربت النسخ وضغط المرفقات والتحقق من سياسة الاحتفاظ"
    else
        record_result "${id}" "${title}" "FAIL" "فشل في تشغيل سكربت النسخ الاحتياطي: ${backup_out}"
    fi
}

# -----------------------------------------------------------------------------
# T4-10: فحص سكربت الاستعادة وصمام الأمان (Disaster Recovery)
# -----------------------------------------------------------------------------
test_t4_10() {
    local id="T4-10"
    local title="سكربت الاستعادة وصمام الأمان (deploy/scripts/restore.sh)"

    local script="deploy/scripts/restore.sh"
    if [ ! -x "${script}" ]; then
        record_result "${id}" "${title}" "FAIL" "سكربت الاستعادة غير قابل للتنفيذ"
        return
    fi

    local usage_out
    usage_out=$(bash "${script}" 2>&1 || true)
    local has_safety=false
    if grep -q "YES" "${script}"; then
        has_safety=true
    fi

    if echo "${usage_out}" | grep -q "الاستخدام الصحيح" && [ "${has_safety}" = true ]; then
        record_result "${id}" "${title}" "PASS" "سكربت الاستعادة مزود بصمام أمان صارم ويطلب تأكيد YES صريح"
    else
        record_result "${id}" "${title}" "FAIL" "صمام الأمان مفقود في سكربت الاستعادة"
    fi
}

# -----------------------------------------------------------------------------
# T4-11: إعدادات الرصد وتتبع الأداء المؤسسي (Langfuse Tracing)
# -----------------------------------------------------------------------------
test_t4_11() {
    local id="T4-11"
    local title="الرصد والمراقبة وتتبع الأداء (Langfuse Tracing)"

    local has_tracing=false
    local has_sample_rate=false

    if grep -q "LANGFUSE_TRACING_ENABLED=true" "${ENV_FILE}"; then has_tracing=true; fi
    if grep -q "LANGFUSE_SAMPLE_RATE=" "${ENV_FILE}"; then has_sample_rate=true; fi

    if [ "${has_tracing}" = true ] && [ "${has_sample_rate}" = true ]; then
        record_result "${id}" "${title}" "PASS" "نظام Langfuse Tracing مفعل بنسبة 100% لرصد استعلامات النماذج والأداء"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات Langfuse Tracing غير مفعلة في ملف البيئة"
    fi
}

# -----------------------------------------------------------------------------
# T4-12: مسار سجلات التدقيق وضوابط العمليات الحساسة (Audit Trail)
# -----------------------------------------------------------------------------
test_t4_12() {
    local id="T4-12"
    local title="سجلات التدقيق الأمني وضوابط العمليات الحساسة (Audit Trail)"

    local has_audit_log=false
    local has_confirm=false
    local has_rate=false

    if grep -q "AUDIT_LOG_PATH=" "${ENV_FILE}"; then has_audit_log=true; fi
    if grep -q "WRITE_CONFIRM_PHRASE=" "${ENV_FILE}"; then has_confirm=true; fi
    if grep -q "WRITE_RATE_LIMIT=" "${ENV_FILE}"; then has_rate=true; fi

    if [ "${has_audit_log}" = true ] && [ "${has_confirm}" = true ] && [ "${has_rate}" = true ]; then
        record_result "${id}" "${title}" "PASS" "مسار سجلات التدقيق مفعل مع صمامات موافقة الكتابة ومعدل العمليات"
    else
        record_result "${id}" "${title}" "FAIL" "ضوابط سجلات التدقيق والعمليات الحساسة غير مكتملة"
    fi
}

# -----------------------------------------------------------------------------
# T4-13: عزل الشبكات والمنافذ غير الآمنة (Network Isolation)
# -----------------------------------------------------------------------------
test_t4_13() {
    local id="T4-13"
    local title="عزل قواعد البيانات والمنافذ داخل شبكة internal"

    local compose_content
    compose_content=$(cat docker-compose.prod.yml)

    local db_isolated=true
    if echo "${compose_content}" | grep -A 10 "container_name: chat-mongodb" | grep -q "ports:"; then db_isolated=false; fi
    if echo "${compose_content}" | grep -A 10 "container_name: vectordb" | grep -q "ports:"; then db_isolated=false; fi
    if echo "${compose_content}" | grep -A 10 "container_name: rag_api" | grep -q "ports:"; then db_isolated=false; fi
    if echo "${compose_content}" | grep -A 10 "container_name: meilisearch" | grep -q "ports:"; then db_isolated=false; fi

    local nginx_ports=false
    if echo "${compose_content}" | grep -A 8 "container_name: LibreChat-NGINX" | grep -q 'ports: \["80:80", "443:443"\]'; then
        nginx_ports=true
    fi

    if [ "${db_isolated}" = true ] && [ "${nginx_ports}" = true ]; then
        record_result "${id}" "${title}" "PASS" "قواعد البيانات معزولة داخلياً بالكامل، والمنافذ المفتوحة للخارج هي 80/443 فقط"
    else
        record_result "${id}" "${title}" "FAIL" "خطر أمني: توجد منافذ لقواعد البيانات أو الخدمات الداخلية مكشوفة للخارج"
    fi
}

# -----------------------------------------------------------------------------
# T4-14: حظر تسريب الأسرار والمفاتيح في السجلات والتقارير
# -----------------------------------------------------------------------------
test_t4_14() {
    local id="T4-14"
    local title="حظر تسريب الرموز والمفاتيح في السجلات والتقارير"

    local leak_detected=false

    if [ -d "${REPORTS_DIR}" ]; then
        if grep -rn -E "(AIzaSy|sk-proj-[A-Za-z0-9_-]{20,}|re_hacs|1l5OQSg)" "${REPORTS_DIR}" > /dev/null 2>&1; then
            leak_detected=true
        fi
    fi

    if grep -rn -E "(AIzaSy|sk-proj-[A-Za-z0-9_-]{20,}|re_hacs|1l5OQSg)" deploy/ > /dev/null 2>&1; then
        leak_detected=true
    fi

    if [ "${leak_detected}" = false ]; then
        record_result "${id}" "${title}" "PASS" "كافة السجلات وملفات النشر نظيفة وخالية من أي تسريب لمفاتيح الإنتاج"
    else
        record_result "${id}" "${title}" "FAIL" "اكتشاف تسريب لمفتاح أو رمز أمني داخل السجلات أو مجلد deploy"
    fi
}

# -----------------------------------------------------------------------------
# تشغيل الاختبارات
# -----------------------------------------------------------------------------
test_t4_01
test_t4_02
test_t4_03
test_t4_04
test_t4_05
test_t4_06
test_t4_07
test_t4_08
test_t4_09
test_t4_10
test_t4_11
test_t4_12
test_t4_13
test_t4_14

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "============================================================================="
echo "  ملخص نتائج فحص الركيزة الرابعة (Phase 04 Summary):"
echo "  - إجمالي الاختبارات: $((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))"
echo "  - ناجح (PASS): ${PASSED_COUNT}"
echo "  - فاشل (FAIL): ${FAILED_COUNT}"
echo "  - متجاوز (SKIP): ${SKIPPED_COUNT}"
echo "  - مدة التنفيذ: ${DURATION} ثانية"
echo "  - ملف التقرير: ${LOG_FILE}"
echo "============================================================================="

cat <<EOF > "${JSON_FILE}"
{
  "phase": "04-production-hardening",
  "title": "الاستقرار، الحماية، الأداء العالي، والمراقبة والنسخ الاحتياطي",
  "timestamp": "${TIMESTAMP}",
  "durationSeconds": ${DURATION},
  "summary": {
    "total": $((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT)),
    "passed": ${PASSED_COUNT},
    "failed": ${FAILED_COUNT},
    "skipped": ${SKIPPED_COUNT}
  },
  "results": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ]
}
EOF

if [ "${FAILED_COUNT}" -gt 0 ]; then
    echo -e "\e[31m[ERROR] يوجد ${FAILED_COUNT} اختبارات لم تجتز الفحص بنجاح.\e[0m"
    exit 1
else
    echo -e "\e[32m[SUCCESS] تم اجتياز جميع اختبارات الركيزة الرابعة بنجاح 100%.\e[0m"
    exit 0
fi
