#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".svelte-kit",
  "node_modules",
  "build",
  "dist",
  "target"
]);
const ignoredFiles = new Set(["pnpm-lock.yaml", "Cargo.lock"]);
const textExtensions = new Set([
  ".json", ".json5", ".md", ".mjs", ".js", ".ts", ".svelte", ".sh", ".yml", ".yaml", ".toml", ".env", ".txt"
]);

const rules = [
  {
    name: "private key",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gu
  },
  {
    name: "Meta access token",
    re: /\bEAA[A-Za-z0-9_-]{24,}\b/gu
  },
  {
    name: "literal Bearer token",
    re: /\bBearer\s+[A-Za-z0-9._~-]{24,}\b/gu
  },
  {
    name: "literal client secret",
    re: /["']?client[_-]?secret["']?\s*[:=]\s*["'](?!\{\{|\$\{|<|REPLACE_|CHANGE_|YOUR_)[^"'\r\n]{12,}["']/giu
  },
  {
    name: "literal API key",
    re: /["']?(?:api[_-]?key|apikey)["']?\s*[:=]\s*["'](?!\{\{|\$\{|<|REPLACE_|CHANGE_|YOUR_)[A-Za-z0-9._~-]{20,}["']/giu
  }
];

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(ext) && !entry.name.startsWith(".env")) continue;
    yield full;
  }
}

function lineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

const findings = [];
for await (const file of walk(root)) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      findings.push({
        rule: rule.name,
        file: path.relative(root, file),
        line: lineNumber(text, match.index ?? 0)
      });
    }
  }
}

if (findings.length) {
  console.error("Potential repository secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  }
  console.error("Replace live credentials with placeholders or environment-variable references before committing.");
  process.exit(1);
}

console.log("OK: no high-confidence credential patterns detected.");
