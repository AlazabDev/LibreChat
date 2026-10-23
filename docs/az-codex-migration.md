# AZ-Codex → LibreChat integration

## Verified baseline (2026-10-23)
Source: [AlazabDev/az-codex](https://github.com/AlazabDev/az-codex), default `main`, SvelteKit frontend, Rust backend, pnpm.
Target: [AlazabDev/LibreChat](https://github.com/AlazabDev/LibreChat), default `main`, React client, TypeScript services, npm workspaces. The target repository does not currently expose a `dev` branch, so this feature branch was based on `main`.

## Migration constraints
- Never overlay AZ-Codex `src/` onto LibreChat `client/src/`, nor its Rust `backend/` onto `api/`.
- Implement new backend behavior inside `packages/api`, shared API contracts in `packages/data-provider`, persistence in `packages/data-schemas`, UI in `client` / appropriate `packages/client` or `packages/chat` boundaries.
- Keep AZ-Codex running throughout migration. Avoid any production deployment or `main` merge until acceptance tests pass.
- Treat the source registry as **inventory**, not a drop-in LibreChat MCP configuration: `openapi`, `plugin`, and `knowledge` providers need different adapters.
- Reuse the existing Arabic locale in `client/src/locales/ar` rather than introducing Paraglide/Svelte infrastructure.
- Integration code must not contain runtime secrets; configure credentials through the destination's supported runtime configuration.
- Check licence notices and redistribution requirements before copying individual third-party files.

## Confirmed source inventory
| Source path | Migration method | Status |
| --- | --- | --- |
| `mcp/registry.json` | Inventory / provider mapping | Inventory copied to `integrations/az-codex/source-registry.json` |
| `mcp/frappe-bench.mjs` | Review transport and execution boundaries, adapt MCP invocation | Not migrated |
| `mcp/daftra/` | Validate OpenAPI spec, use compatible adapter | Not migrated |
| `mcp/magicplan/` | Validate OpenAPI spec, use compatible adapter | Not migrated |
| `mcp/uberfix/` | Validate OpenAPI spec, use compatible adapter | Not migrated |
| `mcp/whatsapp/` | Review plugin protocol and authorization | Not migrated |
| `mcp/alazab-catalog/` | Review knowledge ingestion / data schema | Not migrated |
| `backend/src/terminal_support.rs` | Isolated service or new bounded TypeScript implementation | Not migrated |
| `backend/src/git_worktree_support.rs` | Isolated service or new bounded TypeScript implementation | Not migrated |
| `src/lib/theme-customization.ts` | React-compatible theme implementation | Not migrated |

## Execution gates
1. Inventory source files, their dependencies, types, licenses, and required environment.
2. Define explicit interface contracts and destination folders; isolate each provider behind configuration and permissions.
3. Migrate providers incrementally with unit and integration tests.
4. Integrate UI via existing React components; complete Arabic labels and accessibility.
5. Validate failure, retry, cancellation, authentication, persistence, and production parity.
6. Run affected workspace type checks, tests, static checks, build, and live smoke tests before any merge.

## Acceptance requirements
A provider is considered migrated only if it can be configured, discovered, invoked, and audited through LibreChat; authorization and failures behave correctly; tests and UI entry points exist. Mere file copying is not completion.
