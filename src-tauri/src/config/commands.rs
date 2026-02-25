use crate::config::*;
use std::collections::HashMap;

/// Read a configuration file
#[tauri::command]
pub fn config_read(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<String>,
) -> Result<ConfigValue, String> {
    let path =
        resolve_config_path(kind, scope, project_path.as_deref()).map_err(|e| e.to_string())?;

    read_config_file(&path, kind).map_err(|e| e.to_string())
}

/// Read merged configuration view
#[tauri::command]
pub fn config_read_merged(project_path: Option<String>) -> Result<MergedConfigView, String> {
    build_merged_config(project_path.as_deref()).map_err(|e| e.to_string())
}

/// Write configuration value
#[tauri::command]
pub fn config_write(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<String>,
    key: Option<String>,
    value: serde_json::Value,
) -> Result<WriteResult, String> {
    let path =
        resolve_config_path(kind, scope, project_path.as_deref()).map_err(|e| e.to_string())?;

    if let Some(key_path) = key {
        // Parse dot-path and create nested structure
        let patch = create_nested_value(&key_path, value);
        merge_and_write(&path, kind, scope, &patch, true).map_err(|e| e.to_string())
    } else {
        // Write entire value
        write_config(&path, kind, scope, &value, true).map_err(|e| e.to_string())
    }
}

/// Convert a dot-path key and value into a nested JSON structure
/// Example: "permissions.default_mode" with value "ask" becomes:
/// { "permissions": { "default_mode": "ask" } }
fn create_nested_value(key_path: &str, value: serde_json::Value) -> serde_json::Value {
    let parts: Vec<&str> = key_path.split('.').collect();

    // Build nested structure from innermost to outermost
    let mut result = value;
    for part in parts.iter().rev() {
        let mut map = serde_json::Map::new();
        map.insert(part.to_string(), result);
        result = serde_json::Value::Object(map);
    }

    result
}

/// Write markdown content
#[tauri::command]
pub fn config_write_markdown(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<String>,
    content: String,
) -> Result<WriteResult, String> {
    let path =
        resolve_config_path(kind, scope, project_path.as_deref()).map_err(|e| e.to_string())?;

    write_markdown(&path, scope, &content, true).map_err(|e| e.to_string())
}

/// Delete a configuration key
#[tauri::command]
pub fn config_delete_key(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<String>,
    key: String,
) -> Result<WriteResult, String> {
    let path =
        resolve_config_path(kind, scope, project_path.as_deref()).map_err(|e| e.to_string())?;

    delete_key(&path, kind, scope, &key, true).map_err(|e| e.to_string())
}

/// Validate configuration value
#[tauri::command]
pub fn config_validate(
    kind: ConfigFileKind,
    value: serde_json::Value,
) -> Result<Vec<ValidationViolation>, String> {
    validate_config(kind, &value).map_err(|e| e.to_string())
}

/// Get all configuration file paths
#[tauri::command]
pub fn config_get_paths(project_path: Option<String>) -> Result<HashMap<String, String>, String> {
    let paths = get_all_config_paths(project_path.as_deref()).map_err(|e| e.to_string())?;

    let mut result = HashMap::new();
    for (scope, kind, path) in paths {
        let key = format!("{:?}_{:?}", scope, kind);
        result.insert(key, path.display().to_string());
    }

    Ok(result)
}

/// List backup files
#[tauri::command]
pub fn config_list_backups(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<String>,
) -> Result<Vec<BackupEntry>, String> {
    let path =
        resolve_config_path(kind, scope, project_path.as_deref()).map_err(|e| e.to_string())?;

    list_backups(&path).map_err(|e| e.to_string())
}

/// Restore from backup
#[tauri::command]
pub fn config_restore_backup(backup_path: String, target_path: String) -> Result<(), String> {
    restore_backup(
        std::path::Path::new(&backup_path),
        std::path::Path::new(&target_path),
    )
    .map_err(|e| e.to_string())
}

/// Initialize config watcher
#[tauri::command]
pub fn config_init_watcher(
    app: tauri::AppHandle,
    state: tauri::State<ConfigWatcherState>,
    project_path: Option<String>,
) -> Result<String, String> {
    // Check if watcher already exists for the same project path
    {
        let existing_project_path = state.project_path.lock().unwrap();
        if *existing_project_path == project_path {
            let watcher_guard = state.watcher.lock().unwrap();
            if watcher_guard.is_some() {
                return Ok("Watcher already initialized for this project".to_string());
            }
        }
    }

    // Create new watcher
    let watcher =
        ConfigWatcher::new(app.clone(), project_path.clone()).map_err(|e| e.to_string())?;

    // Store watcher in state so it doesn't get dropped
    let mut watcher_guard = state.watcher.lock().unwrap();
    *watcher_guard = Some(watcher);

    let mut project_path_guard = state.project_path.lock().unwrap();
    *project_path_guard = project_path;

    Ok("Watcher initialized and stored in app state".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_read_nonexistent() {
        let result = config_read(ConfigFileKind::Settings, ConfigScope::User, None);

        // Should return NotFound, not an error
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_nested_value() {
        let value = serde_json::json!("ask");
        let result = create_nested_value("permissions.default_mode", value);

        assert_eq!(
            result,
            serde_json::json!({
                "permissions": {
                    "default_mode": "ask"
                }
            })
        );
    }

    #[test]
    fn test_create_nested_value_deep() {
        let value = serde_json::json!(true);
        let result = create_nested_value("a.b.c.d", value);

        assert_eq!(
            result,
            serde_json::json!({
                "a": {
                    "b": {
                        "c": {
                            "d": true
                        }
                    }
                }
            })
        );
    }

    #[test]
    fn test_create_nested_value_single_key() {
        let value = serde_json::json!("opus");
        let result = create_nested_value("model", value);

        assert_eq!(
            result,
            serde_json::json!({
                "model": "opus"
            })
        );
    }
}
