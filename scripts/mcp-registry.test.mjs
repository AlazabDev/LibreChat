import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectRegistry,
  loadRegistry,
  resolveProviderPath,
  validateRegistryShape
} from "./mcp-registry-lib.mjs";

test("registry shape is valid and provider ids are unique", async () => {
  const registry = await loadRegistry();
  assert.equal(validateRegistryShape(registry), true);
  assert.equal(new Set(registry.providers.map((provider) => provider.id)).size, registry.providers.length);
});

test("all enabled provider targets exist", async () => {
  const result = await inspectRegistry();
  assert.equal(result.healthy, true, JSON.stringify(result.providers.filter((provider) => !provider.healthy), null, 2));
});

test("provider paths cannot escape the mcp root", () => {
  assert.throws(
    () => resolveProviderPath({ id: "escape", kind: "openapi", spec: "../package.json" }, "/tmp/az-codex/mcp"),
    /outside mcp/u
  );
});

test("duplicate provider ids are rejected", () => {
  assert.throws(
    () => validateRegistryShape({
      version: 1,
      providers: [
        { id: "x", label: "X", kind: "openapi", enabled: true, description: "x", spec: "./x.json" },
        { id: "x", label: "X2", kind: "openapi", enabled: true, description: "x2", spec: "./x2.json" }
      ]
    }),
    /Duplicate MCP provider id/u
  );
});

test("doctor marks missing enabled targets unhealthy", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "az-codex-mcp-"));
  const registryFile = path.join(root, "registry.json");
  await fs.writeFile(
    registryFile,
    JSON.stringify({
      version: 1,
      providers: [
        {
          id: "missing",
          label: "Missing",
          kind: "openapi",
          enabled: true,
          description: "test",
          spec: "./missing.json"
        }
      ]
    })
  );

  const result = await inspectRegistry({ file: registryFile, root });
  assert.equal(result.healthy, false);
  assert.equal(result.providers[0].healthy, false);
});
