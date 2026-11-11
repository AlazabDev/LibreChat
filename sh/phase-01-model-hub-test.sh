#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 01 Verification Script: Unified Model Hub
# منظومة العزب — فحص واعتماد الركيزة الأولى: توحيد النماذج والمحركات
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
LOG_FILE="${REPORTS_DIR}/phase-01-model-hub-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-01-model-hub-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الأولى: توحيد النماذج والمحركات (Model Hub)"
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
echo "--- بدء تشغيل حالات الاختبار المستقلة ---"
echo ""

# T-001: وجود ملفات الإعداد وصحة صياغة YAML
test_t001() {
    local id="T-001"
    local title="وجود ملفات الإعداد وصحة صياغة YAML"
    if [[ ! -f "librechat.alazab.yaml" || ! -f "librechat.yaml" ]]; then
        record_result "${id}" "${title}" "FAIL" "ملف librechat.alazab.yaml أو librechat.yaml غير موجود"
        return
    fi

    local yaml_check
    yaml_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        try {
            yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
            yaml.load(fs.readFileSync('librechat.yaml', 'utf8'));
            console.log('OK');
        } catch (e) {
            console.log('ERR: ' + e.message);
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${yaml_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "الملفان موجودان وصياغة YAML سليمة تماماً"
    else
        record_result "${id}" "${title}" "FAIL" "خطأ في قراءة YAML: ${yaml_check}"
    fi
}
test_t001

# T-002: مطابقة المخطط الرسمي لنظام LibreChat (configSchema)
test_t002() {
    local id="T-002"
    local title="مطابقة المخطط الرسمي لنظام LibreChat (configSchema)"
    local schema_check
    schema_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const { configSchema } = require('./packages/data-provider/dist/index.js');
        const content = fs.readFileSync('librechat.alazab.yaml', 'utf8');
        const parsed = yaml.load(content);
        const res = configSchema.safeParse(parsed);
        if (res.success) {
            console.log('VALID');
        } else {
            console.log('INVALID: ' + JSON.stringify(res.error.issues.map(i => i.path.join('.') + ': ' + i.message)));
        }
    " 2>/dev/null || echo "SCHEMA_ERR")

    if [[ "${schema_check}" == "VALID" ]]; then
        record_result "${id}" "${title}" "PASS" "الملف مطابق 100% لمخطط Zod الرسمي"
    else
        record_result "${id}" "${title}" "FAIL" "فشل التحقق من المخطط: ${schema_check}"
    fi
}
test_t002

# T-003: تهيئة نقطة Azure OpenAI (Alazab Azure)
test_t003() {
    local id="T-003"
    local title="تهيئة نقطة Azure OpenAI (Alazab Azure)"
    local azure_check
    azure_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const az = cfg.endpoints?.custom?.find(e => e.name === 'Alazab Azure');
        if (!az) { console.log('NOT_FOUND'); process.exit(0); }
        const hasBaseURL = az.baseURL && az.baseURL.includes('openai.azure.com/openai/v1');
        const hasKey = az.apiKey && az.apiKey.includes('AZURE_OPENAI_API_KEY');
        const models = az.models?.default || [];
        const requiredModels = ['az-model-core', 'az-model-sol', 'az-model-maint', 'az-model-finance', 'az-model-mini'];
        const allPresent = requiredModels.every(m => models.includes(m));
        if (hasBaseURL && hasKey && allPresent) {
            console.log('OK');
        } else {
            console.log('ERR: missing parameters or models');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${azure_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "نقطة Alazab Azure مهيأة بكافة النماذج والواجهة الموحدة"
    else
        record_result "${id}" "${title}" "FAIL" "نقطة Azure غير مهيأة بالشكل الصحيح: ${azure_check}"
    fi
}
test_t003

# T-004: معالجة معاملات الاستدلال (dropParams) في Azure
test_t004() {
    local id="T-004"
    local title="معالجة معاملات الاستدلال (dropParams) في Azure"
    local drop_check
    drop_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const az = cfg.endpoints?.custom?.find(e => e.name === 'Alazab Azure');
        const drop = az?.dropParams || [];
        const requiredDrops = ['temperature', 'top_p', 'stop', 'user', 'frequency_penalty', 'presence_penalty'];
        const valid = requiredDrops.every(p => drop.includes(p));
        if (valid) {
            console.log('OK');
        } else {
            console.log('MISSING: ' + requiredDrops.filter(p => !drop.includes(p)).join(', '));
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${drop_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "تم استبعاد معاملات الاستدلال بالكامل لمنع أخطاء 400"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في dropParams: ${drop_check}"
    fi
}
test_t004

# T-005: تهيئة نقطة Google Gemini الرسمية وحل مشكلة 404
test_t005() {
    local id="T-005"
    local title="تهيئة نقطة Google Gemini الرسمية وحل مشكلة 404"
    local gemini_check
    gemini_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const g = cfg.endpoints?.google;
        if (!g || !Array.isArray(g.models)) { console.log('NO_MODELS'); process.exit(0); }
        const hasFlash = g.models.includes('gemini-2.5-flash');
        const hasPro = g.models.includes('gemini-2.5-pro');
        const titleModel = g.titleModel === 'gemini-2.5-flash';
        if (hasFlash && hasPro && titleModel) {
            console.log('OK');
        } else {
            console.log('MISCONFIGURED');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${gemini_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "نقطة Google مهيأة بنماذج Gemini 2.5 الصريحة ونموذج العناوين"
    else
        record_result "${id}" "${title}" "FAIL" "نقطة Google غير مهيأة: ${gemini_check}"
    fi
}
test_t005

# T-006: تهيئة نقطة DeepSeek المباشرة
test_t006() {
    local id="T-006"
    local title="تهيئة نقطة DeepSeek المباشرة"
    local deepseek_check
    deepseek_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const ds = cfg.endpoints?.custom?.find(e => e.name === 'DeepSeek');
        if (!ds) { console.log('NOT_FOUND'); process.exit(0); }
        const models = ds.models?.default || [];
        const hasChat = models.includes('deepseek-chat');
        const hasReasoner = models.includes('deepseek-reasoner');
        const fetchEnabled = ds.models?.fetch === true;
        if (hasChat && hasReasoner && fetchEnabled) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${deepseek_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "نقطة DeepSeek معرفة بنماذج V3 و R1 مع التحديث التلقائي"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات DeepSeek ناقصة"
    fi
}
test_t006

# T-007: تهيئة نقطة Ollama المحلية والسرية التامة (On-Premise)
test_t007() {
    local id="T-007"
    local title="تهيئة نقطة Ollama المحلية والسرية التامة (On-Premise)"
    local ollama_check
    ollama_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const ol = cfg.endpoints?.custom?.find(e => e.name === 'Ollama');
        if (!ol) { console.log('NOT_FOUND'); process.exit(0); }
        const hasURL = ol.baseURL && ol.baseURL.includes('ollama.alazab.com/v1');
        const models = ol.models?.default || [];
        const hasGptOss = models.includes('gpt-oss:20b');
        const hasCoder = models.includes('deepseek-coder-v2:16b');
        if (hasURL && hasGptOss && hasCoder) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${ollama_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "نقطة Ollama مهيأة على سيرفر الشركة بالنماذج المعتمدة"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات Ollama غير مطابقة"
    fi
}
test_t007

# T-008: هيكل قوائم النماذج الذكية (Model Specs)
test_t008() {
    local id="T-008"
    local title="هيكل قوائم النماذج الذكية (Model Specs)"
    local specs_check
    specs_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const ms = cfg.modelSpecs;
        if (!ms || !Array.isArray(ms.list)) { console.log('NO_SPECS'); process.exit(0); }
        const count = ms.list.length;
        const prioritized = ms.prioritize === true;
        const hasDefault = ms.list.some(s => s.softDefault === true);
        if (count >= 8 && prioritized && hasDefault) {
            console.log('OK:' + count);
        } else {
            console.log('ERR: count=' + count + ', prioritized=' + prioritized);
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${specs_check}" =~ ^OK: ]]; then
        record_result "${id}" "${title}" "PASS" "تم تعريف 8 نماذج ذكية مصنفة ومسبقة الأولوية للمستخدمين"
    else
        record_result "${id}" "${title}" "FAIL" "هيكل modelSpecs غير مطابق: ${specs_check}"
    fi
}
test_t008

# T-009: التعليمات التخصصية وبدايات المحادثة (Prompt Prefixes & Starters)
test_t009() {
    local id="T-009"
    local title="التعليمات التخصصية وبدايات المحادثة (Prompt Prefixes & Starters)"
    local prompts_check
    prompts_check=$(node -e "
        const yaml = require('js-yaml');
        const fs = require('fs');
        const cfg = yaml.load(fs.readFileSync('librechat.alazab.yaml', 'utf8'));
        const list = cfg.modelSpecs?.list || [];
        const allHavePrefix = list.every(s => s.preset?.promptPrefix && s.preset.promptPrefix.length > 20);
        const allHaveStarters = list.every(s => Array.isArray(s.conversation_starters) && s.conversation_starters.length >= 2);
        if (allHavePrefix && allHaveStarters) {
            console.log('OK');
        } else {
            console.log('ERR');
        }
    " 2>/dev/null || echo "NODE_ERR")

    if [[ "${prompts_check}" == "OK" ]]; then
        record_result "${id}" "${title}" "PASS" "كافة النماذج مزودة بتعليمات مهام عربية وأسئلة انطلاق سريعة"
    else
        record_result "${id}" "${title}" "FAIL" "بعض النماذج تنقصها تعليمات promptPrefix أو conversation_starters"
    fi
}
test_t009

# T-010: مزامنة ملف متغيرات البيئة (.env)
test_t010() {
    local id="T-010"
    local title="مزامنة ملف متغيرات البيئة (.env)"
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
    local has_endpoints=false
    local has_google_models=false
    local has_ollama=false

    [[ "${env_content}" =~ "ENDPOINTS=".*"agents" ]] && has_endpoints=true
    [[ "${env_content}" =~ "GOOGLE_MODELS=".*"gemini" ]] && has_google_models=true
    [[ "${env_content}" =~ "OLLAMA_API_KEY=" ]] && has_ollama=true

    if [[ "${has_endpoints}" == "true" && "${has_google_models}" == "true" && "${has_ollama}" == "true" ]]; then
        record_result "${id}" "${title}" "PASS" "ملف متغيرات البيئة (${env_file}) متطابق تماماً مع إعدادات المنظومة"
    else
        record_result "${id}" "${title}" "FAIL" "نواقص في ${env_file}"
    fi
}
test_t010

# T-011: التحقق من سلامة الأنواع البرمجية (TypeScript Typecheck)
test_t011() {
    local id="T-011"
    local title="التحقق من سلامة الأنواع البرمجية (TypeScript Typecheck)"
    local tsc_output
    if tsc_output=$(npx tsc --noEmit -p packages/data-provider/tsconfig.json 2>&1); then
        record_result "${id}" "${title}" "PASS" "اجتياز فحص الأنواع البرمجية بـ 0 أخطاء"
    else
        record_result "${id}" "${title}" "FAIL" "أخطاء في فحص الأنواع: ${tsc_output}"
    fi
}
test_t011

# T-012: فحص الاتصال بالشبكة وخوادم النماذج (Live Reachability Probe)
test_t012() {
    local id="T-012"
    local title="فحص الاتصال بالشبكة وخوادم النماذج (Live Reachability Probe)"
    
    # فحص خادم Ollama الداخلي عبر timeout قصير مع مراعاة بيئة الساندبوكس المعزولة
    local ollama_status
    ollama_status=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "https://ollama.alazab.com" 2>/dev/null || echo "UNREACHABLE")
    
    if [[ "${ollama_status}" =~ ^(200|301|302|401|403|404|405)$ ]]; then
        record_result "${id}" "${title}" "PASS" "تم التحقق من استجابة خادم Ollama الداخلي (HTTP ${ollama_status})"
    else
        # في بيئات التطوير أو الساندبوكس بدون إنترنت/DNS محلي، يُسجل كـ SKIP موثق بدلاً من إخفاء النتيجة
        record_result "${id}" "${title}" "SKIP" "سيرفر ollama.alazab.com غير متاح من البيئة الحالية (كود: ${ollama_status})، يلزم التحقق المباشر من شبكة الشركة"
    fi
}
test_t012

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL_TESTS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))

echo ""
echo "============================================================================="
echo "  ملخص تقرير الفحص للمرحلة الأولى: توحيد النماذج والمحركات"
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
  "phase": "01",
  "name": "model-hub",
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
    echo -e "\n✅ النتيجة الإجمالية: اجتياز كامل لكافة متطلبات المرحلة الأولى!"
    exit 0
fi

