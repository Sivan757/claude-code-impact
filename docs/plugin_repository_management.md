# Plugin Repository Management

## Goals
- Align the plugin management page with filesystem-first scanning of Claude Code plugins.
- Consolidate marketplace data, install state, and component metadata into one scan result.
- Keep install/enable/disable/update operations delegated to the Claude CLI.

## Data Sources
- `~/.claude/settings.json` -> `enabledPlugins` map.
- `~/.claude/plugins/known_marketplaces.json` -> marketplace registry and install locations.
- `~/.claude/plugins/installed_plugins.json` -> installed plugin records and paths.
- `~/.claude/plugins/marketplaces/<name>/.claude-plugin/marketplace.json` -> marketplace plugin entries.
- `<plugin_dir>/.claude-plugin/plugin.json` -> plugin metadata.
- `<plugin_dir>/commands`, `<plugin_dir>/skills`, `<plugin_dir>/agents` -> component content.
- `<plugin_dir>/hooks/hooks.json` -> hook components.
- `<plugin_dir>/.mcp.json` -> MCP components.

## Backend Flow
1. Load `settings.json` to map enabled plugins.
2. Load `known_marketplaces.json` for marketplace definitions.
3. Load `installed_plugins.json` for install records.
4. For each marketplace, read `marketplace.json` to build the plugin list.
5. Resolve plugin paths (installed path first, then marketplace-relative path).
6. Read `plugin.json` to enrich metadata.
7. Scan component folders and files to build component counts and lists.
8. Emit `PluginScanResult` with `plugins`, `marketplaces`, and `errors`.

## Frontend Flow
- `usePluginLibrary` fetches `scan_plugins` and provides derived state:
  - Filters: marketplace, install status, search.
  - Sort: name, installed, marketplace.
  - Action handlers: install/uninstall/enable/disable/update, add/remove marketplace.
  - Fallbacks: uninstall retries via install->uninstall; disable retries via enable->disable.
- UI composition:
  - `MarketplaceSidebar` for marketplace selection and management.
  - `PluginFilterBar` for filters/search/sort.
  - `PluginCard` grid for overview and quick actions.
  - `PluginDetailModal` for metadata, components, and CLI command copy.

## CLI Operations
- `claude plugin install <plugin@marketplace>`
- `claude plugin uninstall <plugin@marketplace>`
- `claude plugin enable <plugin@marketplace>`
- `claude plugin disable <plugin@marketplace>`
- `claude plugin update <plugin@marketplace>`
- `claude plugin marketplace add <source>`
- `claude plugin marketplace remove <name>`
- `claude plugin marketplace update [name]`

## Resilience / Repair
- If a plugin action returns "not installed", retry via install -> action.
- If install fails because the marketplace is missing, prune stale records:
  - `settings.json` `enabledPlugins`
  - `installed_plugins.json`
- Marketplace removal runs in a safe order:
  - Uninstall all plugins for the marketplace (with the same fallback)
  - Remove the marketplace via CLI (ignore missing marketplace)
  - Prune `known_marketplaces.json` and remove marketplace directory

## Notes / Follow-ups
- CLI subcommands are assumed; verify against the installed Claude CLI version.
- Marketplace manifests can vary; the parser is intentionally tolerant.
- If scan performance becomes an issue, consider incremental caching per marketplace.
