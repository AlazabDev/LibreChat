#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 05 Verification Script: Unified Enterprise UI/UX & Customization
# منظومة العزب — فحص واعتماد الركيزة الخامسة: الهوية البصرية، تجربة المستخدم والصلاحيات
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
LOG_FILE="${REPORTS_DIR}/phase-05-ui-ux-branding-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-05-ui-ux-branding-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الخامسة: الهوية البصرية، تجربة المستخدم والصلاحيات"
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
if [ ! -f "${ENV_FILE}" ]; then
    ENV_FILE=".env"
fi

# -----------------------------------------------------------------------------
# T5-01: فحص عنوان المنظومة واسم التطبيق في client/index.html
# -----------------------------------------------------------------------------
test_t5_01() {
    local id="T5-01"
    local title="عنوان المنظومة واسم التطبيق في client/index.html"

    local index_file="client/index.html"
    if [ ! -f "${index_file}" ]; then
        record_result "${id}" "${title}" "FAIL" "ملف ${index_file} غير موجود"
        return
    fi

    local has_title=false
    local has_app_name=false

    if grep -q "<title>منظومة العزب للذكاء الاصطناعي | Alazab AI</title>" "${index_file}"; then
        has_title=true
    fi
    if grep -q '<meta name="application-name" content="منظومة العزب للذكاء الاصطناعي"' "${index_file}"; then
        has_app_name=true
    fi

    if [ "${has_title}" = true ] && [ "${has_app_name}" = true ]; then
        record_result "${id}" "${title}" "PASS" "تم اعتماد العنوان الرسمي واسم التطبيق في صفحة البداية الرئيسية"
    else
        record_result "${id}" "${title}" "FAIL" "العنوان أو اسم التطبيق غير مطابق للهوية المؤسسية"
    fi
}

# -----------------------------------------------------------------------------
# T5-02: فحص الوصف المؤسسي التعريفي في client/index.html
# -----------------------------------------------------------------------------
test_t5_02() {
    local id="T5-02"
    local title="الوصف المؤسسي التعريفي للبوابة في HTML"

    local index_file="client/index.html"
    if grep -q "منظومة العزب للذكاء الاصطناعي — بوابة الدردشة والوكلاء الموحدة لموظفي ومهندسي وإدارة العزب" "${index_file}"; then
        record_result "${id}" "${title}" "PASS" "الوصف التعريفي بالعربية يعكس الفئات الأربع والهدف المؤسسي بدقة"
    else
        record_result "${id}" "${title}" "FAIL" "الوصف التعريفي في HTML غير مطابق أو مفقود"
    fi
}

# -----------------------------------------------------------------------------
# T5-03: فحص متغير عنوان التطبيق APP_TITLE
# -----------------------------------------------------------------------------
test_t5_03() {
    local id="T5-03"
    local title="متغير عنوان التطبيق الرسمي (APP_TITLE)"

    if grep -q "APP_TITLE=منظومة العزب للذكاء الاصطناعي | Alazab AI" "${ENV_FILE}"; then
        record_result "${id}" "${title}" "PASS" "متغير APP_TITLE موثق ومطابق للاسم الموحد في ملف البيئة"
    else
        record_result "${id}" "${title}" "FAIL" "متغير APP_TITLE غير مطابق للاسم المعتمد"
    fi
}

# -----------------------------------------------------------------------------
# T5-04: فحص التذييل المؤسسي المعتمد CUSTOM_FOOTER
# -----------------------------------------------------------------------------
test_t5_04() {
    local id="T5-04"
    local title="التذييل المؤسسي المعتمد (CUSTOM_FOOTER)"

    if grep -q "CUSTOM_FOOTER=.*منظومة العزب" "${ENV_FILE}"; then
        record_result "${id}" "${title}" "PASS" "التذييل المؤسسي الرسمي معرّف ويعكس هوية المنظومة ونطاق العمل"
    else
        record_result "${id}" "${title}" "FAIL" "متغير CUSTOM_FOOTER غير معرّف أو يحتوي على نص تجريبي"
    fi
}

# -----------------------------------------------------------------------------
# T5-05: فحص رسالة الترحيب ورأس شاشة البداية في librechat.yaml
# -----------------------------------------------------------------------------
test_t5_05() {
    local id="T5-05"
    local title="رسالة الترحيب المخصصة ورأس شاشة البداية"

    local welcome_check
    welcome_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const ok = c.interface?.customWelcome?.includes('منظومة العزب') &&
                   c.interface?.landingHeading === 'greeting' &&
                   c.interface?.landingFooter === true;
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${welcome_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "رسالة الترحيب والتحية المخصصة (landingHeading: greeting) مفعلة"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات customWelcome أو landingHeading غير مطابقة"
    fi
}

# -----------------------------------------------------------------------------
# T5-06: فحص روابط الخصوصية وشروط الاستخدام في الواجهة
# -----------------------------------------------------------------------------
test_t5_06() {
    local id="T5-06"
    local title="روابط الخصوصية وشروط الاستخدام المؤسسية"

    local links_check
    links_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const p = c.interface?.privacyPolicy?.externalUrl;
        const t = c.interface?.termsOfService?.externalUrl;
        const ok = p === 'https://chat.alazab.com/privacy' && t === 'https://chat.alazab.com/terms';
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${links_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "روابط سياسة الخصوصية والشروط موجهة لنطاق المؤسسة الرسمي"
    else
        record_result "${id}" "${title}" "FAIL" "روابط الخصوصية أو الشروط غير مطابقة لنطاق المؤسسة"
    fi
}

# -----------------------------------------------------------------------------
# T5-07: فحص رابط المساعدة والدعم الفني الموحد helpAndFaqURL
# -----------------------------------------------------------------------------
test_t5_07() {
    local id="T5-07"
    local title="رابط مركز المساعدة والدعم الفني الموحد"

    local faq_check
    faq_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        console.log(c.helpAndFaqURL === 'https://chat.alazab.com/help' ? 'OK' : 'ERR');
    ")

    if [ "${faq_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "رابط helpAndFaqURL يشير مباشرة لمركز دعم منظومة العزب"
    else
        record_result "${id}" "${title}" "FAIL" "رابط المساعدة helpAndFaqURL غير مضبوط بالشكل الصحيح"
    fi
}

# -----------------------------------------------------------------------------
# T5-08: سلامة وتكامل ملف الترجمة العربية (client/src/locales/ar/)
# -----------------------------------------------------------------------------
test_t5_08() {
    local id="T5-08"
    local title="سلامة وتكامل ملف التعريب (client/src/locales/ar/)"

    local ar_file="client/src/locales/ar/translation.json"
    if [ ! -f "${ar_file}" ]; then
        record_result "${id}" "${title}" "FAIL" "ملف التعريب ${ar_file} غير موجود"
        return
    fi

    local ar_check
    ar_check=$(node -e "
        try {
            const d = JSON.parse(fs.readFileSync('${ar_file}', 'utf8'));
            const keys = Object.keys(d);
            const ok = keys.length > 500 && d.com_agents_all && d.com_ui_save;
            console.log(ok ? 'OK:' + keys.length : 'ERR');
        } catch(e) { console.log('ERR:' + e.message); }
    ")

    if [[ "${ar_check}" == OK:* ]]; then
        local count="${ar_check#OK:}"
        record_result "${id}" "${title}" "PASS" "ملف التعريب العربي متكامل وخالي من الأخطاء (${count} مفتاح معرب)"
    else
        record_result "${id}" "${title}" "FAIL" "فشل في التحقق من ملف التعريب العربي"
    fi
}

# -----------------------------------------------------------------------------
# T5-09: سلامة وتكامل ملف الترجمة الإنجليزية (client/src/locales/en/)
# -----------------------------------------------------------------------------
test_t5_09() {
    local id="T5-09"
    local title="سلامة ملف الترجمة الإنجليزية الموازية (en)"

    local en_file="client/src/locales/en/translation.json"
    local en_check
    en_check=$(node -e "
        try {
            const d = JSON.parse(fs.readFileSync('${en_file}', 'utf8'));
            const ok = Object.keys(d).length > 1000;
            console.log(ok ? 'OK' : 'ERR');
        } catch(e) { console.log('ERR'); }
    ")

    if [ "${en_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "ملف الترجمة الإنجليزية متكامل وصالح برمجياً"
    else
        record_result "${id}" "${title}" "FAIL" "فشل التحقق من ملف الترجمة الإنجليزية"
    fi
}

# -----------------------------------------------------------------------------
# T5-10: تنظيم وطريقة عرض النماذج (Model Specs Layout)
# -----------------------------------------------------------------------------
test_t5_10() {
    local id="T5-10"
    local title="إبراز نماذج العزب أولاً مع مرونة الاختيار (prioritize: true)"

    local layout_check
    layout_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const ok = c.modelSpecs?.prioritize === true && c.modelSpecs?.enforce === false;
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${layout_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "تم إبراز نماذج العزب في واجهة الاختيار مع إتاحة التبديل السلس"
    else
        record_result "${id}" "${title}" "FAIL" "إعدادات prioritize أو enforce لقوائم النماذج غير مطابقة"
    fi
}

# -----------------------------------------------------------------------------
# T5-11: تغطية الفئات المؤسسية الـ 4 بنماذج تخصصية
# -----------------------------------------------------------------------------
test_t5_11() {
    local id="T5-11"
    local title="تمثيل الفئات الـ 4 (المدراء، الموظفين، الفنيين، والمالية)"

    local personas_check
    personas_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const list = (c.modelSpecs?.list || []).map(m => m.name);
        const hasSol = list.includes('alazab-sol');      // المدراء والقرارات
        const hasCore = list.includes('alazab-core');    // الموظفون والمهام
        const hasMaint = list.includes('alazab-maint');  // الفنيون والصيانة
        const hasFin = list.includes('alazab-finance');  // المالية والحسابات
        const ok = hasSol && hasCore && hasMaint && hasFin;
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${personas_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "الفئات الأربع ممثلة بنماذج تخصصية دقيقة (الاستدلال، الأعمال، الصيانة، المالية)"
    else
        record_result "${id}" "${title}" "FAIL" "نقص في تغطية إحدى الفئات الأساسية في قوائم النماذج"
    fi
}

# -----------------------------------------------------------------------------
# T5-12: جودة وتكامل أسئلة الانطلاق السريعة بالعربية (Starters)
# -----------------------------------------------------------------------------
test_t5_12() {
    local id="T5-12"
    local title="أسئلة الانطلاق السريعة بالعربية لكافة النماذج (Conversation Starters)"

    local starters_check
    starters_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const list = c.modelSpecs?.list || [];
        const allHaveStarters = list.length === 8 && list.every(m => Array.isArray(m.conversation_starters) && m.conversation_starters.length >= 2);
        console.log(allHaveStarters ? 'OK' : 'ERR');
    ")

    if [ "${starters_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "كافة النماذج الـ 8 مزودة بأسئلة انطلاق مهنية عربية تسرع وتسهل الاستخدام"
    else
        record_result "${id}" "${title}" "FAIL" "بعض النماذج تفتقر لأسئلة الانطلاق السريعة أو عددها أقل من المطلوب"
    fi
}

# -----------------------------------------------------------------------------
# T5-13: سياسات الصلاحيات والمشاركة (Role-Based Sharing Controls)
# -----------------------------------------------------------------------------
test_t5_13() {
    local id="T5-13"
    local title="سياسات الصلاحيات والمشاركة المنضبطة (RBAC Controls)"

    local rbac_check
    rbac_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const iface = c.interface || {};
        const promptsOk = iface.prompts?.public === false && iface.prompts?.share === false;
        const agentsOk = iface.agents?.share === true;
        const mcpOk = iface.mcpServers?.share === true;
        console.log(promptsOk && agentsOk && mcpOk ? 'OK' : 'ERR');
    ")

    if [ "${rbac_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "حظر المشاركة العامة العشوائية وتمكين مشاركة الوكلاء والأدوات المعتمدة"
    else
        record_result "${id}" "${title}" "FAIL" "سياسات المشاركة في interface غير مضبوطة وفق الضوابط المؤسسية"
    fi
}

# -----------------------------------------------------------------------------
# T5-14: مطابقة المخطط الشامل لنظام LibreChat (configSchema)
# -----------------------------------------------------------------------------
test_t5_14() {
    local id="T5-14"
    local title="مطابقة المخطط الرسمي الشامل لنظام LibreChat (configSchema)"

    local schema_check
    schema_check=$(node -e "
        async function run() {
            try {
                const { configSchema } = await import('./packages/data-provider/dist/index.mjs');
                const yaml = require('yaml');
                const doc = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
                const res = configSchema.safeParse(doc);
                console.log(res.success ? 'OK' : 'ERR:' + JSON.stringify(res.error.issues));
            } catch(e) { console.log('ERR:' + e.message); }
        }
        run();
    ")

    if [[ "${schema_check}" == OK* ]]; then
        record_result "${id}" "${title}" "PASS" "ملف librechat.yaml مطابق تماماً بنسبة 100% لمخطط Zod الرسمي"
    else
        record_result "${id}" "${title}" "FAIL" "فشل في التحقق البرمجي مع configSchema: ${schema_check}"
    fi
}

# -----------------------------------------------------------------------------
# تشغيل الاختبارات
# -----------------------------------------------------------------------------
test_t5_01
test_t5_02
test_t5_03
test_t5_04
test_t5_05
test_t5_06
test_t5_07
test_t5_08
test_t5_09
test_t5_10
test_t5_11
test_t5_12
test_t5_13
test_t5_14

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "============================================================================="
echo "  ملخص نتائج فحص الركيزة الخامسة (Phase 05 Summary):"
echo "  - إجمالي الاختبارات: $((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))"
echo "  - ناجح (PASS): ${PASSED_COUNT}"
echo "  - فاشل (FAIL): ${FAILED_COUNT}"
echo "  - متجاوز (SKIP): ${SKIPPED_COUNT}"
echo "  - مدة التنفيذ: ${DURATION} ثانية"
echo "  - ملف التقرير: ${LOG_FILE}"
echo "============================================================================="

cat <<EOF > "${JSON_FILE}"
{
  "phase": "05-ui-ux-branding",
  "title": "الهوية البصرية، تجربة المستخدم الموحدة، وتخصيص الصلاحيات",
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
    echo -e "\e[32m[SUCCESS] تم اجتياز جميع اختبارات الركيزة الخامسة بنجاح 100%.\e[0m"
    exit 0
fi

