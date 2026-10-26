#!/usr/bin/env node
// Generates the Alazab agent model specs inside librechat.alazab.yaml from
// integrations/alazab/agents/*.json. Zero dependencies.
//
//   node integrations/alazab/scripts/modelspecs.mjs           rewrite the generated block
//   node integrations/alazab/scripts/modelspecs.mjs --check   exit 1 if the block is stale
//
// Edit the agent JSON files, never the generated block.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const agentsDir = join(root, 'integrations', 'alazab', 'agents');
const yamlPath = join(root, 'librechat.alazab.yaml');

const GROUP = 'وكلاء العزب';
const BEGIN = '    # >>> GENERATED:agent-specs (integrations/alazab/scripts/modelspecs.mjs) - do not edit';
const END = '    # <<< GENERATED:agent-specs';

// JSON strings are valid YAML double-quoted scalars; only U+2028/2029 need escaping.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const q = (value) =>
  JSON.stringify(value)
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');

const agents = readdirSync(agentsDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(agentsDir, file), 'utf8')))
  .sort((a, b) => a.order - b.order);

const yaml = readFileSync(yamlPath, 'utf8');
const errors = [];

function renderSpec(agent) {
  const lines = [
    `    - name: ${q(`agent-${agent.id}`)}`,
    `      label: ${q(agent.label)}`,
    `      description: ${q(agent.description)}`,
    `      group: ${q(GROUP)}`,
  ];
  if (agent.showInMenu === false) {
    lines.push('      showInMenu: false');
  }
  if (agent.conversation_starters?.length) {
    lines.push('      conversation_starters:');
    for (const starter of agent.conversation_starters) {
      lines.push(`        - ${q(starter)}`);
    }
  }
  for (const [flag, enabled] of Object.entries(agent.tools ?? {})) {
    lines.push(`      ${flag}: ${enabled === true}`);
  }
  if (agent.mcpServers?.length) {
    lines.push('      mcpServers:');
    for (const server of agent.mcpServers) {
      lines.push(`        - ${q(server)}`);
      if (!new RegExp(`^  ${server}:\\s*$`, 'm').test(yaml)) {
        errors.push(`${agent.id}: mcpServers entry "${server}" is not defined in ${yamlPath}`);
      }
    }
  }
  lines.push('      preset:');
  lines.push(`        endpoint: ${q(agent.endpoint)}`);
  lines.push(`        model: ${q(agent.model)}`);
  lines.push(`        promptPrefix: ${q(agent.instructions)}`);
  if (typeof agent.temperature === 'number') {
    lines.push(`        temperature: ${agent.temperature}`);
  }
  if (typeof agent.top_p === 'number') {
    lines.push(`        top_p: ${agent.top_p}`);
  }
  if (!yaml.includes(`'${agent.model}'`)) {
    errors.push(`${agent.id}: model "${agent.model}" is not in the "${agent.endpoint}" model list`);
  }
  return lines.join('\n');
}

const block = [BEGIN, ...agents.map(renderSpec), END].join('\n');

const start = yaml.indexOf(BEGIN);
const end = yaml.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error(`Generated-block markers not found in ${yamlPath}`);
  process.exit(2);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(2);
}

const next = yaml.slice(0, start) + block + yaml.slice(end + END.length);
if (process.argv.includes('--check')) {
  if (next !== yaml) {
    console.error('librechat.alazab.yaml is out of date: run integrations/alazab/scripts/modelspecs.mjs');
    process.exit(1);
  }
  console.log(`OK: ${agents.length} agent specs are up to date`);
} else {
  if (next !== yaml) {
    writeFileSync(yamlPath, next);
  }
  console.log(`Wrote ${agents.length} agent specs to librechat.alazab.yaml`);
}
