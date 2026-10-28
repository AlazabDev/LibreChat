#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const templateDir = path.join(repoRoot, "templates", "frappe");

function usage() {
  console.log(`Usage:
  pnpm frappe:install -- --bench /home/frappe/frappe-bench --site dev.example.com [--profile development|production]

Options:
  --bench    Frappe bench root (required)
  --site     Site name used for automatic pre-operation backups (required)
  --profile  development (default) or production
`);
}

function parseArgs(argv) {
  const out = { profile: "development" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--bench") out.bench = argv[++i];
    else if (arg === "--site") out.site = argv[++i];
    else if (arg === "--profile") out.profile = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function assertSafeValue(label, value) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`${label} is required and must be a single line.`);
}

async function installAgents(benchRoot) {
  const source = await readFile(path.join(templateDir, "AGENTS.md"), "utf8");
  const target = path.join(benchRoot, "AGENTS.md");
  const start = "<!-- AZCODEX_FRAPPE_START -->";
  const end = "<!-- AZCODEX_FRAPPE_END -->";
  const block = `${start}\n${source.trim()}\n${end}`;

  let current = existsSync(target) ? await readFile(target, "utf8") : "";
  const startIndex = current.indexOf(start);
  const endIndex = current.indexOf(end);

  if (startIndex >= 0 && endIndex > startIndex) {
    current = `${current.slice(0, startIndex)}${block}${current.slice(endIndex + end.length)}`;
  } else if (current.trim()) {
    current = `${current.trimEnd()}\n\n${block}\n`;
  } else {
    current = `${block}\n`;
  }
  await writeFile(target, current, "utf8");
  return target;
}

async function installProfile(benchRoot, profile, site) {
  const profileSource = path.join(templateDir, `${profile}.env`);
  if (!existsSync(profileSource)) throw new Error(`Unknown profile: ${profile}`);

  const azDir = path.join(benchRoot, ".azcodex");
  const binDir = path.join(azDir, "bin");
  await mkdir(binDir, { recursive: true });

  let envText = await readFile(profileSource, "utf8");
  envText = envText.replace(/^AZCODEX_FRAPPE_SITE=.*$/m, `AZCODEX_FRAPPE_SITE=${site}`);
  const envTarget = path.join(azDir, "frappe.env");
  await writeFile(envTarget, envText, { encoding: "utf8", mode: 0o600 });
  await chmod(envTarget, 0o600);

  const guardTarget = path.join(binDir, "az-bench");
  await copyFile(path.join(templateDir, "az-bench"), guardTarget);
  await chmod(guardTarget, 0o750);

  return { envTarget, guardTarget };
}

function detectVersion(benchRoot) {
  try {
    return execFileSync("bench", ["version"], {
      cwd: benchRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "bench version unavailable (run `bench version` inside the bench to inspect it)";
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  assertSafeValue("--bench", options.bench);
  assertSafeValue("--site", options.site);
  if (!["development", "production"].includes(options.profile)) {
    throw new Error("--profile must be development or production");
  }

  const benchRoot = path.resolve(options.bench);
  if (!existsSync(path.join(benchRoot, "apps")) || !existsSync(path.join(benchRoot, "sites"))) {
    throw new Error(`${benchRoot} does not look like a Frappe bench (apps/ and sites/ are required).`);
  }

  const agentsTarget = await installAgents(benchRoot);
  const { envTarget, guardTarget } = await installProfile(
    benchRoot,
    options.profile,
    options.site,
  );

  console.log("Frappe profile installed successfully.");
  console.log(`Bench:   ${benchRoot}`);
  console.log(`Site:    ${options.site}`);
  console.log(`Profile: ${options.profile}`);
  console.log(`Version: ${detectVersion(benchRoot)}`);
  console.log(`AGENTS:  ${agentsTarget}`);
  console.log(`Profile: ${envTarget}`);
  console.log(`Guard:   ${guardTarget}`);
  console.log("");
  console.log("Guarded example:");
  console.log(`  ${guardTarget} --site ${options.site} migrate`);
}

main().catch((error) => {
  console.error(`[frappe:install] ${error.message}`);
  process.exitCode = 1;
});
