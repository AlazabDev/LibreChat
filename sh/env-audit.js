#!/usr/bin/env node
/**
 * =============================================================================
 * LibreChat Environment Variable Auditor & Codebase Comparator
 * فاحص ومقارن متغيرات البيئة لمنظومة LibreChat
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal formatting
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
};

// Parse command line arguments
const args = process.argv.slice(2);
let envPath = '.env';
let showAll = false;
let showOnlyMissing = false;
let showOnlyCustom = false;
let outputJson = false;

for (const arg of args) {
  if (arg.startsWith('--env=')) {
    envPath = arg.split('=')[1];
  } else if (arg === '--all' || arg === '-a') {
    showAll = true;
  } else if (arg === '--missing' || arg === '-m') {
    showOnlyMissing = true;
  } else if (arg === '--custom' || arg === '-c') {
    showOnlyCustom = true;
  } else if (arg === '--json') {
    outputJson = true;
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (!arg.startsWith('-') && fs.existsSync(arg)) {
    envPath = arg;
  }
}

function printHelp() {
  console.log(`
${C.bold}استخدام أداة فحص ومقارنة متغيرات البيئة (LibreChat Env Auditor)${C.reset}

  node sh/env-audit.js [options]
  bash sh/env-audit.sh [options]

${C.bold}الخيارات المتاحة (Options):${C.reset}
  --env=<path>       تحديد مسار ملف البيئة (الافتراضي: .env)
  --all, -a          عرض كافة المتغيرات المكتشفة في الكود (بما فيها الاختيارية)
  --missing, -m      عرض المتغيرات الموجودة في الكود وغير المعرفة في ملف البيئة فقط
  --custom, -c       عرض المتغيرات المعرفة في ملف البيئة وليست في الكود الأساسي (تكاملات مخصصة)
  --json             إخراج التقرير بصيغة JSON
  --help, -h         عرض رسالة المساعدة
`);
}

// Secret masking helper
function maskSecret(key, value) {
  if (!value || typeof value !== 'string') return '';
  const sensitivePatterns = /KEY|SECRET|PASSWORD|PASSWARD|TOKEN|PRIVATE|IV|HASH|SALT/i;
  if (!sensitivePatterns.test(key)) return value;
  if (value.length <= 8) return '********';
  return value.slice(0, 3) + '...' + value.slice(-3);
}

// Read and parse env file
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const envMap = new Map();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();

    // Strip inline comments if any (without stripping URLs like http://)
    const commentMatch = val.match(/^(.*?)(\s+#.*)$/);
    if (commentMatch && !val.includes('://')) {
      val = commentMatch[1].trim();
    }

    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    envMap.set(key, { value: val, line: i + 1 });
  }

  return envMap;
}

// Scan codebase for environment variable usages
function scanCodebase() {
  const codeVars = new Map(); // varName -> { files: Set, count: number }
  const searchDirs = ['api', 'client', 'packages', 'deploy', 'config'];
  const extensions = ['.js', '.ts', '.tsx', '.jsx', '.cjs', '.mjs', '.yml', '.yaml', '.json'];
  const rootFiles = [
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.langfuse-fanout.yml',
    'librechat.yaml',
    'librechat.alazab.yaml',
    'Dockerfile',
    'Dockerfile.multi',
  ];

  function addMatch(varName, filePath) {
    if (!varName || varName.length < 2) return;
    // Exclude plain numbers or obvious non-variables
    if (/^[0-9]+$/.test(varName)) return;
    if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) return;

    if (!codeVars.has(varName)) {
      codeVars.set(varName, { files: new Set(), count: 0 });
    }
    const entry = codeVars.get(varName);
    entry.files.add(path.relative(process.cwd(), filePath));
    entry.count++;
  }

  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // 1. process.env.VAR_NAME
      const p1 = /process\.env\.([A-Z0-9_]+)/g;
      let m;
      while ((m = p1.exec(content)) !== null) addMatch(m[1], filePath);

      // 2. process.env['VAR_NAME'] or ["VAR_NAME"]
      const p2 = /process\.env\[['"]([A-Z0-9_]+)['"]\]/g;
      while ((m = p2.exec(content)) !== null) addMatch(m[1], filePath);

      // 3. import.meta.env.VAR_NAME
      const p3 = /import\.meta\.env\.([A-Z0-9_]+)/g;
      while ((m = p3.exec(content)) !== null) addMatch(m[1], filePath);

      // 4. import.meta.env['VAR_NAME']
      const p4 = /import\.meta\.env\[['"]([A-Z0-9_]+)['"]\]/g;
      while ((m = p4.exec(content)) !== null) addMatch(m[1], filePath);

      // 5. ${VAR_NAME} or ${VAR_NAME:-default} in YAML/Docker/Compose
      const p5 = /\$\{([A-Z][A-Z0-9_]+)(?::-[^}]*)?\}/g;
      while ((m = p5.exec(content)) !== null) addMatch(m[1], filePath);
    } catch (e) {}
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name === 'coverage' ||
        entry.name === 'reports' ||
        entry.name === 'scratch' ||
        entry.name === '.system_generated'
      )
        continue;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext) || entry.name.startsWith('docker-compose') || entry.name.startsWith('Dockerfile')) {
          scanFile(full);
        }
      }
    }
  }

  for (const dir of searchDirs) walk(dir);
  for (const rf of rootFiles) {
    if (fs.existsSync(rf)) scanFile(rf);
  }

  return codeVars;
}

// Classify variable category
function getCategory(key) {
  if (/^(HOST|PORT|DOMAIN_|TRUST_PROXY|NO_INDEX|CONFIG_PATH|UID|GID|NODE_)/.test(key)) {
    return '1. الخادم والشبكة (Server & Network)';
  }
  if (/^(JWT_|CREDS_|ADMIN_PANEL_|SESSION_|REFRESH_TOKEN_|ENFORCE_|MIN_PASSWORD_|ALLOW_)/.test(key)) {
    return '2. الأمان والمصادقة (Security & Auth)';
  }
  if (/^(MONGO_|MEILI_|SUPABASE_|DATABASE_|POSTGRES_|REDIS_|CTX_)/.test(key)) {
    return '3. قواعد البيانات والتخزين (Databases & Storage)';
  }
  if (/^(AZURE_|FOUNDRY_|GOOGLE_|OPENAI_|DEEPSEEK_|OLLAMA_|ENDPOINTS|ANTHROPIC_|BEDROCK_|GROQ_|MISTRAL_)/.test(key)) {
    return '4. محركات ونماذج الذكاء الاصطناعي (AI Models & Providers)';
  }
  if (/^(MCP_|ALAZAB_MCP_|WRITE_CONFIRM|WRITE_RATE)/.test(key)) {
    return '5. بوابة MCP وصمامات الأمان (MCP Gateway & HITL)';
  }
  if (/^(DAFTRA_|ERP_|FRAPPE_|META_|WHATSAPP_|GITHUB_|AMAZON_|ALAZAB_|AZCCTV_|ACCESS_TOKEN|VERIFY_TOKEN|APP_ID|APP_SECRET)/.test(key)) {
    return '6. تكاملات أنظمة الأعمال (Business Integrations)';
  }
  if (/^EMAIL_/.test(key)) {
    return '7. خدمة البريد الإلكتروني (Email Service)';
  }
  if (/^RAG_/.test(key)) {
    return '8. البحث في الملفات والمعرفة (RAG Service)';
  }
  if (/^(LANGFUSE_|OTEL_|CONSOLE_|LOG_|DEBUG_|AGENT_DEBUG_)/.test(key)) {
    return '9. المراقبة والسجلات (Observability & Logging)';
  }
  if (/^(IMAGE_TAG|BACKUP_|DOCKER_)/.test(key)) {
    return '10. النشر وحاويات Docker (Production & Docker)';
  }
  return '11. إضافات وخيارات أخرى (Other & Plugins)';
}

function main() {
  const envMap = parseEnv(envPath);
  if (!envMap) {
    console.error(`${C.red}خطأ: لم يتم العثور على ملف البيئة: ${envPath}${C.reset}`);
    process.exit(1);
  }

  const codeVars = scanCodebase();

  // Categorize comparison sets
  const matched = [];       // Found in code & set in .env
  const customInEnv = [];   // Set in .env & not found in code (custom integrations/docker/etc)
  const unsetInCode = [];   // Found in code & not set in .env (defaults apply)

  // 1. Process all variables present in .env
  for (const [key, meta] of envMap.entries()) {
    if (codeVars.has(key)) {
      matched.push({
        key,
        value: meta.value,
        line: meta.line,
        files: Array.from(codeVars.get(key).files),
        usages: codeVars.get(key).count,
        category: getCategory(key),
      });
    } else {
      customInEnv.push({
        key,
        value: meta.value,
        line: meta.line,
        category: getCategory(key),
      });
    }
  }

  // 2. Process variables in code that are missing from .env
  for (const [key, data] of codeVars.entries()) {
    if (!envMap.has(key)) {
      unsetInCode.push({
        key,
        files: Array.from(data.files),
        usages: data.count,
        category: getCategory(key),
      });
    }
  }

  // Sort lists
  matched.sort((a, b) => a.key.localeCompare(b.key));
  customInEnv.sort((a, b) => a.key.localeCompare(b.key));
  unsetInCode.sort((a, b) => a.key.localeCompare(b.key));

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          envPath,
          timestamp: new Date().toISOString(),
          summary: {
            totalInEnv: envMap.size,
            totalInCode: codeVars.size,
            matchedCount: matched.length,
            customInEnvCount: customInEnv.length,
            unsetInCodeCount: unsetInCode.length,
          },
          matched,
          customInEnv,
          unsetInCode,
        },
        null,
        2
      )
    );
    return;
  }

  // Terminal Render
  console.log('\n' + C.bold + C.cyan + '═'.repeat(80) + C.reset);
  console.log(
    C.bold +
      C.white +
      '  🔍 فاحص ومقارن متغيرات البيئة لمنظومة LibreChat (Codebase Env Auditor)' +
      C.reset
  );
  console.log(
    C.dim +
      `  الملف المفحوص: ${C.bold}${envPath}${C.reset}${C.dim} | التاريخ: ${new Date().toLocaleString('ar-EG')}` +
      C.reset
  );
  console.log(C.bold + C.cyan + '═'.repeat(80) + C.reset + '\n');

  // Summary Cards
  console.log(C.bold + '📊 ملخص المقارنة الإجمالي (Executive Summary):' + C.reset);
  console.log('┌' + '─'.repeat(78) + '┐');
  console.log(
    `│  ${C.green}● متغيرات نشطة ومستخدمة في الكود (Configured in Code):${C.reset}  ${C.bold}${String(
      matched.length
    ).padEnd(4)}${C.reset}                       │`
  );
  console.log(
    `│  ${C.cyan}★ متغيرات تكامل مخصصة في .env (Custom / Business Systems):${C.reset}  ${C.bold}${String(
      customInEnv.length
    ).padEnd(4)}${C.reset}                       │`
  );
  console.log(
    `│  ${C.gray}○ متغيرات في الكود تعتمد القيمة الافتراضية (Code Defaults):${C.reset}   ${C.bold}${String(
      unsetInCode.length
    ).padEnd(4)}${C.reset}                       │`
  );
  console.log(
    `│  ${C.white}Σ إجمالي متغيرات ملف .env:${C.reset} ${C.bold}${String(envMap.size).padEnd(
      4
    )}${C.reset} | ${C.white}Σ إجمالي متغيرات الكود المكتشفة:${C.reset} ${C.bold}${String(
      codeVars.size
    ).padEnd(4)}${C.reset} │`
  );
  console.log('└' + '─'.repeat(78) + '┘\n');

  // Mode: show only missing
  if (showOnlyMissing) {
    console.log(
      C.bold +
        C.yellow +
        `⚠️ المتغيرات المكتشفة في الكود وغير المعرفة في ${envPath} (${unsetInCode.length} متغيراً):` +
        C.reset
    );
    console.log(
      C.dim + '   (هذه المتغيرات اختيارية وتعمل بقيمها الافتراضية المبرمجة داخل النظام)' + C.reset + '\n'
    );
    for (const item of unsetInCode) {
      const topFiles = item.files.slice(0, 2).join(', ');
      console.log(
        `  ${C.yellow}○${C.reset} ${C.bold}${item.key.padEnd(35)}${C.reset} ${C.dim}← ${topFiles}${C.reset}`
      );
    }
    return;
  }

  // Mode: show only custom
  if (showOnlyCustom) {
    console.log(
      C.bold +
        C.cyan +
        `★ متغيرات التكامل المخصصة المعرفة في ${envPath} (${customInEnv.length} متغيراً):` +
        C.reset
    );
    console.log(
      C.dim +
        '   (تُستخدم في خوادم MCP، تكاملات ERP/Daftra، بوابات WhatsApp، وحاويات Docker)' +
        C.reset +
        '\n'
    );
    for (const item of customInEnv) {
      const masked = maskSecret(item.key, item.value);
      console.log(
        `  ${C.cyan}★${C.reset} ${C.bold}${item.key.padEnd(35)}${C.reset} = ${C.green}${masked}${C.reset} ${C.dim}(السطر ${item.line})${C.reset}`
      );
    }
    return;
  }

  // Group matched and custom by category
  const categories = new Map();

  function addToCategory(cat, item, type) {
    if (!categories.has(cat)) {
      categories.set(cat, { matched: [], custom: [], unset: [] });
    }
    categories.get(cat)[type].push(item);
  }

  matched.forEach((i) => addToCategory(i.category, i, 'matched'));
  customInEnv.forEach((i) => addToCategory(i.category, i, 'custom'));
  if (showAll) {
    unsetInCode.forEach((i) => addToCategory(i.category, i, 'unset'));
  }

  const sortedCats = Array.from(categories.keys()).sort();

  for (const catName of sortedCats) {
    const data = categories.get(catName);
    console.log(C.bold + C.magenta + `📁 ${catName}` + C.reset);
    console.log(C.dim + '─'.repeat(70) + C.reset);

    // Active Matched in Code
    for (const item of data.matched) {
      const masked = maskSecret(item.key, item.value);
      const fileBadge = C.dim + `(${item.usages} في الكود: ${item.files[0]})` + C.reset;
      console.log(
        `  ${C.green}✔ [ACTIVE]${C.reset}  ${C.bold}${item.key.padEnd(32)}${C.reset} = ${C.white}${masked.padEnd(
          20
        )}${C.reset} ${fileBadge}`
      );
    }

    // Custom in .env
    for (const item of data.custom) {
      const masked = maskSecret(item.key, item.value);
      console.log(
        `  ${C.cyan}★ [CUSTOM]${C.reset}  ${C.bold}${item.key.padEnd(32)}${C.reset} = ${C.white}${masked.padEnd(
          20
        )}${C.reset} ${C.dim}(نظام/تكامل مخصص)${C.reset}`
      );
    }

    // Optional / Unset (if --all)
    if (showAll && data.unset.length > 0) {
      for (const item of data.unset) {
        console.log(
          `  ${C.gray}○ [DEFAULT]${C.reset} ${C.gray}${item.key.padEnd(32)} = <قيمة افتراضية>${C.reset} ${C.dim}(${item.files[0]})${C.reset}`
        );
      }
    }

    console.log('');
  }

  console.log(C.bold + C.cyan + '═'.repeat(80) + C.reset);
  console.log(
    C.dim +
      `💡 نصيحة: استخدم ${C.bold}bash sh/env-audit.sh --missing${C.reset}${C.dim} لعرض المتغيرات غير المعرفة، أو ${C.bold}--all${C.reset}${C.dim} للتفصيل الكامل، أو ${C.bold}--json${C.reset}${C.dim} للتصدير البرمجي.` +
      C.reset
  );
  console.log(C.bold + C.cyan + '═'.repeat(80) + C.reset + '\n');
}

main();

