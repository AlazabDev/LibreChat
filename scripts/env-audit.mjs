#!/usr/bin/env node
/**
 * env-audit.mjs — يفحص استخدام متغيرات البيئة في الكود ويقارنها بملفات البيئة.
 *
 * بلا أي اعتمادات خارجية (Node 18+). لا يطبع قيم المتغيرات أبدًا، فقط حالتها (SET / EMPTY / COMMENTED).
 *
 * ما يفحصه في الكود:
 *   process.env.X | process.env['X'] | const { A, B } = process.env | import.meta.env.X
 *   Deno.env.get('X') | ${X} و ${X:-d} و ${X:?msg} (أسماء بحروف كبيرة فقط) داخل yml/yaml/toml/conf (و .sh مع --shell)
 *
 * الاستخدام:
 *   node scripts/env-audit.mjs --env .env.example --env .env.alazab.example
 *   node scripts/env-audit.mjs --env .env.alazab.example --scope docker-compose.prod.yml,librechat.alazab.yaml,api,packages
 *   node scripts/env-audit.mjs --env .env --target .env --all --out env-report.md --csv env-report.csv
 *
 * الخيارات:
 *   --env <file>        ملف بيئة للمقارنة (يتكرر). الافتراضي: .env.example
 *   --target <file>     الملف الذي يُحكم عليه (OK/MISSING). الافتراضي: اتحاد كل الملفات
 *   --scope a,b,c       قصر الفحص على مسارات تبدأ بهذه البادئات (نسبةً إلى الجذر)
 *   --profile <name>    librechat | supabase | azcodex (مجموعات مسارات جاهزة، تُدمج مع --scope)
 *   --root <dir>        جذر المشروع (الافتراضي: المجلد الحالي)
 *   --all               اعرض كل المتغيرات (الافتراضي: غير OK فقط)
 *   --include-tests     اشمل ملفات الاختبار (مستبعدة افتراضيًا)
 *   --include-system    اشمل متغيرات النظام/CI (PATH, HOME, GITHUB_* ...)
 *   --shell             افحص ${VAR} في ملفات .sh أيضًا (قد يضيف متغيرات محلية)
 *   --include-ci        اشمل .github/ (workflows) — مستبعدة افتراضيًا لأن متغيراتها محلية للـ CI
 *   --out <file.md>     اكتب التقرير بصيغة Markdown
 *   --csv <file> --json <file>
 *   --fail-on-missing   خروج برمز 1 إن وُجد متغير MISSING (للاستخدام في CI)
 *
 * الحالات:
 *   OK         مستخدم وله قيمة في الملف الهدف
 *   EMPTY      معرّف في الهدف لكن بلا قيمة (علامة * = مطلوب بـ :? في compose)
 *   COMMENTED  موجود كتعليق فقط (موثَّق لكنه معطّل)
 *   DEFAULT    غائب لكن كل استخداماته لها قيمة افتراضية (:- أو || أو ??)
 *   REF-ONLY   غائب من الهدف لكنه موثَّق في ملف مرجعي آخر من --env (غالبًا اختياري)
 *   MISSING    مستخدم في الكود وغير موجود في أي ملف بيئة (فجوة حقيقية)
 *   UNUSED     معرّف في ملف البيئة ولا أثر له في الكود المفحوص (قد تستهلكه حاويات خارجية)
 */
import fs from 'node:fs';
import path from 'node:path';

// ───────────────────────── args ─────────────────────────
// مجموعات جاهزة للمسارات (تُدمج مع --scope):
//   librechat : ما يعمل داخل حاوية LibreChat + ملفات النشر الخاصة بكم
//   supabase  : دوال Supabase (أسرارها تُضبط بـ `supabase secrets set` لا في .env)
//   azcodex   : تطبيق AZ-Codex في client/src/lib و client/src/integrations
const PROFILES = {
  librechat: ['api', 'packages/api', 'packages/data-schemas', 'packages/data-provider', 'docker-compose.prod.yml', 'librechat.alazab.yaml'],
  supabase: ['supabase'],
  azcodex: ['client/src/lib', 'client/src/integrations', 'bin'],
};
const argv = process.argv.slice(2);
const opt = { env: [], scope: [], target: null, out: null, csv: null, json: null, all: false, tests: false, system: false, shell: false, ci: false, failOnMissing: false, root: process.cwd() };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { if (i + 1 >= argv.length) die(`الخيار ${a} يحتاج قيمة`); return argv[++i]; };
  switch (a) {
    case '--env': opt.env.push(val()); break;
    case '--target': opt.target = val(); break;
    case '--scope': opt.scope.push(...val().split(',').map((s) => s.trim().replace(/\\/g, '/').replace(/\/$/, '')).filter(Boolean)); break;
    case '--profile': {
      const pr = PROFILES[val()]; if (!pr) die('--profile: ' + Object.keys(PROFILES).join(' | '));
      opt.scope.push(...pr); break;
    }
    case '--root': opt.root = path.resolve(val()); break;
    case '--out': opt.out = val(); break;
    case '--csv': opt.csv = val(); break;
    case '--json': opt.json = val(); break;
    case '--all': opt.all = true; break;
    case '--include-tests': opt.tests = true; break;
    case '--include-system': opt.system = true; break;
    case '--shell': opt.shell = true; break;
    case '--include-ci': opt.ci = true; break;
    case '--fail-on-missing': opt.failOnMissing = true; break;
    case '-h': case '--help': printHelp(); process.exit(0);
    default: die(`خيار غير معروف: ${a}  (استخدم --help)`);
  }
}
if (!opt.env.length) opt.env.push('.env.example');
function die(m) { console.error('خطأ: ' + m); process.exit(2); }
function printHelp() {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  console.log(src.split('*/')[0].replace(/^\/\*\*?\s?/, '').replace(/^ \* ?/gm, ''));
}

// ───────────────────────── scan config ─────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', '.cache', '.yarn', 'locales', '__pycache__', '.venv', 'vendor']);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue']);
const CFG_EXT = new Set(['.yml', '.yaml', '.toml', '.conf']);
const MAX_BYTES = 2 * 1024 * 1024;
const TEST_RE = /(^|\/)(__tests__|__mocks__|tests?|e2e|playwright|cypress|fixtures)(\/|$)|\.(spec|test|e2e)\.[cm]?[jt]sx?$/i;
const SYSTEM_RE = /^(PATH|HOME|PWD|OLDPWD|USER|USERNAME|LOGNAME|SHELL|TERM|LANG|LC_[A-Z]+|TMPDIR|TEMP|TMP|HOSTNAME|HOST|CI|TZ|DEBUG|FORCE_COLOR|NO_COLOR|COLORTERM|NODE|NODE_OPTIONS|NODE_PATH|NODE_ENV|APPDATA|LOCALAPPDATA|USERPROFILE|PROGRAMFILES|SYSTEMROOT|COMSPEC|OS|PLATFORM|DISPLAY|EDITOR|INIT_CWD|PNPM_HOME|XDG_[A-Z_]+|(npm_|NPM_|GITHUB_|RUNNER_|ACTIONS_)[A-Za-z0-9_]*)$/;
const NAME = '[A-Za-z_][A-Za-z0-9_]*';

const usage = new Map(); // name -> {locs:[], kinds:Set, required:bool, fallbacks:number, total:number}
const dynamic = [];
let scanned = 0;

function rec(name, rel, line, kind, { fallback = false, required = false } = {}) {
  let u = usage.get(name);
  if (!u) usage.set(name, (u = { locs: [], kinds: new Set(), required: false, fallbacks: 0, total: 0 }));
  u.total++; if (fallback) u.fallbacks++; if (required) u.required = true;
  u.kinds.add(kind);
  if (u.locs.length < 50) u.locs.push(`${rel}:${line}`);
}
function lineIndex(text) { const nl = []; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) nl.push(i); return nl; }
function lineAt(nl, idx) { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < idx) lo = m + 1; else hi = m; } return lo + 1; }

function scanCode(text, rel) {
  const nl = lineIndex(text);
  // كشف القيمة الافتراضية (استدلالي): x || d | x ?? d | parseInt(x) || d | helper(x, d) | isEnabled(x) | x === 'v'
  const fb = (end, start) => {
    const a = text.slice(end, end + 40), b = text.slice(Math.max(0, start - 24), start);
    if (/^\s*(\|\||\?\?)/.test(a)) return true;
    if (/^\s*\)+\s*(\|\||\?\?)/.test(a)) return true;
    if (/^\s*,\s*\d+\s*\)\s*(\|\||\?\?)/.test(a)) return true;
    if (/^\s*(===|!==|==|!=)\s*['"`]/.test(a)) return true;
    if (/(isEnabled|Boolean)\(\s*$/.test(b) || /!!\s*$/.test(b)) return true;
    if (!/parseInt\(\s*$/.test(b) && /^\s*,\s*[^\s)]/.test(a)) return true;
    return false;
  };
  let m;
  const reDot = new RegExp(`(?:process\\.env|import\\.meta\\.env)\\.(${NAME})`, 'g');
  while ((m = reDot.exec(text))) rec(m[1], rel, lineAt(nl, m.index), 'code', { fallback: fb(reDot.lastIndex, m.index) });
  const reBr = new RegExp(`(?:process\\.env|import\\.meta\\.env)\\[\\s*['"\`](${NAME})['"\`]\\s*\\]`, 'g');
  while ((m = reBr.exec(text))) rec(m[1], rel, lineAt(nl, m.index), 'code', { fallback: fb(reBr.lastIndex, m.index) });
  const reDyn = /(?:process\.env|import\.meta\.env)\[\s*(?!['"`])[^\]\n]+\]/g;
  while ((m = reDyn.exec(text))) dynamic.push(`${rel}:${lineAt(nl, m.index)}  ${m[0].slice(0, 60)}`);
  const reDes = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:process\.env|import\.meta\.env)\b(?!\s*[.\[])/g;
  while ((m = reDes.exec(text))) {
    for (const raw of m[1].split(',')) {
      const t = raw.replace(/\/\/.*$/gm, '').trim();
      if (!t || t.startsWith('...')) continue;
      const nm = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(t);
      if (nm) rec(nm[1], rel, lineAt(nl, m.index), 'code', { fallback: /=/.test(t.replace(/^[^:=]*:/, '')) || /^[^:]*=/.test(t) });
    }
  }
  const reDeno = new RegExp(`Deno\\.env\\.get\\(\\s*['"\`](${NAME})['"\`]\\s*\\)`, 'g');
  while ((m = reDeno.exec(text))) rec(m[1], rel, lineAt(nl, m.index), 'code', { fallback: fb(reDeno.lastIndex, m.index) });
}

function scanCfg(text, rel, kind) {
  const nl = lineIndex(text);
  const re = /\$\{([A-Z][A-Z0-9_]*)(:?[-?+=])?/g;
  let m;
  while ((m = re.exec(text))) {
    // تجاهل ما يقع داخل تعليق (# في بداية السطر أو بعد مسافة قبل الموضع)
    const ls = text.lastIndexOf('\n', m.index) + 1;
    const before = text.slice(ls, m.index);
    if (/^\s*#/.test(before) || /\s#/.test(before)) continue;
    const op = m[2] || '';
    rec(m[1], rel, lineAt(nl, m.index), kind, { fallback: op.endsWith('-') || op.endsWith('='), required: op.endsWith('?') });
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(opt.root, full).split(path.sep).join('/');
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !(e.name === '.github' && !opt.ci)) walk(full); continue; }
    if (opt.scope.length && !opt.scope.some((s) => rel === s || rel.startsWith(s + '/'))) continue;
    if (!opt.tests && TEST_RE.test(rel)) continue;
    const ext = path.extname(e.name).toLowerCase();
    const isCode = CODE_EXT.has(ext), isCfg = CFG_EXT.has(ext), isSh = ext === '.sh' && opt.shell;
    if (!isCode && !isCfg && !isSh) continue;
    if (/\.env(\.|$)/.test(e.name)) continue;
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (st.size > MAX_BYTES) continue;
    let text; try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    scanned++;
    if (isCode) scanCode(text, rel);
    if (isCfg) scanCfg(text, rel, /compose/i.test(e.name) ? 'compose' : 'config');
    if (isSh) scanCfg(text, rel, 'shell');
  }
}

// ───────────────────────── env files ─────────────────────────
function parseEnv(file) {
  const abs = path.resolve(opt.root, file);
  if (!fs.existsSync(abs)) { console.error(`تحذير: الملف غير موجود: ${file}`); return null; }
  const vars = new Map(); // name -> state set|empty|commented
  const rank = { set: 3, empty: 2, commented: 1 };
  const put = (n, s) => { const o = vars.get(n); if (!o || rank[s] > rank[o]) vars.set(n, s); };
  for (const line of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
    const m = new RegExp(`^\\s*(#\\s*)?(?:export\\s+)?(${NAME})\\s*=(.*)$`).exec(line);
    if (!m) continue;
    const commented = !!m[1];
    if (commented && !/^[A-Z][A-Z0-9_]*$/.test(m[2])) continue; // تجاهل شروحات نصية
    let v = m[3].trim();
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '');
    v = v.replace(/^(["'])(.*)\1$/, '$2').trim();
    put(m[2], commented ? 'commented' : v === '' ? 'empty' : 'set');
  }
  return { file, vars };
}
const envs = opt.env.map(parseEnv).filter(Boolean);
if (!envs.length) die('لا يوجد ملف بيئة صالح للمقارنة');
const target = opt.target ? envs.find((e) => e.file === opt.target || path.resolve(opt.root, e.file) === path.resolve(opt.root, opt.target)) : null;
if (opt.target && !target) die(`--target يجب أن يكون أحد ملفات --env: ${opt.target}`);

// ───────────────────────── run ─────────────────────────
walk(opt.root);

const rank = { set: 3, empty: 2, commented: 1 };
const bestState = (files, n) => files.reduce((b, e) => { const s = e.vars.get(n); return s && (!b || rank[s] > rank[b]) ? s : b; }, null);
const judged = target ? [target] : envs;
const names = new Set([...usage.keys(), ...envs.flatMap((e) => [...e.vars.keys()])]);
const rows = [];
for (const n of [...names].sort()) {
  const u = usage.get(n);
  const isSystem = SYSTEM_RE.test(n);
  if (isSystem && !opt.system) continue;
  const st = bestState(judged, n);
  let status;
  if (!u) status = 'UNUSED';
  else if (st === 'set') status = 'OK';
  else if (st === 'empty') status = 'EMPTY';
  else if (st === 'commented') status = 'COMMENTED';
  else if (u.fallbacks === u.total) status = 'DEFAULT';
  else if (target && envs.some((e) => e !== target && e.vars.has(n))) status = 'REF-ONLY';
  else status = 'MISSING';
  if (status === 'EMPTY' && u?.required) status = 'EMPTY*';
  rows.push({
    name: n, status, uses: u?.total ?? 0, kinds: u ? [...u.kinds].join('+') : '-',
    where: u ? u.locs.slice(0, 2).join(' ; ') + (u.total > 2 ? ` (+${u.total - 2})` : '') : '-',
    ...Object.fromEntries(envs.map((e) => [e.file, e.vars.get(n) ?? '-'])),
  });
}
const ORDER = ['MISSING', 'EMPTY*', 'EMPTY', 'REF-ONLY', 'COMMENTED', 'DEFAULT', 'UNUSED', 'OK'];
rows.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
const counts = Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.status === s).length]));
const shown = opt.all ? rows : rows.filter((r) => r.status !== 'OK');

// ───────────────────────── render ─────────────────────────
function table(headers, data) {
  const w = headers.map((h, i) => Math.max(h.length, ...data.map((r) => String(r[i]).length)));
  const line = (r) => '| ' + r.map((c, i) => String(c).padEnd(w[i])).join(' | ') + ' |';
  return [line(headers), '| ' + w.map((x) => '-'.repeat(x)).join(' | ') + ' |', ...data.map(line)].join('\n');
}
const headers = ['VARIABLE', 'STATUS', 'USES', 'KIND', ...envs.map((e) => e.file), 'WHERE (first 2)'];
const body = shown.map((r) => [r.name, r.status, r.uses, r.kinds, ...envs.map((e) => r[e.file]), r.where.replace(/\|/g, '\\|')]);
const summary = [
  `Root: ${opt.root}`,
  `Scanned files: ${scanned}${opt.scope.length ? `  (scope: ${opt.scope.join(', ')})` : ''}${opt.tests ? '' : '  (tests excluded)'}`,
  `Env files: ${envs.map((e) => e.file).join(', ')}  | judged against: ${target ? target.file : 'union of all'}`,
  `Variables: ${rows.length}  =>  ` + ORDER.map((s) => `${s}: ${counts[s]}`).join('  '),
  dynamic.length ? `Dynamic accesses (cannot be resolved statically): ${dynamic.length}` : '',
].filter(Boolean).join('\n');

const report = `${summary}\n\n${body.length ? table(headers, body) : '(no rows to show — everything is OK)'}\n` +
  (dynamic.length ? `\nDynamic env access (first 15):\n${dynamic.slice(0, 15).map((d) => '  - ' + d).join('\n')}\n` : '') +
  `\nLegend: OK=set in target | EMPTY=defined but empty (*=required via :? in compose) | COMMENTED=only commented | DEFAULT=absent but every use has a detected fallback (heuristic) | REF-ONLY=absent from target, documented in another --env file | MISSING=used, in no env file | UNUSED=in env file, not in scanned code\n`;
console.log(report);

if (opt.out) fs.writeFileSync(opt.out, `# Env audit\n\n\`\`\`\n${summary}\n\`\`\`\n\n${table(headers, shown.length ? body : [])}\n`);
if (opt.csv) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  fs.writeFileSync(opt.csv, '\uFEFF' + [headers.map(esc).join(','), ...(opt.all ? rows : shown).map((r) => [r.name, r.status, r.uses, r.kinds, ...envs.map((e) => r[e.file]), r.where].map(esc).join(','))].join('\r\n'));
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ summary: counts, envFiles: envs.map((e) => e.file), target: target?.file ?? null, rows, dynamic }, null, 2));
if (opt.failOnMissing && counts.MISSING > 0) process.exit(1);
