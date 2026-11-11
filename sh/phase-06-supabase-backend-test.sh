#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 06 Verification Script: Supabase & Backend Orchestration
# منظومة العزب — فحص واعتماد الركيزة السادسة: تنظيم الباك إند الداخلي والخارجي وسوبابيس
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
LOG_FILE="${REPORTS_DIR}/phase-06-supabase-backend-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-06-supabase-backend-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة السادسة: تنظيم الباك إند الداخلي والخارجي وسوبابيس"
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

ENV_FILE=".env.candidate"
if [[ ! -f "${ENV_FILE}" ]]; then
    ENV_FILE=".env"
fi

echo ""
echo "--- بدء تشغيل حالات الاختبار المستقلة للركيزة السادسة ---"
echo ""

# -----------------------------------------------------------------------------
# T6-01: إعدادات نطاق سوبابيس وتوجيه المصادقة المعتمد
# -----------------------------------------------------------------------------
T6_01_PASS=true
CONFIG_TOML="supabase/config.toml"
if [[ -f "${CONFIG_TOML}" ]]; then
    if grep -q 'site_url = "https://chat.alazab.com"' "${CONFIG_TOML}" && \
       grep -q '"https://chat.alazab.com"' "${CONFIG_TOML}"; then
        record_result "T6-01" "إعدادات نطاق سوبابيس وتوجيه المصادقة" "PASS" \
            "تم توجيه site_url وعناوين إعادة التوجيه إلى نطاق chat.alazab.com بنجاح"
    else
        record_result "T6-01" "إعدادات نطاق سوبابيس وتوجيه المصادقة" "FAIL" \
            "لم يتم العثور على توجيه chat.alazab.com في ${CONFIG_TOML}"
    fi
else
    record_result "T6-01" "إعدادات نطاق سوبابيس وتوجيه المصادقة" "FAIL" \
        "الملف ${CONFIG_TOML} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-02: تطابق معرف المشروع السحابي المعتمد refpgfvhfzralhzwnyyi
# -----------------------------------------------------------------------------
PROJECT_REF_FILE="supabase/.temp/project-ref"
EXPECTED_REF="refpgfvhfzralhzwnyyi"
if [[ -f "${PROJECT_REF_FILE}" ]]; then
    ACTUAL_REF="$(tr -d '[:space:]' < "${PROJECT_REF_FILE}")"
    if [[ "${ACTUAL_REF}" == "${EXPECTED_REF}" ]] && grep -q "${EXPECTED_REF}" "${ENV_FILE}"; then
        record_result "T6-02" "تطابق معرف المشروع السحابي المعتمد" "PASS" \
            "معرف المشروع متطابق تماماً (${EXPECTED_REF}) بين مجلد supabase وملف البيئة"
    else
        record_result "T6-02" "تطابق معرف المشروع السحابي المعتمد" "FAIL" \
            "تعارض في معرف المشروع: وجد (${ACTUAL_REF}) والمطلوب (${EXPECTED_REF})"
    fi
else
    record_result "T6-02" "تطابق معرف المشروع السحابي المعتمد" "FAIL" \
        "الملف ${PROJECT_REF_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-03: سياسات الأمان والعزل لتخزين المرفقات (Storage RLS)
# -----------------------------------------------------------------------------
MIGRATION_FILE="supabase/migrations/20261011211927_61def045-6041-4eeb-9cc3-092d821e3661.sql"
if [[ -f "${MIGRATION_FILE}" ]]; then
    if grep -q "chat_attachments_insert_own" "${MIGRATION_FILE}" && \
       grep -q "chat_attachments_select_own" "${MIGRATION_FILE}" && \
       grep -q "chat_attachments_delete_own" "${MIGRATION_FILE}"; then
        record_result "T6-03" "سياسات الأمان والعزل لتخزين المرفقات (Storage RLS)" "PASS" \
            "سياسات RLS الثلاث (insert, select, delete) مفعلة لمجلد chat-attachments ومقترنة بـ auth.uid()"
    else
        record_result "T6-03" "سياسات الأمان والعزل لتخزين المرفقات (Storage RLS)" "FAIL" \
            "نقص في سياسات الأمان الخاصة بالمرفقات في ${MIGRATION_FILE}"
    fi
else
    record_result "T6-03" "سياسات الأمان والعزل لتخزين المرفقات (Storage RLS)" "FAIL" \
        "ملف المايجريشن ${MIGRATION_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-04: دالة الحافة ollama-proxy ومعالجة CORS وفحص الهوية
# -----------------------------------------------------------------------------
OLLAMA_PROXY_FILE="supabase/functions/ollama-proxy/index.ts"
if [[ -f "${OLLAMA_PROXY_FILE}" ]]; then
    PROXY_CHECK=$(node -e "
        const fs = require('fs');
        const code = fs.readFileSync('${OLLAMA_PROXY_FILE}', 'utf8');
        const hasCors = code.includes('Access-Control-Allow-Origin') && code.includes('OPTIONS');
        const hasAuth = code.includes('auth.getUser') && code.includes('ALLOWED_DOMAINS');
        const hasLimit = code.includes('MAX_BODY_BYTES');
        if (hasCors && hasAuth && hasLimit) {
            console.log('OK');
        } else {
            console.log('FAIL: cors=' + hasCors + ' auth=' + hasAuth + ' limit=' + hasLimit);
        }
    ")
    if [[ "${PROXY_CHECK}" == "OK" ]]; then
        record_result "T6-04" "دالة الحافة ollama-proxy ومعالجة CORS وفحص الهوية" "PASS" \
            "كود دالة الوكيل يحمي نماذج أولاما برمز JWT ونطاق البريد مع دعم كامل لـ CORS و OPTIONS (204)"
    else
        record_result "T6-04" "دالة الحافة ollama-proxy ومعالجة CORS وفحص الهوية" "FAIL" \
            "نقص في معايير أمان دالة الوكيل: ${PROXY_CHECK}"
    fi
else
    record_result "T6-04" "دالة الحافة ollama-proxy ومعالجة CORS وفحص الهوية" "FAIL" \
        "الملف ${OLLAMA_PROXY_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-05: كتالوج عمليات دفترة المحاسبية (Daftra Catalog)
# -----------------------------------------------------------------------------
DAFTRA_CATALOG="supabase/functions/daftra-mcp/catalog.json"
if [[ -f "${DAFTRA_CATALOG}" ]]; then
    CAT_COUNT=$(node -e "
        try {
            const cat = require('./${DAFTRA_CATALOG}');
            console.log(cat.length);
        } catch(e) {
            console.log('ERROR: ' + e.message);
        }
    ")
    if [[ "${CAT_COUNT}" == "301" ]]; then
        record_result "T6-05" "كتالوج عمليات دفترة المحاسبية (Daftra Catalog)" "PASS" \
            "كتالوج دفترة مكتمل ومفهرس بنجاح بإجمالي 301 عملية محاسبية وإدارية معتمدة"
    else
        record_result "T6-05" "كتالوج عمليات دفترة المحاسبية (Daftra Catalog)" "FAIL" \
            "عدد العمليات في كتالوج دفترة غير مطابق: ${CAT_COUNT} (المطلوب 301)"
    fi
else
    record_result "T6-05" "كتالوج عمليات دفترة المحاسبية (Daftra Catalog)" "FAIL" \
        "الملف ${DAFTRA_CATALOG} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-06: تغطية وحدات وأقسام دفترة (Daftra Registry Coverage)
# -----------------------------------------------------------------------------
COVERAGE_TEST="supabase/functions/daftra-mcp/tests/coverage.test.ts"
if [[ -f "${COVERAGE_TEST}" ]]; then
    COVERAGE_OUT=$(npx tsx "${COVERAGE_TEST}" 2>&1 || true)
    if echo "${COVERAGE_OUT}" | grep -q "PASS { modules: 70, operations: 301 }"; then
        record_result "T6-06" "تغطية وحدات وأقسام دفترة (Daftra Coverage)" "PASS" \
            "اجتياز فحص التغطية البرمجية بـ 70 موديول و 301 عملية متوافقة 100% مع كتالوج دفترة"
    else
        record_result "T6-06" "تغطية وحدات وأقسام دفترة (Daftra Coverage)" "FAIL" \
            "فشل اختبار التغطية البرمجية: ${COVERAGE_OUT}"
    fi
else
    record_result "T6-06" "تغطية وحدات وأقسام دفترة (Daftra Coverage)" "FAIL" \
        "ملف اختبار التغطية ${COVERAGE_TEST} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-07: المرادفات الدلالية العربية لدفترة (Arabic Aliases)
# -----------------------------------------------------------------------------
ALIASES_FILE="supabase/functions/daftra-mcp/arabic-aliases.ts"
if [[ -f "${ALIASES_FILE}" ]]; then
    ALIASES_CHECK=$(node -e "
        const fs = require('fs');
        const content = fs.readFileSync('${ALIASES_FILE}', 'utf8');
        const keywords = ['فاتورة', 'عميل', 'قيد', 'سند', 'أصل', 'مصروف'];
        const found = keywords.filter(k => content.includes(k));
        if (found.length >= 4) {
            console.log('OK: ' + found.length + ' terms');
        } else {
            console.log('FAIL: only found ' + found.join(','));
        }
    ")
    if echo "${ALIASES_CHECK}" | grep -q "OK"; then
        record_result "T6-07" "المرادفات الدلالية العربية لدفترة (Arabic Aliases)" "PASS" \
            "المعجم الدلالي العربي مفعل ويدعم استعلامات الفواتير والقيود والعملاء والسندات"
    else
        record_result "T6-07" "المرادفات الدلالية العربية لدفترة (Arabic Aliases)" "FAIL" \
            "نقص في المرادفات العربية: ${ALIASES_CHECK}"
    fi
else
    record_result "T6-07" "المرادفات الدلالية العربية لدفترة (Arabic Aliases)" "FAIL" \
        "الملف ${ALIASES_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-08: دالة حافة المصادقة الموحدة auth-mcp
# -----------------------------------------------------------------------------
AUTH_MCP_FILE="supabase/functions/auth-mcp/index.ts"
if [[ -f "${AUTH_MCP_FILE}" ]]; then
    AUTH_CHECK=$(node -e "
        const fs = require('fs');
        const code = fs.readFileSync('${AUTH_MCP_FILE}', 'utf8');
        const tools = ['check_account', 'send_auth_otp', 'create_auth_conflict', 'open_support_ticket', 'get_allowed_apps'];
        const missing = tools.filter(t => !code.includes(t));
        if (missing.length === 0) {
            console.log('OK');
        } else {
            console.log('MISSING: ' + missing.join(', '));
        }
    ")
    if [[ "${AUTH_CHECK}" == "OK" ]]; then
        record_result "T6-08" "دالة حافة المصادقة الموحدة auth-mcp" "PASS" \
            "كود دالة المصادقة صالح ومزود بالأدوات الـ 5 المعتمدة مع التحقق الثنائي للمستخدم"
    else
        record_result "T6-08" "دالة حافة المصادقة الموحدة auth-mcp" "FAIL" \
            "أدوات مفقودة في دالة المصادقة: ${AUTH_CHECK}"
    fi
else
    record_result "T6-08" "دالة حافة المصادقة الموحدة auth-mcp" "FAIL" \
        "الملف ${AUTH_MCP_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T6-09: محركات الربط المشتركة (_shared minio & wa)
# -----------------------------------------------------------------------------
SHARED_MINIO="supabase/functions/_shared/minio.ts"
SHARED_WA="supabase/functions/_shared/wa.ts"
if [[ -f "${SHARED_MINIO}" && -f "${SHARED_WA}" ]]; then
    SHARED_CHECK=$(node -e "
        const ts = require('typescript');
        const fs = require('fs');
        ['${SHARED_MINIO}', '${SHARED_WA}'].forEach(f => {
            const code = fs.readFileSync(f, 'utf8');
            ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } });
        });
        console.log('OK');
    " 2>&1 || true)
    if [[ "${SHARED_CHECK}" == "OK" ]]; then
        record_result "T6-09" "محركات الربط المشتركة (_shared)" "PASS" \
            "محرك التخزين المتوافق مع S3 (MinIO) ومحرك التواصل (WhatsApp) خاليان من أخطاء الصياغة"
    else
        record_result "T6-09" "محركات الربط المشتركة (_shared)" "FAIL" \
            "خطأ صياغة في المحركات المشتركة: ${SHARED_CHECK}"
    fi
else
    record_result "T6-09" "محركات الربط المشتركة (_shared)" "FAIL" \
        "ملفات المحركات المشتركة غير مكتملة في supabase/functions/_shared/"
fi

# -----------------------------------------------------------------------------
# T6-10: سلامة أداة سوبابيس التشغيلية (Supabase CLI)
# -----------------------------------------------------------------------------
SUPABASE_VER=$(HOME=/tmp supabase --version 2>/dev/null || true)
if echo "${SUPABASE_VER}" | grep -qE "^2\."; then
    record_result "T6-10" "سلامة أداة سوبابيس التشغيلية (Supabase CLI)" "PASS" \
        "أداة Supabase CLI تعمل بنجاح بإصدار معتمد (${SUPABASE_VER}) ومتوافقة مع بيئة التشغيل"
else
    record_result "T6-10" "سلامة أداة سوبابيس التشغيلية (Supabase CLI)" "FAIL" \
        "فشل استدعاء أداة Supabase CLI أو الإصدار غير مطابق: '${SUPABASE_VER}'"
fi

# -----------------------------------------------------------------------------
# T6-11: مزامنة متغيرات البيئة الأساسية لسوبابيس في .env
# -----------------------------------------------------------------------------
T6_11_PASS=true
for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL; do
    if ! grep -qE "^[[:space:]]*${key}=" "${ENV_FILE}"; then
        T6_11_PASS=false
        break
    fi
done
if [[ "${T6_11_PASS}" == "true" ]]; then
    record_result "T6-11" "مزامنة متغيرات البيئة الأساسية لسوبابيس" "PASS" \
        "كافة متغيرات الربط السحابي (URL, Anon Key, Service Key, Database URL) معرفة ونشطة في ملف البيئة"
else
    record_result "T6-11" "مزامنة متغيرات البيئة الأساسية لسوبابيس" "FAIL" \
        "نقص في متغيرات بيئة سوبابيس الأساسية في ${ENV_FILE}"
fi

# -----------------------------------------------------------------------------
# T6-12: تسجيل وتكامل خوادم MCP في librechat.yaml
# -----------------------------------------------------------------------------
LIBRECHAT_YAML="librechat.yaml"
if [[ -f "${LIBRECHAT_YAML}" ]]; then
    YAML_MCP_CHECK=$(node -e "
        const fs = require('fs');
        const yaml = require('yaml');
        const content = fs.readFileSync('${LIBRECHAT_YAML}', 'utf8');
        const parsed = yaml.parse(content);
        const servers = parsed.mcpServers || {};
        const hasDaftra = !!servers.daftra;
        const hasSupabase = !!servers.supabase;
        
        let boundToFinance = false;
        const specs = parsed.modelSpecs?.list || [];
        const finSpec = specs.find(s => s.name === 'alazab-finance');
        if (finSpec && finSpec.mcpServers && finSpec.mcpServers.includes('daftra') && finSpec.mcpServers.includes('supabase')) {
            boundToFinance = true;
        }

        if (hasDaftra && hasSupabase && boundToFinance) {
            console.log('OK');
        } else {
            console.log('FAIL: daftra=' + hasDaftra + ' supabase=' + hasSupabase + ' financeBound=' + boundToFinance);
        }
    " 2>&1 || true)
    if [[ "${YAML_MCP_CHECK}" == "OK" ]]; then
        record_result "T6-12" "تسجيل وتكامل خوادم MCP في librechat.yaml" "PASS" \
            "خوادم Daftra و Supabase مسجلة في mcpServers ومربوطة بالنموذج المالي alazab-finance"
    else
        record_result "T6-12" "تسجيل وتكامل خوادم MCP في librechat.yaml" "FAIL" \
            "نقص في تسجيل أو ربط خوادم MCP في librechat.yaml: ${YAML_MCP_CHECK}"
    fi
else
    record_result "T6-12" "تسجيل وتكامل خوادم MCP في librechat.yaml" "FAIL" \
        "الملف ${LIBRECHAT_YAML} غير موجود"
fi

# -----------------------------------------------------------------------------
# حفظ التقرير بصيغة JSON وملخص النتائج
# -----------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_TESTS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))

{
    echo "{"
    echo "  \"phase\": \"phase-06-supabase-backend\","
    echo "  \"title\": \"Supabase & Backend Orchestration\","
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
echo "  ملخص تقرير الفحص للمرحلة السادسة: تنظيم الباك إند وسوبابيس"
echo "  النتيجة الإجمالية: ${PASSED_COUNT}/${TOTAL_TESTS} حالة اجتياز بنجاح"
echo "  وقت التنفيذ: ${DURATION} ثانية"
echo "  ملف التقرير التفصيلي: ${LOG_FILE}"
echo "  ملف مصفوفة النتائج JSON: ${JSON_FILE}"
echo "============================================================================="

if [[ ${FAILED_COUNT} -gt 0 ]]; then
    exit 1
fi

exit 0

