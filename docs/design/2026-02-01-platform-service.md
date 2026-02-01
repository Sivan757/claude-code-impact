# Platform Service Boundary

Date: 2026-02-01

## Goal
Centralize cross-platform behavior so OS-specific logic is readable, testable, and not duplicated
across the Rust backend and the frontend.

## Decisions
- Create a single Rust platform module: `src-tauri/src/services/platform.rs`.
- All filesystem path construction for real I/O uses PathBuf in Rust.
- The frontend uses `~` only for display, but resolves to absolute paths via backend commands
  for any file operations.
- UI labels that depend on OS (e.g., “Reveal in Finder”) are provided by the backend.

## Rust API (source of truth)
`src-tauri/src/services/platform.rs` provides:
- `platform_kind()` -> "windows" | "linux" | "macos" | "unknown"
- `path_separator()` -> platform separator char
- `reveal_label()` -> UI label ("Reveal in Finder", "Show in File Explorer", etc.)
- `resolve_user_path()` -> expands `~` safely to absolute path
- `get_default_unix_shell()` -> robust shell fallback on Unix

## Tauri Commands
Expose only intent-driven commands to the frontend:
- `resolve_user_path`
- `get_platform_kind`
- `get_reveal_label`
- `get_path_separator`
- `get_distill_command_path`
- `get_docs_distill_dir_path`
- `get_docs_reference_dir_path`
- `get_docs_distill_file_path`

## Frontend Usage Rules
- Do not build absolute paths in TS/JS. Use backend commands instead.
- Display paths may keep `~` for readability, but file operations must use resolved paths.
- Do not use UA sniffing. Use `get_reveal_label()` or other backend utilities.

## Benefits
- One place to update OS behavior.
- Fewer UI conditionals and string hacks.
- Safer Windows path handling and future portability.

