#!/usr/bin/env node
// azcodex — Codex CLI backed by Microsoft Foundry models.
// Plain `codex` is untouched and keeps using the default OpenAI account/model.
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { findBench } from "../mcp/frappe-bench-lib.mjs";
import {
  azcodexChildEnv,
  azcodexHome,
  ensureAzcodexHome,
  foundrySettings,
  installChartInstructions,
  installFrappe,
  removeChartInstructions,
  removeFrappe,
  normalizeBaseUrl,
  registerWebuiProfiles,
  validateFoundrySettings
} from "../scripts/azcodex-lib.mjs";
import {
  inspectRegistry,
  loadRegistry,
  providerRelativePath
} from "../scripts/mcp-registry-lib.mjs";

const codexBin = process.env.AZCODEX_CODEX_BIN || process.env.CODEX_WEBUI_CODEX_BIN || "codex";

function usage() {
  console.log(`azcodex — Codex on Microsoft Foundry

Usage:
  azcodex [codex args...]   Run codex against Foundry (CODEX_HOME=${azcodexHome()})
  azcodex setup             Generate config.toml from the environment
  azcodex doctor [--offline]
                            Validate Codex, integrations and a live Foundry round-trip
                            (--offline skips the billable live request)
  azcodex integrations      List registered Alazab integrations
  azcodex integrations doctor [--json]
                            Validate all enabled integration targets
  azcodex webui             Add 'codex' (OpenAI) and 'azcodex' (Foundry) profiles to codex-webui.yml
  azcodex charts [--openai] [--remove]
                            Teach the agent to draw charts (AGENTS.md). Default: azcodex home;
                            --openai: the plain codex home (CODEX_HOME or ~/.codex)
  azcodex frappe [--bench PATH] [--sites a,b] [--readonly] [--allow-console] [--openai] [--remove]
                            Enable Frappe bench support: agent instructions (AGENTS.md) plus the
                            frappe-bench MCP server. Default: azcodex home; --openai: plain codex.

Environment:
  AZURE_FOUNDRY_ENDPOINT      https://<resource>.openai.azure.com   (required)
  AZURE_FOUNDRY_API_KEY       API key                                (required)
  AZURE_FOUNDRY_MODEL         Azure deployment name                     (required)
  AZURE_FOUNDRY_API_VERSION   optional; switches to the classic /openai API
  AZURE_FOUNDRY_API_KEY_ENV   name of the variable holding the key (default AZURE_FOUNDRY_API_KEY)
  AZCODEX_HOME                default ~/.azcodex`);
}

function requireFoundry(settings) {
  return validateFoundrySettings(settings, process.env);
}

function redactSecrets(value, settings) {
  let text = String(value ?? "");
  const names = [settings.apiKeyEnv, "AZURE_FOUNDRY_API_KEY"];
  for (const name of names) {
    const secret = String(process.env[name] ?? "");
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

function liveFoundryProbe(settings) {
  const marker = "AZCODEX_FOUNDRY_OK";
  const result = spawnSync(
    codexBin,
    ["exec", "--skip-git-repo-check", `Reply with exactly: ${marker}`],
    {
      cwd: os.tmpdir(),
      encoding: "utf8",
      timeout: 90_000,
      env: azcodexChildEnv(settings)
    }
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return {
    ok: result.status === 0 && output.includes(marker),
    status: result.status,
    timedOut: Boolean(result.error?.code === "ETIMEDOUT"),
    detail: redactSecrets(output, settings).split(/\r?\n/u).slice(-8).join("\n")
  };
}

async function printIntegrations(args) {
  const action = args.find((value) => !value.startsWith("-")) ?? "list";
  const json = args.includes("--json");

  if (action === "list") {
    const registry = await loadRegistry();
    if (json) {
      console.log(JSON.stringify(registry, null, 2));
      return;
    }
    console.log(`Integration registry v${registry.version}`);
    for (const provider of registry.providers) {
      console.log(
        `${provider.enabled ? "ON " : "OFF"} ${provider.id.padEnd(16)} ${provider.kind.padEnd(10)} ${providerRelativePath(provider)}`
      );
    }
    return;
  }

  if (action === "doctor") {
    const result = await inspectRegistry();
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Integration registry v${result.version}`);
      for (const provider of result.providers) {
        const status = provider.healthy ? "OK" : "FAIL";
        console.log(`${status.padEnd(5)} ${provider.id.padEnd(16)} ${provider.kind.padEnd(10)} ${provider.target}`);
      }
    }
    if (!result.healthy) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown integrations action: ${action}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const settings = foundrySettings();

  if (command === "--help" || command === "-h" || command === "help") return usage();

  if (command === "setup") {
    requireFoundry(settings);
    const result = await ensureAzcodexHome(settings);
    await installChartInstructions(azcodexHome());
    console.log(`${result.configPath}: ${result.reason}`);
    console.log(`base_url: ${normalizeBaseUrl(settings.endpoint, settings.apiVersion)}  model: ${settings.model}`);
    return;
  }

  if (command === "doctor") {
    let ok = true;
    const offline = rest.includes("--offline");
    const check = (label, pass, hint = "") => {
      ok &&= pass;
      console.log(`${pass ? "OK  " : "FAIL"} ${label}${pass || !hint ? "" : ` — ${hint}`}`);
    };

    try {
      const baseUrl = normalizeBaseUrl(settings.endpoint, settings.apiVersion);
      check(`endpoint → ${baseUrl}`, true);
    } catch (error) {
      check("endpoint", false, error.message);
    }

    check("AZURE_FOUNDRY_MODEL", Boolean(settings.model), "set the exact Azure deployment name");
    check(`${settings.apiKeyEnv} set`, Boolean(process.env[settings.apiKeyEnv]), "export your Foundry API key");

    const codexProbe = spawnSync(codexBin, ["--version"], { encoding: "utf8" });
    check(`${codexBin} installed`, codexProbe.status === 0, "npm install -g @openai/codex");

    try {
      const registry = await inspectRegistry();
      check(
        `integration registry (${registry.providers.filter((provider) => provider.enabled).length} enabled)`,
        registry.healthy,
        "run `azcodex integrations doctor`"
      );
    } catch (error) {
      check("integration registry", false, error.message);
    }

    if (ok && !offline) {
      try {
        requireFoundry(settings);
        const config = await ensureAzcodexHome(settings);
        check(`Foundry config (${config.reason})`, true);
        const probe = liveFoundryProbe(settings);
        check(
          "live Codex → Foundry round-trip",
          probe.ok,
          probe.timedOut ? "request timed out" : (probe.detail || `codex exited with status ${probe.status}`)
        );
      } catch (error) {
        check("live Codex → Foundry round-trip", false, error.message);
      }
    } else if (offline) {
      console.log("SKIP live Codex → Foundry round-trip (--offline)");
    }

    console.log(`model (deployment): ${settings.model || "(missing)"}`);
    console.log(`CODEX_HOME: ${azcodexHome()}`);
    process.exit(ok ? 0 : 1);
  }

  if (command === "integrations") {
    await printIntegrations(rest);
    return;
  }

  if (command === "charts") {
    const dir = rest.includes("--openai") ? process.env.CODEX_HOME || path.join(os.homedir(), ".codex") : azcodexHome();
    const result = rest.includes("--remove") ? await removeChartInstructions(dir) : await installChartInstructions(dir);
    console.log(`${result.file}: ${result.changed ? (rest.includes("--remove") ? "removed" : "installed") : "unchanged"}`);
    return;
  }

  if (command === "frappe") {
    const openai = rest.includes("--openai");
    const home = openai ? process.env.CODEX_HOME || path.join(os.homedir(), ".codex") : azcodexHome();
    if (rest.includes("--remove")) {
      const result = await removeFrappe(home, { openai });
      if (!openai && settings.endpoint) await ensureAzcodexHome(settings);
      console.log(`Frappe support removed from ${home} (${result.agents.changed ? "AGENTS.md updated" : "nothing to remove"}).`);
      return;
    }

    const option = (name) => {
      const index = rest.indexOf(name);
      return index >= 0 ? rest[index + 1] : undefined;
    };
    const bench = await findBench(option("--bench") || process.env.FRAPPE_BENCH_PATH || process.cwd());
    if (!bench) {
      throw new Error("No bench found. Pass --bench /path/to/frappe-bench (a folder containing apps/ and sites/apps.txt).");
    }

    const state = {
      benchPath: bench,
      sites: (option("--sites") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      readonly: rest.includes("--readonly"),
      allowConsole: rest.includes("--allow-console")
    };
    await installFrappe(home, state, { openai });
    if (!openai && settings.endpoint) await ensureAzcodexHome(settings);
    console.log(`Frappe support enabled in ${home}`);
    console.log(`  bench:   ${bench}`);
    console.log(`  sites:   ${state.sites.length ? state.sites.join(", ") : "developer-mode sites only"}`);
    console.log(`  mode:    ${state.readonly ? "read-only" : "read/write"}${state.allowConsole ? ", console enabled" : ""}`);
    if (!openai && !settings.endpoint) {
      console.log("  note:    config.toml is generated when AZURE_FOUNDRY_ENDPOINT is set (azcodex setup).");
    }
    console.log("Start a new session so Codex loads AGENTS.md and the MCP server.");
    return;
  }

  if (command === "webui") {
    requireFoundry(settings);
    const dataDir = path.join(os.homedir(), ".codex", "codex-webui", "data");
    const yamlPath = path.join(os.homedir(), ".codex", "codex-webui.yml");
    await ensureAzcodexHome(settings);
    await installChartInstructions(azcodexHome());
    await registerWebuiProfiles(yamlPath, {
      openaiHome: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
      azHome: azcodexHome(),
      dataDir
    });
    console.log(`Profiles 'codex' (OpenAI, default) and 'azcodex' (Foundry) saved to ${yamlPath}.`);
    console.log("Restart with: codex-webui restart   (export AZURE_FOUNDRY_API_KEY before starting)");
    return;
  }

  requireFoundry(settings);
  await ensureAzcodexHome(settings);
  await installChartInstructions(azcodexHome());
  const args = command === undefined ? [] : [command, ...rest];
  const child = spawn(codexBin, args, { stdio: "inherit", env: azcodexChildEnv(settings) });
  child.on("error", (error) => {
    console.error(`failed to start ${codexBin}: ${error.message}`);
    process.exit(127);
  });
  child.on("exit", (code, signal) => process.exit(signal ? 128 : (code ?? 0)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
