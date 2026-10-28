#!/usr/bin/env node
import process from "node:process";

import { inspectRegistry, loadRegistry, providerRelativePath } from "./mcp-registry-lib.mjs";

function usage() {
  console.log(`Az Codex MCP Registry

Usage:
  node scripts/mcp-registry.mjs list [--json]
  node scripts/mcp-registry.mjs doctor [--json]

Commands:
  list    List registered integrations without probing files.
  doctor  Validate the registry and verify that every enabled provider target exists.
`);
}

async function list(json) {
  const registry = await loadRegistry();
  if (json) {
    console.log(JSON.stringify(registry, null, 2));
    return;
  }

  console.log(`Registry v${registry.version}`);
  for (const provider of registry.providers) {
    const state = provider.enabled ? "enabled" : "disabled";
    console.log(`${provider.id.padEnd(16)} ${provider.kind.padEnd(10)} ${state.padEnd(8)} ${providerRelativePath(provider)}`);
  }
}

async function doctor(json) {
  const result = await inspectRegistry();
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Registry v${result.version}`);
    for (const provider of result.providers) {
      const status = provider.healthy ? "OK" : "FAIL";
      const suffix = provider.size === null ? "" : ` (${provider.size} bytes)`;
      console.log(`${status.padEnd(5)} ${provider.id.padEnd(16)} ${provider.kind.padEnd(10)} ${provider.target}${suffix}`);
      if (provider.error && !provider.healthy) console.log(`      ${provider.error}`);
    }
  }

  if (!result.healthy) process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? "list";
  const json = args.includes("--json");

  if (["help", "--help", "-h"].includes(command)) return usage();
  if (command === "list") return list(json);
  if (command === "doctor") return doctor(json);

  throw new Error(`Unknown MCP registry command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
