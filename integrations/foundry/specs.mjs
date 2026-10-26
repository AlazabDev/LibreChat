// Generates the Foundry agent model specs inside librechat.alazab.yaml.
//
//   node integrations/foundry/specs.mjs          rewrite the generated block
//   node integrations/foundry/specs.mjs --check  exit 1 if the block is stale
//
// No dependencies: YAML double-quoted scalars accept JSON string escapes, so
// JSON.stringify is used to emit every free-text value safely.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const target = join(root, 'librechat.alazab.yaml');

export const BEGIN = '    # >>> BEGIN GENERATED integrations/foundry — لا تعدّل يدوياً، شغّل: node integrations/foundry/specs.mjs';
export const END = '    # <<< END GENERATED integrations/foundry';

// U+2028/2029 are line breaks to YAML even inside quotes; keep them escaped.
// Built from char codes so no raw separator character lives in this source file.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const quote = (value) =>
  JSON.stringify(value).split(LS).join('\\u2028').split(PS).join('\\u2029');

export function loadManifest() {
  return JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
}

export function readPrompt(id) {
  return readFileSync(join(here, 'prompts', `${id}.md`), 'utf8').replace(/\r\n/g, '\n').trim();
}

export function buildBlock(manifest = loadManifest(), prompt = readPrompt) {
  const lines = [BEGIN];
  for (const agent of manifest.agents) {
    lines.push(`    - name: ${quote(agent.id)}`);
    lines.push(`      label: ${quote(agent.label)}`);
    lines.push(`      description: ${quote(agent.description)}`);
    lines.push(`      group: ${quote(manifest.group)}`);
    if (agent.showInMenu === false) {
      lines.push('      showInMenu: false');
    }
    lines.push('      preset:');
    lines.push(`        endpoint: ${quote(manifest.endpoint)}`);
    lines.push(`        model: ${quote(agent.model)}`);
    if (agent.reasoningEffort) {
      lines.push(`        reasoning_effort: ${quote(agent.reasoningEffort)}`);
    }
    lines.push(`        promptPrefix: ${quote(prompt(agent.id))}`);
  }
  lines.push(END);
  return lines.join('\n');
}

export function splice(yamlText, block) {
  const start = yamlText.indexOf(BEGIN);
  const end = yamlText.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Generated-block markers not found in librechat.alazab.yaml');
  }
  return yamlText.slice(0, start) + block + yamlText.slice(end + END.length);
}

function main() {
  const current = readFileSync(target, 'utf8');
  const next = splice(current, buildBlock());
  if (process.argv.includes('--check')) {
    if (next !== current) {
      console.error('librechat.alazab.yaml is stale. Run: node integrations/foundry/specs.mjs');
      process.exit(1);
    }
    console.log('librechat.alazab.yaml is up to date.');
    return;
  }
  if (next === current) {
    console.log('No changes.');
    return;
  }
  writeFileSync(target, next, 'utf8');
  console.log('Updated librechat.alazab.yaml');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
