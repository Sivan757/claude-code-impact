# Tauri Backend Packaging Refactor (2026-01-29)

## Context
The current Rust backend uses a single `commands/handlers.rs` module with many `include!`d sections, and the app bootstrap (`run`) lives inside a macOS section file. Shared state/types are defined in a prelude file that is implicitly available via `include!`, which makes boundaries and dependencies implicit and hard to evolve.

## Goals
- Separate **app bootstrap** from **command definitions**.
- Centralize **domain models** and **runtime state**.
- Keep behavior identical (no command API changes).
- Prepare for incremental modularization of command sections.

## Non-Goals
- Full command module split (each feature to its own Rust module).
- Changing command signatures or frontend API.
- Large-scale error handling redesign.

## New Structure (Incremental)
```
src-tauri/src/
├── app/                # Tauri bootstrap, menus, lifecycle
├── commands/           # Command sections + registry
├── domain/             # Shared domain models
├── state.rs            # Global runtime state (atomics)
├── infra/              # Path + environment helpers
├── services/           # Application services
```

## Implemented Changes
1. **App bootstrap extraction**
   - Moved `run()` and macOS window activation logic into `src-tauri/src/app/mod.rs`.
   - App now calls `commands::build_invoke_handler()`.

2. **Command registry**
   - Added `build_invoke_handler()` in `commands/handlers.rs` to own the `tauri::generate_handler!` list.

3. **Domain models**
   - Moved `Project`, `Session`, `SessionUsage`, `Message`, `ChatMessage`, `ChatsResponse` into `src-tauri/src/domain/mod.rs`.

4. **Runtime state**
   - Moved `DISTILL_WATCH_ENABLED` and `CC_INSTALL_PID` to `src-tauri/src/state.rs`.

5. **Infra paths**
   - Centralized `get_distill_dir()` and `get_reference_dir()` in `infra/mod.rs`.

6. **Numbered section reconstruction**
   - Replaced numbered plugin section files with purpose-based modules:
     - `commands/sections/plugins/marketplace/{metadata,catalog,install,statusline}.rs`
     - `commands/sections/plugins/repository_scan.rs`
   - Removed legacy `commands/sections/core/00_prelude.rs` after extracting types/state.

## Behavior Compatibility
- Command names and signatures are unchanged.
- `tauri::generate_handler!` list is identical, just relocated.
- Distill watcher behavior is unchanged (still debounced + guarded by `DISTILL_WATCH_ENABLED`).

## Follow-Up (Recommended)
1. **Modularize command sections**
   - Move each feature folder (`settings`, `distill`, `plugins`, etc.) into its own Rust module to eliminate `include!`.
2. **Typed errors & logging**
   - Introduce `thiserror` + tracing/logging for consistent error handling.
3. **Tests**
   - Add unit tests for domain/infra helpers and integration tests for key command flows.
