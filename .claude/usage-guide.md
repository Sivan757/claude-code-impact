# Configuration Management System - Quick Start Guide

## Overview

The configuration management system provides scope-aware access to Claude Code settings with automatic merging, provenance tracking, and real-time updates.

---

## Using the UI

### Basic Configuration Editor

```tsx
import { ConfigEditor } from "@/config";

function SettingsPage() {
  return <ConfigEditor projectPath={currentProject} />;
}
```

**Features**:
- View merged configuration from all scopes
- Write to any writable scope (User, User Local, Project, Project Local)
- See provenance for every configuration key
- View combined CLAUDE.md content
- Real-time updates via filesystem watcher

---

## Using React Hooks

### Read Merged Configuration

```tsx
import { useConfigMerged } from "@/config/hooks/useConfig";

function MyComponent() {
  const { data: config, isLoading } = useConfigMerged("/path/to/project");

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      Model: {config?.effective.model}
      <ScopeIndicator scope={config?.provenance.model?.scope} />
    </div>
  );
}
```

### Write Configuration

```tsx
import { useConfigWrite } from "@/config/hooks/useConfig";
import { ConfigScope, ConfigFileKind } from "@/config/types";

function ModelSelector() {
  const writeMutation = useConfigWrite();

  const changeModel = (model: string) => {
    writeMutation.mutate({
      kind: ConfigFileKind.Settings,
      scope: ConfigScope.User,
      key: "model",
      value: model,
    });
  };

  return <button onClick={() => changeModel("opus")}>Use Opus</button>;
}
```

### Enable File Watching

```tsx
import { useConfigWatcher } from "@/config/hooks/useConfigWatcher";

function App() {
  // Automatically invalidates queries when config files change
  useConfigWatcher("/path/to/project");

  return <div>...</div>;
}
```

---

## Backend API (Tauri Commands)

### Read Configuration

```rust
// Read single config file
invoke("config_read", {
  kind: "settings",
  scope: "user",
  projectPath: "/path/to/project"
})

// Read merged view
invoke("config_read_merged", {
  projectPath: "/path/to/project"
})
```

### Write Configuration

```rust
// Write full config
invoke("config_write", {
  kind: "settings",
  scope: "user",
  projectPath: null,
  key: null,
  value: { model: "opus", ... }
})

// Update single key
invoke("config_write", {
  kind: "settings",
  scope: "project",
  projectPath: "/path/to/project",
  key: "model",
  value: "sonnet"
})

// Write markdown
invoke("config_write_markdown", {
  kind: "claude_md",
  scope: "user",
  projectPath: null,
  content: "# My Config\n..."
})
```

### Validate Before Write

```rust
invoke("config_validate", {
  kind: "settings",
  value: { permissions: { default_mode: "invalid" } }
})
// Returns: [{ severity: "error", field: "permissions.default_mode", message: "..." }]
```

### Manage Backups

```rust
// List backups
invoke("config_list_backups", {
  kind: "settings",
  scope: "user",
  projectPath: null
})

// Restore backup
invoke("config_restore_backup", {
  backupPath: "/home/user/.claude/settings.json.backup.1234567890",
  targetPath: "/home/user/.claude/settings.json"
})
```

---

## Configuration Scopes

### Precedence Order (Highest → Lowest)

1. **Managed** - Read-only, IT-controlled
2. **Project Local** - Personal project overrides (`.claude/settings.local.json`)
3. **Project** - Team settings (`.claude/settings.json`)
4. **User Local** - Machine-specific (`~/.claude/settings.local.json`)
5. **User** - Personal defaults (`~/.claude/settings.json`)
6. **Default** - Hardcoded fallbacks

### When to Use Each Scope

| Scope | Use Case | Version Control |
|-------|----------|----------------|
| **User** | Personal preferences across all projects | ❌ No |
| **User Local** | Machine-specific overrides (API keys, paths) | ❌ No |
| **Project** | Team-shared settings | ✅ Yes |
| **Project Local** | Personal project overrides | ❌ No |
| **Managed** | Enterprise policies (read-only) | N/A |

---

## Configuration Files

### settings.json

```json
{
  "model": "opus",
  "always_thinking_enabled": false,
  "permissions": {
    "default_mode": "ask",
    "allow": ["/home/user/projects"],
    "deny": [],
    "ask": []
  },
  "env": {
    "ANTHROPIC_API_KEY": "sk-..."
  },
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "echo 'Before tool use'"
      }
    ]
  },
  "mcp_servers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

### CLAUDE.md

```markdown
# Project Context

This is my Claude Code configuration.

## Rules

- Always use TypeScript
- Follow Clean Architecture
```

### .mcp.json

```json
{
  "database": {
    "type": "stdio",
    "command": "mcp-server-sqlite"
  }
}
```

---

## Validation Rules

### Model Name
- **Severity**: Warning
- **Rule**: Known models: opus, sonnet, haiku, claude-opus-4, claude-sonnet-4, claude-haiku-4
- **Note**: Warnings don't block writes (allows new models)

### Permissions Default Mode
- **Severity**: Error
- **Rule**: Must be "allow", "deny", or "ask"
- **Note**: Errors block writes

### Hook Type
- **Severity**: Error
- **Rule**: Must be "command", "prompt", or "agent"

### Hook Event Names
- **Severity**: Warning
- **Known Events**: PreToolUse, PostToolUse, Stop, UserPromptSubmit, SessionStart

### MCP Server Type
- **Severity**: Error
- **Rule**: Must be "stdio", "sse", "http", or "websocket"

### Environment Variables
- **Severity**: Error
- **Rule**: Values must be strings

---

## Best Practices

### 1. Use Correct Scope

```tsx
// ❌ Don't write API keys to project scope
writeMutation.mutate({
  scope: ConfigScope.Project, // Will be in version control!
  key: "env.ANTHROPIC_API_KEY",
  value: "sk-..."
});

// ✅ Use user local scope for secrets
writeMutation.mutate({
  scope: ConfigScope.UserLocal,
  key: "env.ANTHROPIC_API_KEY",
  value: "sk-..."
});
```

### 2. Validate Before Write

```tsx
const validateMutation = useConfigValidate();
const writeMutation = useConfigWrite();

const saveConfig = async (value: unknown) => {
  const violations = await validateMutation.mutateAsync({
    kind: ConfigFileKind.Settings,
    value,
  });

  const hasErrors = violations.some(v => v.severity === "error");
  if (hasErrors) {
    alert("Validation failed!");
    return;
  }

  await writeMutation.mutateAsync({
    kind: ConfigFileKind.Settings,
    scope: ConfigScope.User,
    value,
  });
};
```

### 3. Use Provenance for UI

```tsx
const { data: config } = useConfigMerged();

const renderSetting = (key: string) => {
  const provenance = config?.provenance[key];
  const value = config?.effective[key];

  return (
    <div>
      <Label>{key}</Label>
      <Input value={value} />
      {provenance && <ScopeIndicator scope={provenance.scope} />}
      <span className="text-xs text-muted-foreground">
        Source: {provenance.file_path}
      </span>
    </div>
  );
};
```

### 4. Handle Errors Gracefully

```tsx
const writeMutation = useConfigWrite();

const save = async () => {
  try {
    await writeMutation.mutateAsync({...});
    toast.success("Configuration saved!");
  } catch (error) {
    if (error.includes("ReadOnly")) {
      toast.error("Cannot modify managed configuration");
    } else if (error.includes("ValidationError")) {
      toast.error("Invalid configuration");
    } else {
      toast.error("Failed to save configuration");
    }
  }
};
```

---

## Troubleshooting

### Config Changes Not Reflecting

**Problem**: UI doesn't update after external file edit

**Solution**: Ensure watcher is initialized

```tsx
import { useConfigWatcher } from "@/config/hooks/useConfigWatcher";

function App() {
  useConfigWatcher(projectPath); // Add this
  return <YourUI />;
}
```

### Write Fails with "ReadOnly"

**Problem**: Trying to write to Managed scope

**Solution**: Use a writable scope (User, UserLocal, Project, ProjectLocal)

### Validation Errors

**Problem**: Write blocked by validation

**Solution**: Check validation response and fix the config

```tsx
const { data: violations } = useConfigValidate();
violations?.forEach(v => {
  console.log(`${v.severity}: ${v.field} - ${v.message}`);
});
```

### Backup Not Created

**Problem**: No backup file after write

**Solution**: Backups are only created if file exists. First write won't have backup.

---

## Examples

### Complete Settings Form

```tsx
import { useConfigMerged, useConfigWrite } from "@/config/hooks/useConfig";
import { ConfigScope, ConfigFileKind } from "@/config/types";
import { Select, Switch, Button } from "@/components/ui";

function SettingsForm({ projectPath }: { projectPath?: string }) {
  const { data: config } = useConfigMerged(projectPath);
  const writeMutation = useConfigWrite();

  const updateModel = (model: string) => {
    writeMutation.mutate({
      kind: ConfigFileKind.Settings,
      scope: projectPath ? ConfigScope.Project : ConfigScope.User,
      projectPath,
      key: "model",
      value: model,
    });
  };

  const toggleThinking = () => {
    const current = config?.effective.always_thinking_enabled ?? false;
    writeMutation.mutate({
      kind: ConfigFileKind.Settings,
      scope: ConfigScope.User,
      key: "always_thinking_enabled",
      value: !current,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Model</Label>
        <Select
          value={config?.effective.model ?? "opus"}
          onValueChange={updateModel}
        >
          <SelectItem value="opus">Opus</SelectItem>
          <SelectItem value="sonnet">Sonnet</SelectItem>
          <SelectItem value="haiku">Haiku</SelectItem>
        </Select>
        <ScopeIndicator scope={config?.provenance.model?.scope} />
      </div>

      <div>
        <Label>Always Thinking</Label>
        <Switch
          checked={config?.effective.always_thinking_enabled ?? false}
          onCheckedChange={toggleThinking}
        />
      </div>

      {writeMutation.isSuccess && (
        <div className="text-sm text-green-600">Saved!</div>
      )}
    </div>
  );
}
```

---

## API Reference

See `src/config/types.ts` for complete type definitions.

See implementation-summary.md for detailed technical documentation.
