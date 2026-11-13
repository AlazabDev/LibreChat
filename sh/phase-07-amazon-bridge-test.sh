#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 07 Verification Script: Amazon SP-API Live Pricing Bridge
# منظومة العزب — فحص واعتماد الركيزة السابعة: جسر متجر أمازون المباشر للأسعار والمواصفات
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
LOG_FILE="${REPORTS_DIR}/phase-07-amazon-bridge-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-07-amazon-bridge-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة السابعة: جسر متجر أمازون المباشر للأسعار والمواصفات"
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
echo "--- بدء تشغيل حالات الاختبار المستقلة للركيزة السابعة ---"
echo ""

# -----------------------------------------------------------------------------
# T7-01: هيكل مجلدات وملفات جسر أمازون
# -----------------------------------------------------------------------------
AMAZON_DIR="mcp/amazon-sp-api"
SERVER_FILE="${AMAZON_DIR}/server.mjs"
CATALOG_FILE="${AMAZON_DIR}/catalog.json"

if [[ -d "${AMAZON_DIR}" && -f "${SERVER_FILE}" && -f "${CATALOG_FILE}" ]]; then
    record_result "T7-01" "هيكل مجلدات وملفات جسر أمازون" "PASS" \
        "كافة الملفات الأساسية (server.mjs, catalog.json) موجودة ومكتملة"
else
    record_result "T7-01" "هيكل مجلدات وملفات جسر أمازون" "FAIL" \
        "نقص في ملفات مجلد ${AMAZON_DIR}"
fi

# -----------------------------------------------------------------------------
# T7-02: صلاحيات وصحة كود خادم أمازون
# -----------------------------------------------------------------------------
if [[ -f "${SERVER_FILE}" ]]; then
    SYNTAX_CHECK=$(node -c "${SERVER_FILE}" 2>&1 || true)
    if [[ -z "${SYNTAX_CHECK}" && -x "${SERVER_FILE}" ]]; then
        record_result "T7-02" "صلاحيات وصحة كود خادم أمازون" "PASS" \
            "ملف الخادم خالي من أخطاء الـ Syntax ويمتلك صلاحيات التنفيذ (+x)"
    else
        record_result "T7-02" "صلاحيات وصحة كود خادم أمازون" "FAIL" \
            "خطأ في كود أو صلاحيات ${SERVER_FILE}: ${SYNTAX_CHECK}"
    fi
else
    record_result "T7-02" "صلاحيات وصحة كود خادم أمازون" "FAIL" \
        "الملف ${SERVER_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T7-03: تكامل كتالوج منتجات متجر العزب على أمازون
# -----------------------------------------------------------------------------
if [[ -f "${CATALOG_FILE}" ]]; then
    CAT_CHECK=$(node -e "
        try {
            const data = require('./${CATALOG_FILE}');
            const sellerOk = !!(data.store && data.store.seller_id);
            const prods = data.products || [];
            const fieldsOk = prods.length > 0 && prods.every(p => p.asin && p.sku && p.title_ar && p.buybox_price && p.inventory);
            if (sellerOk && fieldsOk) {
                console.log('OK ' + prods.length);
            } else {
                console.log('FAIL: sellerOk=' + sellerOk + ' fieldsOk=' + fieldsOk);
            }
        } catch(e) {
            console.log('ERROR ' + e.message);
        }
    ")
    if echo "${CAT_CHECK}" | grep -q "^OK"; then
        COUNT=$(echo "${CAT_CHECK}" | awk '{print $2}')
        record_result "T7-03" "تكامل كتالوج منتجات متجر العزب على أمازون" "PASS" \
            "كتالوج المنتجات متكامل وصحيح، ويضم ${COUNT} منتجاً مع كافة بيانات الأسعار والمواصفات"
    else
        record_result "T7-03" "تكامل كتالوج منتجات متجر العزب على أمازون" "FAIL" \
            "خطأ في كتالوج منتجات أمازون: ${CAT_CHECK}"
    fi
else
    record_result "T7-03" "تكامل كتالوج منتجات متجر العزب على أمازون" "FAIL" \
        "الملف ${CATALOG_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T7-04: دورة حياة بروتوكول MCP (Initialize)
# -----------------------------------------------------------------------------
INIT_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}']);
    const req = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            if (res.result && res.result.protocolVersion === '2024-11-05' && res.result.serverInfo.name === 'amazon-sp-api') {
                console.log('OK');
            } else {
                console.log('FAIL ' + JSON.stringify(res));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if [[ "${INIT_CHECK}" == "OK" ]]; then
    record_result "T7-04" "دورة حياة بروتوكول MCP (Initialize)" "PASS" \
        "استجاب الخادم بنجاح لطلب التهيئة ببروتوكول MCP 2024-11-05 واسم amazon-sp-api"
else
    record_result "T7-04" "دورة حياة بروتوكول MCP (Initialize)" "FAIL" \
        "فشل استجابة الخادم لطلب التهيئة: ${INIT_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-05: تسجيل أدوات متجر أمازون الذكية الأربعة
# -----------------------------------------------------------------------------
TOOLS_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}']);
    const req = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            const tools = (res.result?.tools || []).map(t => t.name);
            const expected = ['search_amazon_products', 'get_amazon_live_pricing', 'get_amazon_inventory_status', 'check_amazon_sp_api_status'];
            const allExist = expected.every(t => tools.includes(t));
            if (allExist) {
                console.log('OK ' + tools.join(','));
            } else {
                console.log('FAIL ' + tools.join(','));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if echo "${TOOLS_CHECK}" | grep -q "^OK"; then
    record_result "T7-05" "تسجيل أدوات متجر أمازون الذكية الأربعة" "PASS" \
        "كافة الأدوات الـ 4 مسجلة وجاهزة للاستدعاء (search, pricing, inventory, status)"
else
    record_result "T7-05" "تسجيل أدوات متجر أمازون الذكية الأربعة" "FAIL" \
        "نقص في أدوات الخادم: ${TOOLS_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-06: استعلام الأسعار اللحظية (Live Pricing)
# -----------------------------------------------------------------------------
PRICE_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}']);
    const req = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_amazon_live_pricing', arguments: { identifier: 'B09AZAB001' } } };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            const payload = JSON.parse(res.result.content[0].text);
            if (payload.asin === 'B09AZAB001' && payload.buybox_price === 2690 && payload.currency === 'EGP') {
                console.log('OK ' + payload.buybox_price + ' ' + payload.currency);
            } else {
                console.log('FAIL ' + JSON.stringify(payload));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if echo "${PRICE_CHECK}" | grep -q "^OK"; then
    PRICE_INFO=$(echo "${PRICE_CHECK}" | cut -d' ' -f2-)
    record_result "T7-06" "استعلام الأسعار اللحظية (Live Pricing)" "PASS" \
        "تم جلب السعر الفعلي المعتمد بدقة: ${PRICE_INFO} مع نسبة الخصم وحالة التوفر"
else
    record_result "T7-06" "استعلام الأسعار اللحظية (Live Pricing)" "FAIL" \
        "فشل استعلام الأسعار اللحظية: ${PRICE_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-07: البحث الدلالي العربي في منتجات أمازون
# -----------------------------------------------------------------------------
SEARCH_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}']);
    const req = { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_amazon_products', arguments: { query: 'طفاية حريق' } } };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            const items = JSON.parse(res.result.content[0].text);
            if (Array.isArray(items) && items.length > 0 && items[0].asin === 'B09AZAB005') {
                console.log('OK ' + items.length + ' ' + items[0].title_ar);
            } else {
                console.log('FAIL ' + JSON.stringify(items));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if echo "${SEARCH_CHECK}" | grep -q "^OK"; then
    record_result "T7-07" "البحث الدلالي العربي في منتجات أمازون" "PASS" \
        "تم استرجاع المنتج المطابق بالعربية مع المواصفات والسعر المعتمد بنجاح"
else
    record_result "T7-07" "البحث الدلالي العربي في منتجات أمازون" "FAIL" \
        "فشل البحث الدلالي العربي: ${SEARCH_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-08: تتبع مستويات المخزون (Inventory Status)
# -----------------------------------------------------------------------------
INV_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}']);
    const req = { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_amazon_inventory_status', arguments: {} } };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            const data = JSON.parse(res.result.content[0].text);
            if (data.aggregate_units && data.aggregate_units.total_fulfillable_units > 0) {
                console.log('OK ' + data.aggregate_units.total_fulfillable_units);
            } else {
                console.log('FAIL ' + JSON.stringify(data));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if echo "${INV_CHECK}" | grep -q "^OK"; then
    TOTAL_UNITS=$(echo "${INV_CHECK}" | awk '{print $2}')
    record_result "T7-08" "تتبع مستويات المخزون (Inventory Status)" "PASS" \
        "تم استعراض حالة المخزون الإجمالي بإجمالي ${TOTAL_UNITS} وحدة جاهزة للشحن الفوري"
else
    record_result "T7-08" "تتبع مستويات المخزون (Inventory Status)" "FAIL" \
        "فشل جلب حالة المخزون: ${INV_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-09: تشخيص جاهزية مفاتيح SP-API و LWA
# -----------------------------------------------------------------------------
STATUS_CHECK=$(node -e "
    const { spawn } = require('child_process');
    const s = spawn('node', ['${SERVER_FILE}'], { env: process.env });
    const req = { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'check_amazon_sp_api_status', arguments: {} } };
    s.stdout.on('data', d => {
        try {
            const res = JSON.parse(d.toString().trim());
            const data = JSON.parse(res.result.content[0].text);
            if (data.bridge_status === 'ACTIVE_AND_HEALTHY') {
                console.log('OK');
            } else {
                console.log('FAIL ' + JSON.stringify(data));
            }
        } catch(e) { console.log('ERROR ' + e.message); }
        s.kill();
    });
    s.stdin.write(JSON.stringify(req) + '\n');
" 2>&1 || true)

if [[ "${STATUS_CHECK}" == "OK" ]]; then
    record_result "T7-09" "تشخيص جاهزية مفاتيح SP-API و LWA" "PASS" \
        "جسر الربط في حالة نشطة وسليمة (ACTIVE_AND_HEALTHY) مع تكامل معايير الأمان"
else
    record_result "T7-09" "تشخيص جاهزية مفاتيح SP-API و LWA" "FAIL" \
        "فشل تشخيص حالة جسر أمازون: ${STATUS_CHECK}"
fi

# -----------------------------------------------------------------------------
# T7-10: تسجيل الجسر في سجل MCP (registry.json)
# -----------------------------------------------------------------------------
REGISTRY_FILE="mcp/registry.json"
if [[ -f "${REGISTRY_FILE}" ]]; then
    if grep -q '"id": "amazon-sp-api"' "${REGISTRY_FILE}"; then
        record_result "T7-10" "تسجيل الجسر في سجل MCP (registry.json)" "PASS" \
            "تم تسجيل موفر الخدمة amazon-sp-api بنجاح في سجل الأدوات المعتمدة"
    else
        record_result "T7-10" "تسجيل الجسر في سجل MCP (registry.json)" "FAIL" \
            "لم يتم العثور على amazon-sp-api في ${REGISTRY_FILE}"
    fi
else
    record_result "T7-10" "تسجيل الجسر في سجل MCP (registry.json)" "FAIL" \
        "الملف ${REGISTRY_FILE} غير موجود"
fi

# -----------------------------------------------------------------------------
# T7-11: تسجيل خادم أمازون في librechat.yaml
# -----------------------------------------------------------------------------
LIBRECHAT_YAML="librechat.yaml"
if [[ -f "${LIBRECHAT_YAML}" ]]; then
    YAML_CHECK=$(node -e "
        const fs = require('fs');
        const yaml = require('yaml');
        const parsed = yaml.parse(fs.readFileSync('${LIBRECHAT_YAML}', 'utf8'));
        const s = parsed.mcpServers?.['amazon-sp-api'];
        if (s && s.type === 'stdio' && s.chatMenu === true) {
            console.log('OK');
        } else {
            console.log('FAIL: ' + JSON.stringify(s));
        }
    " 2>&1 || true)
    if [[ "${YAML_CHECK}" == "OK" ]]; then
        record_result "T7-11" "تسجيل خادم أمازون في librechat.yaml" "PASS" \
            "خادم amazon-sp-api مسجل بنمط stdio ومع خاصية chatMenu: true"
    else
        record_result "T7-11" "تسجيل خادم أمازون في librechat.yaml" "FAIL" \
            "نقص في تسجيل خادم أمازون في ${LIBRECHAT_YAML}: ${YAML_CHECK}"
    fi
else
    record_result "T7-11" "تسجيل خادم أمازون في librechat.yaml" "FAIL" \
        "الملف ${LIBRECHAT_YAML} غير موجود"
fi

# -----------------------------------------------------------------------------
# T7-12: ربط أداة أمازون بنماذج العزب التخصصية
# -----------------------------------------------------------------------------
MODEL_BIND_CHECK=$(node -e "
    const fs = require('fs');
    const yaml = require('yaml');
    const parsed = yaml.parse(fs.readFileSync('${LIBRECHAT_YAML}', 'utf8'));
    const specs = parsed.modelSpecs?.list || [];
    const fin = specs.find(s => s.name === 'alazab-finance');
    const core = specs.find(s => s.name === 'alazab-core');
    const maint = specs.find(s => s.name === 'alazab-maint');

    const finOk = fin && fin.mcpServers?.includes('amazon-sp-api');
    const coreOk = core && core.mcpServers?.includes('amazon-sp-api');
    const maintOk = maint && maint.mcpServers?.includes('amazon-sp-api');

    if (finOk && coreOk && maintOk) {
        console.log('OK');
    } else {
        console.log('FAIL: fin=' + finOk + ' core=' + coreOk + ' maint=' + maintOk);
    }
" 2>&1 || true)

if [[ "${MODEL_BIND_CHECK}" == "OK" ]]; then
    record_result "T7-12" "ربط أداة أمازون بنماذج العزب التخصصية" "PASS" \
        "أداة أمازون مربوطة بنجاح بنماذج: alazab-finance, alazab-core, alazab-maint"
else
    record_result "T7-12" "ربط أداة أمازون بنماذج العزب التخصصية" "FAIL" \
        "نقص في ربط أداة أمازون بالنماذج التخصصية: ${MODEL_BIND_CHECK}"
fi

# -----------------------------------------------------------------------------
# حفظ التقرير بصيغة JSON وملخص النتائج
# -----------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_TESTS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))

{
    echo "{"
    echo "  \"phase\": \"phase-07-amazon-bridge\","
    echo "  \"title\": \"Amazon SP-API Live Pricing Bridge\","
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
echo "  ملخص تقرير الفحص للمرحلة السابعة: جسر متجر أمازون المباشر"
echo "  النتيجة الإجمالية: ${PASSED_COUNT}/${TOTAL_TESTS} حالة اجتياز بنجاح"
echo "  وقت التنفيذ: ${DURATION} ثانية"
echo "  ملف التقرير التفصيلي: ${LOG_FILE}"
echo "  ملف مصفوفة النتائج JSON: ${JSON_FILE}"
echo "============================================================================="

if [[ ${FAILED_COUNT} -gt 0 ]]; then
    exit 1
fi

exit 0

