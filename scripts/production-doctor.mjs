#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { inspectRegistry } from "./mcp-registry-lib.mjs";

let ok = true;
const check = (label, pass, hint = "") => {
  ok &&= pass;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}${pass || !hint ? "" : ` — ${hint}`}`);
};

function command(name, args = ["--version"], required = true) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  const pass = result.status === 0;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/u)[0] ?? "";
  check(`${name}${output ? `: ${output}` : ""}`, pass || !required, required ? `${name} is required` : "optional");
  return pass;
}

const major = Number(process.versions.node.split(".")[0]);
check(`Node ${process.version}`, Number.isInteger(major) && major >= 22, "Node >= 22 is required");
command("pnpm");
command("cargo");
command(process.env.CODEX_WEBUI_CODEX_BIN || "codex");
command("nginx", ["-v"], false);

const production = process.env.NODE_ENV === "production";
check("NODE_ENV=production", production, "set NODE_ENV=production on the production host");

const host = String(process.env.HOST ?? "127.0.0.1");
check(`HOST=${host}`, host === "127.0.0.1" || host === "::1", "bind the gateway to loopback behind Nginx");

const passwordHash = String(process.env.CODEX_WEBUI_PASSWORD_HASH ?? "");
const ownerHash = String(process.env.CODEX_WEBUI_OWNER_PASSWORD_HASH ?? "");
const sessionSecret = String(process.env.CODEX_WEBUI_SESSION_SECRET ?? "");
check("CODEX_WEBUI_PASSWORD_HASH", passwordHash.startsWith("scrypt$"), "generate with `pnpm hash-password`");
check("CODEX_WEBUI_OWNER_PASSWORD_HASH", ownerHash.startsWith("scrypt$"), "generate with `pnpm hash-password`");
check("CODEX_WEBUI_SESSION_SECRET", sessionSecret.length >= 32, "generate a high-entropy secret");


const allowedRoots = String(process.env.CODEX_WEBUI_ALLOWED_ROOTS ?? "")
  .split(process.platform === "win32" ? ";" : ":")
  .map((value) => value.trim())
  .filter(Boolean);
check("CODEX_WEBUI_ALLOWED_ROOTS configured", allowedRoots.length > 0, "set at least one allowed workspace root");
for (const root of allowedRoots) {
  check(`allowed root exists: ${root}`, fs.existsSync(root), "create/mount the workspace before starting");
}

const projectRoot = String(process.env.CODEX_WEBUI_PROJECT_ROOT ?? "").trim();
check("CODEX_WEBUI_PROJECT_ROOT configured", Boolean(projectRoot), "set the deployed application root, normally /home/frappe/az-codex");
if (projectRoot) {
  check(`project root exists: ${projectRoot}`, fs.existsSync(projectRoot), "deploy the repository before starting");
  check(
    `project package.json: ${projectRoot}`,
    fs.existsSync(`${projectRoot.replace(/\/+$/u, "")}/package.json`),
    "production checks require package.json at CODEX_WEBUI_PROJECT_ROOT"
  );
}

const dataDir = String(process.env.CODEX_WEBUI_DATA_DIR ?? "").trim();
check("CODEX_WEBUI_DATA_DIR configured", Boolean(dataDir), "set a persistent data directory");
if (dataDir) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
    check(`data dir writable: ${dataDir}`, true);
  } catch (error) {
    check(`data dir writable: ${dataDir}`, false, error.message);
  }
}

try {
  const registry = await inspectRegistry();
  check(`integration registry (${registry.providers.length} providers)`, registry.healthy, "run `pnpm mcp:doctor`");
} catch (error) {
  check("integration registry", false, error.message);
}

const foundryEndpoint = String(process.env.AZURE_FOUNDRY_ENDPOINT ?? "").trim();
const foundryKey = String(process.env.AZURE_FOUNDRY_API_KEY ?? "").trim();
const foundryModel = String(process.env.AZURE_FOUNDRY_MODEL ?? "").trim();
const azcodexHome = String(process.env.AZCODEX_HOME ?? "").trim();
check("Foundry endpoint", Boolean(foundryEndpoint), "set AZURE_FOUNDRY_ENDPOINT");
check("Foundry API key", Boolean(foundryKey), "set AZURE_FOUNDRY_API_KEY");
check("Foundry deployment", Boolean(foundryModel), "set AZURE_FOUNDRY_MODEL to the exact Azure deployment name");
check("AZCODEX_HOME", Boolean(azcodexHome), "set AZCODEX_HOME, normally /home/frappe/.azcodex");

const defaultProfile = String(process.env.CODEX_WEBUI_DEFAULT_PROFILE_ID ?? "").trim();
check("default WebUI profile configured", Boolean(defaultProfile), "set CODEX_WEBUI_DEFAULT_PROFILE_ID");

const profilesRaw = String(process.env.CODEX_WEBUI_PROFILES_JSON ?? "").trim();
try {
  const profiles = JSON.parse(profilesRaw);
  const configuredProfiles = Array.isArray(profiles) ? profiles : [];
  const selected = configuredProfiles.find((profile) => profile?.id === defaultProfile);
  check(
    `WebUI default profile exists: ${defaultProfile || "(missing)"}`,
    Boolean(selected?.codexHome),
    "CODEX_WEBUI_DEFAULT_PROFILE_ID must reference an entry in CODEX_WEBUI_PROFILES_JSON"
  );
  const azcodex = configuredProfiles.find((profile) => profile?.id === "azcodex");
  if (azcodex && azcodexHome) {
    check(
      "azcodex profile CODEX_HOME",
      azcodex.codexHome === azcodexHome,
      "azcodex profile codexHome must match AZCODEX_HOME"
    );
  }
} catch (error) {
  check("CODEX_WEBUI_PROFILES_JSON", false, `invalid JSON: ${error.message}`);
}

if (ok) {
  const azcodexBin = fileURLToPath(new URL("../bin/azcodex.mjs", import.meta.url));
  const probe = spawnSync(process.execPath, [azcodexBin, "doctor"], {
    encoding: "utf8",
    timeout: 120_000,
    env: process.env
  });
  const output = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
  check(
    "live Foundry runtime",
    probe.status === 0,
    probe.error?.code === "ETIMEDOUT" ? "azcodex doctor timed out" : output.split(/\r?\n/u).slice(-8).join(" | ")
  );
}

if (!ok) {
  console.error("\nProduction doctor failed. Fix the reported items before deployment.");
  process.exit(1);
}

console.log("\nProduction doctor passed.");
