// NOTE: This file is textually included via include!() in handlers.rs
// Additional imports specific to this module:
use crate::config::templates::{
    apply_merge_mode, delete_template, get_template, list_templates, save_from_project,
    save_template, ConfigTemplate, ExportedConfig, MergeMode, TemplateListEntry,
};
use crate::config::{
    build_merged_config, read_config_file, resolve_config_path, write_config, ConfigFileKind,
    ConfigScope, ConfigValue, MergedConfigView, WriteResult,
};

/// List all templates (built-in + custom)
#[tauri::command]
pub fn template_list() -> Result<Vec<TemplateListEntry>, String> {
    list_templates().map_err(|e| e.to_string())
}

/// Get a full template by ID
#[tauri::command]
pub fn template_get(id: String) -> Result<ConfigTemplate, String> {
    get_template(&id).map_err(|e| e.to_string())
}

/// Save a template
#[tauri::command]
pub fn template_save(template: ConfigTemplate) -> Result<(), String> {
    save_template(&template).map_err(|e| e.to_string())
}

/// Delete a template
#[tauri::command]
pub fn template_delete(id: String) -> Result<(), String> {
    delete_template(&id).map_err(|e| e.to_string())
}

/// Apply a template to a project
#[tauri::command]
pub fn template_apply(
    id: String,
    project_path: Option<String>,
    merge_mode: MergeMode,
) -> Result<WriteResult, String> {
    let template = get_template(&id).map_err(|e| e.to_string())?;

    // Determine target scope
    let scope = if project_path.is_some() {
        ConfigScope::Project
    } else {
        ConfigScope::User
    };

    // Read existing config
    let existing_path =
        resolve_config_path(ConfigFileKind::Settings, scope, project_path.as_deref())
            .map_err(|e| e.to_string())?;

    let existing = if existing_path.exists() {
        match read_config_file(&existing_path, ConfigFileKind::Settings)
            .map_err(|e| e.to_string())?
        {
            ConfigValue::Json { value } => value,
            _ => serde_json::json!({}),
        }
    } else {
        serde_json::json!({})
    };

    // Build the template's full config (merge config + env + hooks + mcp_servers)
    let mut template_config = template.config.clone();
    if let Some(obj) = template_config.as_object_mut() {
        if let Some(env) = &template.env {
            obj.insert(
                "env".to_string(),
                serde_json::to_value(env).unwrap_or_default(),
            );
        }
        if let Some(hooks) = &template.hooks {
            obj.insert(
                "hooks".to_string(),
                serde_json::to_value(hooks).unwrap_or_default(),
            );
        }
        if let Some(mcp_servers) = &template.mcp_servers {
            obj.insert(
                "mcp_servers".to_string(),
                serde_json::to_value(mcp_servers).unwrap_or_default(),
            );
        }
    }

    // Apply merge mode
    let merged = apply_merge_mode(existing, template_config, merge_mode);

    // Write the result
    write_config(&existing_path, ConfigFileKind::Settings, scope, &merged, true)
        .map_err(|e| e.to_string())
}

/// Save current project config as a template
#[tauri::command]
pub fn template_save_from_project(
    name: String,
    description: String,
    tags: Vec<String>,
    project_path: Option<String>,
) -> Result<ConfigTemplate, String> {
    save_from_project(&name, &description, tags, project_path.as_deref())
        .map_err(|e| e.to_string())
}

/// Batch read merged configs for multiple projects
#[tauri::command]
pub fn config_read_multi_merged(
    project_paths: Vec<String>,
) -> Result<HashMap<String, MergedConfigView>, String> {
    let mut results = HashMap::new();

    for path in project_paths {
        match build_merged_config(Some(&path)) {
            Ok(view) => {
                results.insert(path, view);
            }
            Err(e) => {
                // Include error as a minimal view with parse_errors
                results.insert(
                    path.clone(),
                    MergedConfigView {
                        effective: serde_json::json!({}),
                        provenance: HashMap::new(),
                        claude_md: crate::config::ClaudeMdView {
                            combined_content: String::new(),
                            sources: Vec::new(),
                        },
                        mcp_servers: crate::config::MergedMcpView {
                            servers: HashMap::new(),
                            sources: HashMap::new(),
                        },
                        parse_errors: vec![crate::config::ParseError {
                            scope: ConfigScope::Default,
                            file_path: path,
                            error: e.to_string(),
                        }],
                    },
                );
            }
        }
    }

    Ok(results)
}

/// Export configuration as a JSON bundle
#[tauri::command]
pub fn config_export(
    project_path: Option<String>,
    include_local: bool,
) -> Result<String, String> {
    let mut files: HashMap<String, serde_json::Value> = HashMap::new();

    // Determine scope based on project_path
    let scope = if project_path.is_some() {
        ConfigScope::Project
    } else {
        ConfigScope::User
    };

    // Read settings.json
    if let Ok(path) =
        resolve_config_path(ConfigFileKind::Settings, scope, project_path.as_deref())
    {
        if let Ok(ConfigValue::Json { value }) =
            read_config_file(&path, ConfigFileKind::Settings)
        {
            files.insert("settings.json".to_string(), value);
        }
    }

    // Optionally include local settings
    if include_local {
        let local_scope = if project_path.is_some() {
            ConfigScope::ProjectLocal
        } else {
            ConfigScope::UserLocal
        };
        if let Ok(path) = resolve_config_path(
            ConfigFileKind::SettingsLocal,
            local_scope,
            project_path.as_deref(),
        ) {
            if let Ok(ConfigValue::Json { value }) =
                read_config_file(&path, ConfigFileKind::SettingsLocal)
            {
                files.insert("settings.local.json".to_string(), value);
            }
        }
    }

    let export = ExportedConfig {
        version: 1,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        source_project: project_path,
        files,
    };

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

/// Import configuration from a JSON bundle
#[tauri::command]
pub fn config_import(
    config_json: String,
    target_project_path: Option<String>,
    merge_mode: MergeMode,
) -> Result<Vec<WriteResult>, String> {
    let export: ExportedConfig =
        serde_json::from_str(&config_json).map_err(|e| format!("Invalid export format: {}", e))?;

    let mut results = Vec::new();

    for (filename, value) in &export.files {
        let (kind, scope) = match filename.as_str() {
            "settings.json" => (
                ConfigFileKind::Settings,
                if target_project_path.is_some() {
                    ConfigScope::Project
                } else {
                    ConfigScope::User
                },
            ),
            "settings.local.json" => (
                ConfigFileKind::SettingsLocal,
                if target_project_path.is_some() {
                    ConfigScope::ProjectLocal
                } else {
                    ConfigScope::UserLocal
                },
            ),
            _ => continue,
        };

        let path =
            resolve_config_path(kind, scope, target_project_path.as_deref())
                .map_err(|e| e.to_string())?;

        // Read existing
        let existing = if path.exists() {
            match read_config_file(&path, kind) {
                Ok(ConfigValue::Json { value }) => value,
                _ => serde_json::json!({}),
            }
        } else {
            serde_json::json!({})
        };

        // Apply merge mode
        let merged = apply_merge_mode(existing, value.clone(), merge_mode);

        // Write
        let result = write_config(&path, kind, scope, &merged, true)
            .map_err(|e| e.to_string())?;
        results.push(result);
    }

    Ok(results)
}
