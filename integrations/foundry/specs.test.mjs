// node --test integrations/foundry
// Requires js-yaml (already a transitive dependency after `npm ci`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BEGIN, END, buildBlock, loadManifest, readPrompt, splice } from './specs.mjs';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const here = dirname(fileURLToPath(import.meta.url));
const yamlPath = join(here, '..', '..', 'librechat.alazab.yaml');
const yamlText = readFileSync(yamlPath, 'utf8');
const config = yaml.load(yamlText);
const manifest = loadManifest();
const specs = config.modelSpecs.list;

test('manifest ids are unique and every prompt file is non-empty', () => {
  const ids = manifest.agents.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(readPrompt(id).length > 0, `${id} prompt is empty`);
  }
});

test('generated block in librechat.alazab.yaml is up to date', () => {
  assert.equal(splice(yamlText, buildBlock()), yamlText);
  assert.ok(yamlText.includes(BEGIN) && yamlText.includes(END));
});

test('every agent spec points at a real endpoint and listed model', () => {
  const endpoints = new Map(config.endpoints.custom.map((e) => [e.name, new Set(e.models.default)]));
  const names = specs.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, 'spec names must be unique');

  for (const agent of manifest.agents) {
    const spec = specs.find((s) => s.name === agent.id);
    assert.ok(spec, `${agent.id} missing from modelSpecs`);
    assert.ok(endpoints.has(spec.preset.endpoint), `${agent.id}: unknown endpoint`);
    assert.ok(endpoints.get(spec.preset.endpoint).has(spec.preset.model), `${agent.id}: model not listed`);
    assert.equal(spec.preset.promptPrefix, readPrompt(agent.id));
    assert.equal(spec.preset.reasoning_effort, agent.reasoningEffort);
    assert.equal(spec.showInMenu ?? true, agent.showInMenu);
  }
});

test('tool-dependent agents stay hidden from the model menu', () => {
  for (const id of ['az-agent-payments', 'az-agent-auth']) {
    assert.equal(specs.find((s) => s.name === id).showInMenu, false);
  }
});

test('no credential-shaped strings in prompts, manifest or config', () => {
  const patterns = [
    /sk-[A-Za-z0-9_-]{20,}/,
    /eyJ[A-Za-z0-9_-]{10,}\./,
    /AIza[0-9A-Za-z_-]{30,}/,
    /\b[a-f0-9]{32,}\b/,
    /(password|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9/+_.-]{16,}/i,
  ];
  const corpus = [yamlText, JSON.stringify(manifest), ...manifest.agents.map((a) => readPrompt(a.id))];
  for (const text of corpus) {
    for (const re of patterns) {
      assert.equal(re.test(text), false, `credential-like match: ${re}`);
    }
  }
});

test('line/paragraph separators and quotes survive the YAML round trip', () => {
  const tricky = `سطر أول\n"اقتباس" \\ مائل ${String.fromCharCode(0x2028)} فاصل ${String.fromCharCode(0x2029)} نهاية`;
  const fake = { endpoint: 'E', group: 'G', agents: [{ id: 'x', label: 'L', description: 'D', model: 'm', showInMenu: true }] };
  const block = buildBlock(fake, () => tricky);
  const parsed = yaml.load(`list:\n${block}\n`);
  assert.equal(parsed.list[0].preset.promptPrefix, tricky);
});
