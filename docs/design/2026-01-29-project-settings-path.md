# Project Settings Path Support

## Context
Claude Code supports both user and project settings files. We want Global Settings UI to edit any settings file by passing a path (for project-level configs) without breaking the existing default user settings flow.

## Goals
- Allow Global Settings to read/write any settings.json by passing a path.
- Create the settings file and parent directory when missing.
- Keep the change incremental and backwards compatible.

## Non-goals
- Automatic project root discovery.
- Merging multiple settings scopes in the UI.
- Per-project disabled env/hook storage (still global for now).

## Design
- Frontend reads `?path=...` via `useSettingsPath` and passes it through Global Settings sub-views.
- Backend commands accept an optional `path` (or `settings_path` where `path` is already used) and resolve it with `resolve_settings_path`.
- Writes ensure parent directories exist via `ensure_parent_dir`.
- Hooks and settings template install/updates respect the provided path.
- Hooks feature route redirects to Settings > Hooks to keep all settings in one place.

## Risks & Mitigations
- **Relative paths** resolve against the Tauri process CWD; prefer absolute paths in UI.
- **Security**: accepting arbitrary paths means we must rely on allowlist/CSP and careful input validation if we later expose user input controls.

## Follow-ups
- Decide whether disabled env/hooks should be keyed by settings path for project isolation.
- Consider a UI selector for scope (user / project / local) and resolve paths internally.
