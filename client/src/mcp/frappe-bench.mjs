#!/usr/bin/env node
// frappe-bench MCP server (stdio, newline-delimited JSON-RPC, zero dependencies).
//
// Env:
//   FRAPPE_BENCH_PATH           bench root (default: auto-detect from cwd)
//   FRAPPE_BENCH_BIN            bench executable (default: bench)
//   FRAPPE_BENCH_ALLOWED_SITES  comma list; default = sites with developer_mode on
//   FRAPPE_BENCH_READONLY=1     only inspection tools
//   FRAPPE_BENCH_ALLOW_CONSOLE=1  enable console_eval (arbitrary Python on the site!)
//   FRAPPE_BENCH_TIMEOUT_SECONDS  per command (default 600)
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";

import {
  DOCTYPE_RE,
  MODULE_RE,
  allowedSites,
  assertName,
  assertSiteAllowed,
  findBench,
  getDocSchema,
  listApps,
  listDoctypes,
  listLogs,
  listSites,
  runCommand,
  tailLog
} from "./frappe-bench-lib.mjs";

const SERVER_INFO = { name: "frappe-bench", version: "0.1.0" };
const flag = (v) => ["1", "true", "yes"].includes(String(v ?? "").toLowerCase());

const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const TOOLS = [
  { name: "bench_status", mutating: false, description: "Bench path, bench version, apps, all sites and which sites the agent may use.", properties: {} },
  { name: "list_doctypes", mutating: false, description: "List DocTypes defined in an app (from its JSON files).", properties: { app: str("App name, e.g. my_app") }, required: ["app"] },
  { name: "get_doc_schema", mutating: false, description: "Fields and permissions of a DocType from its JSON definition.", properties: { doctype: str("DocType name, e.g. Sales Invoice"), app: str("Optional app to search first") }, required: ["doctype"] },
  { name: "tail_logs", mutating: false, description: "Last lines of a file in <bench>/logs (omit file to list log files).", properties: { file: str("e.g. web.error.log"), lines: { type: "integer", description: "1-500, default 100" } } },
  { name: "run_tests", mutating: true, description: "bench --site <site> run-tests --app <app> [--module M | --doctype D].", properties: { site: str("Allowed site"), app: str("App name"), module: str("Dotted python module"), doctype: str("DocType name") }, required: ["site", "app"] },
  { name: "migrate", mutating: true, description: "Takes a backup, then runs bench --site <site> migrate. Use after DocType or patch changes.", properties: { site: str("Allowed site"), skip_backup: { type: "boolean", description: "Default false" } }, required: ["site"] },
  { name: "backup", mutating: true, description: "bench --site <site> backup.", properties: { site: str("Allowed site") }, required: ["site"] },
  { name: "build", mutating: true, description: "bench build --app <app> (JS/CSS assets).", properties: { app: str("App name") }, required: ["app"] },
  { name: "console_eval", mutating: true, console: true, description: "Run Python in `bench --site <site> console`. Disabled unless FRAPPE_BENCH_ALLOW_CONSOLE=1. Can modify data; prefer other tools.", properties: { site: str("Allowed site"), code: str("Python code; end with print(...) to see results") }, required: ["site", "code"] }
];

function visibleTools(env) {
  const readonly = flag(env.FRAPPE_BENCH_READONLY);
  return TOOLS.filter((t) => !(readonly && t.mutating) && !(t.console && !flag(env.FRAPPE_BENCH_ALLOW_CONSOLE)));
}

const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: "text", text: message }] });

export async function callTool(name, args = {}, env = process.env) {
  const tool = visibleTools(env).find((t) => t.name === name);
  if (!tool) return fail(`Unknown or disabled tool: ${name}`);

  const bench = await findBench(env.FRAPPE_BENCH_PATH || process.cwd());
  if (!bench) return fail("Bench not found. Set FRAPPE_BENCH_PATH to the bench root (contains apps/ and sites/).");
  const bin = env.FRAPPE_BENCH_BIN || "bench";
  const timeoutMs = Math.max(5, Number(env.FRAPPE_BENCH_TIMEOUT_SECONDS) || 600) * 1000;
  const run = (argv, input) => runCommand(bin, argv, { cwd: bench, timeoutMs, input, env });
  const report = (r) => ({
    ...(r.code === 0 && !r.timedOut ? {} : { isError: true }),
    content: [{ type: "text", text: `${r.timedOut ? "[timed out]\n" : ""}exit code ${r.code}\n${r.output}` }]
  });

  try {
    switch (name) {
      case "bench_status": {
        const version = await run(["--version"]);
        return text({
          bench,
          benchVersion: version.code === 0 ? version.output.trim() : `unavailable (${version.output.trim().slice(0, 200)})`,
          apps: await listApps(bench),
          sites: await listSites(bench),
          allowedSites: await allowedSites(bench, env),
          readonly: flag(env.FRAPPE_BENCH_READONLY),
          consoleEnabled: flag(env.FRAPPE_BENCH_ALLOW_CONSOLE)
        });
      }
      case "list_doctypes":
        return text(await listDoctypes(bench, args.app));
      case "get_doc_schema": {
        const schema = await getDocSchema(bench, args.doctype, args.app);
        return schema ? text(schema) : fail(`DocType "${args.doctype}" not found in apps/*/ JSON files.`);
      }
      case "tail_logs": {
        if (!args.file) return text({ logs: await listLogs(bench) });
        return text(await tailLog(bench, args.file, args.lines));
      }
      case "run_tests": {
        const site = await assertSiteAllowed(bench, args.site, env);
        const argv = ["--site", site, "run-tests", "--app", assertName(args.app, "app")];
        if (args.module) argv.push("--module", assertName(args.module, "module", MODULE_RE));
        if (args.doctype) argv.push("--doctype", assertName(args.doctype, "doctype", DOCTYPE_RE));
        return report(await run(argv));
      }
      case "backup":
        return report(await run(["--site", await assertSiteAllowed(bench, args.site, env), "backup"]));
      case "migrate": {
        const site = await assertSiteAllowed(bench, args.site, env);
        let prefix = "";
        if (!args.skip_backup) {
          const backup = await run(["--site", site, "backup"]);
          if (backup.code !== 0) return fail(`Backup failed, migrate not run.\n${backup.output}`);
          prefix = `[backup ok]\n`;
        }
        const migrate = await run(["--site", site, "migrate"]);
        const out = report(migrate);
        out.content[0].text = prefix + out.content[0].text;
        return out;
      }
      case "build":
        return report(await run(["build", "--app", assertName(args.app, "app")]));
      case "console_eval": {
        const site = await assertSiteAllowed(bench, args.site, env);
        if (typeof args.code !== "string" || !args.code.trim() || args.code.length > 20_000) return fail("code must be 1-20000 characters.");
        return report(await run(["--site", site, "console"], `${args.code}\nexit()\n`));
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

async function handle(message, env) {
  const { id, method, params } = message;
  const respond = (result) => ({ jsonrpc: "2.0", id, result });
  const error = (code, msg) => ({ jsonrpc: "2.0", id, error: { code, message: msg } });
  if (method === "initialize") {
    const requested = params?.protocolVersion;
    return respond({
      protocolVersion: typeof requested === "string" ? requested : "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: "Frappe bench helper. Start with bench_status. Only developer-mode or explicitly allowed sites can be used."
    });
  }
  if (method === "ping") return respond({});
  if (method === "tools/list") {
    return respond({
      tools: visibleTools(env).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: { type: "object", properties: t.properties, ...(t.required ? { required: t.required } : {}), additionalProperties: false }
      }))
    });
  }
  if (method === "tools/call") return respond(await callTool(params?.name, params?.arguments ?? {}, env));
  if (id === undefined) return null; // notification
  return error(-32601, `Method not found: ${method}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const rl = createInterface({ input: process.stdin });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
        return;
      }
      const response = await handle(message, process.env);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    });
  });
  rl.on("close", () => chain.then(() => process.exit(0)));
}