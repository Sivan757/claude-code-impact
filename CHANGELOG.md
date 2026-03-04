# Changelog

All notable changes to this project will be documented in this file.

## 0.1.5

- Unify project and conversation history navigation into a grouped `Project -> Threads` sidebar with lazy session pagination.
- Replace split chat route files with catch-all route handling to keep project/session navigation stable.
- Fix large-session message browsing: improve bottom jump reliability and dedupe repeated message rows in the detail pane.
- Improve navigator usability with compact rows, clickable collapsed counter, and clearer role-based color distinction between user and assistant.
- Prevent `settings.json` writes from generating timestamped backup files on every small update.

## 0.1.3

- Refactor Chat History into split panes (`HistorySessionListPane` / `HistorySessionDetailPane`) to reduce cross-pane rerender jitter.
- Improve loading flow when switching projects and sessions with panel-scoped loading overlays.
- Stabilize long-list message browsing with `react-virtuoso` tuning and navigator/list interaction cleanup.
- Remove card hover lift effects in history panels to keep interactions visually stable during dense session review.

## 0.1.2

- Rebuild Chat History workspace with a three-column layout and improved full-height usability.
- Replace legacy virtual list implementation with `react-virtuoso` for smoother long-session scrolling and trailing-follow behavior.
- Add assistant/tool-chain merge rendering and specialized tool cards (Read/Bash/Edit/WebSearch) with default-collapsed tool result views.
- Improve conversation content rendering for command tags, markdown blocks, teammate messages, and tool-result pairing.
- Complete i18n coverage for chat history/navigator/tool cards/session menu and export format labels.

## 0.1.1

- Refactor launch draft lifecycle to runtime workspace model with stable `draft_id` reuse and explicit release command.
- Add startup and materialization cleanup pipeline for stale launch artifacts with configurable retention duration.
- Add launch-draft retention setting in Application Settings and persist it in user profile.
- Improve Session Launcher draft flow and embedded advanced settings integration (provider/env/plugins) for consistent mutation behavior.
- Improve managed settings path resolution under `~/.claudecodeimpact` to correctly map directory inputs to `settings.json`.

## 0.0.4-snapshot.20260201

- Add version bump script with snapshot support
- Add Apache 2.0 license compliance (LICENSE, NOTICE)
- Unify interface styling and add persistent data storage
- Introduce new Tauri app structure and plugin marketplace commands
- Refactor settings into unified GlobalSettingsView
- Add LSP server management and agent uninstallation

## 0.0.3

- Initial release
- Chat History Viewer with full-text search
- Commands Manager for slash commands
- MCP Servers configuration
- Skills and Hooks management
- Sub-Agents with custom models
- Marketplace for community templates
- Customizable Statusbar
