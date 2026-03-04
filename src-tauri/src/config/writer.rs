use crate::config::{
    ensure_parent_dir, read_config_file, validate_config, ConfigError, ConfigFileKind, ConfigScope,
    ConfigValue, WriteResult,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Write configuration with atomic operation and backup
pub fn write_config(
    path: &Path,
    kind: ConfigFileKind,
    scope: ConfigScope,
    value: &serde_json::Value,
    create_backup: bool,
) -> Result<WriteResult, ConfigError> {
    // Check if scope is writable
    if !scope.is_writable() {
        return Err(ConfigError::ReadOnly {
            scope: format!("{:?}", scope),
            reason: "This scope cannot be modified".to_string(),
        });
    }

    // Validate before writing
    let violations = validate_config(kind, value)?;
    let has_errors = violations
        .iter()
        .any(|v| v.severity == crate::config::ViolationSeverity::Error);
    if has_errors {
        return Err(ConfigError::ValidationError { violations });
    }

    // Read existing content
    let before = if path.exists() {
        match read_config_file(path, kind)? {
            ConfigValue::Json { value } => Some(value),
            _ => None,
        }
    } else {
        None
    };

    // settings.json is edited frequently from UI controls; suppress automatic
    // timestamped backups to avoid generating a new backup on every small change.
    let create_backup = create_backup && kind != ConfigFileKind::Settings;

    // Create backup if requested and file exists
    let backup_path = if create_backup && path.exists() {
        Some(create_backup_file(path)?)
    } else {
        None
    };

    // Ensure parent directory exists
    ensure_parent_dir(path)?;

    // Write to temporary file first
    let temp_path = get_temp_path(path);
    write_to_file(&temp_path, value)?;

    // Atomic rename
    fs::rename(&temp_path, path).map_err(|e| ConfigError::WriteFailed {
        path: path.display().to_string(),
        backup: backup_path.clone().map(|p| p.display().to_string()),
        message: format!("Failed to rename temp file: {}", e),
    })?;

    // Emit config changed event (will be handled by watcher)

    Ok(WriteResult {
        path: path.display().to_string(),
        before,
        after: value.clone(),
        backup_path: backup_path.map(|p| p.display().to_string()),
    })
}

/// Write markdown content
pub fn write_markdown(
    path: &Path,
    scope: ConfigScope,
    content: &str,
    create_backup: bool,
) -> Result<WriteResult, ConfigError> {
    // Check if scope is writable
    if !scope.is_writable() {
        return Err(ConfigError::ReadOnly {
            scope: format!("{:?}", scope),
            reason: "This scope cannot be modified".to_string(),
        });
    }

    // Read existing content
    let before = if path.exists() {
        fs::read_to_string(path).ok()
    } else {
        None
    };

    // Create backup if requested and file exists
    let backup_path = if create_backup && path.exists() {
        Some(create_backup_file(path)?)
    } else {
        None
    };

    // Ensure parent directory exists
    ensure_parent_dir(path)?;

    // Write to temporary file first
    let temp_path = get_temp_path(path);
    fs::write(&temp_path, content).map_err(|e| ConfigError::IoError {
        message: format!("Failed to write temp file: {}", e),
    })?;

    // Atomic rename
    fs::rename(&temp_path, path).map_err(|e| ConfigError::WriteFailed {
        path: path.display().to_string(),
        backup: backup_path.clone().map(|p| p.display().to_string()),
        message: format!("Failed to rename temp file: {}", e),
    })?;

    Ok(WriteResult {
        path: path.display().to_string(),
        before: before.map(|s| serde_json::Value::String(s)),
        after: serde_json::Value::String(content.to_string()),
        backup_path: backup_path.map(|p| p.display().to_string()),
    })
}

/// Deep merge patch into existing configuration
pub fn merge_and_write(
    path: &Path,
    kind: ConfigFileKind,
    scope: ConfigScope,
    patch: &serde_json::Value,
    create_backup: bool,
) -> Result<WriteResult, ConfigError> {
    // Read existing config
    let existing = if path.exists() {
        match read_config_file(path, kind)? {
            ConfigValue::Json { value } => value,
            _ => serde_json::Value::Object(serde_json::Map::new()),
        }
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    // Deep merge
    let merged = deep_merge(existing, patch.clone());

    // Write merged result
    write_config(path, kind, scope, &merged, create_backup)
}

/// Deep merge two JSON values
fn deep_merge(base: serde_json::Value, patch: serde_json::Value) -> serde_json::Value {
    match (base, patch) {
        (serde_json::Value::Object(mut base_map), serde_json::Value::Object(patch_map)) => {
            for (key, patch_value) in patch_map {
                if patch_value.is_null() {
                    // null means delete the key
                    base_map.remove(&key);
                } else if let Some(base_value) = base_map.get(&key).cloned() {
                    // Recursively merge
                    base_map.insert(key, deep_merge(base_value, patch_value));
                } else {
                    // New key
                    base_map.insert(key, patch_value);
                }
            }
            serde_json::Value::Object(base_map)
        }
        (_, patch) => patch, // For non-objects, patch overwrites
    }
}

/// Delete a key from configuration
/// Supports dot-paths for nested keys (e.g., "permissions.default_mode")
pub fn delete_key(
    path: &Path,
    kind: ConfigFileKind,
    scope: ConfigScope,
    key: &str,
    create_backup: bool,
) -> Result<WriteResult, ConfigError> {
    // Create nested structure with null value for deletion
    let patch = create_nested_value_for_delete(key);
    merge_and_write(path, kind, scope, &patch, create_backup)
}

/// Convert a dot-path key into a nested JSON structure with null leaf
/// Example: "permissions.default_mode" becomes:
/// { "permissions": { "default_mode": null } }
fn create_nested_value_for_delete(key_path: &str) -> serde_json::Value {
    let parts: Vec<&str> = key_path.split('.').collect();

    // Build nested structure from innermost to outermost
    let mut result = serde_json::Value::Null;
    for part in parts.iter().rev() {
        let mut map = serde_json::Map::new();
        map.insert(part.to_string(), result);
        result = serde_json::Value::Object(map);
    }

    result
}

/// Create backup file with timestamp
fn create_backup_file(path: &Path) -> Result<PathBuf, ConfigError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    // Append .backup.{timestamp} to the full filename instead of replacing extension
    let filename = path.file_name().ok_or_else(|| ConfigError::Other {
        message: "Path has no filename".to_string(),
    })?;
    let backup_filename = format!("{}.backup.{}", filename.to_string_lossy(), timestamp);
    let backup_path = path.with_file_name(backup_filename);

    fs::copy(path, &backup_path).map_err(|e| ConfigError::IoError {
        message: format!("Failed to create backup: {}", e),
    })?;

    Ok(backup_path)
}

/// Get temporary file path
fn get_temp_path(path: &Path) -> PathBuf {
    path.with_extension("tmp")
}

/// Write JSON to file
fn write_to_file(path: &Path, value: &serde_json::Value) -> Result<(), ConfigError> {
    let content = serde_json::to_string_pretty(value).map_err(|e| ConfigError::IoError {
        message: format!("Failed to serialize JSON: {}", e),
    })?;

    fs::write(path, content).map_err(|e| ConfigError::IoError {
        message: format!("Failed to write file: {}", e),
    })?;

    Ok(())
}

/// List backup files for a config path
pub fn list_backups(path: &Path) -> Result<Vec<crate::config::BackupEntry>, ConfigError> {
    let parent = path.parent().ok_or_else(|| ConfigError::Other {
        message: "Path has no parent directory".to_string(),
    })?;

    let filename = path.file_name().ok_or_else(|| ConfigError::Other {
        message: "Path has no filename".to_string(),
    })?;

    let filename_str = filename.to_string_lossy();
    let mut backups = Vec::new();

    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let entry_name = entry_path.file_name().unwrap().to_string_lossy();

            if entry_name.starts_with(&*filename_str) && entry_name.contains(".backup.") {
                if let Ok(metadata) = entry.metadata() {
                    // Extract timestamp from filename
                    if let Some(timestamp_str) = entry_name.split(".backup.").nth(1) {
                        if let Ok(timestamp) = timestamp_str.parse::<u64>() {
                            backups.push(crate::config::BackupEntry {
                                path: entry_path.display().to_string(),
                                timestamp,
                                size: metadata.len(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp descending (newest first)
    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(backups)
}

/// Restore from backup
pub fn restore_backup(backup_path: &Path, target_path: &Path) -> Result<(), ConfigError> {
    fs::copy(backup_path, target_path).map_err(|e| ConfigError::IoError {
        message: format!("Failed to restore backup: {}", e),
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    #[test]
    fn test_write_and_backup() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.local.json");

        // Initial write
        let value1 = json!({"model": "opus"});
        write_config(
            &config_path,
            ConfigFileKind::SettingsLocal,
            ConfigScope::User,
            &value1,
            false,
        )
        .unwrap();

        assert!(config_path.exists());

        // Second write with backup
        let value2 = json!({"model": "sonnet"});
        let result = write_config(
            &config_path,
            ConfigFileKind::SettingsLocal,
            ConfigScope::User,
            &value2,
            true,
        )
        .unwrap();

        assert!(result.backup_path.is_some());
    }

    #[test]
    fn test_settings_write_skips_auto_backup() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        // Initial write
        let value1 = json!({"model": "opus"});
        write_config(
            &config_path,
            ConfigFileKind::Settings,
            ConfigScope::User,
            &value1,
            false,
        )
        .unwrap();

        // Follow-up write still should not create a backup for settings.json
        let value2 = json!({"model": "sonnet"});
        let result = write_config(
            &config_path,
            ConfigFileKind::Settings,
            ConfigScope::User,
            &value2,
            true,
        )
        .unwrap();

        assert!(result.backup_path.is_none());
    }

    #[test]
    fn test_deep_merge() {
        let base = json!({
            "a": 1,
            "b": {"c": 2, "d": 3}
        });

        let patch = json!({
            "b": {"c": 20, "e": 4},
            "f": 5
        });

        let merged = deep_merge(base, patch);

        assert_eq!(merged["a"], 1);
        assert_eq!(merged["b"]["c"], 20);
        assert_eq!(merged["b"]["d"], 3);
        assert_eq!(merged["b"]["e"], 4);
        assert_eq!(merged["f"], 5);
    }

    #[test]
    fn test_delete_key_with_null() {
        let base = json!({"a": 1, "b": 2});
        let patch = json!({"a": null});

        let merged = deep_merge(base, patch);

        assert_eq!(merged.as_object().unwrap().len(), 1);
        assert_eq!(merged["b"], 2);
    }

    #[test]
    fn test_readonly_scope_rejected() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let value = json!({"model": "opus"});
        let result = write_config(
            &config_path,
            ConfigFileKind::Settings,
            ConfigScope::Managed,
            &value,
            false,
        );

        assert!(matches!(result, Err(ConfigError::ReadOnly { .. })));
    }

    #[test]
    fn test_create_nested_value_for_delete() {
        let result = create_nested_value_for_delete("permissions.default_mode");
        assert_eq!(
            result,
            json!({
                "permissions": {
                    "default_mode": null
                }
            })
        );
    }

    #[test]
    fn test_create_nested_value_for_delete_deep() {
        let result = create_nested_value_for_delete("a.b.c.d");
        assert_eq!(
            result,
            json!({
                "a": {
                    "b": {
                        "c": {
                            "d": null
                        }
                    }
                }
            })
        );
    }

    #[test]
    fn test_create_nested_value_for_delete_single_key() {
        let result = create_nested_value_for_delete("model");
        assert_eq!(
            result,
            json!({
                "model": null
            })
        );
    }
}
