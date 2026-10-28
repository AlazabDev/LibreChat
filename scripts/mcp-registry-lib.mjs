import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");
export const registryPath = path.join(projectRoot, "mcp", "registry.json");

const kindPathField = {
  "mcp-server": "entry",
  openapi: "spec",
  plugin: "manifest",
  knowledge: "catalog"
};

export async function loadRegistry(file = registryPath) {
  const text = await fs.readFile(file, "utf8");
  const registry = JSON.parse(text);
  validateRegistryShape(registry);
  return registry;
}

export function validateRegistryShape(registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new Error("MCP registry must be a JSON object.");
  }
  if (!Number.isInteger(registry.version) || registry.version < 1) {
    throw new Error("MCP registry version must be an integer >= 1.");
  }
  if (!Array.isArray(registry.providers) || registry.providers.length === 0) {
    throw new Error("MCP registry must contain at least one provider.");
  }

  const ids = new Set();
  for (const provider of registry.providers) {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
      throw new Error("Every MCP provider must be an object.");
    }
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(String(provider.id ?? ""))) {
      throw new Error(`Invalid MCP provider id: ${provider.id ?? "<missing>"}`);
    }
    if (ids.has(provider.id)) {
      throw new Error(`Duplicate MCP provider id: ${provider.id}`);
    }
    ids.add(provider.id);

    if (!String(provider.label ?? "").trim()) {
      throw new Error(`Provider ${provider.id} is missing label.`);
    }
    if (!String(provider.description ?? "").trim()) {
      throw new Error(`Provider ${provider.id} is missing description.`);
    }
    if (typeof provider.enabled !== "boolean") {
      throw new Error(`Provider ${provider.id} must define enabled as boolean.`);
    }

    const field = kindPathField[provider.kind];
    if (!field) {
      throw new Error(`Provider ${provider.id} has unsupported kind: ${provider.kind}`);
    }
    if (!String(provider[field] ?? "").trim()) {
      throw new Error(`Provider ${provider.id} (${provider.kind}) is missing ${field}.`);
    }
  }

  return true;
}

export function providerRelativePath(provider) {
  const field = kindPathField[provider.kind];
  return field ? provider[field] : undefined;
}

export function resolveProviderPath(provider, root = path.join(projectRoot, "mcp")) {
  const relative = providerRelativePath(provider);
  if (!relative) return null;

  const resolved = path.resolve(root, relative);
  const relativeToRoot = path.relative(root, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Provider ${provider.id} points outside mcp/: ${relative}`);
  }
  return resolved;
}

export async function inspectRegistry({ file = registryPath, root = path.join(projectRoot, "mcp") } = {}) {
  const registry = await loadRegistry(file);
  const providers = [];

  for (const provider of registry.providers) {
    const target = resolveProviderPath(provider, root);
    let exists = false;
    let readable = false;
    let size = null;
    let error = null;

    try {
      const stat = await fs.stat(target);
      exists = stat.isFile();
      size = stat.size;
      if (exists) {
        await fs.access(target);
        readable = true;
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }

    providers.push({
      ...provider,
      target,
      exists,
      readable,
      size,
      healthy: provider.enabled ? exists && readable : true,
      error
    });
  }

  return {
    version: registry.version,
    providers,
    healthy: providers.every((provider) => provider.healthy)
  };
}
