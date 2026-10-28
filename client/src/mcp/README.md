# Az Codex Integration Hub

`mcp/` is the integration boundary for Az Codex. It contains executable MCP servers, OpenAPI specifications, plugin manifests and curated knowledge sources used by the agent runtime.

## Registry

`registry.json` is the single source of truth for integrations. Runtime code must discover integrations from the registry instead of hard-coding provider paths.

```bash
pnpm mcp:list
pnpm mcp:doctor
```

`pnpm mcp:doctor` is part of the production verification gate and fails when an enabled provider points to a missing or unreadable target.

## Provider kinds

| Kind | Required field | Purpose |
| --- | --- | --- |
| `mcp-server` | `entry` | Executable stdio/server integration |
| `openapi` | `spec` | External API contract |
| `plugin` | `manifest` | Packaged plugin/tool surface |
| `knowledge` | `catalog` | Curated local knowledge/catalog data |

## Current providers

- `frappe` — guarded Frappe Bench operations.
- `daftra` — Daftra ERP OpenAPI contract.
- `magicplan` — magicplan OpenAPI contract.
- `uberfix` — UberFix maintenance API.
- `whatsapp` — WhatsApp plugin and skills.
- `alazab-catalog` — Alazab catalog and category knowledge.

## Security contract

Repository integration files are configuration and contracts, not secret storage.

- Never commit access tokens, API keys, passwords, client secrets, session cookies or private keys.
- Use placeholders such as `{{client_secret}}`, `{{apikey}}` or environment variables.
- Runtime credentials belong in the server environment or an external secret manager.
- A provider may document the environment variable names it requires, but never their production values.

## Adding a provider

1. Create a dedicated folder under `mcp/<provider>/`.
2. Add the MCP entry point, OpenAPI spec, plugin manifest or knowledge file.
3. Register the provider in `mcp/registry.json`.
4. Run `pnpm mcp:doctor`.
5. Add provider-specific tests when executable logic is introduced.

Do not modify the registry schema to bypass a validation failure. Fix the provider declaration or artifact instead.
