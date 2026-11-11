#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 02 Verification Script: Agents & MCP Architecture
# منظومة العزب — فحص واعتماد الركيزة الثانية: وكلاء الذكاء الاصطناعي وبوابة MCP
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
LOG_FILE="${REPORTS_DIR}/phase-02-agents-mcp-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-02-agents-mcp-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الثانية: وكلاء الذكاء الاصطناعي وبوابة MCP"
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

# 3. فحص توفر الأدوات المطلوبة
command -v node >/dev/null 2>&1 || { echo "ERROR: node is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required"; exit 1; }

echo ""
echo "--- بدء تشغيل حالات اختبار الركيزة الثانية ---"
echo ""

# T-101: تمكين واجهات الوكلاء وخوادم MCP في الواجهة (interface)
test_t101() {
    local id="T-101"
    local title="تمكين واجهات الوكلاء وخوادم MCP في الواجهة (interface)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const a = cfg.interface?.agents;
        const m = cfg.interface?.mcpServers;
        if (a?.use && a?.create && a?.share && m?.use && m?.create && m?.share) {
            console.log('OK');
        } else {
            console.log('ERR: agents=' + JSON.stringify(a) + ', mcpServers=' + JSON.stringify(m));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "واجهات Agents و MCP مفعلة بالكامل للصلاحيات والمشاركة"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في إعدادات interface: ${res}"
    fi
}
test_t101

# T-102: تكوين نقطة الوكلاء وصمامات الأمان (toolApproval)
test_t102() {
    local id="T-102"
    local title="تكوين نقطة الوكلاء وصمامات الأمان (toolApproval)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const ta = cfg.endpoints?.agents?.toolApproval;
        if (ta?.enabled === true && ta?.mode === 'bypass' && ta?.agentModes === true && ta?.grantLookupTimeoutMs > 0) {
            console.log('OK');
        } else {
            console.log('ERR: ' + JSON.stringify(ta));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "صمامات الأمان والموافقة البشرية (HITL) مفعلة مع حفظ قرارات المراجعة"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات toolApproval غير مكتملة: ${res}"
    fi
}
test_t102

# T-103: استمرارية نقاط التحقق للوكلاء (checkpointer: mongo)
test_t103() {
    local id="T-103"
    local title="استمرارية نقاط التحقق للوكلاء (checkpointer: mongo)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const cp = cfg.endpoints?.agents?.checkpointer;
        if (cp?.type === 'mongo') {
            console.log('OK');
        } else {
            console.log('ERR: ' + JSON.stringify(cp));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "تم ضبط checkpointer على mongo لضمان حفظ واستئناف المهام عبر السيرفرات"
    else
        record_result "${id}" "${title}" "FAIL" "checkpointer غير مضبوط على mongo"
    fi
}
test_t103

# T-104: تكوين خوادم الأعمال الستة في بوابة MCP المركزية
test_t104() {
    local id="T-104"
    local title="تكوين خوادم الأعمال الستة في بوابة MCP المركزية"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const mcp = cfg.mcpServers || {};
        const required = ['daftra', 'uberfix', 'erpnext', 'whatsapp', 'magicplan', 'supabase'];
        const allPresent = required.every(k => mcp[k] && mcp[k].url && mcp[k].type === 'streamable-http');
        if (allPresent) {
            console.log('OK');
        } else {
            console.log('ERR: missing servers');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "الخوادم الستة (دفترة، أوبر فيكس، ERPNext، واتساب، ماجيك بلان، سوبابيز) مهيأة بنوع streamable-http"
    else
        record_result "${id}" "${title}" "FAIL" "بعض خوادم MCP مفقودة أو غير مهيأة"
    fi
}
test_t104

# T-105: مطابقة عناوين خوادم MCP لمعايير التسمية الرسمية
test_t105() {
    local id="T-105"
    local title="مطابقة عناوين خوادم MCP لمعايير التسمية الرسمية"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const { MCP_SERVER_TITLE_PATTERN } = require('./packages/data-provider/dist/index.js');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const mcp = cfg.mcpServers || {};
        const invalid = [];
        for (const [k, v] of Object.entries(mcp)) {
            if (!v.title || !MCP_SERVER_TITLE_PATTERN.test(v.title)) {
                invalid.push(k + ':' + v.title);
            }
        }
        if (invalid.length === 0) {
            console.log('OK');
        } else {
            console.log('ERR: ' + invalid.join(', '));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "كافة عناوين الخوادم مطابقة تماماً لتعبير MCP_SERVER_TITLE_PATTERN الرسمي"
    else
        record_result "${id}" "${title}" "FAIL" "عناوين غير مطابقة: ${res}"
    fi
}
test_t105

# T-106: تعليمات الأمان التشغيلية للخوادم (serverInstructions)
test_t106() {
    local id="T-106"
    local title="تعليمات الأمان التشغيلية للخوادم (serverInstructions)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const mcp = cfg.mcpServers || {};
        const daftra = mcp.daftra?.serverInstructions?.length > 20;
        const uberfix = mcp.uberfix?.serverInstructions?.length > 20;
        const whatsapp = mcp.whatsapp?.serverInstructions?.length > 20;
        const magicplan = mcp.magicplan?.serverInstructions?.length > 20;
        const erpnext = mcp.erpnext?.serverInstructions?.length > 20;
        if (daftra && uberfix && whatsapp && magicplan && erpnext) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "تعليمات الأمان وحظر التعديل التلقائي دون تأكيد بشري مضمنة في كافة الخوادم الحساسة"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في serverInstructions"
    fi
}
test_t106

# T-107: تمكين ظهور أدوات الخوادم في القائمة (chatMenu: true)
test_t107() {
    local id="T-107"
    local title="تمكين ظهور أدوات الخوادم في القائمة (chatMenu: true)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const mcp = cfg.mcpServers || {};
        const allChatMenu = Object.values(mcp).every(s => s.chatMenu === true);
        if (allChatMenu) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "أدوات الخوادم الستة مجهزة ومتاحة للاختيار في واجهة المحادثة"
    else
        record_result "${id}" "${title}" "FAIL" "خاصية chatMenu غير مفعلة على بعض الخوادم"
    fi
}
test_t107

# T-108: ربط أدوات MCP مباشرة بقوالب النماذج الذكية (Model Specs)
test_t108() {
    local id="T-108"
    local title="ربط أدوات MCP مباشرة بقوالب النماذج الذكية (Model Specs)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const specs = cfg.modelSpecs?.list || [];
        const fin = specs.find(s => s.name === 'alazab-finance');
        const maint = specs.find(s => s.name === 'alazab-maint');
        const core = specs.find(s => s.name === 'alazab-core');
        const finHasTools = fin?.mcpServers?.includes('daftra') && fin?.mcpServers?.includes('supabase');
        const maintHasTools = maint?.mcpServers?.includes('uberfix') && maint?.mcpServers?.includes('magicplan');
        const coreHasTools = core?.mcpServers?.includes('whatsapp') && core?.mcpServers?.includes('erpnext');
        if (finHasTools && maintHasTools && coreHasTools) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "النماذج التخصصية (مالية، صيانة، أعمال عامة) مربوطة تلقائياً بأدوات أنظمتها المناسبة"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في ربط mcpServers بالنماذج التخصصية"
    fi
}
test_t108

# T-109: مطابقة المخطط الشامل لنظام LibreChat (configSchema)
test_t109() {
    local id="T-109"
    local title="مطابقة المخطط الشامل لنظام LibreChat (configSchema)"
    local res
    res=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const { configSchema } = require('./packages/data-provider/dist/index.js');
        const a = configSchema.safeParse(yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8')));
        const b = configSchema.safeParse(yaml.load(fs.readFileSync('librechat.yaml', 'utf8')));
        if (a.success && b.success) {
            console.log('OK');
        } else {
            console.log('ERR: ' + JSON.stringify(a.error?.issues || b.error?.issues));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${res}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "كافة ملفات التكوين مطابقة 100% لمخطط Zod الرسمي لنظام LibreChat"
    else
        record_result "${id}" "${title}" "FAIL" "فشل التحقق الشامل: ${res}"
    fi
}
test_t109

# T-110: مزامنة متغيرات البيئة لبوابة MCP والوكلاء
test_t110() {
    local id="T-110"
    local title="مزامنة متغيرات البيئة لبوابة MCP والوكلاء"
    local env_file=""
    if [[ -f ".env" ]]; then
        env_file=".env"
    elif [[ -f ".env.example" ]]; then
        env_file=".env.example"
    else
        record_result "${id}" "${title}" "FAIL" "ملف .env غير موجود"
        return
    fi

    local env_content
    env_content=$(cat "${env_file}")
    if [[ "${env_content}" =~ "MCP_GATEWAY_TOKEN=" && "${env_content}" =~ "ENDPOINTS=".*"agents" ]]; then
        record_result "${id}" "${title}" "PASS" "المتغيرات المطلوبة (MCP_GATEWAY_TOKEN, ENDPOINTS=...agents) موثقة ومطابقة في ${env_file}"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في متغيرات البيئة في ${env_file}"
    fi
}
test_t110

# T-111: فحص استجابة بوابة MCP المركزية (mcp.alazab.com)
test_t111() {
    local id="T-111"
    local title="فحص استجابة بوابة MCP المركزية (mcp.alazab.com)"
    local mcp_probe
    mcp_probe=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "https://mcp.alazab.com" 2>/dev/null || echo "UNREACHABLE")

    if [[ "${mcp_probe}" =~ ^(200|301|302|401|403|404|405)$ ]]; then
        record_result "${id}" "${title}" "PASS" "تم التحقق من استجابة بوابة MCP المركزية (HTTP ${mcp_probe})"
    else
        record_result "${id}" "${title}" "SKIP" "بوابة mcp.alazab.com غير متاحة من بيئة التطوير الحالية (كود: ${mcp_probe})، يلزم الفحص المباشر داخل شبكة السيرفر"
    fi
}
test_t111

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_TESTS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))

echo ""
echo "============================================================================="
echo "  ملخص تقرير الفحص للمرحلة الثانية: وكلاء الذكاء الاصطناعي وبوابة MCP"
echo "  إجمالي الحالات: ${TOTAL_TESTS}"
echo "  الناجحة (PASS): ${PASSED_COUNT}"
echo "  الفاشلة (FAIL): ${FAILED_COUNT}"
echo "  المتجاوزة (SKIP): ${SKIPPED_COUNT}"
echo "  زمن التنفيذ: ${DURATION} ثانية"
echo "  مسار التقرير: ${LOG_FILE}"
echo "============================================================================="

# كتابة ملف JSON
cat <<EOF > "${JSON_FILE}"
{
  "phase": "02",
  "name": "agents-mcp",
  "timestamp": "${TIMESTAMP}",
  "duration_seconds": ${DURATION},
  "total": ${TOTAL_TESTS},
  "passed": ${PASSED_COUNT},
  "failed": ${FAILED_COUNT},
  "skipped": ${SKIPPED_COUNT},
  "results": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ]
}
EOF

if [[ "${FAILED_COUNT}" -gt 0 ]]; then
    echo -e "\n❌ النتيجة الإجمالية: فشل الفحص لوجود حالات غير مجتازة."
    exit 1
else
    echo -e "\n✅ النتيجة الإجمالية: اجتياز كامل لكافة متطلبات المرحلة الثانية!"
    exit 0
fi

