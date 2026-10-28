// Pure helpers for the `frappe-bench` MCP server (no dependencies).
// Safety model: no shell (argv arrays only), strict name validation, sites must be
// explicitly allowed or in developer_mode, output/time limits.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
export const DOCTYPE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/u;
export const MODULE_RE = /^[A-Za-z0-9_.]{1,200}$/u;
export const LOG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.log(\.\d{1,3})?$/u;

export function assertName(value, label, re = NAME_RE) {
  if (typeof value !== "string" || !re.test(value) || value.includes("..")) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** A bench root has `apps/` and `sites/apps.txt`. Walks upwards from `start`. */
export async function findBench(start) {
  let dir = path.resolve(start);
  for (;;) {
    if ((await exists(path.join(dir, "sites", "apps.txt"))) && (await exists(path.join(dir, "apps")))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function listApps(bench) {
  const entries = await fs.readdir(path.join(bench, "apps"), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && NAME_RE.test(e.name)).map((e) => e.name).sort();
}

export async function listSites(bench) {
  const entries = await fs.readdir(path.join(bench, "sites"), { withFileTypes: true });
  const sites = [];
  for (const e of entries) {
    if (e.isDirectory() && NAME_RE.test(e.name) && (await exists(path.join(bench, "sites", e.name, "site_config.json")))) {
      sites.push(e.name);
    }
  }
  return sites.sort();
}

export async function readSiteConfig(bench, site) {
  assertName(site, "site");
  try {
    return JSON.parse(await fs.readFile(path.join(bench, "sites", site, "site_config.json"), "utf8"));
  } catch {
    return null;
  }
}

const truthy = (v) => v === 1 || v === true || v === "1" || v === "true";

/** Sites the agent may touch: FRAPPE_BENCH_ALLOWED_SITES, otherwise sites with developer_mode on. */
export async function allowedSites(bench, env = process.env) {
  const sites = await listSites(bench);
  const configured = String(env.FRAPPE_BENCH_ALLOWED_SITES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (configured.length > 0) return sites.filter((s) => configured.includes(s));
  const out = [];
  for (const site of sites) {
    const cfg = await readSiteConfig(bench, site);
    if (cfg && truthy(cfg.developer_mode)) out.push(site);
  }
  return out;
}

export async function assertSiteAllowed(bench, site, env = process.env) {
  assertName(site, "site");
  const allowed = await allowedSites(bench, env);
  if (!allowed.includes(site)) {
    throw new Error(
      `Site "${site}" is not allowed. Allowed: ${allowed.join(", ") || "(none)"}. ` +
        "Sites need developer_mode enabled, or be listed in FRAPPE_BENCH_ALLOWED_SITES."
    );
  }
  return site;
}

const slug = (name) => name.toLowerCase().replace(/[\s-]+/gu, "_");

async function* doctypeFiles(bench, app) {
  const pkg = path.join(bench, "apps", app, app);
  let modules;
  try {
    modules = await fs.readdir(pkg, { withFileTypes: true });
  } catch {
    return;
  }
  for (const m of modules) {
    if (!m.isDirectory()) continue;
    const dtRoot = path.join(pkg, m.name, "doctype");
    let dts;
    try {
      dts = await fs.readdir(dtRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dts) {
      if (!d.isDirectory()) continue;
      const file = path.join(dtRoot, d.name, `${d.name}.json`);
      if (await exists(file)) yield { file, module: m.name, dir: d.name };
    }
  }
}

export async function listDoctypes(bench, app, limit = 500) {
  assertName(app, "app");
  const out = [];
  for await (const item of doctypeFiles(bench, app)) {
    let json = {};
    try {
      json = JSON.parse(await fs.readFile(item.file, "utf8"));
    } catch {
      /* keep directory name */
    }
    out.push({
      name: json.name ?? item.dir,
      module: item.module,
      istable: truthy(json.istable),
      issingle: truthy(json.issingle),
      is_submittable: truthy(json.is_submittable),
      path: path.relative(bench, item.file)
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getDocSchema(bench, doctype, app) {
  assertName(doctype, "doctype", DOCTYPE_RE);
  const apps = app ? [assertName(app, "app")] : await listApps(bench);
  for (const a of apps) {
    for await (const item of doctypeFiles(bench, a)) {
      if (item.dir !== slug(doctype)) continue;
      const json = JSON.parse(await fs.readFile(item.file, "utf8"));
      return {
        name: json.name ?? doctype,
        app: a,
        module: json.module ?? item.module,
        path: path.relative(bench, item.file),
        naming: json.autoname ?? json.naming_rule ?? null,
        istable: truthy(json.istable),
        issingle: truthy(json.issingle),
        is_submittable: truthy(json.is_submittable),
        title_field: json.title_field ?? null,
        fields: (json.fields ?? []).slice(0, 300).map((f) => ({
          fieldname: f.fieldname,
          fieldtype: f.fieldtype,
          label: f.label,
          options: f.options,
          reqd: truthy(f.reqd) || undefined,
          unique: truthy(f.unique) || undefined,
          in_list_view: truthy(f.in_list_view) || undefined
        })),
        permissions: (json.permissions ?? []).map((p) => ({
          role: p.role,
          read: p.read,
          write: p.write,
          create: p.create,
          delete: p.delete,
          submit: p.submit
        }))
      };
    }
  }
  return null;
}

export async function tailLog(bench, file, lines = 100) {
  assertName(file, "log file", LOG_RE);
  const n = Math.max(1, Math.min(Number(lines) || 100, 500));
  const full = path.join(bench, "logs", file);
  const handle = await fs.open(full, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, 256 * 1024);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString("utf8").split("\n").filter(Boolean).slice(-n).join("\n");
  } finally {
    await handle.close();
  }
}

export async function listLogs(bench) {
  try {
    return (await fs.readdir(path.join(bench, "logs"))).filter((f) => LOG_RE.test(f)).sort();
  } catch {
    return [];
  }
}

/** Run a command without a shell. Resolves with the (tail-truncated) combined output. */
export function runCommand(bin, args, { cwd, timeoutMs = 600_000, maxChars = 20_000, input, env } = {}) {
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let child;
    try {
      child = spawn(bin, args, { cwd, env: env ?? process.env, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      resolve({ code: 127, output: String(error?.message ?? error), truncated: false, timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const onData = (chunk) => {
      output += chunk.toString("utf8");
      if (output.length > maxChars * 4) output = output.slice(-maxChars * 2);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, output: `${output}\n${error.message}`.trim(), truncated: false, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const truncated = output.length > maxChars;
      resolve({ code: code ?? 1, output: truncated ? `…(truncated)…\n${output.slice(-maxChars)}` : output, truncated, timedOut });
    });
    child.stdin.on("error", () => {});
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}