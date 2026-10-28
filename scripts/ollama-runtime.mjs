import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { frappeMcpBlock } from './azcodex-lib.mjs';

export function ollamaSettings(env = process.env) {
  if (!env.OLLAMA_BASE_URL) throw new Error('لم يُضبط OLLAMA_BASE_URL على خادم التطبيق.');
  const url = new URL(env.OLLAMA_BASE_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('عنوان Ollama غير صالح.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('استخدم HTTPS لخادم Ollama البعيد.');
  url.pathname = url.pathname.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  if (Boolean(env.OLLAMA_AUTH_USER) !== Boolean(env.OLLAMA_AUTH_PASS)) throw new Error('اسم المستخدم وكلمة المرور مطلوبان معًا.');
  const authorization = env.OLLAMA_AUTHORIZATION || (env.OLLAMA_AUTH_USER
    ? `Basic ${Buffer.from(`${env.OLLAMA_AUTH_USER}:${env.OLLAMA_AUTH_PASS}`).toString('base64')}`
    : env.OLLAMA_API_KEY ? `Bearer ${env.OLLAMA_API_KEY}` : '');
  const home = path.resolve(env.OLLAMA_CODEX_HOME || path.join(os.homedir(), '.codex-ollama'));
  for (const other of [env.CODEX_HOME, env.AZCODEX_HOME, path.join(os.homedir(), '.codex'), path.join(os.homedir(), '.azcodex')].filter(Boolean)) {
    if (path.resolve(other) === home) throw new Error('يجب تخصيص مجلد مستقل لـOllama للحفاظ على ملفات OpenAI وFoundry.');
  }
  return { base: url.toString().replace(/\/$/, ''), authorization, home };
}

async function api(settings, endpoint, body, timeout = 15000) {
  let response;
  try {
    response = await fetch(`${settings.base}${endpoint}`, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(settings.authorization ? { Authorization: settings.authorization } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeout)
    });
  } catch { throw new Error('تعذر الوصول إلى Ollama أو انتهت مهلة الاتصال.'); }
  if (!response.ok) throw new Error(`فشل اتصال Ollama (HTTP ${response.status}).`);
  return response.json();
}

export async function catalog(settings) {
  const payload = await api(settings, '/api/tags');
  const models = (payload.models ?? []).map(model => ({ name: model.name, size: model.size ?? 0 }));
  return { configured: true, endpoint: settings.base, models, home: settings.home };
}

export function buildOllamaConfig(settings, model) {
  if (!model || model.length > 200 || /[\r\n\x00]/.test(model)) throw new Error('اختر اسم نموذج صالحًا.');
  return `# managed-by: az-codex-ollama\nmodel = ${JSON.stringify(model)}\nmodel_provider = "alazab_ollama"\nmodel_reasoning_effort = "low"\n\n[model_providers.alazab_ollama]\nname = "Ollama"\nbase_url = ${JSON.stringify(settings.base + '/v1')}\nwire_api = "responses"\nrequires_openai_auth = false\nenv_http_headers = { Authorization = "OLLAMA_AUTHORIZATION" }\nstream_idle_timeout_ms = 900000\n`;
}

export async function run(action, model, env = process.env) {
  const settings = ollamaSettings(env);
  const list = await catalog(settings);
  if (action === 'catalog') return list;
  if (!list.models.some(item => item.name === model)) throw new Error('النموذج غير موجود في قائمة Ollama الحالية.');
  if (action === 'probe') {
    const result = await api(settings, '/v1/responses', { model, input: 'Reply with OK only.', stream: false, store: false, max_output_tokens: 1024, ...(model.startsWith('gpt-oss') ? { reasoning: { effort: 'low' } } : {}) }, 300000);
    const output = (result.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('').trim();
    if (!output) throw new Error('لم يصل نص من Responses API؛ لم يُثبت نجاح النموذج.');
    return { ok: true, model, message: 'نجح اختبار توليد النص عبر Responses API.' };
  }
  if (action !== 'setup') throw new Error('عملية غير معروفة.');
  const capabilities = await api(settings, '/api/show', { model });
  if (!capabilities.capabilities?.includes('tools')) throw new Error('النموذج لا يعلن دعم الأدوات اللازمة لوكيل Codex.');
  const content = buildOllamaConfig(settings, model);
  await fs.mkdir(settings.home, { recursive: true, mode: 0o700 });
  const filename = path.join(settings.home, 'config.toml');
  const old = await fs.readFile(filename, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  if (old && !old.startsWith('# managed-by: az-codex-ollama\n')) throw new Error('ملف Ollama معدل يدويًا؛ لن يتم استبداله.');
  // Keep any MCP or workspace settings added after the managed provider section.
  let extra = old.match(/\n\[(?!model_providers\.alazab_ollama\])[^\n]*\][\s\S]*/)?.[0] ?? '';
  const benchPath = path.resolve(env.FRAPPE_BENCH_PATH || '/home/frappe/frappe-bench');
  if (!extra.includes('[mcp_servers.frappe-bench]') && await fs.stat(path.join(benchPath, 'sites')).then(info => info.isDirectory()).catch(() => false)) {
    extra += '\n' + frappeMcpBlock({ benchPath, readonly: env.FRAPPE_BENCH_READONLY === '1' });
  }
  const temp = filename + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temp, content + extra, { mode: 0o600 });
  await fs.rename(temp, filename);
  return { ok: true, model, home: settings.home, message: 'تم حفظ ملف Ollama. اختر حساب Ollama وافتح محادثة جديدة؛ العمليات المفتوحة تستخدم إعداداتها السابقة.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const input = process.argv[3] ?? '';
    process.stdout.write(JSON.stringify(await run(process.argv[2] || 'catalog', input)));
  } catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
