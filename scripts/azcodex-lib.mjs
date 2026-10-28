// Shared helpers for `azcodex`: run Codex against Microsoft Foundry (Azure OpenAI)
// while plain `codex` keeps using the default OpenAI account.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const MANAGED_MARKER = "# managed-by: azcodex (delete this line to keep your manual edits)";
export const DEFAULT_API_KEY_ENV = "AZURE_FOUNDRY_API_KEY";

export function azcodexHome(env = process.env) {
  return path.resolve(env.AZCODEX_HOME || path.join(os.homedir(), ".azcodex"));
}

/** Read Foundry settings from the environment. */
export function foundrySettings(env = process.env) {
  return {
    endpoint: String(env.AZURE_FOUNDRY_ENDPOINT ?? "").trim(),
    apiKeyEnv: String(env.AZURE_FOUNDRY_API_KEY_ENV ?? DEFAULT_API_KEY_ENV).trim() || DEFAULT_API_KEY_ENV,
    // On Azure, "model" is the deployment name, not a guessed base-model name.
    model: String(env.AZURE_FOUNDRY_MODEL ?? "").trim(),
    apiVersion: String(env.AZURE_FOUNDRY_API_VERSION ?? "").trim()
  };
}

/**
 * Turn the resource endpoint into the provider base_url.
 *  - default: v1 API  -> <endpoint>/openai/v1   (no api-version needed)
 *  - with AZURE_FOUNDRY_API_VERSION: classic API -> <endpoint>/openai + ?api-version=
 */
export function normalizeBaseUrl(endpoint, apiVersion = "") {
  const raw = String(endpoint ?? "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("AZURE_FOUNDRY_ENDPOINT is not set.");
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`AZURE_FOUNDRY_ENDPOINT is not a valid URL: ${raw}`);
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("AZURE_FOUNDRY_ENDPOINT must use https.");
  }

  const version = String(apiVersion ?? "").trim().toLowerCase();
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/openai(\/v1)?$/, "");

  // Foundry/OpenAI v1 uses the OpenAI-compatible /openai/v1 surface.
  // Model versions such as 2026-02-24 are NOT REST API versions.
  if (!version || version === "v1") {
    return `${url.origin}${pathname}/openai/v1`;
  }

  // Retain classic Azure API-version support only for explicit dated/preview API versions.
  return `${url.origin}${pathname}/openai`;
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

export function validateFoundrySettings(settings, env = process.env) {
  const errors = [];
  if (!String(settings?.endpoint ?? "").trim()) errors.push("AZURE_FOUNDRY_ENDPOINT is required.");
  if (!String(settings?.model ?? "").trim()) errors.push("AZURE_FOUNDRY_MODEL is required and must be the Azure deployment name.");
  const keyEnv = String(settings?.apiKeyEnv ?? DEFAULT_API_KEY_ENV).trim() || DEFAULT_API_KEY_ENV;
  if (!String(env[keyEnv] ?? "").trim()) errors.push(`${keyEnv} is required.`);
  if (errors.length) throw new Error(errors.join(" "));
  return settings;
}

/** Build the CODEX_HOME/config.toml used by azcodex. */
export function buildConfigToml(settings, extraBlock = "") {
  if (!String(settings?.model ?? "").trim()) {
    throw new Error("AZURE_FOUNDRY_MODEL is required and must be the Azure deployment name.");
  }
  const baseUrl = normalizeBaseUrl(settings.endpoint, settings.apiVersion);
  const lines = [
    MANAGED_MARKER,
    `model = ${tomlString(settings.model)}`,
    `model_provider = "foundry"`,
    "",
    "[model_providers.foundry]",
    `name = "Microsoft Foundry"`,
    `base_url = ${tomlString(baseUrl)}`,
    `env_key = ${tomlString(settings.apiKeyEnv)}`,
    `wire_api = "responses"`,
    `requires_openai_auth = false`
  ];
  const apiVersion = String(settings.apiVersion ?? "").trim().toLowerCase();
  if (apiVersion && apiVersion !== "v1") {
    lines.push(`query_params = { api-version = ${tomlString(settings.apiVersion)} }`);
  }
  return `${lines.join("\n")}\n${extraBlock ? `\n${extraBlock.trimEnd()}\n` : ""}`;
}

/**
 * Create/refresh <azcodex home>/config.toml.
 * A file without the managed marker is treated as hand-edited and is never overwritten.
 */
export async function ensureAzcodexHome(settings, env = process.env) {
  const home = azcodexHome(env);
  const configPath = path.join(home, "config.toml");
  const state = await readFrappeState(home);
  const next = buildConfigToml(settings, state ? frappeMcpBlock(state) : "");
  await fs.mkdir(home, { recursive: true, mode: 0o700 });
  let existing = null;
  try {
    existing = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (existing !== null && !existing.includes(MANAGED_MARKER)) {
    return { home, configPath, written: false, reason: "manual-config" };
  }
  if (existing === next) {
    return { home, configPath, written: false, reason: "unchanged" };
  }
  await fs.writeFile(configPath, next, { mode: 0o600 });
  return { home, configPath, written: true, reason: existing === null ? "created" : "updated" };
}

/** Environment for a codex child process that should talk to Foundry. */
export function azcodexChildEnv(settings, env = process.env) {
  return { ...env, CODEX_HOME: azcodexHome(env) };
}

/**
 * Add/refresh the `codex` (OpenAI) and `azcodex` (Foundry) profiles in codex-webui.yml.
 * Existing profiles and every other key are preserved.
 */
export async function registerWebuiProfiles(yamlPath, { openaiHome, azHome, dataDir }) {
  let text;
  try {
    text = await fs.readFile(yamlPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${yamlPath} not found. Run \`codex-webui config\` once first, then re-run this command.`);
    }
    throw error;
  }
  const doc = YAML.parse(text) ?? {};
  const profiles = Array.isArray(doc.profiles) ? doc.profiles : [];
  const upsert = (id, label, codexHome) => {
    const entry = { id, label, codexHome, dataDir: path.join(dataDir, "profiles", id) };
    const index = profiles.findIndex((p) => p?.id === id);
    if (index >= 0) profiles[index] = { ...profiles[index], ...entry };
    else profiles.push(entry);
  };
  upsert("codex", "Codex (OpenAI)", openaiHome);
  upsert("azcodex", "azcodex (Microsoft Foundry)", azHome);
  doc.profiles = profiles;
  if (!doc.defaultProfileId || !profiles.some((p) => p.id === doc.defaultProfileId)) {
    doc.defaultProfileId = "codex"; // OpenAI stays the default
  }
  await fs.writeFile(yamlPath, YAML.stringify(doc), { mode: 0o600 });
  return doc;
}

// ---------------------------------------------------------------------------
// Chart instructions: teach the agent to draw charts the web UI can render.
// ---------------------------------------------------------------------------
export const CHARTS_START = "<!-- codex-webui:charts:start -->";
export const CHARTS_END = "<!-- codex-webui:charts:end -->";

export const CHART_INSTRUCTIONS = `${CHARTS_START}
## Charts in the chat UI

You can draw charts. When numbers are easier to understand visually (trends, comparisons,
shares, distributions, correlations), include a fenced code block whose language is \`chart\`
and whose content is ONE valid JSON object. The web UI renders it as an inline chart.

Format:
{"type":"bar|line|area|scatter|pie","title":"...","xLabel":"...","yLabel":"...",
 "labels":["A","B","C"],
 "series":[{"name":"Series 1","data":[1,2,3]}]}

Rules:
- bar/line/area: "labels" + "series" (each series has the same length as "labels").
- pie: one series, non-negative values (or "data":[{"label":"A","value":3}]).
- scatter: "series":[{"name":"...","data":[[x,y],[x,y]]}] (no "labels").
- Plain JSON only: no comments, no trailing commas, no formulas, numbers not strings.
- At most 200 points and 12 series. Aggregate larger data before charting.
- Compute the real numbers first (run code or read the files); never invent data.
- Add a one or two sentence explanation outside the block.
${CHARTS_END}
`;

// ---------------------------------------------------------------------------
// Managed sections (idempotent, never touch the rest of the file)
// ---------------------------------------------------------------------------
export async function upsertManaged(file, startMark, endMark, body) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const start = existing.indexOf(startMark);
  const end = existing.indexOf(endMark);
  let next;
  if (start >= 0 && end > start) {
    next = existing.slice(0, start) + body.trimEnd() + existing.slice(end + endMark.length);
  } else {
    next = existing.trimEnd() ? `${existing.trimEnd()}\n\n${body}` : body;
  }
  if (next === existing) return { file, changed: false };
  await fs.writeFile(file, next);
  return { file, changed: true };
}

export async function removeManaged(file, startMark, endMark) {
  let existing;
  try {
    existing = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { file, changed: false };
    throw error;
  }
  const start = existing.indexOf(startMark);
  const end = existing.indexOf(endMark);
  if (start < 0 || end < start) return { file, changed: false };
  const next = `${existing.slice(0, start).trimEnd()}\n${existing.slice(end + endMark.length).trimStart()}`.trim();
  if (next) await fs.writeFile(file, `${next}\n`);
  else await fs.rm(file);
  return { file, changed: true };
}

/** Insert or refresh the chart instructions in <dir>/AGENTS.md without touching other content. */
export const installChartInstructions = (dir) =>
  upsertManaged(path.join(dir, "AGENTS.md"), CHARTS_START, CHARTS_END, CHART_INSTRUCTIONS);

/** Remove the managed chart section (leaves the rest of AGENTS.md). */
export const removeChartInstructions = (dir) => removeManaged(path.join(dir, "AGENTS.md"), CHARTS_START, CHARTS_END);

// ---------------------------------------------------------------------------
// Frappe bench: agent instructions + `frappe-bench` MCP server registration
// ---------------------------------------------------------------------------
export const FRAPPE_START = "<!-- codex-webui:frappe:start -->";
export const FRAPPE_END = "<!-- codex-webui:frappe:end -->";
export const MCP_START = "# >>> frappe-bench (managed by azcodex) >>>";
export const MCP_END = "# <<< frappe-bench <<<";

export async function loadFrappeInstructions() {
  const templatePath = fileURLToPath(new URL("../templates/frappe/AGENTS.md", import.meta.url));
  const body = (await fs.readFile(templatePath, "utf8")).trim();
  return `${FRAPPE_START}\n${body}\n${FRAPPE_END}\n`;
}

export function frappeServerPath() {
  return fileURLToPath(new URL("../mcp/frappe-bench.mjs", import.meta.url));
}

/** TOML block that registers the frappe-bench MCP server with Codex. */
export function frappeMcpBlock(state) {
  const env = { FRAPPE_BENCH_PATH: state.benchPath };
  if (state.sites?.length) env.FRAPPE_BENCH_ALLOWED_SITES = state.sites.join(",");
  if (state.readonly) env.FRAPPE_BENCH_READONLY = "1";
  if (state.allowConsole) env.FRAPPE_BENCH_ALLOW_CONSOLE = "1";
  if (state.benchBin) env.FRAPPE_BENCH_BIN = state.benchBin;
  const envToml = Object.entries(env).map(([k, v]) => `${k} = ${JSON.stringify(String(v))}`).join(", ");
  return [
    MCP_START,
    "[mcp_servers.frappe-bench]",
    `command = ${JSON.stringify(state.nodeBin ?? process.execPath)}`,
    `args = [${JSON.stringify(state.serverPath ?? frappeServerPath())}]`,
    `env = { ${envToml} }`,
    MCP_END,
    ""
  ].join("\n");
}

export async function readFrappeState(home) {
  try {
    return JSON.parse(await fs.readFile(path.join(home, "frappe.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Enable Frappe support in a Codex home: AGENTS.md section + MCP server.
 * - azcodex home: state is saved in frappe.json so the managed config.toml keeps the block.
 * - plain codex home (openai: true): the block is inserted into the user's config.toml.
 */
export async function installFrappe(home, state, { openai = false } = {}) {
  const instructions = await loadFrappeInstructions();
  const agents = await upsertManaged(path.join(home, "AGENTS.md"), FRAPPE_START, FRAPPE_END, instructions);
  let config;
  if (openai) {
    config = await upsertManaged(path.join(home, "config.toml"), MCP_START, MCP_END, frappeMcpBlock(state));
  } else {
    await fs.mkdir(home, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(home, "frappe.json"), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }
  return { agents, config };
}

export async function removeFrappe(home, { openai = false } = {}) {
  const agents = await removeManaged(path.join(home, "AGENTS.md"), FRAPPE_START, FRAPPE_END);
  let config;
  if (openai) {
    config = await removeManaged(path.join(home, "config.toml"), MCP_START, MCP_END);
  } else {
    await fs.rm(path.join(home, "frappe.json"), { force: true });
  }
  return { agents, config };
}
