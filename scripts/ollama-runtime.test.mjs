import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ollamaSettings, buildOllamaConfig, run } from './ollama-runtime.mjs';

test('remote Basic auth stays out of generated provider configuration', () => {
  const settings = ollamaSettings({ OLLAMA_BASE_URL: 'https://example.test/v1/', OLLAMA_AUTH_USER: 'user', OLLAMA_AUTH_PASS: 'secret' });
  assert.equal(settings.base, 'https://example.test');
  assert.equal(settings.authorization, 'Basic ' + Buffer.from('user:secret').toString('base64'));
  const config = buildOllamaConfig(settings, 'gpt-oss:20b');
  assert.match(config, /wire_api = "responses"/);
  assert.match(config, /OLLAMA_AUTHORIZATION/);
  assert.ok(!config.includes('secret'));
  assert.throws(() => ollamaSettings({ OLLAMA_BASE_URL: 'http://remote.test' }));
  assert.throws(() => ollamaSettings({ OLLAMA_BASE_URL: 'https://example.test', OLLAMA_AUTH_USER: 'user' }));
  assert.throws(() => ollamaSettings({ OLLAMA_BASE_URL: 'https://example.test', OLLAMA_CODEX_HOME: path.join(os.homedir(), '.codex') }));
});

test('catalog, Responses probe and isolated setup preserve MCP and reject unsupported models', async () => {
  const originalFetch = globalThis.fetch;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'az-ollama-'));
  const env = { OLLAMA_BASE_URL: 'https://example.test', OLLAMA_CODEX_HOME: home };
  let tools = true;
  let text = true;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gpt-oss:20b' }] });
    if (url.endsWith('/api/show')) return Response.json({ capabilities: tools ? ['tools'] : [] });
    assert.ok(url.endsWith('/v1/responses'));
    assert.equal(JSON.parse(options.body).store, false);
    return Response.json({ output: text ? [{ content: [{ type: 'output_text', text: 'OK' }] }] : [] });
  };
  try {
    assert.equal((await run('catalog', '', env)).models.length, 1);
    assert.equal((await run('probe', 'gpt-oss:20b', env)).ok, true);
    text = false;
    await assert.rejects(run('probe', 'gpt-oss:20b', env), /لم يصل نص/);
    await assert.rejects(run('setup', 'missing', env), /غير موجود/);
    await run('setup', 'gpt-oss:20b', env);
    const filename = path.join(home, 'config.toml');
    await fs.appendFile(filename, '\n[mcp_servers.frappe]\ncommand = "node"\n');
    await run('setup', 'gpt-oss:20b', env);
    assert.match(await fs.readFile(filename, 'utf8'), /mcp_servers.frappe/);
    tools = false;
    await assert.rejects(run('setup', 'gpt-oss:20b', env), /دعم الأدوات/);
    tools = true;
    await fs.writeFile(filename, '# manual config');
    await assert.rejects(run('setup', 'gpt-oss:20b', env), /معدل يدويًا/);
  } finally { globalThis.fetch = originalFetch; await fs.rm(home, { recursive: true, force: true }); }
});
