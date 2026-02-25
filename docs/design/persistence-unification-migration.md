# Persistence Unification & Migration Plan

## Background

Historically, app persistence was split across multiple locations:

- `~/.claude/*` and `~/.claude.json`
- `~/.claudecodeimpact/claudecodeimpact/*` (legacy nested layout)
- frontend browser storage (`localStorage`) for part of UI state
- app-managed files under multiple roots

This document defines and records the migration to a single managed root:

- **Managed root**: `~/.claudecodeimpact`

## Goals

1. All app-managed persistent writes route through managed paths under `~/.claudecodeimpact`.
2. Remove nested legacy directory `~/.claudecodeimpact/claudecodeimpact`.
3. Centralize key-value state in SQLite (`~/.claudecodeimpact/data.db`).
4. Move settings/plugin-managed writes away from `~/.claude/*`.
5. Remove active browser-storage writes for app state.

## Target Storage Layout

- `~/.claudecodeimpact/data.db` (SQLite KV + app tables)
- `~/.claudecodeimpact/settings-scopes/user-settings.json`
- `~/.claudecodeimpact/mcp-scopes/user.json`
- `~/.claudecodeimpact/scopes/<scope-id>/claude/*`
- `~/.claudecodeimpact/launch-settings/*`
- `~/.claudecodeimpact/launch-drafts/*`
- `~/.claudecodeimpact/runtime/*`

## Migration Strategy

### Phase 1: Path normalization

- `get_claudecodeimpact_dir()` now resolves directly to `~/.claudecodeimpact`.
- Added one-time startup migration to merge legacy nested directory into root and remove it.

### Phase 2: Data-store unification

- Replaced JSON-based key-value persistence with SQLite-backed `kv` table.
- Added migration from legacy JSON stores:
  - `~/.claudecodeimpact/data.json`
  - `~/claudecodeimpact/data.db` (legacy JSON format case)

### Phase 3: Scope remapping

- Settings path resolution now targets `settings-scopes`.
- MCP config path resolution now targets `mcp-scopes`.
- Scope Claude directories now target `scopes/<scope-id>/claude`.
- Legacy assets are copied on-demand from `~/.claude/*` to managed scope paths.
- `get_claude_dir()` keeps pointing to Claude Code native directory (`~/.claude`) for compatibility with configuration editing flows.
- Legacy scope migration now copies the full tree (not a partial whitelist), so `projects/` and `history.jsonl` are included.

### Phase 4: External write cut-over

- Local command management moved to managed scope (`resolve_claude_dir(None)`).
- Marketplace command install moved to managed scope.
- LSP config CRUD moved from `~/.claude.json` to managed MCP scope file.
- Added managed-write commands:
  - `write_managed_file`
  - `write_managed_binary_file`
- Added explicit export commands for user-selected files:
  - `export_file`
  - `export_binary_file`
- Removed frontend browser-storage persistence paths; UI preference persistence now relies only on backend commands.

### Phase 5: Plugin metadata path remap

- Added migration for plugin metadata JSON payloads:
  - rewrite `installLocation` and `installPath` from legacy `~/.claude/plugins/*`
  - to managed `~/.claudecodeimpact/scopes/user/claude/plugins/*`

## Verification Checklist

- `pnpm -s tsc --noEmit` passes.
- `cargo check` passes.
- `~/.claudecodeimpact/claudecodeimpact` does not exist.
- Managed paths are present:
  - `settings-scopes/user-settings.json`
  - `mcp-scopes/user.json`
  - `scopes/user/claude`
- Frontend contains no `localStorage.setItem/removeItem` writes.

## Operational Notes

- User-triggered export actions intentionally support writing to user-selected destinations and are separated from managed persistence commands.
- Config watcher now watches the managed persistence root (`~/.claudecodeimpact`) instead of only legacy `config/` subtree.
