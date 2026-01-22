# Workspace Launch Settings

## Goals
- Allow selecting a provider and installed plugins when launching Claude Code from the workspace launcher.
- Avoid mutating global `~/.claude/settings.json` during session-specific launches.

## Approach
- Add a "Launch options" section in the workspace empty-state UI (Claude mode only).
- Create a new Tauri command `create_launch_settings` that:
  - Reads `~/.claude/settings.json` (or `{}` if missing).
  - Overrides `env` and `claudecodeimpact.activeProvider` when a provider is selected.
  - Replaces `enabledPlugins` with the selected plugin IDs.
  - Writes a copy to `~/.lovstudio/claudecodeimpact/launch-settings/settings-<uuid>.json`.
- Append `--settings "<path>"` to the `claude` command before any prompt text.

## Data Flow
1. UI loads providers from localStorage and installed plugins via `list_installed_plugins`.
2. User selects provider/plugins in the launcher.
3. On Start, UI calls `create_launch_settings` and receives a file path.
4. UI launches `claude --settings "<path>"` with the prompt argument appended.

## Error Handling
- If settings generation fails, log the error and continue with the base `claude` command.

## Notes
- Launch settings files are not auto-cleaned. Consider adding cleanup if storage growth becomes an issue.
