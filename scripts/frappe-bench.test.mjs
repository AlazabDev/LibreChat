import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  allowedSites,
  assertName,
  findBench,
  getDocSchema,
  listApps,
  listDoctypes,
  listSites,
  tailLog
} from "../mcp/frappe-bench-lib.mjs";
import { callTool } from "../mcp/frappe-bench.mjs";
import {
  buildConfigToml,
  ensureAzcodexHome,
  installFrappe,
  removeFrappe,
  frappeMcpBlock,
  FRAPPE_START,
  MCP_START
} from "./azcodex-lib.mjs";

async function makeBench() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bench-"));
  const w = async (rel, content) => {
    const file = path.join(root, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  await w("sites/apps.txt", "frappe\nmyapp\n");
  await w("sites/dev.local/site_config.json", JSON.stringify({ developer_mode: 1 }));
  await w("sites/prod.local/site_config.json", JSON.stringify({ db_name: "x" }));
  await w("apps/frappe/frappe/__init__.py", "");
  await w(
    "apps/myapp/myapp/crm/doctype/todo_item/todo_item.json",
    JSON.stringify({
      name: "Todo Item",
      module: "Crm",
      autoname: "naming_series:",
      fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 }],
      permissions: [{ role: "System Manager", read: 1, write: 1 }]
    })
  );
  await w("apps/myapp/myapp/crm/doctype/todo_item/todo_item.py", "");
  await w("logs/web.error.log", "a\nb\nc\n");
  const bin = path.join(root, "fake-bench.sh");
  await fs.writeFile(
    bin,
    '#!/bin/sh\necho "$@" >> "$FAKE_BENCH_LOG"\nif [ "$1" = "--version" ]; then echo 15.3.0; exit 0; fi\necho "ARGS: $*"\nif [ "$3" = "console" ]; then cat; fi\n',
    { mode: 0o755 }
  );
  return { root, bin, log: path.join(root, "calls.log") };
}

const envFor = (b, extra = {}) => ({ ...process.env, FRAPPE_BENCH_PATH: b.root, FRAPPE_BENCH_BIN: b.bin, FAKE_BENCH_LOG: b.log, ...extra });
const textOf = (r) => r.content[0].text;

test("bench discovery, doctypes and schema", async () => {
  const b = await makeBench();
  assert.equal(await findBench(path.join(b.root, "apps", "myapp")), b.root);
  assert.deepEqual(await listApps(b.root), ["frappe", "myapp"]);
  assert.deepEqual(await listSites(b.root), ["dev.local", "prod.local"]);
  assert.deepEqual(await allowedSites(b.root, {}), ["dev.local"]);
  assert.deepEqual(await allowedSites(b.root, { FRAPPE_BENCH_ALLOWED_SITES: "prod.local" }), ["prod.local"]);
  const dts = await listDoctypes(b.root, "myapp");
  assert.equal(dts[0].name, "Todo Item");
  const schema = await getDocSchema(b.root, "Todo Item");
  assert.equal(schema.app, "myapp");
  assert.equal(schema.fields[0].reqd, true);
  assert.equal(await getDocSchema(b.root, "Nope"), null);
  assert.equal(await tailLog(b.root, "web.error.log", 2), "b\nc");
  await assert.rejects(tailLog(b.root, "../../etc/passwd"));
});

test("names are validated", () => {
  for (const bad of ["../x", "a b", "x;rm -rf /", "", "$(id)", "a/b"]) assert.throws(() => assertName(bad, "x"));
  assert.equal(assertName("my_app-2", "app"), "my_app-2");
});

test("tools run bench without a shell and enforce site rules", async () => {
  const b = await makeBench();
  const env = envFor(b);
  const ok = await callTool("run_tests", { site: "dev.local", app: "myapp", module: "myapp.crm.test_x" }, env);
  assert.ok(!ok.isError, textOf(ok));
  assert.match(textOf(ok), /ARGS: --site dev\.local run-tests --app myapp --module myapp\.crm\.test_x/u);

  assert.equal((await callTool("run_tests", { site: "prod.local", app: "myapp" }, env)).isError, true);
  assert.equal((await callTool("run_tests", { site: "dev.local", app: "x; rm -rf /" }, env)).isError, true);
  assert.equal((await callTool("run_tests", { site: "dev.local", app: "myapp", module: "a b" }, env)).isError, true);

  const mig = await callTool("migrate", { site: "dev.local" }, env);
  assert.match(textOf(mig), /\[backup ok\]/u);
  const calls = (await fs.readFile(b.log, "utf8")).trim().split("\n");
  assert.deepEqual(calls.slice(-2), ["--site dev.local backup", "--site dev.local migrate"]);

  const status = await callTool("bench_status", {}, env);
  assert.match(textOf(status), /15\.3\.0/u);
});

test("console is off by default and readonly hides mutating tools", async () => {
  const b = await makeBench();
  assert.equal((await callTool("console_eval", { site: "dev.local", code: "print(1)" }, envFor(b))).isError, true);
  const on = await callTool("console_eval", { site: "dev.local", code: "print(1)" }, envFor(b, { FRAPPE_BENCH_ALLOW_CONSOLE: "1" }));
  assert.match(textOf(on), /print\(1\)/u);
  assert.equal((await callTool("migrate", { site: "dev.local" }, envFor(b, { FRAPPE_BENCH_READONLY: "1" }))).isError, true);
  assert.ok(!(await callTool("list_doctypes", { app: "myapp" }, envFor(b, { FRAPPE_BENCH_READONLY: "1" }))).isError);
});

test("MCP stdio protocol round trip", async () => {
  const b = await makeBench();
  const child = spawn(process.execPath, [path.resolve("mcp/frappe-bench.mjs")], { env: envFor(b), stdio: ["pipe", "pipe", "inherit"] });
  const lines = [];
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      lines.push(JSON.parse(buffer.slice(0, i)));
      buffer = buffer.slice(i + 1);
    }
  });
  const send = (m) => child.stdin.write(`${JSON.stringify(m)}\n`);
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_doc_schema", arguments: { doctype: "Todo Item" } } });
  send({ jsonrpc: "2.0", id: 4, method: "nope" });
  child.stdin.end();
  await new Promise((resolve) => child.on("close", resolve));
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  assert.equal(byId[1].result.serverInfo.name, "frappe-bench");
  assert.equal(byId[1].result.protocolVersion, "2025-03-26");
  const names = byId[2].result.tools.map((t) => t.name);
  assert.ok(names.includes("run_tests") && !names.includes("console_eval"));
  assert.match(byId[3].result.content[0].text, /"fieldname": "title"/u);
  assert.equal(byId[4].error.code, -32601);
  assert.equal(lines.length, 4);
});

test("installFrappe wires AGENTS.md and MCP config for azcodex and plain codex", async () => {
  const b = await makeBench();
  const az = await fs.mkdtemp(path.join(os.tmpdir(), "azh-"));
  const state = { benchPath: b.root, sites: ["dev.local"], readonly: false, allowConsole: false };
  await installFrappe(az, state);
  const agentsText = await fs.readFile(path.join(az, "AGENTS.md"), "utf8");
  assert.match(agentsText, new RegExp(FRAPPE_START));
  assert.match(agentsText, /\.\/\.azcodex\/bin\/az-bench/u);
  assert.match(agentsText, /does not ask for interactive approval/u);

  const settings = { endpoint: "https://r.openai.azure.com", apiKeyEnv: "K", model: "m", apiVersion: "" };
  await ensureAzcodexHome(settings, { AZCODEX_HOME: az });
  const toml = await fs.readFile(path.join(az, "config.toml"), "utf8");
  assert.match(toml, /\[mcp_servers\.frappe-bench\]/u);
  assert.match(toml, /FRAPPE_BENCH_ALLOWED_SITES = "dev\.local"/u);
  assert.ok(toml.indexOf("[model_providers.foundry]") < toml.indexOf("[mcp_servers.frappe-bench]"));
  assert.equal((await ensureAzcodexHome(settings, { AZCODEX_HOME: az })).reason, "unchanged");

  const oa = await fs.mkdtemp(path.join(os.tmpdir(), "oa-"));
  await fs.writeFile(path.join(oa, "config.toml"), 'model = "gpt-5"\n');
  await installFrappe(oa, state, { openai: true });
  await installFrappe(oa, state, { openai: true });
  const cfg = await fs.readFile(path.join(oa, "config.toml"), "utf8");
  assert.ok(cfg.startsWith('model = "gpt-5"'));
  assert.equal(cfg.split(MCP_START).length - 1, 1);
  await removeFrappe(oa, { openai: true });
  assert.equal((await fs.readFile(path.join(oa, "config.toml"), "utf8")).trim(), 'model = "gpt-5"');
  await assert.rejects(fs.readFile(path.join(oa, "AGENTS.md"), "utf8"));

  assert.match(buildConfigToml(settings, frappeMcpBlock(state)), /mcp_servers/u);
});