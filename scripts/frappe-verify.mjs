#!/usr/bin/env node
import process from "node:process";

import {
  MODULE_RE,
  assertName,
  assertSiteAllowed,
  findBench,
  runCommand
} from "../mcp/frappe-bench-lib.mjs";

function usage() {
  console.log(`Frappe verification loop

Usage:
  node scripts/frappe-verify.mjs --bench /path/to/frappe-bench --site dev.example.com --app my_app [options]

Options:
  --module dotted.module   Restrict run-tests to a module
  --skip-migrate          Skip backup + migrate
  --skip-build            Skip bench build --app <app>
  --timeout SECONDS       Per-command timeout (default 900)

The target site must be developer-mode or listed in FRAPPE_BENCH_ALLOWED_SITES.
Migrate is always preceded by a successful backup.
`);
}

function parseArgs(argv) {
  const out = { skipMigrate: false, skipBuild: false, timeoutSeconds: 900 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = () => {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--bench") out.bench = take();
    else if (arg === "--site") out.site = take();
    else if (arg === "--app") out.app = take();
    else if (arg === "--module") out.module = take();
    else if (arg === "--timeout") out.timeoutSeconds = Number(take());
    else if (arg === "--skip-migrate") out.skipMigrate = true;
    else if (arg === "--skip-build") out.skipBuild = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printResult(label, result) {
  const ok = result.code === 0 && !result.timedOut;
  console.log(`\n===== ${label}: ${ok ? "PASS" : "FAIL"} =====`);
  if (result.output.trim()) console.log(result.output.trim());
  if (!ok) {
    const reason = result.timedOut ? "timed out" : `exit code ${result.code}`;
    throw new Error(`${label} failed (${reason}).`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();
  if (!options.bench || !options.site || !options.app) {
    usage();
    throw new Error("--bench, --site and --app are required.");
  }
  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds < 5 || options.timeoutSeconds > 7200) {
    throw new Error("--timeout must be between 5 and 7200 seconds.");
  }

  const bench = await findBench(options.bench);
  if (!bench) throw new Error(`Frappe bench not found from: ${options.bench}`);
  const site = await assertSiteAllowed(bench, options.site, process.env);
  const app = assertName(options.app, "app");
  const moduleName = options.module ? assertName(options.module, "module", MODULE_RE) : null;
  const bin = process.env.FRAPPE_BENCH_BIN || "bench";
  const timeoutMs = options.timeoutSeconds * 1000;
  const run = (args) => runCommand(bin, args, { cwd: bench, timeoutMs, env: process.env, maxChars: 40_000 });

  console.log(`Bench: ${bench}`);
  console.log(`Site:  ${site}`);
  console.log(`App:   ${app}`);

  const testArgs = ["--site", site, "run-tests", "--app", app];
  if (moduleName) testArgs.push("--module", moduleName);
  printResult("tests", await run(testArgs));

  if (!options.skipMigrate) {
    printResult("backup", await run(["--site", site, "backup", "--with-files"]));
    printResult("migrate", await run(["--site", site, "migrate"]));
  }

  if (!options.skipBuild) {
    printResult("build", await run(["build", "--app", app]));
  }

  console.log("\nFrappe verification completed successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
