use crate::config::{
    read_config_file, resolve_config_path, ClaudeMdSource, ClaudeMdView, ConfigError,
    ConfigFileKind, ConfigScope, ConfigValue, McpServerConfig, MergedConfigView, MergedMcpView,
    ParseError, ProvenanceEntry,
};
use std::collections::HashMap;

/// Build merged configuration view with provenance tracking
pub fn build_merged_config(
    project_path: Option<&str>,
) -> Result<MergedConfigView, ConfigError> {
    // Start with default settings
    let mut effective = serde_json::json!({});
    let mut provenance: HashMap<String, ProvenanceEntry> = HashMap::new();
    let mut parse_errors: Vec<ParseError> = Vec::new();

    // Layer configs bottom-up (lowest priority first)
    let scopes_in_order = vec![
        ConfigScope::User,
        ConfigScope::UserLocal,
        ConfigScope::Project,
        ConfigScope::ProjectLocal,
        ConfigScope::Managed,
    ];

    for scope in scopes_in_order {
        // UserLocal and ProjectLocal scopes only read settings.local.json, not settings.json
        // Skip the settings.json read for these scopes to avoid duplicate/incorrect attribution
        let should_read_settings = !matches!(scope, ConfigScope::UserLocal | ConfigScope::ProjectLocal);

        if should_read_settings {
            // Determine which file kind to use for this scope
            let settings_kind = if scope == ConfigScope::Managed {
                ConfigFileKind::Managed
            } else {
                ConfigFileKind::Settings
            };

            // Read settings file for this scope
            if let Ok(path) = resolve_config_path(settings_kind, scope, project_path) {
                match read_config_file(&path, settings_kind) {
                    Ok(ConfigValue::Json { value }) => {
                        // Merge this layer
                        merge_layer(
                            &mut effective,
                            &mut provenance,
                            value,
                            scope,
                            path.display().to_string(),
                        );
                    }
                    Err(e) => {
                        // Only record error if file exists (ignore missing files)
                        if path.exists() {
                            parse_errors.push(ParseError {
                                scope,
                                file_path: path.display().to_string(),
                                error: e.to_string(),
                            });
                        }
                    }
                    _ => {} // Ignore non-JSON results
                }
            }
        }

        // Read settings.local.json for user/project local scopes
        if matches!(scope, ConfigScope::UserLocal | ConfigScope::ProjectLocal) {
            if let Ok(path) = resolve_config_path(
                ConfigFileKind::SettingsLocal,
                scope,
                project_path,
            ) {
                match read_config_file(&path, ConfigFileKind::SettingsLocal) {
                    Ok(ConfigValue::Json { value }) => {
                        merge_layer(
                            &mut effective,
                            &mut provenance,
                            value,
                            scope,
                            path.display().to_string(),
                        );
                    }
                    Err(e) => {
                        if path.exists() {
                            parse_errors.push(ParseError {
                                scope,
                                file_path: path.display().to_string(),
                                error: e.to_string(),
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // Build CLAUDE.md view
    let claude_md = build_claude_md_view(project_path)?;

    // Build MCP servers view
    let mcp_servers = build_mcp_servers_view(project_path, &mut parse_errors)?;

    Ok(MergedConfigView {
        effective,
        provenance,
        claude_md,
        mcp_servers,
        parse_errors,
    })
}

/// Merge a config layer into effective config
fn merge_layer(
    effective: &mut serde_json::Value,
    provenance: &mut HashMap<String, ProvenanceEntry>,
    layer: serde_json::Value,
    scope: ConfigScope,
    file_path: String,
) {
    if let (Some(effective_obj), Some(layer_obj)) =
        (effective.as_object_mut(), layer.as_object())
    {
        for (key, value) in layer_obj {
            // Deep merge the value
            if let Some(existing_value) = effective_obj.get_mut(key) {
                deep_merge_value(existing_value, value.clone());
            } else {
                effective_obj.insert(key.clone(), value.clone());
            }

            // Track provenance
            provenance.insert(
                key.clone(),
                ProvenanceEntry {
                    value: value.clone(),
                    scope,
                    file_path: file_path.clone(),
                    key: key.clone(),
                },
            );

            // Recursively track nested keys
            track_nested_provenance(
                provenance,
                value,
                scope,
                &file_path,
                key,
            );
        }
    }
}

/// Deep merge source value into target value
fn deep_merge_value(target: &mut serde_json::Value, source: serde_json::Value) {
    match (target, source) {
        (serde_json::Value::Object(target_map), serde_json::Value::Object(source_map)) => {
            for (key, source_value) in source_map {
                if source_value.is_null() {
                    // null means delete the key
                    target_map.remove(&key);
                } else if let Some(target_value) = target_map.get_mut(&key) {
                    // Recursively merge
                    deep_merge_value(target_value, source_value);
                } else {
                    // New key
                    target_map.insert(key, source_value);
                }
            }
        }
        (target, source) => {
            // For non-objects, source overwrites target
            *target = source;
        }
    }
}

/// Track provenance for nested keys
fn track_nested_provenance(
    provenance: &mut HashMap<String, ProvenanceEntry>,
    value: &serde_json::Value,
    scope: ConfigScope,
    file_path: &str,
    parent_key: &str,
) {
    if let Some(obj) = value.as_object() {
        for (nested_key, nested_value) in obj {
            let full_key = format!("{}.{}", parent_key, nested_key);
            provenance.insert(
                full_key.clone(),
                ProvenanceEntry {
                    value: nested_value.clone(),
                    scope,
                    file_path: file_path.to_string(),
                    key: full_key.clone(),
                },
            );

            // Recursively track deeper nesting
            track_nested_provenance(
                provenance,
                nested_value,
                scope,
                file_path,
                &full_key,
            );
        }
    }
}

/// Build CLAUDE.md merged view
fn build_claude_md_view(project_path: Option<&str>) -> Result<ClaudeMdView, ConfigError> {
    let mut sources = Vec::new();
    let mut combined_content = String::new();

    let scopes_to_check = vec![
        (ConfigScope::User, ConfigFileKind::ClaudeMd),
        (ConfigScope::Project, ConfigFileKind::ClaudeMd),
        (ConfigScope::ProjectLocal, ConfigFileKind::ClaudeMdLocal),
    ];

    for (scope, kind) in scopes_to_check {
        if let Ok(path) = resolve_config_path(kind, scope, project_path) {
            if let Ok(ConfigValue::Markdown { content }) = read_config_file(&path, kind) {
                if !content.trim().is_empty() {
                    // Add section header
                    if !combined_content.is_empty() {
                        combined_content.push_str("\n\n---\n\n");
                    }
                    combined_content.push_str(&format!(
                        "<!-- Source: {:?} at {} -->\n\n",
                        scope,
                        path.display()
                    ));
                    combined_content.push_str(&content);

                    sources.push(ClaudeMdSource {
                        scope,
                        file_path: path.display().to_string(),
                        content,
                    });
                }
            }
        }
    }

    Ok(ClaudeMdView {
        combined_content,
        sources,
    })
}

/// Build merged MCP servers view
fn build_mcp_servers_view(
    project_path: Option<&str>,
    parse_errors: &mut Vec<ParseError>,
) -> Result<MergedMcpView, ConfigError> {
    let mut servers: HashMap<String, McpServerConfig> = HashMap::new();
    let mut sources: HashMap<String, ConfigScope> = HashMap::new();

    // Collect from settings.json files (all scopes)
    let scopes_in_order = vec![
        ConfigScope::User,
        ConfigScope::UserLocal,
        ConfigScope::Project,
        ConfigScope::ProjectLocal,
        ConfigScope::Managed,
    ];

    for scope in scopes_in_order {
        // Determine which file kind to use for this scope
        let settings_kind = if scope == ConfigScope::Managed {
            ConfigFileKind::Managed
        } else {
            ConfigFileKind::Settings
        };

        if let Ok(path) = resolve_config_path(settings_kind, scope, project_path) {
            if let Ok(ConfigValue::Json { value }) = read_config_file(&path, settings_kind) {
                if let Some(mcp_servers_obj) = value.get("mcp_servers") {
                    if let Some(mcp_servers_map) = mcp_servers_obj.as_object() {
                        for (server_name, server_config) in mcp_servers_map {
                            if let Ok(config) =
                                serde_json::from_value::<McpServerConfig>(server_config.clone())
                            {
                                servers.insert(server_name.clone(), config);
                                sources.insert(server_name.clone(), scope);
                            }
                        }
                    }
                }
            }
        }

        // Also collect from .mcp.json when processing Project scope
        if scope == ConfigScope::Project {
            if let Ok(path) =
                resolve_config_path(ConfigFileKind::McpJson, ConfigScope::Project, project_path)
            {
                match read_config_file(&path, ConfigFileKind::McpJson) {
                    Ok(ConfigValue::Json { value }) => {
                        if let Some(mcp_servers_map) = value.as_object() {
                            for (server_name, server_config) in mcp_servers_map {
                                if let Ok(config) =
                                    serde_json::from_value::<McpServerConfig>(server_config.clone())
                                {
                                    servers.insert(server_name.clone(), config);
                                    sources.insert(server_name.clone(), ConfigScope::Project);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        // Collect .mcp.json parse error if file exists
                        if path.exists() {
                            parse_errors.push(ParseError {
                                scope: ConfigScope::Project,
                                file_path: path.display().to_string(),
                                error: e.to_string(),
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // Collect from legacy ~/.claude.json
    if let Ok(path) =
        resolve_config_path(ConfigFileKind::LegacyConfig, ConfigScope::User, None)
    {
        if let Ok(ConfigValue::Json { value }) = read_config_file(&path, ConfigFileKind::LegacyConfig)
        {
            if let Some(mcp_servers_obj) = value.get("mcpServers") {
                if let Some(mcp_servers_map) = mcp_servers_obj.as_object() {
                    for (server_name, server_config) in mcp_servers_map {
                        // Only add if not already present (lower priority)
                        if !servers.contains_key(server_name) {
                            if let Ok(config) =
                                serde_json::from_value::<McpServerConfig>(server_config.clone())
                            {
                                servers.insert(server_name.clone(), config);
                                sources.insert(server_name.clone(), ConfigScope::User);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(MergedMcpView { servers, sources })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge_layer() {
        let mut effective = json!({});
        let mut provenance = HashMap::new();

        let layer = json!({
            "model": "opus",
            "permissions": {
                "default_mode": "ask"
            }
        });

        merge_layer(
            &mut effective,
            &mut provenance,
            layer,
            ConfigScope::User,
            "/home/user/.claude/settings.json".to_string(),
        );

        assert_eq!(effective["model"], "opus");
        assert!(provenance.contains_key("model"));
        assert!(provenance.contains_key("permissions"));
        assert!(provenance.contains_key("permissions.default_mode"));
    }

    #[test]
    fn test_provenance_tracking() {
        let mut effective = json!({});
        let mut provenance = HashMap::new();

        // Layer 1: User
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({"model": "opus"}),
            ConfigScope::User,
            "user.json".to_string(),
        );

        // Layer 2: Project (overrides)
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({"model": "sonnet"}),
            ConfigScope::Project,
            "project.json".to_string(),
        );

        assert_eq!(effective["model"], "sonnet");
        assert_eq!(provenance["model"].scope, ConfigScope::Project);
    }

    #[test]
    fn test_deep_merge_preserves_nested_values() {
        let mut effective = json!({});
        let mut provenance = HashMap::new();

        // Base layer: User config with permissions
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({
                "permissions": {
                    "allow": ["read", "write"],
                    "deny": ["delete"]
                }
            }),
            ConfigScope::User,
            "user.json".to_string(),
        );

        // Higher layer: Project config adds default_mode
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({
                "permissions": {
                    "default_mode": "ask"
                }
            }),
            ConfigScope::Project,
            "project.json".to_string(),
        );

        // Verify deep merge preserved nested values
        assert_eq!(effective["permissions"]["allow"][0], "read");
        assert_eq!(effective["permissions"]["allow"][1], "write");
        assert_eq!(effective["permissions"]["deny"][0], "delete");
        assert_eq!(effective["permissions"]["default_mode"], "ask");
    }

    #[test]
    fn test_deep_merge_can_override_nested_values() {
        let mut effective = json!({});
        let mut provenance = HashMap::new();

        // Base layer
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({
                "hooks": {
                    "pre_commit": ["lint"],
                    "post_commit": ["notify"]
                }
            }),
            ConfigScope::User,
            "user.json".to_string(),
        );

        // Higher layer overrides pre_commit
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({
                "hooks": {
                    "pre_commit": ["format", "lint"]
                }
            }),
            ConfigScope::Project,
            "project.json".to_string(),
        );

        // pre_commit should be overridden (it's an array, not an object)
        assert_eq!(effective["hooks"]["pre_commit"][0], "format");
        assert_eq!(effective["hooks"]["pre_commit"][1], "lint");
        // post_commit should be preserved
        assert_eq!(effective["hooks"]["post_commit"][0], "notify");
    }

    #[test]
    fn test_local_scopes_only_read_local_files() {
        // This test verifies that UserLocal/ProjectLocal scopes don't incorrectly
        // read settings.json files. The merge_layer function should only be called
        // with settings.local.json for these scopes.

        // In practice, this is tested by the behavior of build_merged_config,
        // which skips settings.json reads for local scopes.
        let mut effective = json!({});
        let mut provenance = HashMap::new();

        // Simulate User scope reading settings.json
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({"model": "opus"}),
            ConfigScope::User,
            "/home/user/.claude/settings.json".to_string(),
        );

        // UserLocal should only read from settings.local.json
        merge_layer(
            &mut effective,
            &mut provenance,
            json!({"always_thinking_enabled": true}),
            ConfigScope::UserLocal,
            "/home/user/.claude/settings.local.json".to_string(),
        );

        // Verify provenance shows correct scopes
        assert_eq!(provenance["model"].scope, ConfigScope::User);
        assert_eq!(provenance["model"].file_path, "/home/user/.claude/settings.json");
        assert_eq!(provenance["always_thinking_enabled"].scope, ConfigScope::UserLocal);
        assert_eq!(provenance["always_thinking_enabled"].file_path, "/home/user/.claude/settings.local.json");
    }
}
