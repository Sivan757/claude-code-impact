use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::{build_merged_config, ConfigError, McpServerConfig};

/// Template merge mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MergeMode {
    /// Overwrite target config entirely
    Replace,
    /// Deep merge (existing keys preserved, new keys added, conflicts overwritten)
    Merge,
    /// Only fill missing keys (never overwrite existing values)
    Fill,
}

/// A configuration template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub created_at: u64,
    #[serde(default)]
    pub updated_at: u64,
    #[serde(default)]
    pub is_builtin: bool,
    /// The settings configuration
    #[serde(default)]
    pub config: serde_json::Value,
    /// Environment variables
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
    /// Hooks configuration
    #[serde(default)]
    pub hooks: Option<serde_json::Value>,
    /// MCP server configurations
    #[serde(default)]
    pub mcp_servers: Option<HashMap<String, McpServerConfig>>,
}

/// Lightweight template listing entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateListEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub tags: Vec<String>,
    pub is_builtin: bool,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub mcp_count: u32,
    #[serde(default)]
    pub env_count: u32,
    #[serde(default)]
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub provider_name: Option<String>,
    #[serde(default)]
    pub has_hooks: bool,
}

fn infer_name_from_host(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_scheme = trimmed.split("://").nth(1).unwrap_or(trimmed);
    let host_port_path = without_scheme.split('/').next().unwrap_or("");
    let host_with_auth_removed = host_port_path.split('@').last().unwrap_or(host_port_path);
    let host = host_with_auth_removed
        .split(':')
        .next()
        .unwrap_or(host_with_auth_removed)
        .trim()
        .trim_start_matches("api.")
        .to_lowercase();

    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

fn infer_provider_name_from_template_config(config: &serde_json::Value) -> Option<String> {
    if let Some(name) = config
        .get("claudecodeimpact")
        .and_then(|value| value.as_object())
        .and_then(|cci| cci.get("activeProvider"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(name.to_string());
    }

    config
        .get("env")
        .and_then(|value| value.as_object())
        .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
        .and_then(|value| value.as_str())
        .and_then(infer_name_from_host)
}

fn normalize_permission_mode(value: &str) -> Option<String> {
    match value {
        "normal" => Some("default".to_string()),
        "allowEdits" => Some("acceptEdits".to_string()),
        "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan" => {
            Some(value.to_string())
        }
        _ => None,
    }
}

impl From<&ConfigTemplate> for TemplateListEntry {
    fn from(t: &ConfigTemplate) -> Self {
        let model = t
            .config
            .get("model")
            .and_then(|v| v.as_str())
            .map(String::from);
        let mcp_count = t.mcp_servers.as_ref().map_or(0, |s| s.len() as u32);
        let env_count = t.env.as_ref().map_or(0, |e| e.len() as u32);
        let permission_mode = t
            .config
            .get("permissions")
            .and_then(|p| {
                p.get("defaultMode")
                    .and_then(|v| v.as_str())
                    .or_else(|| p.get("default_mode").and_then(|v| v.as_str()))
            })
            .and_then(normalize_permission_mode);
        let provider_name = infer_provider_name_from_template_config(&t.config);
        let has_hooks = t
            .hooks
            .as_ref()
            .and_then(|h| h.as_object())
            .map_or(false, |h| !h.is_empty());

        TemplateListEntry {
            id: t.id.clone(),
            name: t.name.clone(),
            description: t.description.clone(),
            author: t.author.clone(),
            tags: t.tags.clone(),
            is_builtin: t.is_builtin,
            created_at: t.created_at,
            updated_at: t.updated_at,
            model,
            mcp_count,
            env_count,
            permission_mode,
            provider_name,
            has_hooks,
        }
    }
}

/// Exported config bundle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedConfig {
    pub version: u32,
    pub timestamp: u64,
    pub source_project: Option<String>,
    pub files: HashMap<String, serde_json::Value>,
}

/// Get the templates storage directory
pub fn get_templates_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claudecodeimpact")
        .join("templates")
}

/// Get built-in templates
pub fn get_builtin_templates() -> Vec<ConfigTemplate> {
    let now = current_timestamp();

    vec![
        ConfigTemplate {
            id: "builtin-example".to_string(),
            name: "Example Template".to_string(),
            description: "A single starter template covering current launcher capabilities (model, permissions, env, and plugin map).".to_string(),
            author: "claudecodeimpact".to_string(),
            tags: vec![
                "example".to_string(),
                "starter".to_string(),
            ],
            created_at: now,
            updated_at: now,
            is_builtin: true,
            config: serde_json::json!({
                "model": "sonnet",
                "alwaysThinkingEnabled": false,
                "showTurnDuration": true,
                "autoUpdatesChannel": "stable",
                "permissions": {
                    "allow": ["Read", "Edit"],
                    "deny": [],
                    "ask": [],
                    "defaultMode": "default"
                },
                "enabledPlugins": {}
            }),
            env: Some(HashMap::from([
                (
                    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS".to_string(),
                    "0".to_string(),
                ),
                (
                    "CLAUDE_CODE_PLAN_MODE_REQUIRED".to_string(),
                    "0".to_string(),
                ),
            ])),
            hooks: None,
            mcp_servers: None,
        },
    ]
}

/// List all templates (built-in + user-defined)
pub fn list_templates() -> Result<Vec<TemplateListEntry>, ConfigError> {
    let mut entries: Vec<TemplateListEntry> = Vec::new();

    // Add built-in templates
    for t in get_builtin_templates() {
        entries.push(TemplateListEntry::from(&t));
    }

    // Scan user templates directory
    let templates_dir = get_templates_dir();
    if templates_dir.exists() {
        if let Ok(dir_entries) = fs::read_dir(&templates_dir) {
            for entry in dir_entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(template) = serde_json::from_str::<ConfigTemplate>(&content) {
                            entries.push(TemplateListEntry::from(&template));
                        }
                    }
                }
            }
        }
    }

    Ok(entries)
}

/// Get a single template by ID
pub fn get_template(id: &str) -> Result<ConfigTemplate, ConfigError> {
    // Check built-in templates first
    for t in get_builtin_templates() {
        if t.id == id {
            return Ok(t);
        }
    }

    // Check user templates
    let template_path = get_templates_dir().join(format!("{}.json", id));
    if template_path.exists() {
        let content = fs::read_to_string(&template_path).map_err(|e| ConfigError::IoError {
            message: format!("Failed to read template: {}", e),
        })?;
        let template: ConfigTemplate =
            serde_json::from_str(&content).map_err(|e| ConfigError::IoError {
                message: format!("Failed to parse template: {}", e),
            })?;
        return Ok(template);
    }

    Err(ConfigError::Other {
        message: format!("Template not found: {}", id),
    })
}

/// Save a template to disk
pub fn save_template(template: &ConfigTemplate) -> Result<(), ConfigError> {
    if template.is_builtin {
        return Err(ConfigError::Other {
            message: "Cannot save built-in templates".to_string(),
        });
    }

    let templates_dir = get_templates_dir();
    fs::create_dir_all(&templates_dir).map_err(|e| ConfigError::IoError {
        message: format!("Failed to create templates directory: {}", e),
    })?;

    let template_path = templates_dir.join(format!("{}.json", template.id));
    let content = serde_json::to_string_pretty(template).map_err(|e| ConfigError::IoError {
        message: format!("Failed to serialize template: {}", e),
    })?;

    fs::write(&template_path, content).map_err(|e| ConfigError::IoError {
        message: format!("Failed to write template: {}", e),
    })?;

    Ok(())
}

/// Delete a template by ID
pub fn delete_template(id: &str) -> Result<(), ConfigError> {
    // Prevent deleting built-in templates
    for t in get_builtin_templates() {
        if t.id == id {
            return Err(ConfigError::Other {
                message: "Cannot delete built-in templates".to_string(),
            });
        }
    }

    let template_path = get_templates_dir().join(format!("{}.json", id));
    if template_path.exists() {
        fs::remove_file(&template_path).map_err(|e| ConfigError::IoError {
            message: format!("Failed to delete template: {}", e),
        })?;
    }

    Ok(())
}

/// Save current project config as a template
pub fn save_from_project(
    name: &str,
    description: &str,
    tags: Vec<String>,
    project_path: Option<&str>,
) -> Result<ConfigTemplate, ConfigError> {
    let merged = build_merged_config(project_path)?;
    let now = current_timestamp();

    let id = format!(
        "custom-{}",
        name.to_lowercase()
            .replace(' ', "-")
            .replace(|c: char| !c.is_alphanumeric() && c != '-', "")
    );

    // Extract env, hooks, mcp_servers from effective config
    let effective = &merged.effective;
    let env: Option<HashMap<String, String>> = effective
        .get("env")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let hooks = effective
        .get("hooks")
        .cloned()
        .filter(|value| value.as_object().map_or(false, |obj| !obj.is_empty()));
    let mcp_servers = if merged.mcp_servers.servers.is_empty() {
        None
    } else {
        Some(merged.mcp_servers.servers.clone())
    };

    // Build config without env/hooks/mcp_servers (they're stored separately)
    let mut config = effective.clone();
    if let Some(obj) = config.as_object_mut() {
        obj.remove("env");
        obj.remove("hooks");
        obj.remove("mcp_servers");
    }

    let template = ConfigTemplate {
        id,
        name: name.to_string(),
        description: description.to_string(),
        author: "User".to_string(),
        tags,
        created_at: now,
        updated_at: now,
        is_builtin: false,
        config,
        env,
        hooks,
        mcp_servers,
    };

    save_template(&template)?;
    Ok(template)
}

/// Apply merge mode to two JSON values
pub fn apply_merge_mode(
    target: serde_json::Value,
    source: serde_json::Value,
    mode: MergeMode,
) -> serde_json::Value {
    match mode {
        MergeMode::Replace => source,
        MergeMode::Merge => deep_merge_for_template(target, source),
        MergeMode::Fill => fill_missing(target, source),
    }
}

/// Deep merge source into target (source wins on conflict)
fn deep_merge_for_template(
    target: serde_json::Value,
    source: serde_json::Value,
) -> serde_json::Value {
    match (target, source) {
        (serde_json::Value::Object(mut target_map), serde_json::Value::Object(source_map)) => {
            for (key, source_value) in source_map {
                if let Some(target_value) = target_map.remove(&key) {
                    target_map.insert(key, deep_merge_for_template(target_value, source_value));
                } else {
                    target_map.insert(key, source_value);
                }
            }
            serde_json::Value::Object(target_map)
        }
        (_, source) => source,
    }
}

/// Fill only missing keys from source into target
fn fill_missing(target: serde_json::Value, source: serde_json::Value) -> serde_json::Value {
    match (target, source) {
        (serde_json::Value::Object(mut target_map), serde_json::Value::Object(source_map)) => {
            for (key, source_value) in source_map {
                if let Some(target_value) = target_map.get(&key) {
                    // Recursively fill nested objects
                    if target_value.is_object() && source_value.is_object() {
                        let merged = fill_missing(target_value.clone(), source_value);
                        target_map.insert(key, merged);
                    }
                    // Existing key: keep target value
                } else {
                    // Missing key: use source value
                    target_map.insert(key, source_value);
                }
            }
            serde_json::Value::Object(target_map)
        }
        (target, _) => target, // Non-objects: keep target
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_builtin_templates_count() {
        let templates = get_builtin_templates();
        assert_eq!(templates.len(), 1);
        assert!(templates.iter().all(|t| t.is_builtin));
    }

    #[test]
    fn test_merge_mode_replace() {
        let target = json!({"model": "sonnet", "extra": true});
        let source = json!({"model": "opus"});
        let result = apply_merge_mode(target, source.clone(), MergeMode::Replace);
        assert_eq!(result, source);
    }

    #[test]
    fn test_merge_mode_merge() {
        let target = json!({"model": "sonnet", "extra": true});
        let source = json!({"model": "opus", "new_key": "value"});
        let result = apply_merge_mode(target, source, MergeMode::Merge);
        assert_eq!(result["model"], "opus");
        assert_eq!(result["extra"], true);
        assert_eq!(result["new_key"], "value");
    }

    #[test]
    fn test_merge_mode_fill() {
        let target = json!({"model": "sonnet", "extra": true});
        let source = json!({"model": "opus", "new_key": "value"});
        let result = apply_merge_mode(target, source, MergeMode::Fill);
        assert_eq!(result["model"], "sonnet"); // kept
        assert_eq!(result["extra"], true);
        assert_eq!(result["new_key"], "value"); // filled
    }

    #[test]
    fn test_fill_missing_nested() {
        let target = json!({"permissions": {"allow": ["Read"]}});
        let source =
            json!({"permissions": {"allow": ["Write"], "deny": ["Bash"]}, "model": "opus"});
        let result = apply_merge_mode(target, source, MergeMode::Fill);
        // permissions.allow should keep target value
        assert_eq!(result["permissions"]["allow"][0], "Read");
        // permissions.deny should be filled from source
        assert_eq!(result["permissions"]["deny"][0], "Bash");
        // model should be filled
        assert_eq!(result["model"], "opus");
    }
}
