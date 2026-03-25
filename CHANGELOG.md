# Changelog

All notable changes to this project will be documented in this file.

## 0.1.8

- Revamp Claude Code settings coverage and streamline the settings UX by removing obsolete Agent Teams and plugin marketplace forms from General Settings.
- Align permission and model selectors with current Claude Code behavior: remove unsupported permission modes and update model aliases to the documented official set.
- Refine launcher and plugin override flows, including a dedicated project-level `enabledPlugins` save path that fixes failures when saving plugin selections from the quick-launch dialog.
- Remove legacy `distill` code paths and remaining historical product traces, and drop the unused `lovinsp` integration from the build.

## 0.1.7

- Move project launch into Chat as a new `Launchpad`, remove the standalone project hub/template route, and add a compact quick-launch panel with model, permission, provider, and plugin overrides.
- Add project management actions in history: register local folders into the sidebar, hide projects from the list, and keep project-scoped settings reflected back into quick-launch selectors.
- Replace the old template-based launch flow with launch-time settings snapshots, including provider env injection, permission override, and `enabledPlugins` overrides from a compact plugin picker.
- Improve session review usability with safer delete confirmation, merge-view toggle, compact menus, and a new session delete action in both list and detail views.
- Fix merged-message duplication caused by mutating source `raw_content` during assistant/tool-chain merging, and improve long-token overflow handling in chat content.
- Lightly refine chat workspace chrome by removing the outer workbench card treatment and repositioning the header entry as `Launchpad`.

## 0.1.6

- Add supplier model env form fields for `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_MODEL`, and `ANTHROPIC_SMALL_FAST_MODEL`.
- Ensure empty supplier env values are not written to `settings.json`; when applying a profile, empty values only trigger key deletion if the key already exists.
- Add an `Import from config` action in LLM Provider view to import current Anthropic supplier config into profile presets with duplicate detection.
- Group supplier model fields under default-collapsed Advanced Options and remove model placeholders for cleaner editing.
- Improve provider editor dialog usability by constraining modal height and enabling internal form scrolling when advanced options are expanded.

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
