# AZ-Codex → LibreChat: model, agent and Frappe integration only

## Scope (corrected)
Migrate the **existing model and agent runtime configuration, orchestration and Frappe tooling** from AZ-Codex into LibreChat. Preserve working logic; adapt only the necessary LibreChat boundary. **Do not migrate or rebuild the AZ-Codex frontend, translation, theme, generic chat UI, or unrelated integrations.** Keep source AZ-Codex intact.

## Source files verified through GitHub
| Existing code | Role | Treatment |
| --- | --- | --- |
| `mcp/frappe-bench.mjs` | Frappe MCP stdio server | Preserve and integrate via LibreChat MCP transport |
| `mcp/frappe-bench-lib.mjs` | Frappe Bench helpers, command execution | Keep with its executable server |
| `mcp/registry.json` | Provider catalog | Inventory only; map the Frappe MCP entry |
| `scripts/install-frappe-profile.mjs` | Frappe profile installer | Examine generated settings and reuse |
| `scripts/frappe-verify.mjs` | Frappe integration checks | Reuse verification scenarios |
| `scripts/frappe-bench.test.mjs` | Bench behavior tests | Preserve test coverage |
| `backend/src/config_support.rs` | Runtime profiles and configuration | Extract actual profile contract before adapting |
| `backend/src/codex_runtime_support.rs` | Codex model runtime/auth | Identify usable runtime contract, not UI |
| `backend/src/turn_execution_support.rs` | Agent turn execution | Inspect orchestration dependencies |
| `backend/src/queue_runtime_support.rs` | Queue | Inspect runtime responsibilities |
| `backend/src/ws_dispatch_support.rs` | Dispatch/streaming | Adapt transport as needed, not frontend |

## Frappe MCP known surface
Verified `mcp/frappe-bench.mjs` exposes `bench_status`, `list_doctypes`, `get_doc_schema`, `tail_logs`, `run_tests`, `migrate`, `backup`, `build`, and gated `console_eval`. This is an existing implementation, **not** a request to rewrite it. Inspect its remaining tool declarations and tests before connecting.

## Destination strategy
1. Preserve existing MCP files under `integrations/az-codex/frappe/` or connect to the running source MCP service; choose based on runtime deployment constraints. Do not duplicate the implementation in TypeScript.
2. Connect through LibreChat's existing MCP configuration and preserve Frappe site authorization, read-only modes, action gates and command timeouts.
3. Inventory actual agent/model profiles and their runtime/provider bindings from AZ-Codex. Transfer supported values into LibreChat's existing configuration; use thin adapters only for missing semantics.
4. Validate active Frappe workflow end-to-end, then migrate additional agent capabilities only if confirmed relevant to Frappe.
5. Preserve test coverage and verify per-model selection, agent tool calls, permissions, failures, retries, and logs.
6. No main-branch merge or production rollout without runtime validation.

## Excluded
- SvelteKit/React UI migration
- Arabic UI changes or styling
- Theme, icons, design system
- Daftra, Magicplan, UberFix, WhatsApp and catalog migration unless requested separately
- Rebuilding a model provider or agent implementation that already functions

## Current state
This document and the source registry snapshot are preparation only. Runtime files have **not** been migrated, deployed or executed in LibreChat. A successful GitHub commit alone is not a working integration.
