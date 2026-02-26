# Changelog

All notable changes to this project will be documented in this file.

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
