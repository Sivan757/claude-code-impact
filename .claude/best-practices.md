# Configuration Management System - Best Practices & Patterns

## Table of Contents
1. [Writing Configuration](#writing-configuration)
2. [Reading Configuration](#reading-configuration)
3. [Error Handling](#error-handling)
4. [Performance Optimization](#performance-optimization)
5. [Security Best Practices](#security-best-practices)
6. [Testing Patterns](#testing-patterns)
7. [Common Pitfalls](#common-pitfalls)

---

## Writing Configuration

### ✅ DO: Use Correct Scope

```typescript
// ✅ Good: API keys in user-local (machine-specific, not in VCS)
await invoke("config_write", {
  kind: "settings",
  scope: "user_local",
  key: "env.ANTHROPIC_API_KEY",
  value: "sk-ant-..."
});

// ✅ Good: Team settings in project scope (in VCS)
await invoke("config_write", {
  kind: "settings",
  scope: "project",
  projectPath: "/path/to/project",
  key: "model",
  value: "opus"
});

// ❌ Bad: Secrets in project scope (will be committed!)
await invoke("config_write", {
  kind: "settings",
  scope: "project",
  key: "env.API_KEY",
  value: "secret"
});
```

### ✅ DO: Validate Before Write

```typescript
// Always validate to catch errors early
const { data: violations } = await validateMutation.mutateAsync({
  kind: ConfigFileKind.Settings,
  value: newConfig,
});

const hasErrors = violations.some(v => v.severity === "error");
if (hasErrors) {
  // Show errors to user
  violations.forEach(v => {
    toast.error(`${v.field}: ${v.message}`);
  });
  return;
}

// Proceed with write
await writeMutation.mutateAsync({...});
```

### ✅ DO: Use Deep Merge for Partial Updates

```typescript
// ✅ Good: Update only one field
await invoke("config_write", {
  kind: "settings",
  scope: "user",
  key: "model",
  value: "sonnet"
});

// ❌ Bad: Read entire config, modify, write back
const config = await invoke("config_read", {...});
config.model = "sonnet";
await invoke("config_write", { value: config });
```

### ✅ DO: Handle Write Failures Gracefully

```typescript
try {
  const result = await writeMutation.mutateAsync({...});
  toast.success("Configuration saved!");

  // Optional: Show backup path
  if (result.backup_path) {
    console.log(`Backup created: ${result.backup_path}`);
  }
} catch (error) {
  if (error.includes("ReadOnly")) {
    toast.error("Cannot modify managed configuration");
  } else if (error.includes("ValidationError")) {
    toast.error("Invalid configuration values");
  } else if (error.includes("PermissionDenied")) {
    toast.error("No permission to write to this file");
  } else {
    toast.error("Failed to save configuration");
  }
}
```

---

## Reading Configuration

### ✅ DO: Use Merged View for Display

```typescript
// ✅ Good: Read merged config with provenance
const { data: config } = useConfigMerged(projectPath);

// Access effective value
const model = config?.effective.model;

// Show where it comes from
const provenance = config?.provenance.model;
<ScopeIndicator scope={provenance?.scope} />
```

### ✅ DO: Cache Merged Configs

```typescript
// React Query caches automatically
const { data: config } = useConfigMerged(projectPath);
// ✅ Subsequent reads use cache (no re-fetch)

// Invalidate cache after writes
queryClient.invalidateQueries(["config", "merged"]);
```

### ❌ DON'T: Read Individual Files for Merged View

```typescript
// ❌ Bad: Manual merging
const userConfig = await invoke("config_read", {
  kind: "settings",
  scope: "user"
});
const projectConfig = await invoke("config_read", {
  kind: "settings",
  scope: "project",
  projectPath
});
// Then merge manually... (complex, error-prone)

// ✅ Good: Use built-in merger
const merged = await invoke("config_read_merged", { projectPath });
```

---

## Error Handling

### ✅ DO: Check for NotFound

```typescript
const result = await invoke<ConfigValue>("config_read", {...});

if (result.type === "not_found") {
  // File doesn't exist - this is OK
  return defaultConfig;
}

if (result.type === "json") {
  return result.value;
}
```

### ✅ DO: Provide Context in Errors

```rust
// ✅ Good: Include path and reason
return Err(ConfigError::ParseError {
    path: path.display().to_string(),
    message: format!("Invalid JSON at line {}: {}", line, e),
});

// ❌ Bad: Generic error
return Err(ConfigError::Other {
    message: "Parse failed".to_string()
});
```

### ✅ DO: Handle Validation Errors Specifically

```typescript
const violations = await invoke<ValidationViolation[]>(
  "config_validate",
  { kind, value }
);

// Group by severity
const errors = violations.filter(v => v.severity === "error");
const warnings = violations.filter(v => v.severity === "warning");

// Errors block write
if (errors.length > 0) {
  showErrors(errors);
  return;
}

// Warnings are informational
if (warnings.length > 0) {
  showWarnings(warnings);
}

// Proceed with write
```

---

## Performance Optimization

### ✅ DO: Use Watcher for Real-Time Updates

```typescript
// Initialize once at app level
function App() {
  useConfigWatcher(projectPath);

  return <YourApp />;
}

// Components auto-refresh when files change
function SettingsView() {
  const { data } = useConfigMerged(); // ✅ Auto-updates
  return <div>{data?.effective.model}</div>;
}
```

### ✅ DO: Batch Configuration Writes

```rust
// ✅ Good: Single transaction
let mut changes = vec![
    ("model", "opus"),
    ("always_thinking_enabled", "true"),
    ("cleanup_period_days", "30"),
];

let patch = serde_json::json!({
    "model": "opus",
    "always_thinking_enabled": true,
    "cleanup_period_days": 30
});

merge_and_write(&path, kind, scope, &patch, true)?;

// ❌ Bad: Multiple writes
for (key, value) in changes {
    write_config(..., key, value, ...)?; // Creates 3 backups!
}
```

### ✅ DO: Minimize Merged Config Reads

```typescript
// ✅ Good: Read once, use provenance map
const { data: config } = useConfigMerged();

const renderSetting = (key: string) => {
  const value = config?.effective[key];
  const source = config?.provenance[key];
  return <Setting value={value} source={source} />;
};

// ❌ Bad: Read merged config per setting
const renderSetting = (key: string) => {
  const { data: config } = useConfigMerged(); // ❌ Re-renders entire tree
  return <Setting value={config?.effective[key]} />;
};
```

### ✅ DO: Use Stale-While-Revalidate

```typescript
// Already configured in react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // ✅ No auto-refetch
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Manually invalidate on write
mutation.onSuccess(() => {
  queryClient.invalidateQueries(["config"]);
});
```

---

## Security Best Practices

### ✅ DO: Encrypt Sensitive Values

```typescript
// ✅ Good: Use system keychain (future enhancement)
const apiKey = await getSecureValue("ANTHROPIC_API_KEY");

await invoke("config_write", {
  kind: "settings",
  scope: "user_local",
  key: "env.ANTHROPIC_API_KEY_REF",
  value: `keychain:${apiKey.id}`
});

// ❌ Bad: Store plaintext secrets
await invoke("config_write", {
  key: "env.ANTHROPIC_API_KEY",
  value: "sk-ant-plaintext" // ❌ Visible in settings.json
});
```

### ✅ DO: Validate Scope Write Permissions

```rust
// Already enforced in code
if !scope.is_writable() {
    return Err(ConfigError::ReadOnly {
        scope: format!("{:?}", scope),
        reason: "This scope cannot be modified".to_string(),
    });
}
```

### ✅ DO: Sanitize User Input

```typescript
// Validate before write
const sanitizeKey = (key: string): string => {
  // Only allow alphanumeric, dots, underscores
  return key.replace(/[^a-zA-Z0-9._]/g, "");
};

const key = sanitizeKey(userInput);
await invoke("config_write", { key, value });
```

### ❌ DON'T: Trust External Config Files

```rust
// ✅ Good: Validate after read
let config = read_config_file(path, kind)?;
let violations = validate_config(kind, &config)?;

if violations.iter().any(|v| v.severity == Error) {
    return Err(ConfigError::ValidationError { violations });
}

// ❌ Bad: Trust file contents
let config = read_config_file(path, kind)?;
// Use directly without validation
```

---

## Testing Patterns

### ✅ DO: Use Temporary Files for Tests

```rust
use tempfile::TempDir;

#[test]
fn test_write_config() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("settings.json");

    write_config(&config_path, kind, scope, &value, true).unwrap();

    assert!(config_path.exists());
    // temp_dir automatically cleaned up
}
```

### ✅ DO: Test Error Conditions

```rust
#[test]
fn test_readonly_scope_rejected() {
    let result = write_config(
        &path,
        ConfigFileKind::Settings,
        ConfigScope::Managed, // ❌ Read-only
        &value,
        false,
    );

    assert!(matches!(result, Err(ConfigError::ReadOnly { .. })));
}

#[test]
fn test_invalid_json_rejected() {
    let result = parse_json_content("{{invalid", &path);
    assert!(matches!(result, Err(ConfigError::ParseError { .. })));
}
```

### ✅ DO: Test Scope Precedence

```rust
#[test]
fn test_project_overrides_user() {
    let user_config = json!({"model": "opus"});
    let project_config = json!({"model": "sonnet"});

    // Write both
    write_config(&user_path, ..., ConfigScope::User, &user_config, ...);
    write_config(&project_path, ..., ConfigScope::Project, &project_config, ...);

    // Read merged
    let merged = build_merged_config(Some(project_dir))?;

    // Project should win
    assert_eq!(merged.effective["model"], "sonnet");
    assert_eq!(merged.provenance["model"].scope, ConfigScope::Project);
}
```

---

## Common Pitfalls

### ❌ PITFALL: Forgetting to Initialize Watcher

```typescript
// ❌ Bad: No watcher = no auto-updates
function App() {
  return <ConfigEditor />;
}

// ✅ Good: Initialize watcher
function App() {
  useConfigWatcher(projectPath); // ✅ Enables auto-updates
  return <ConfigEditor />;
}
```

### ❌ PITFALL: Writing to Wrong Scope

```typescript
// ❌ Bad: Personal settings in project scope
await invoke("config_write", {
  scope: "project", // ❌ Will be in VCS!
  key: "always_thinking_enabled",
  value: true
});

// ✅ Good: Personal settings in user scope
await invoke("config_write", {
  scope: "user", // ✅ Personal preference
  key: "always_thinking_enabled",
  value: true
});
```

### ❌ PITFALL: Not Handling NotFound

```typescript
// ❌ Bad: Assumes file exists
const result = await invoke("config_read", {...});
const model = result.value.model; // ❌ Crashes if not_found

// ✅ Good: Handle NotFound
const result = await invoke("config_read", {...});
if (result.type === "not_found") {
  return defaultModel;
}
const model = result.value.model; // ✅ Safe
```

### ❌ PITFALL: Ignoring Validation Warnings

```typescript
// ❌ Bad: Ignore warnings
const violations = await validate(...);
if (violations.some(v => v.severity === "error")) {
  return; // ✅ Good
}
// ❌ Proceed without showing warnings
await write(...);

// ✅ Good: Show warnings to user
const warnings = violations.filter(v => v.severity === "warning");
if (warnings.length > 0) {
  warnings.forEach(w => toast.warning(w.message));
}
await write(...);
```

### ❌ PITFALL: Not Creating Backups

```rust
// ❌ Bad: No backup on destructive write
write_config(&path, kind, scope, &value, false)?; // ❌ create_backup=false

// ✅ Good: Always create backup
write_config(&path, kind, scope, &value, true)?; // ✅ create_backup=true
```

### ❌ PITFALL: Race Conditions in Concurrent Writes

```typescript
// ❌ Bad: Concurrent writes without coordination
Promise.all([
  invoke("config_write", { key: "model", value: "opus" }),
  invoke("config_write", { key: "model", value: "sonnet" })
]);
// ❌ Last write wins, unpredictable result

// ✅ Good: Sequential writes or use single patch
await invoke("config_write", { key: "model", value: "opus" });
await invoke("config_write", { key: "thinking", value: true });

// ✅ Better: Single patch
await invoke("config_write", {
  value: {
    model: "opus",
    always_thinking_enabled: true
  }
});
```

---

## Checklist for Config Changes

### Before Writing
- [ ] Selected correct scope (User/UserLocal/Project/ProjectLocal)
- [ ] Validated value against schema
- [ ] Confirmed no secrets in project scope
- [ ] Enabled backup creation
- [ ] Handled write errors

### After Writing
- [ ] Verified config file updated
- [ ] Checked backup file created
- [ ] Confirmed UI auto-updated (if watcher enabled)
- [ ] Tested read after write
- [ ] Verified merged view shows correct precedence

### Before Deploying
- [ ] All tests passing
- [ ] No validation errors in existing configs
- [ ] Backup/restore tested
- [ ] Cross-platform paths verified
- [ ] Documentation updated

---

## Summary

Following these best practices ensures:
- ✅ **Correctness**: Right scope, validated writes, proper merging
- ✅ **Performance**: Cached reads, batched writes, efficient watchers
- ✅ **Security**: No plaintext secrets, validated input, read-only enforcement
- ✅ **Reliability**: Error handling, backups, atomic writes
- ✅ **Maintainability**: Clear patterns, consistent style, good tests

The configuration management system is designed to be **safe by default** - most pitfalls are prevented by the API design itself.
