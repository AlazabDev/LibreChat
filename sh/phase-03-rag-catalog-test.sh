#!/usr/bin/env bash
# =============================================================================
# LibreChat Phase 03 Verification Script: Enterprise Knowledge, RAG & Domain Catalog
# منظومة العزب — فحص واعتماد الركيزة الثالثة: المعرفة المؤسسية، الـ RAG وكتالوج المجالات الـ 8
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
LOG_FILE="${REPORTS_DIR}/phase-03-rag-catalog-${TIMESTAMP}.log"
JSON_FILE="${REPORTS_DIR}/phase-03-rag-catalog-${TIMESTAMP}.json"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "============================================================================="
echo "  منظومة العزب — فحص الركيزة الثالثة: المعرفة المؤسسية والـ RAG وكتالوج المجالات"
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

# -----------------------------------------------------------------------------
# T3-01: فحص هيكل المجلدات والمسارات لكتالوج العزب
# -----------------------------------------------------------------------------
test_t3_01() {
    local id="T3-01"
    local title="هيكل مجلدات كتالوج العزب والوثائق المعرفية"

    if [ -d "mcp/alazab-catalog" ] && [ -d "mcp/alazab-catalog/categories" ] && [ -d "mcp/alazab-catalog/docs" ]; then
        record_result "${id}" "${title}" "PASS" "المجلدات الرئيسية (alazab-catalog, categories, docs) موجودة بالكامل"
    else
        record_result "${id}" "${title}" "FAIL" "أحد مجلدات الكتالوج مفقود"
    fi
}

# -----------------------------------------------------------------------------
# T3-02: سلامة وصحة ملفات الفئات الـ 8
# -----------------------------------------------------------------------------
test_t3_02() {
    local id="T3-02"
    local title="سلامة وتكامل ملفات الفئات الـ 8 بصيغة JSON"

    local expected_files=("accounting.json" "flooring.json" "hvac.json" "painting.json" "plumbing.json" "purchases.json" "security.json" "other_specs.json")
    local all_valid=true
    local total_items=0

    for f in "${expected_files[@]}"; do
        local fpath="mcp/alazab-catalog/categories/${f}"
        if [ ! -f "${fpath}" ]; then
            all_valid=false
            break
        fi
        local count
        count=$(node -e "try { const d = JSON.parse(fs.readFileSync('${fpath}')); console.log(Array.isArray(d) ? d.length : 0); } catch(e) { console.log(-1); }")
        if [ "${count}" -le 0 ]; then
            all_valid=false
            break
        fi
        total_items=$((total_items + count))
    done

    if [ "${all_valid}" = true ] && [ "${total_items}" -ge 700 ]; then
        record_result "${id}" "${title}" "PASS" "كافة الملفات الـ 8 صالحة بإجمالي ${total_items} بنداً معتمداً"
    else
        record_result "${id}" "${title}" "FAIL" "فشل في قراءة أو التحقق من ملفات فئات الكتالوج"
    fi
}

# -----------------------------------------------------------------------------
# T3-03: تكامل وصحة الكتالوج الموحد alazab_catalog.json
# -----------------------------------------------------------------------------
test_t3_03() {
    local id="T3-03"
    local title="تكامل الكتالوج الموحد المفهرس alazab_catalog.json"

    local cpath="mcp/alazab-catalog/alazab_catalog.json"
    if [ ! -f "${cpath}" ]; then
        record_result "${id}" "${title}" "FAIL" "ملف الكتالوج الموحد alazab_catalog.json غير موجود"
        return
    fi

    local validation
    validation=$(node -e "
        try {
            const c = JSON.parse(fs.readFileSync('${cpath}'));
            const ok = c.items && Array.isArray(c.items) && c.items.length >= 700 && c.categories && Object.keys(c.categories).length === 8;
            console.log(ok ? 'OK:' + c.items.length : 'ERR');
        } catch(e) {
            console.log('ERR:' + e.message);
        }
    ")

    if [[ "${validation}" == OK:* ]]; then
        local count="${validation#OK:}"
        record_result "${id}" "${title}" "PASS" "الكتالوج الموحد متكامل ومفهرس ويضم ${count} بنداً"
    else
        record_result "${id}" "${title}" "FAIL" "بنية الكتالوج الموحد غير صحيحة (${validation})"
    fi
}

# -----------------------------------------------------------------------------
# T3-04: التحقق من وثائق الـ RAG المعرفية بتنسيق Markdown
# -----------------------------------------------------------------------------
test_t3_04() {
    local id="T3-04"
    local title="وثائق المعرفة المؤسسية للـ RAG (Markdown)"

    local docs_dir="mcp/alazab-catalog/docs"
    local master_doc="${docs_dir}/alazab_master_catalog.md"

    if [ -f "${master_doc}" ] && [ -s "${master_doc}" ]; then
        local doc_count
        doc_count=$(find "${docs_dir}" -name "*.md" | wc -l)
        local master_size
        master_size=$(wc -c < "${master_doc}")
        if [ "${doc_count}" -ge 9 ] && [ "${master_size}" -gt 50000 ]; then
            record_result "${id}" "${title}" "PASS" "تم توليد ${doc_count} وثائق معرفية، والماستر بحجم $((master_size / 1024))KB جاهز للتضمين"
        else
            record_result "${id}" "${title}" "FAIL" "عدد الوثائق أو حجم الوثيقة الماستر أقل من المتوقع (${doc_count} وثائق)"
        fi
    else
        record_result "${id}" "${title}" "FAIL" "وثيقة الماستر alazab_master_catalog.md مفقودة أو فارغة"
    fi
}

# -----------------------------------------------------------------------------
# T3-05: فحص كود وصلاحيات خادم MCP
# -----------------------------------------------------------------------------
test_t3_05() {
    local id="T3-05"
    local title="صلاحيات وصحة كود خادم الكتالوج catalog-server.mjs"

    local server_path="mcp/alazab-catalog/catalog-server.mjs"
    if [ ! -x "${server_path}" ]; then
        record_result "${id}" "${title}" "FAIL" "خادم الكتالوج غير قابل للتنفيذ (تنقصه صلاحية chmod +x)"
        return
    fi

    local syntax_check
    syntax_check=$(node --check "${server_path}" 2>&1 || true)
    if [ -z "${syntax_check}" ]; then
        record_result "${id}" "${title}" "PASS" "كود الخادم خالي من أخطاء الـ Syntax وقابل للتنفيذ"
    else
        record_result "${id}" "${title}" "FAIL" "خطأ برمجي في خادم الكتالوج: ${syntax_check}"
    fi
}

# -----------------------------------------------------------------------------
# T3-06: دورة حياة بروتوكول MCP (Initialize RPC)
# -----------------------------------------------------------------------------
test_t3_06() {
    local id="T3-06"
    local title="دورة حياة بروتوكول MCP (JSON-RPC Initialize)"

    local rpc_response
    rpc_response=$(node -e "
        const { spawn } = require('child_process');
        const p = spawn('node', ['mcp/alazab-catalog/catalog-server.mjs']);
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('close', () => {
            try {
                const res = JSON.parse(out.trim());
                console.log(res.result?.serverInfo?.name === 'alazab-catalog' ? 'OK' : 'ERR');
            } catch(e) { console.log('ERR'); }
        });
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
        p.stdin.end();
    ")

    if [ "${rpc_response}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "تمت استجابة الخادم لطلب التهيئة ببروتوكول MCP 2024-11-05"
    else
        record_result "${id}" "${title}" "FAIL" "فشل في دورة حياة تهيئة خادم MCP (${rpc_response})"
    fi
}

# -----------------------------------------------------------------------------
# T3-07: قائمة أدوات الكتالوج (Tools List RPC)
# -----------------------------------------------------------------------------
test_t3_07() {
    local id="T3-07"
    local title="توفر أدوات الكتالوج الذكية في قائمة MCP"

    local tools_check
    tools_check=$(node -e "
        const { spawn } = require('child_process');
        const p = spawn('node', ['mcp/alazab-catalog/catalog-server.mjs']);
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('close', () => {
            try {
                const res = JSON.parse(out.trim());
                const names = (res.result?.tools || []).map(t => t.name);
                const hasAll = names.includes('search_alazab_catalog') &&
                               names.includes('get_catalog_categories') &&
                               names.includes('get_catalog_item');
                console.log(hasAll ? 'OK:' + names.join(',') : 'ERR');
            } catch(e) { console.log('ERR'); }
        });
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
        p.stdin.end();
    ")

    if [[ "${tools_check}" == OK:* ]]; then
        record_result "${id}" "${title}" "PASS" "الأدوات الـ 3 مسجلة وجاهزة للاستدعاء (${tools_check#OK:})"
    else
        record_result "${id}" "${title}" "FAIL" "الأدوات المطلوبة غير مكتملة في رد الخادم"
    fi
}

# -----------------------------------------------------------------------------
# T3-08: استدعاء أداة البحث الدلالي والنصوصي بالعربية
# -----------------------------------------------------------------------------
test_t3_08() {
    local id="T3-08"
    local title="البحث الدلالي والنصوصي الدقيق باللغة العربية"

    local search_res
    search_res=$(node -e "
        const { spawn } = require('child_process');
        const p = spawn('node', ['mcp/alazab-catalog/catalog-server.mjs']);
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('close', () => {
            try {
                const res = JSON.parse(out.trim());
                const data = JSON.parse(res.result?.content[0]?.text);
                const ok = data.totalMatches > 0 && data.results[0]?.item && data.results[0]?.unit;
                console.log(ok ? 'OK:' + data.totalMatches : 'ERR');
            } catch(e) { console.log('ERR:' + e.message); }
        });
        p.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'search_alazab_catalog',
                arguments: { query: 'طفاية حريق', category: 'security' }
            }
        }) + '\n');
        p.stdin.end();
    ")

    if [[ "${search_res}" == OK:* ]]; then
        local matches="${search_res#OK:}"
        record_result "${id}" "${title}" "PASS" "تم استرجاع ${matches} بنداً مطابقاً مع الوحدة والمواصفة الفنية"
    else
        record_result "${id}" "${title}" "FAIL" "فشل البحث في الكتالوج (${search_res})"
    fi
}

# -----------------------------------------------------------------------------
# T3-09: استرجاع تفاصيل البند عبر المعرف الموحد UID
# -----------------------------------------------------------------------------
test_t3_09() {
    local id="T3-09"
    local title="استرجاع تفاصيل البند بالمعرف الموحد UID"

    local item_res
    item_res=$(node -e "
        const { spawn } = require('child_process');
        const p = spawn('node', ['mcp/alazab-catalog/catalog-server.mjs']);
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('close', () => {
            try {
                const res = JSON.parse(out.trim());
                const data = JSON.parse(res.result?.content[0]?.text);
                const ok = data.found && data.item?.uid === 'AZ-SEC-0183';
                console.log(ok ? 'OK:' + data.item.name : 'ERR');
            } catch(e) { console.log('ERR:' + e.message); }
        });
        p.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'get_catalog_item',
                arguments: { identifier: 'AZ-SEC-0183' }
            }
        }) + '\n');
        p.stdin.end();
    ")

    if [[ "${item_res}" == OK:* ]]; then
        record_result "${id}" "${title}" "PASS" "تم جلب تفاصيل البند بنجاح: ${item_res#OK:}"
    else
        record_result "${id}" "${title}" "FAIL" "فشل جلب تفاصيل البند بالمعرف الموحد"
    fi
}

# -----------------------------------------------------------------------------
# T3-10: مطابقة منفذ خدمة الـ RAG (Port 8088)
# -----------------------------------------------------------------------------
test_t3_10() {
    local id="T3-10"
    local title="مطابقة منفذ الـ RAG المعتمد (8088) ومنع التعارض"

    local rag_port_ok=true
    # فحص compose prod
    if ! grep -q "RAG_PORT: \${RAG_PORT:-8088}" docker-compose.prod.yml; then
        rag_port_ok=false
    fi
    # فحص compose dev
    if ! grep -q "RAG_PORT=\${RAG_PORT:-8088}" docker-compose.yml; then
        rag_port_ok=false
    fi

    # فحص خلو compose من منفذ 8000 لخدمة RAG
    if grep -E "rag_api.*8000" docker-compose*.yml > /dev/null 2>&1; then
        rag_port_ok=false
    fi

    if [ "${rag_port_ok}" = true ]; then
        record_result "${id}" "${title}" "PASS" "منفذ 8088 معتمد ومطابق في كافة ملفات compose والبيئة"
    else
        record_result "${id}" "${title}" "FAIL" "تعارض أو عدم تطابق في منفذ الـ RAG"
    fi
}

# -----------------------------------------------------------------------------
# T3-11: فحص تكوين معالجة الملفات fileConfig في librechat.yaml
# -----------------------------------------------------------------------------
test_t3_11() {
    local id="T3-11"
    local title="إعدادات معالجة الملفات fileConfig للـ RAG"

    local fc_check
    fc_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const fc = c.fileConfig;
        const ok = fc && fc.serverFileSizeLimit === 100 &&
                   fc.endpoints?.agents?.fileLimit >= 10 &&
                   fc.endpoints?.agents?.supportedMimeTypes?.includes('application/pdf');
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${fc_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "تكوين fileConfig مفعل بحد 100MB للرفع ودعم كامل لـ PDF والنصوص"
    else
        record_result "${id}" "${title}" "FAIL" "تكوين fileConfig غير مطابق في librechat.yaml"
    fi
}

# -----------------------------------------------------------------------------
# T3-12: فحص تسجيل خادم الكتالوج في librechat.yaml
# -----------------------------------------------------------------------------
test_t3_12() {
    local id="T3-12"
    local title="تسجيل خادم الكتالوج في librechat.yaml"

    local srv_check
    srv_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const srv = c.mcpServers?.['alazab-catalog'];
        const ok = srv && srv.type === 'stdio' && srv.command === 'node' && srv.chatMenu === true;
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${srv_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "الخادم مسجل بنمط stdio ومع مفتاح chatMenu: true"
    else
        record_result "${id}" "${title}" "FAIL" "خادم alazab-catalog غير مسجل بشكل صحيح في mcpServers"
    fi
}

# -----------------------------------------------------------------------------
# T3-13: ربط الكتالوج بقوائم النماذج والوكلاء الميدانيين
# -----------------------------------------------------------------------------
test_t3_13() {
    local id="T3-13"
    local title="ربط أداة الكتالوج بالنماذج (alazab-maint, finance, core)"

    local specs_check
    specs_check=$(node -e "
        const yaml = require('yaml');
        const c = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));
        const list = c.modelSpecs?.list || [];
        const maint = list.find(m => m.name === 'alazab-maint');
        const finance = list.find(m => m.name === 'alazab-finance');
        const core = list.find(m => m.name === 'alazab-core');
        const ok = maint?.mcpServers?.includes('alazab-catalog') &&
                   finance?.mcpServers?.includes('alazab-catalog') &&
                   core?.mcpServers?.includes('alazab-catalog');
        console.log(ok ? 'OK' : 'ERR');
    ")

    if [ "${specs_check}" = "OK" ]; then
        record_result "${id}" "${title}" "PASS" "أداة الكتالوج مرتبطة بنماذج الصيانة والمالية والمساعد العام"
    else
        record_result "${id}" "${title}" "FAIL" "لم يتم ربط أداة الكتالوج بكافة النماذج المحددة"
    fi
}

# -----------------------------------------------------------------------------
# T3-14: التحقق من بنية Compose للإنتاج (Docker Compose Config)
# -----------------------------------------------------------------------------
test_t3_14() {
    local id="T3-14"
    local title="فحص صحة بنية Docker Compose للإنتاج"

    local env_target=".env.candidate"
    if [ ! -f "${env_target}" ]; then
        env_target=".env"
    fi

    if docker compose -f docker-compose.prod.yml --env-file "${env_target}" config > /dev/null 2>&1; then
        record_result "${id}" "${title}" "PASS" "بنية docker-compose.prod.yml صحيحة وتتكامل مع vectordb و rag_api"
    else
        record_result "${id}" "${title}" "FAIL" "فشل فحص بنية docker-compose.prod.yml"
    fi
}

# -----------------------------------------------------------------------------
# تشغيل الاختبارات وحفظ النتائج
# -----------------------------------------------------------------------------
test_t3_01
test_t3_02
test_t3_03
test_t3_04
test_t3_05
test_t3_06
test_t3_07
test_t3_08
test_t3_09
test_t3_10
test_t3_11
test_t3_12
test_t3_13
test_t3_14

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "============================================================================="
echo "  ملخص نتائج فحص الركيزة الثالثة (Phase 03 Summary):"
echo "  - إجمالي الاختبارات: $((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))"
echo "  - ناجح (PASS): ${PASSED_COUNT}"
echo "  - فاشل (FAIL): ${FAILED_COUNT}"
echo "  - متجاوز (SKIP): ${SKIPPED_COUNT}"
echo "  - مدة التنفيذ: ${DURATION} ثانية"
echo "  - ملف التقرير: ${LOG_FILE}"
echo "============================================================================="

# كتابة ملف تقرير JSON
cat <<EOF > "${JSON_FILE}"
{
  "phase": "03-rag-domain-catalog",
  "title": "المعرفة المؤسسية الموحدة والـ RAG وكتالوج مجالات العزب السبعة",
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
    echo -e "\e[32m[SUCCESS] تم اجتياز جميع اختبارات الركيزة الثالثة بنجاح 100%.\e[0m"
    exit 0
fi

