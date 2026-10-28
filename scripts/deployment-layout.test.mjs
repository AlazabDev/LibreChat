import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const read = (relative) => fs.readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("deployment helpers use pnpm and fixed production paths", async () => {
  const deploy = await read("deploy/scripts/deploy.sh");
  const preflight = await read("deploy/scripts/preflight.sh");
  const service = await read("deploy/systemd/az-codex.service");

  assert.match(deploy, /pnpm install --frozen-lockfile/u);
  assert.match(deploy, /pnpm release:check/u);
  assert.match(deploy, /pnpm foundry:doctor/u);
  assert.match(deploy, /pnpm prod:doctor/u);
  assert.doesNotMatch(deploy, /npm /u);

  assert.match(preflight, /pnpm release:check/u);
  assert.match(preflight, /pnpm foundry:doctor/u);
  assert.match(preflight, /pnpm prod:doctor/u);

  assert.match(deploy, /APP_DIR="\$\{APP_DIR:-\/home\/frappe\/az-codex\}"/u);
  assert.match(deploy, /ENV_FILE="\$\{ENV_FILE:-\/home\/frappe\/az-codex\/\.env\}"/u);
  assert.match(deploy, /node --env-file='\$ENV_FILE'/u);
  assert.match(service, /WorkingDirectory=\/home\/frappe\/az-codex/u);
  assert.match(service, /--env-file=\/home\/frappe\/az-codex\/\.env/u);
  assert.match(service, /ExecStart=\/home\/frappe\/az-codex\/backend\/target\/release\/backend/u);
  assert.match(deploy, /cargo build --release --manifest-path backend\/Cargo\.toml --bin backend/u);
});

test("first TLS bootstrap never exposes the app over plaintext HTTP", async () => {
  const bootstrap = await read("deploy/nginx/codex.alazab.com.bootstrap.conf");
  assert.match(bootstrap, /\.well-known\/acme-challenge/u);
  assert.match(bootstrap, /location \/ \{\s*return 404;/u);
  assert.doesNotMatch(bootstrap, /proxy_pass/u);
});

test("deployment has health checks and rollback marker", async () => {
  const deploy = await read("deploy/scripts/deploy.sh");
  const rollback = await read("deploy/scripts/rollback.sh");
  const service = await read("deploy/systemd/az-codex.service");

  assert.match(deploy, /previous-release/u);
  assert.match(deploy, /\/healthz/u);
  assert.match(deploy, /\/readyz/u);
  assert.match(rollback, /previous-release/u);
  assert.match(rollback, /pnpm pack:check/u);
  assert.match(service, /ExecStartPre=.*azcodex\.mjs setup/u);
});
