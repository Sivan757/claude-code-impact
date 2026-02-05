# Project Reconstruction Document

**Date**: 2026-02-04
**Project**: Claude Code Impact (lovcode)
**Purpose**: Comprehensive understanding for implementing cross-platform configuration management

---

## Executive Summary

**Claude Code Impact** is a Tauri 2 + React 19 + TypeScript desktop application designed as a Vibe coding assistant to support AI coding tool ecosystems. The first major feature is a chat history viewer with advanced search and analytics capabilities.

**Architecture**: Dual-layer with clear separation
- **Frontend**: React 19 + Jotai + react-query + shadcn/ui
- **Backend**: Rust (Tauri 2) with modular command structure
- **Communication**: Tauri invoke/event system

---

## 1. Technology Stack

### Frontend
- **React 19.1.0** - UI rendering
- **TypeScript 5.8** - Type safety
- **Vite 7.0** - Build tool & dev server
- **Jotai 2.16** - Atomic state management (UI preferences)
- **TanStack React Query 5.90** - Server state management
- **React Router 7.11** - Routing (hash-based)
- **vite-plugin-pages 0.33** - File-based routing (Next.js style)
- **shadcn/ui** - Component library (Radix UI primitives)
- **Tailwind CSS 4.1** - Styling
- **Monaco Editor 4.7** - Code editor
- **xterm.js 6.0** - Terminal emulator
- **Framer Motion 12.23** - Animations
- **i18next 25.7** - Internationalization

### Backend (Rust)
- **Tauri 2** - Desktop framework
- **Serde 1 + serde_json** - Serialization
- **Tantivy 0.22** - Full-text search
- **jieba-rs 0.7** - Chinese tokenization
- **notify 7** - Filesystem watching
- **portable-pty 0.9** - Terminal emulation
- **tokio 1** - Async runtime
- **reqwest 0.12** - HTTP client
- **chrono 0.4** - Date/time
- **uuid 1** - ID generation
- **cocoa/objc** - macOS native APIs

### Build & Package Manager
- **pnpm 10.28.2** - Package manager
- **Cargo** - Rust package manager
- **@changesets/cli** - Version management

---

## 2. Project Structure

```
lovcode/
├── src/                          # Frontend (React + TypeScript)
│   ├── pages/                    # File-based routes (vite-plugin-pages)
│   ├── views/                    # Feature views (Chat, Settings, Home, etc.)
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── Settings/             # Settings component library
│   │   ├── config/               # Config page containers (empty)
│   │   ├── dialogs/              # Modal dialogs
│   │   └── Terminal/             # Terminal UI
│   ├── store/                    # Jotai state management
│   │   ├── atoms/                # Atomic state by domain
│   │   └── persistence.ts        # Storage layer
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities
│   ├── types/                    # TypeScript types
│   ├── constants/                # App constants
│   ├── navigation/               # Routing config
│   └── context/                  # React Context
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Module registry
│   │   ├── app/                  # Tauri app setup
│   │   ├── commands/             # Tauri command handlers
│   │   │   ├── handlers.rs       # Command registration
│   │   │   └── sections/         # Commands by feature
│   │   │       ├── activity/
│   │   │       ├── agents/
│   │   │       ├── commands/
│   │   │       ├── context/
│   │   │       ├── diagnostics/
│   │   │       ├── distill/
│   │   │       ├── files/
│   │   │       ├── git/
│   │   │       ├── hooks/
│   │   │       ├── lsp/
│   │   │       ├── plugins/
│   │   │       ├── pty/
│   │   │       ├── search/
│   │   │       ├── settings/
│   │   │       └── versions/
│   │   ├── domain/               # Data models
│   │   ├── infra/                # Infrastructure (paths, filesystem)
│   │   ├── services/             # Business logic
│   │   ├── config/               # Config management (exists in src-tauri/src)
│   │   ├── diagnostics.rs
│   │   ├── hook_watcher.rs
│   │   ├── pty_manager.rs
│   │   └── state.rs              # Global atomic state
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .claude/
├── .auto-claude/
├── docs/
├── public/
├── scripts/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md
```

---

## 3. Architecture Deep Dive

### 3.1 Frontend Architecture

#### **Routing Strategy**
- **File-based routing** via `vite-plugin-pages` (Next.js pattern)
- **Hash-based router** (`createHashRouter`) for desktop app
- **URL as single source of truth** for navigation

**Key Routes**:
- `/` - Home dashboard
- `/chat` - Chat history viewer
- `/settings/*` - Settings (env, llm, hooks, context, version)
- `/marketplace`, `/extensions` - Plugin marketplace
- `/mcp`, `/skills`, `/commands`, `/agents` - Configuration

#### **State Management**

**Jotai Atoms** (UI preferences only):
```
src/store/atoms/
├── app.ts           # Global UI state (marketplace category, profile)
├── chat.ts          # Chat view preferences (view mode, sort order)
├── commands.ts      # Command management state
├── components.ts    # Collapsible states
├── home.ts          # Home analytics state
└── knowledge.ts     # Knowledge view preferences
```

**react-query** (Server state):
- `useInvokeQuery<T>(key, command, args)` - Load data from Tauri
- `useInvokeMutation<T>(command, invalidateKeys)` - Mutations with cache invalidation
- Configuration: `staleTime: Infinity` (no auto-refetch)

#### **Component Organization**

**Settings Component Library** (`src/components/Settings/`):
- `SettingSection` - Card-based section container
- `SettingRow` - Label + control layout
- `ListItemCard` - Unified list item (providers, env vars, hooks)
- `StatusBadge` - Status indicators (active, warning, error, etc.)
- `ActionToolbar` - Search + action buttons
- `ExpandableSection` - Collapsible sections
- `ViewModeToggle` - list/card view switcher
- `SourceBadge` - Config source indicator

**Design System**: Warm Academic theme
- Colors: Terracotta (clay) + warm beige + charcoal gray
- Typography: Serif titles + sans body + mono code
- Borders: `rounded-xl` cards, `rounded-lg` buttons, `rounded-full` badges
- Density: Compact sizing (`h-7 w-7` icons, `text-xs` labels)

#### **Data Flow**

```
Tauri Backend
     ↓ invoke("command", args)
useInvokeQuery
     ↓
react-query cache
     ↓
Component
     ↓ User action
invoke("update_command", args)
     ↓
queryClient.invalidateQueries()
     ↓
Auto re-fetch → UI updates
```

### 3.2 Backend Architecture

#### **Module Structure**

```rust
// lib.rs
pub mod app;           // Tauri app builder
pub mod domain;        // Data models (Project, Session, Message)
pub mod infra;         // Infrastructure (paths, filesystem)
pub mod services;      // Business logic
pub mod commands;      // Tauri commands
pub mod state;         // Global atomic state
```

#### **Command Pattern**

All commands use `include!` macro for modular organization:

```rust
// commands/handlers.rs
include!("sections/settings/settings_access.rs");
include!("sections/commands/local_commands.rs");
// ... 20+ more sections

pub fn build_invoke_handler() -> impl Fn(...) {
    tauri::generate_handler![
        list_projects,
        get_settings,
        update_settings_field,
        pty_create,
        // ... 50+ commands
    ]
}
```

**Benefits**:
- ✅ Keeps commands logically grouped
- ✅ Maintains clean registry
- ✅ Allows hot-reload development

#### **Core Command Groups**

1. **Settings Management**
   - `get_settings(path?)` - Read `~/.claude/settings.json`
   - `update_settings_field(field, value, path?)` - Atomic updates
   - `get_settings_path()` - Resolve path

2. **Chat History**
   - `list_projects()` - Scan for Claude Code projects
   - `list_sessions(project_id)` - List sessions
   - `get_session_messages(project_id, session_id)` - Fetch messages

3. **Search & Analytics**
   - `build_search_index()` - Tantivy full-text search
   - `search_chats(query)` - Search all projects
   - `get_activity_stats()` - Activity heatmap
   - `get_command_stats()` - Command usage analytics

4. **Plugin & Template Management**
   - `list_local_commands/agents/skills()` - Discover installed items
   - `install_command_template()` - Clone from marketplace
   - `check_skill_installed()` - Verify installation

5. **PTY (Terminal)**
   - `pty_create(id, cwd)` - Create terminal session
   - `pty_write(id, data)` - Send input
   - `pty_resize(id, cols, rows)` - Resize
   - Events: `pty-data`, `pty-exit` via Tauri events

6. **Distill & Knowledge**
   - `get_docs_distill()` - Load distilled docs
   - Filesystem watcher with debouncing

#### **Domain Models**

```rust
pub struct Project {
    pub id: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: u64,
}

pub struct Session {
    pub id: String,
    pub project_id: String,
    pub summary: Option<String>,
    pub message_count: usize,
    pub last_modified: u64,
    pub usage: Option<SessionUsage>,
}

pub struct Message {
    pub uuid: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub is_meta: bool,
    pub is_tool: bool,
}
```

#### **Infrastructure Layer** (`infra/mod.rs`)

**Path Resolution**:
- `get_claude_dir()` → `~/.claude/`
- `get_claudecodeimpact_dir()` → `~/.claudecodeimpact/claudecodeimpact/`
- `resolve_user_path()` - Handle `~` expansion

**Data Storage**:
- `data.db` - JSON key-value store
- `read_data_key()`, `write_data_key()` - Generic storage API

#### **Services Layer**

- `claude_format.rs` - Parse Claude Code message format
- `command_stats.rs` - Command usage aggregation
- `message_content.rs` - Extract metadata
- `platform.rs` - OS-specific path resolution
- `project_paths.rs` - Encode/decode project IDs
- `search_index.rs` - Tantivy search engine

#### **Real-Time Features**

**PTY Manager**:
- Event-driven (push via Tauri events)
- Persistent scrollback (256KB max per session)
- Disk persistence in `~/.claudecodeimpact/claudecodeimpact/scrollback/`
- Debounced writes (2000ms)

**Distill Watcher**:
- Watches `~/.claudecodeimpact/docs/distill/`
- Debounces (200ms)
- Emits `distill-changed` event
- Controllable via atomic flag

---

## 4. Current Configuration Management

### Settings File Structure

**Location**: `~/.claude/settings.json`

**Observed Keys**:
```json
{
  "model": "opus",
  "always_thinking_enabled": false,
  "permissions": {
    "allow": [],
    "deny": [],
    "ask": [],
    "default_mode": "ask"
  },
  "env": {},
  "hooks": {},
  "mcp_servers": {},
  "enabled_plugins": {},
  "projects": {},
  "sandbox": {},
  "attribution": {},
  "cleanup_period_days": 30,
  "disable_all_hooks": false
}
```

### Current Commands

```rust
// Read
get_settings(path?) → ClaudeSettings

// Write (field-level)
update_settings_field(field, value, path?)
update_settings_permission_field(...)
add_permission_directory(path)
remove_permission_directory(path)
toggle_hook_item(eventType, matcherIndex, hookIndex)
```

### UI Integration

**Settings Views**:
- `SettingsView.tsx` - General settings (model, attribution, cleanup)
- `LlmProviderView.tsx` - Provider profiles
- `EnvSettingsView.tsx` - Environment variables
- `HooksSettingsView.tsx` - Hook configuration
- `ContextFilesView.tsx` - Context files

**Data Flow**:
1. Load: `useInvokeQuery(["settings", path], "get_settings", { path })`
2. Update: `invoke("update_settings_field", { field, value, path })`
3. Invalidate: `queryClient.invalidateQueries({ queryKey: ["settings", path] })`
4. Auto re-fetch → UI updates

---

## 5. Plan Implementation Roadmap

### Phase 1: Rust Backend (Config Module)

**Files to Create**:
```
src-tauri/src/config/
├── mod.rs              # Module exports
├── types.rs            # ConfigScope, ConfigFileKind, SettingsJson
├── paths.rs            # Cross-platform path resolution
├── reader.rs           # Read JSON/markdown with error handling
├── writer.rs           # Atomic writes with backups
├── merger.rs           # Scope precedence + provenance
├── validator.rs        # Schema validation
├── watcher.rs          # Filesystem watching (notify crate)
├── error.rs            # Error types
└── commands.rs         # Tauri commands
```

**Commands to Implement**:
- `config_read(kind, scope, project_path?)`
- `config_read_merged(project_path?)`
- `config_write(kind, scope, project_path?, key?, value)`
- `config_write_markdown(kind, scope, project_path?, content)`
- `config_delete_key(kind, scope, project_path?, key)`
- `config_validate(kind, value)`
- `config_get_paths(project_path?)`
- `config_list_backups(kind, scope, project_path?)`
- `config_restore_backup(backup_path)`

### Phase 2: Frontend Integration

**Files to Create**:
```
src/config/
├── types.ts                          # Mirror Rust types
├── store/
│   └── configStore.ts                # Zustand store (or use react-query)
├── hooks/
│   ├── useConfig.ts                  # Load merged config
│   └── useConfigWatcher.ts           # Event listener
└── components/
    ├── ConfigEditor.tsx              # Main editor
    ├── ScopeIndicator.tsx            # Badge showing source
    ├── MergeViewer.tsx               # Side-by-side view
    ├── McpServerManager.tsx          # MCP server editor
    ├── HookEditor.tsx                # Hook builder
    ├── PermissionEditor.tsx          # Permission rules
    └── ClaudeMdEditor.tsx            # Markdown editor
```

**Integration Pattern**:
```typescript
// Use existing react-query pattern
const { data: mergedConfig } = useInvokeQuery(
  ["config", "merged", projectPath],
  "config_read_merged",
  { project_path: projectPath }
);

// Update with invalidation
await invoke("config_write", { kind, scope, key, value });
queryClient.invalidateQueries({ queryKey: ["config", "merged", projectPath] });
```

### Phase 3: Testing & Validation

**Unit Tests** (Rust):
- Path resolution on each OS
- Deep merge logic
- Validation rules
- Atomic write + rollback

**Integration Tests** (Rust):
- Multi-scope configs
- Verify precedence
- File watching

**Manual Testing**:
- Write at different scopes
- External file edits → watcher triggers
- Validation blocks invalid writes
- Backup/restore

---

## 6. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Config I/O Layer** | Rust backend | Filesystem safety, atomic writes, cross-platform |
| **State Management** | react-query | Consistent with existing pattern, cache invalidation |
| **File Watching** | `notify` crate | Already used for distill watching |
| **Persistence** | JSON files | Human-readable, git-friendly |
| **Merge Strategy** | Bottom-up layering | Precedence: Managed > Project Local > Project > User Local > User |
| **Validation** | Pre-write only | Don't block reads, warn on unknown values |
| **Component Library** | Reuse Settings components | Consistent UI, leverage existing `SettingRow`, `ListItemCard` |
| **Routing** | URL param `?path=` | Multi-file editing support |
| **Event System** | Tauri events | Real-time updates, matches PTY pattern |

---

## 7. Integration Points

### Existing Settings Commands (Reuse)
- Path resolution: `resolve_settings_path(path?)`
- Read: `get_settings(path?)` → Already supports multiple files
- Write: `update_settings_field(field, value, path?)`

### New Config Commands (Additive)
- Extend with `config_read_merged()` for provenance
- Add `config_write()` for scope-aware writes
- Add `config_validate()` for pre-write validation
- Add watcher for real-time updates

### UI Components (Reuse)
- `SettingSection`, `SettingRow` - Layout
- `ListItemCard` - List items
- `StatusBadge` - Source indicators
- `ActionToolbar` - Search + actions
- `ExpandableSection` - Nested configs

### New UI Components (Additive)
- `ScopeIndicator` - Badge showing source scope
- `MergeViewer` - Side-by-side effective vs raw
- Config-specific editors (MCP, hooks, permissions)

---

## 8. Dependencies

### Already Available
- `notify = "7"` - Filesystem watching ✅
- `serde_json = "1"` - JSON parsing ✅
- `dirs = "6"` - Cross-platform paths ✅
- `tokio` - Async runtime ✅

### May Need to Add
- None! All required dependencies are present.

---

## 9. Summary

**Project Status**: Production-ready Tauri 2 desktop app with:
- ✅ Modular Rust backend (50+ commands)
- ✅ React 19 frontend with modern state management
- ✅ Full-text search (Tantivy)
- ✅ Terminal emulation (xterm.js + portable-pty)
- ✅ Settings management (partial - file-level only)
- ✅ Plugin marketplace
- ✅ Activity analytics

**Next Step**: Implement scope-aware configuration management per the plan in `~/.claude/plans/idempotent-orbiting-chipmunk.md`.

**Architecture Strengths**:
- Clean separation of concerns
- Modular command structure
- Type-safe communication
- Cross-platform ready
- Extensible design

**Implementation Approach**:
1. Build Rust config module incrementally (types → paths → reader → writer → merger → validator → watcher → commands)
2. Register commands in `lib.rs`
3. Create frontend hooks/components
4. Integrate into existing Settings views
5. Test cross-platform

---

**Document Status**: ✅ Complete
**Next Action**: Begin implementation with Phase 1 (Rust backend)
