#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "az-codex-pack-"));
const maxArchiveBytes = 200 * 1024 * 1024;
const forbiddenPatterns = [
  /(^|\/)backend\/target\//u,
  /\.bak$/u,
  /(^|\/)node_modules\//u,
  /(^|\/)\.git\//u
];

try {
  const result = spawnSync(
    "pnpm",
    ["pack", "--pack-destination", tempDir],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    }
  );

  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();

  if (stdout) process.stdout.write(`${stdout}\n`);
  if (stderr) process.stderr.write(`${stderr}\n`);

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm pack failed with exit code ${result.status}`);
  }

  const archives = fs.readdirSync(tempDir).filter((name) => name.endsWith(".tgz"));
  if (archives.length !== 1) {
    throw new Error(`expected exactly one package archive, found ${archives.length}`);
  }

  const archive = path.join(tempDir, archives[0]);
  const stat = fs.statSync(archive);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error("package archive is missing or empty");
  }
  if (stat.size > maxArchiveBytes) {
    throw new Error(
      `package archive is too large: ${stat.size} bytes (limit ${maxArchiveBytes})`
    );
  }

  const contentLines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const forbidden = contentLines.filter((line) =>
    forbiddenPatterns.some((pattern) => pattern.test(line))
  );
  if (forbidden.length) {
    throw new Error(
      `package contains forbidden generated files:\n${forbidden.slice(0, 20).join("\n")}`
    );
  }

  const required = [
    "bin/azcodex.mjs",
    "bin/codex-webui.mjs",
    "build/static",
    "dist/backend",
    "mcp/registry.json",
    "deploy/systemd/az-codex.service"
  ];
  for (const requiredPath of required) {
    if (!contentLines.some((line) => line.includes(requiredPath))) {
      throw new Error(`required package content missing: ${requiredPath}`);
    }
  }

  console.log(
    `package check passed: ${archives[0]} (${stat.size} bytes, limit ${maxArchiveBytes})`
  );
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
