use crate::config::{
    ConfigError, ConfigFileKind, ValidationViolation, ViolationSeverity,
};

/// Validate configuration value before write
pub fn validate_config(
    kind: ConfigFileKind,
    value: &serde_json::Value,
) -> Result<Vec<ValidationViolation>, ConfigError> {
    let mut violations = Vec::new();

    match kind {
        ConfigFileKind::Settings | ConfigFileKind::SettingsLocal => {
            validate_settings_json(value, &mut violations)?;
        }
        ConfigFileKind::McpJson => {
            validate_mcp_json(value, &mut violations)?;
        }
        _ => {
            // Other kinds don't have specific validation rules
        }
    }

    Ok(violations)
}

/// Validate settings.json structure
fn validate_settings_json(
    value: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = value
        .as_object()
        .ok_or_else(|| ConfigError::Other {
            message: "Settings must be a JSON object".to_string(),
        })?;

    // Validate model field (warning only - new models may appear)
    if let Some(model) = obj.get("model") {
        if let Some(model_str) = model.as_str() {
            validate_model_name(model_str, violations);
        }
    }

    // Validate permissions
    if let Some(permissions) = obj.get("permissions") {
        validate_permissions(permissions, violations)?;
    }

    // Validate hooks
    if let Some(hooks) = obj.get("hooks") {
        validate_hooks(hooks, violations)?;
    }

    // Validate MCP servers
    if let Some(mcp_servers) = obj.get("mcp_servers") {
        validate_mcp_servers(mcp_servers, violations)?;
    }

    // Validate env (must be string values)
    if let Some(env) = obj.get("env") {
        validate_env(env, violations)?;
    }

    Ok(())
}

/// Validate model name (warning only)
fn validate_model_name(model: &str, violations: &mut Vec<ValidationViolation>) {
    let known_models = [
        "opus",
        "sonnet",
        "haiku",
        "claude-opus-4",
        "claude-sonnet-4",
        "claude-haiku-4",
    ];

    if !known_models.contains(&model) {
        violations.push(ValidationViolation {
            severity: ViolationSeverity::Warning,
            field: "model".to_string(),
            message: format!(
                "Unknown model '{}'. This may be valid if it's a new model.",
                model
            ),
        });
    }
}

/// Validate permissions configuration
fn validate_permissions(
    permissions: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = permissions.as_object().ok_or_else(|| ConfigError::Other {
        message: "permissions must be an object".to_string(),
    })?;

    // Validate default_mode
    if let Some(default_mode) = obj.get("default_mode") {
        if let Some(mode_str) = default_mode.as_str() {
            let valid_modes = ["allow", "deny", "ask"];
            if !valid_modes.contains(&mode_str) {
                violations.push(ValidationViolation {
                    severity: ViolationSeverity::Error,
                    field: "permissions.default_mode".to_string(),
                    message: format!(
                        "Invalid default_mode '{}'. Must be one of: allow, deny, ask",
                        mode_str
                    ),
                });
            }
        }
    }

    // Validate allow/deny/ask are arrays of strings
    for field_name in ["allow", "deny", "ask"] {
        if let Some(field_value) = obj.get(field_name) {
            if let Some(arr) = field_value.as_array() {
                for (i, item) in arr.iter().enumerate() {
                    if !item.is_string() {
                        violations.push(ValidationViolation {
                            severity: ViolationSeverity::Error,
                            field: format!("permissions.{}[{}]", field_name, i),
                            message: "Must be a string".to_string(),
                        });
                    }
                }
            } else {
                violations.push(ValidationViolation {
                    severity: ViolationSeverity::Error,
                    field: format!("permissions.{}", field_name),
                    message: "Must be an array".to_string(),
                });
            }
        }
    }

    Ok(())
}

/// Validate hooks configuration
fn validate_hooks(
    hooks: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = hooks.as_object().ok_or_else(|| ConfigError::Other {
        message: "hooks must be an object".to_string(),
    })?;

    let known_events = [
        "PreToolUse",
        "PostToolUse",
        "Stop",
        "UserPromptSubmit",
        "SessionStart",
    ];

    for (event_name, event_hooks) in obj {
        // Warn about unknown event names
        if !known_events.contains(&event_name.as_str()) {
            violations.push(ValidationViolation {
                severity: ViolationSeverity::Warning,
                field: format!("hooks.{}", event_name),
                message: format!("Unknown hook event '{}'", event_name),
            });
        }

        // Validate hooks array
        if let Some(hooks_arr) = event_hooks.as_array() {
            for (i, hook) in hooks_arr.iter().enumerate() {
                validate_hook_entry(hook, &format!("hooks.{}[{}]", event_name, i), violations)?;
            }
        } else {
            violations.push(ValidationViolation {
                severity: ViolationSeverity::Error,
                field: format!("hooks.{}", event_name),
                message: "Must be an array".to_string(),
            });
        }
    }

    Ok(())
}

/// Validate a single hook entry
fn validate_hook_entry(
    hook: &serde_json::Value,
    field_path: &str,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = hook.as_object().ok_or_else(|| ConfigError::Other {
        message: format!("{} must be an object", field_path),
    })?;

    // Validate type field
    if let Some(hook_type) = obj.get("type") {
        if let Some(type_str) = hook_type.as_str() {
            let valid_types = ["command", "prompt", "agent"];
            if !valid_types.contains(&type_str) {
                violations.push(ValidationViolation {
                    severity: ViolationSeverity::Error,
                    field: format!("{}.type", field_path),
                    message: format!(
                        "Invalid hook type '{}'. Must be one of: command, prompt, agent",
                        type_str
                    ),
                });
            }
        }
    } else {
        violations.push(ValidationViolation {
            severity: ViolationSeverity::Error,
            field: format!("{}.type", field_path),
            message: "Hook type is required".to_string(),
        });
    }

    Ok(())
}

/// Validate MCP servers configuration
fn validate_mcp_servers(
    mcp_servers: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = mcp_servers
        .as_object()
        .ok_or_else(|| ConfigError::Other {
            message: "mcp_servers must be an object".to_string(),
        })?;

    for (server_name, server_config) in obj {
        validate_mcp_server(server_config, server_name, violations)?;
    }

    Ok(())
}

/// Validate a single MCP server configuration
fn validate_mcp_server(
    server: &serde_json::Value,
    server_name: &str,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = server.as_object().ok_or_else(|| ConfigError::Other {
        message: format!("mcp_servers.{} must be an object", server_name),
    })?;

    // Validate type field
    if let Some(server_type) = obj.get("type") {
        if let Some(type_str) = server_type.as_str() {
            let valid_types = ["stdio", "sse", "http", "websocket"];
            if !valid_types.contains(&type_str) {
                violations.push(ValidationViolation {
                    severity: ViolationSeverity::Error,
                    field: format!("mcp_servers.{}.type", server_name),
                    message: format!(
                        "Invalid MCP server type '{}'. Must be one of: stdio, sse, http, websocket",
                        type_str
                    ),
                });
            }
        }
    }

    Ok(())
}

/// Validate MCP JSON file
fn validate_mcp_json(
    value: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = value.as_object().ok_or_else(|| ConfigError::Other {
        message: ".mcp.json must be an object".to_string(),
    })?;

    // MCP JSON is a flat object of server configs
    for (server_name, server_config) in obj {
        validate_mcp_server(server_config, server_name, violations)?;
    }

    Ok(())
}

/// Validate env configuration
fn validate_env(
    env: &serde_json::Value,
    violations: &mut Vec<ValidationViolation>,
) -> Result<(), ConfigError> {
    let obj = env.as_object().ok_or_else(|| ConfigError::Other {
        message: "env must be an object".to_string(),
    })?;

    for (key, value) in obj {
        if !value.is_string() {
            violations.push(ValidationViolation {
                severity: ViolationSeverity::Error,
                field: format!("env.{}", key),
                message: "Environment variable value must be a string".to_string(),
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_validate_valid_settings() {
        let settings = json!({
            "model": "opus",
            "permissions": {
                "default_mode": "ask",
                "allow": ["/home/user"],
                "deny": [],
                "ask": []
            }
        });

        let violations = validate_config(ConfigFileKind::Settings, &settings).unwrap();
        assert!(violations.iter().all(|v| v.severity == ViolationSeverity::Warning));
    }

    #[test]
    fn test_validate_invalid_permission_mode() {
        let settings = json!({
            "permissions": {
                "default_mode": "invalid"
            }
        });

        let violations = validate_config(ConfigFileKind::Settings, &settings).unwrap();
        assert!(violations.iter().any(|v| v.severity == ViolationSeverity::Error));
    }

    #[test]
    fn test_validate_invalid_hook_type() {
        let settings = json!({
            "hooks": {
                "PreToolUse": [
                    {
                        "type": "invalid_type"
                    }
                ]
            }
        });

        let violations = validate_config(ConfigFileKind::Settings, &settings).unwrap();
        assert!(violations.iter().any(|v| v.field.contains("type")));
    }

    #[test]
    fn test_validate_env_non_string_value() {
        let settings = json!({
            "env": {
                "KEY": 123
            }
        });

        let violations = validate_config(ConfigFileKind::Settings, &settings).unwrap();
        assert!(violations.iter().any(|v| v.field.contains("env")));
    }
}
