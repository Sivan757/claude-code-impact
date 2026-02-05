# Settings Views Migration Summary

## Migration Status

### ✅ Completed Migrations

#### 1. **ScopeSelector Component** (`src/components/Settings/ScopeSelector.tsx`)
- Created reusable dropdown for multi-scope editing
- Supports: User, UserLocal, Project, ProjectLocal scopes
- Two modes: full selector or simple badge (user-only mode)
- Color-coded scope indicators for easy identification

#### 2. **EnvSettingsView** (`src/views/Settings/EnvSettingsView.tsx`)
**Changes:**
- Replaced `useInvokeQuery<ClaudeSettings>("get_settings")` with `useConfigMerged()`
- Replaced `invoke("update_settings_env")` with `useConfigWrite()` mutation
- Replaced `invoke("delete_settings_env")` with `useConfigDeleteKey()` mutation
- Removed `invoke("disable_settings_env")` and `invoke("enable_settings_env")` - disabled env tracking is deprecated
- Removed `invoke("update_disabled_settings_env")` - no longer needed

**Features Added:**
- Multi-scope editing with ScopeSelector in toolbar
- Provenance tracking - displays source scope for each env var
- New "Source" column showing where each value comes from
- Simplified UX - no more enable/disable, just edit or delete

**Commands Removed:**
- `toggle_hook_item` (disabled hooks)
- All disabled env-related commands

#### 3. **HooksSettingsView** (`src/views/Settings/HooksSettingsView.tsx`)
**Changes:**
- Replaced `useInvokeQuery<ClaudeSettings>("get_settings")` with `useConfigMerged()`
- Replaced `invoke("toggle_hook_item")` with direct config mutations
- Replaced `invoke("delete_hook_item")` with structured hook deletion using `useConfigWrite/useConfigDeleteKey`
- Removed `invoke("get_disabled_hooks")` - disabled hooks feature removed
- Removed `invoke("delete_disabled_hook")` - no longer needed

**Features Added:**
- Multi-scope editing with ScopeSelector
- Clean hook management (no more disable/enable, just delete)
- Proper hook deletion with cascade (removes empty matchers/event types)

**Commands Removed:**
- `get_disabled_hooks`
- `delete_disabled_hook`
- `toggle_hook_item` (for enable/disable)

### 🚧 Pending Migrations

#### 4. **SettingsView** (`src/views/Settings/SettingsView.tsx`)
**Current Dependencies:**
- Uses `get_settings` command
- Uses `get_settings_path` command
- Uses `update_settings_field` for model, permissions, attribution
- Uses `update_settings_permission_field` for permission settings

**Migration Plan:**
- Replace with `useConfigMerged()` and `useConfigWrite()`
- Add ScopeSelector for multi-scope editing
- Simplify permission management with new config system

#### 5. **LlmProviderView** (`src/views/Settings/LlmProviderView.tsx`)
**Current Dependencies:**
- Uses `get_settings` command (line 150)
- Uses `update_settings_env` for provider token management (lines 420, 433)
- Complex profile management stored in localStorage

**Migration Plan:**
- Keep localStorage for profile management (UI state)
- Migrate active provider settings to use `useConfigWrite()`
- Add scope awareness for provider configuration

### ✅ No Migration Needed

#### **ContextFilesView** (`src/views/Settings/ContextFilesView.tsx`)
- Uses `get_context_files` command - separate from settings system
- Displays CLAUDE.md and context files (read-only view)
- No migration required

#### **GlobalSettingsView** (`src/views/Settings/GlobalSettingsView.tsx`)
- Already properly integrates migrated views
- No changes needed - works with both old and new implementations

---

## Backend Commands Status

### Commands to Deprecate/Remove

Once all views are migrated, these commands can be removed:

#### Settings Access
- ✅ `get_settings` - replaced by `config_read_merged`
- `get_settings_path` - still used by SettingsView, migrate first

#### Settings Update
- `update_settings_field` - replaced by `config_write`
- `update_settings_env` - replaced by `config_write` with key `env.{KEY}`
- `update_settings_permission_field` - replaced by `config_write`

#### Env Management
- ✅ `delete_settings_env` - replaced by `config_delete_key`
- ✅ `disable_settings_env` - feature removed (deprecated)
- ✅ `enable_settings_env` - feature removed (deprecated)
- ✅ `update_disabled_settings_env` - feature removed (deprecated)

#### Hook Management
- ✅ `toggle_hook_item` - replaced by structured config mutations
- ✅ `delete_hook_item` - replaced by `config_write`/`config_delete_key`
- ✅ `get_disabled_hooks` - feature removed (deprecated)
- ✅ `delete_disabled_hook` - feature removed (deprecated)

### Commands to Keep

These are still needed:

- `get_context_files` - used by ContextFilesView
- `open_in_editor` - utility command
- `copy_to_clipboard` - utility command
- All MCP-related commands (`update_mcp_env`, etc.)
- All path resolution commands

---

## New Config System Benefits

### For Users
1. **Multi-Scope Editing**: Choose where to save settings (User/Project/Local)
2. **Provenance Tracking**: See exactly where each setting comes from
3. **Atomic Operations**: Automatic backups on every change
4. **Better Conflict Resolution**: Clear precedence order
5. **Team Collaboration**: Share project settings via version control

### For Developers
1. **Type Safety**: Full TypeScript coverage
2. **React Query Integration**: Automatic caching and revalidation
3. **Cleaner Architecture**: Separation of concerns
4. **Testing**: Easier to test with isolated config logic
5. **Extensibility**: Easy to add new config scopes or files

---

## Migration Checklist

- [x] Create ScopeSelector component
- [x] Migrate EnvSettingsView
- [x] Migrate HooksSettingsView
- [ ] Migrate SettingsView
- [ ] Migrate LlmProviderView (partial - provider tokens)
- [x] Verify GlobalSettingsView integration
- [ ] Remove deprecated backend commands
- [ ] Update documentation
- [ ] Test all settings views end-to-end

---

## Breaking Changes

### Removed Features
1. **Disabled Env Variables**: The enable/disable feature has been removed in favor of scope-based overrides
2. **Disabled Hooks**: Hooks can now only be deleted, not disabled
3. **Legacy Settings Path**: Direct file path settings are now managed through scopes

### Migration Guide for Users

**Before (Disabled Env):**
```json
{
  "env": { "ANTHROPIC_API_KEY": "sk-xxx" },
  "_claudecodeimpact_disabled_env": { "OLD_KEY": "old-value" }
}
```

**After (Scope-Based Override):**
```json
// User scope: ~/.claude/settings.json
{ "env": { "ANTHROPIC_API_KEY": "sk-xxx" } }

// Project scope: .claude/settings.json
{ "env": { "ANTHROPIC_API_KEY": "sk-project-key" } }

// To "disable" an env var: just remove it from the scope or override with empty string
```

---

## Testing Notes

After migration is complete:

1. **Functional Testing**
   - Create/update/delete env vars in different scopes
   - Create/delete hooks in different scopes
   - Verify provenance display is correct
   - Test scope selector switching

2. **Integration Testing**
   - Ensure settings persist across app restarts
   - Verify git-tracked vs gitignored files
   - Test project vs user scope precedence

3. **Edge Cases**
   - Conflicting settings in different scopes
   - Malformed config files
   - Permission errors
   - Concurrent edits

---

## Implementation Details

### Key Files Modified
- `src/components/Settings/ScopeSelector.tsx` (new)
- `src/components/Settings/index.tsx` (exports)
- `src/views/Settings/EnvSettingsView.tsx` (migrated)
- `src/views/Settings/HooksSettingsView.tsx` (migrated)

### Backend Commands Used
- `config_read_merged` - read merged configuration with provenance
- `config_write` - write configuration values
- `config_delete_key` - delete configuration keys
- `config_validate` - validate before write (future enhancement)

### Type Definitions
- `ConfigScope` - enum for scope types
- `ConfigFileKind` - enum for file types
- `MergedConfigView` - merged config with provenance
- `ProvenanceEntry` - tracks where values come from
