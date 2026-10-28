import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";

import {
  buildConfigToml,
  ensureAzcodexHome,
  foundrySettings,
  normalizeBaseUrl,
  registerWebuiProfiles,
  installChartInstructions,
  removeChartInstructions,
  CHARTS_START,
  MANAGED_MARKER,
  validateFoundrySettings
} from "./azcodex-lib.mjs";

test("normalizeBaseUrl handles v1 and classic API", () => {
  assert.equal(normalizeBaseUrl("https://r.openai.azure.com/"), "https://r.openai.azure.com/openai/v1");
  assert.equal(normalizeBaseUrl("https://r.openai.azure.com/openai/v1"), "https://r.openai.azure.com/openai/v1");
  assert.equal(normalizeBaseUrl("https://r.openai.azure.com", "2025-04-01-preview"), "https://r.openai.azure.com/openai");
  assert.throws(() => normalizeBaseUrl(""));
  assert.throws(() => normalizeBaseUrl("http://r.example.com"));
});


test("Foundry deployment is explicit and credentials are validated", () => {
  const settings = foundrySettings({
    AZURE_FOUNDRY_ENDPOINT: "https://r.openai.azure.com",
    AZURE_FOUNDRY_API_KEY_ENV: "FOUND_KEY",
    FOUND_KEY: "secret",
    AZURE_FOUNDRY_MODEL: "az-model-sol"
  });
  assert.equal(settings.model, "az-model-sol");
  assert.equal(settings.apiKeyEnv, "FOUND_KEY");
  assert.equal(
    validateFoundrySettings(settings, { FOUND_KEY: "secret" }),
    settings
  );

  const missingModel = foundrySettings({
    AZURE_FOUNDRY_ENDPOINT: "https://r.openai.azure.com",
    AZURE_FOUNDRY_API_KEY: "secret"
  });
  assert.equal(missingModel.model, "");
  assert.throws(() => buildConfigToml(missingModel), /AZURE_FOUNDRY_MODEL/u);
  assert.throws(
    () => validateFoundrySettings(missingModel, { AZURE_FOUNDRY_API_KEY: "secret" }),
    /AZURE_FOUNDRY_MODEL/u
  );
});

test("production env selects the Foundry profile explicitly", async () => {
  const envFile = new URL("../deploy/production.env.example", import.meta.url);
  const text = await fs.readFile(envFile, "utf8");
  assert.match(text, /^CODEX_WEBUI_DEFAULT_PROFILE_ID=azcodex$/mu);
  assert.match(text, /"id":"codex"/u);
  assert.match(text, /"id":"azcodex"/u);
  assert.match(text, /"codexHome":"\/home\/frappe\/\.azcodex"/u);
});


test("production systemd initializes Foundry before the WebUI", async () => {
  const serviceFile = new URL("../deploy/systemd/az-codex.service", import.meta.url);
  const text = await fs.readFile(serviceFile, "utf8");
  const setup = "ExecStartPre=/usr/bin/node /opt/az-codex/bin/azcodex.mjs setup";
  const start = "ExecStart=/usr/bin/node /opt/az-codex/bin/codex-webui.mjs";
  assert.match(text, new RegExp(setup.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&"), "u"));
  assert.ok(text.indexOf(setup) < text.indexOf(start));
});

test("buildConfigToml uses the foundry provider and never embeds the key", () => {
  const toml = buildConfigToml({ endpoint: "https://r.openai.azure.com", apiKeyEnv: "AZURE_FOUNDRY_API_KEY", model: "my-dep", apiVersion: "" });
  assert.match(toml, /model_provider = "foundry"/);
  assert.match(toml, /model = "my-dep"/);
  assert.match(toml, /wire_api = "responses"/);
  assert.match(toml, /requires_openai_auth = false/);
  assert.ok(!toml.includes("env_http_headers"));
  assert.ok(!toml.includes("query_params"));
});

test("ensureAzcodexHome keeps hand-edited configs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "az-"));
  const env = { AZCODEX_HOME: dir };
  const s = { endpoint: "https://r.openai.azure.com", apiKeyEnv: "K", model: "m", apiVersion: "" };
  assert.equal((await ensureAzcodexHome(s, env)).reason, "created");
  assert.equal((await ensureAzcodexHome(s, env)).reason, "unchanged");
  await fs.writeFile(path.join(dir, "config.toml"), "model = \"mine\"\n");
  assert.equal((await ensureAzcodexHome(s, env)).reason, "manual-config");
  assert.equal(await fs.readFile(path.join(dir, "config.toml"), "utf8"), "model = \"mine\"\n");
  assert.ok(MANAGED_MARKER.length > 0);
});

test("registerWebuiProfiles preserves existing profiles and default", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "az-"));
  const file = path.join(dir, "w.yml");
  await fs.writeFile(file, YAML.stringify({ port: 1, defaultProfileId: "work", profiles: [{ id: "work", codexHome: "/w", dataDir: "/d" }] }));
  const doc = await registerWebuiProfiles(file, { openaiHome: "/o", azHome: "/a", dataDir: "/data" });
  assert.deepEqual(doc.profiles.map((p) => p.id), ["work", "codex", "azcodex"]);
  assert.equal(doc.defaultProfileId, "work");
  assert.equal(doc.port, 1);
});

test("chart instructions are added idempotently and keep user content", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "az-"));
  const file = path.join(dir, "AGENTS.md");
  await fs.writeFile(file, "# My rules\nBe brief.\n");
  assert.equal((await installChartInstructions(dir)).changed, true);
  assert.equal((await installChartInstructions(dir)).changed, false);
  let text = await fs.readFile(file, "utf8");
  assert.ok(text.startsWith("# My rules\nBe brief."));
  assert.equal(text.split(CHARTS_START).length - 1, 1);
  assert.match(text, /language is \`chart\`/);
  assert.equal((await removeChartInstructions(dir)).changed, true);
  text = await fs.readFile(file, "utf8");
  assert.equal(text.trim(), "# My rules\nBe brief.");
});

test("removing chart instructions deletes an AGENTS.md that only held them", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "az-"));
  await installChartInstructions(dir);
  await removeChartInstructions(dir);
  await assert.rejects(fs.readFile(path.join(dir, "AGENTS.md"), "utf8"));
});
