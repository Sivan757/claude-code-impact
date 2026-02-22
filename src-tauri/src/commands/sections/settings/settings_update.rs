// ============================================================================

const DEFAULT_ATTRIBUTION_FOOTER: &str =
    "Generated with [Claude Code](https://claude.com/claude-code)";
const DEFAULT_ATTRIBUTION_COAUTHOR: &str = "Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>";

fn normalize_attribution_setting(value: Value) -> Value {
    match value {
        Value::String(mode) => {
            let lower = mode.to_lowercase();
            if lower == "none" {
                serde_json::json!({ "commit": "", "pr": "" })
            } else if lower == "footer" {
                serde_json::json!({
                    "commit": DEFAULT_ATTRIBUTION_FOOTER,
                    "pr": DEFAULT_ATTRIBUTION_FOOTER
                })
            } else {
                serde_json::json!({
                    "commit": DEFAULT_ATTRIBUTION_COAUTHOR,
                    "pr": DEFAULT_ATTRIBUTION_FOOTER
                })
            }
        }
        other => other,
    }
}

fn normalize_permission_mode_value(value: Value) -> Result<Value, String> {
    let Some(mode) = value.as_str() else {
        return Err("permissions.defaultMode must be a string".to_string());
    };

    let normalized = match mode {
        "normal" => "default",
        "allowEdits" => "acceptEdits",
        "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan" => {
            mode
        }
        _ => {
            return Err(format!(
                "Invalid permissions.defaultMode '{}'. Expected one of: acceptEdits, bypassPermissions, default, delegate, dontAsk, plan",
                mode
            ));
        }
    };

    Ok(Value::String(normalized.to_string()))
}

#[tauri::command]
fn update_settings_field(field: String, value: Value, path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    let value = if field == "attribution" {
        normalize_attribution_setting(value)
    } else {
        value
    };

    if let Some(obj) = settings.as_object_mut() {
        obj.insert(field, value);
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_settings_permission_field(
    field: String,
    value: Value,
    path: Option<String>,
) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !settings
        .get("permissions")
        .and_then(|v| v.as_object())
        .is_some()
    {
        settings["permissions"] = serde_json::json!({});
    }
    let normalized_field = if field == "default_mode" {
        "defaultMode".to_string()
    } else {
        field
    };

    let normalized_value = if normalized_field == "defaultMode" {
        normalize_permission_mode_value(value)?
    } else {
        value
    };

    settings["permissions"][&normalized_field] = normalized_value;
    if let Some(permissions) = settings["permissions"].as_object_mut() {
        permissions.remove("default_mode");
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn add_permission_directory(path: String, settings_path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(settings_path);
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !settings
        .get("permissions")
        .and_then(|v| v.as_object())
        .is_some()
    {
        settings["permissions"] = serde_json::json!({});
    }

    let dirs = settings["permissions"]
        .get("additionalDirectories")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let path_val = Value::String(path.clone());
    if !dirs.contains(&path_val) {
        let mut new_dirs = dirs;
        new_dirs.push(path_val);
        settings["permissions"]["additionalDirectories"] = Value::Array(new_dirs);
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_permission_directory(path: String, settings_path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(settings_path);
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Ok(());
    };

    if let Some(dirs) = settings["permissions"]
        .get_mut("additionalDirectories")
        .and_then(|v| v.as_array_mut())
    {
        dirs.retain(|v| v.as_str() != Some(&path));
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_plugin(plugin_id: String, enabled: bool, path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !settings
        .get("enabledPlugins")
        .and_then(|v| v.as_object())
        .is_some()
    {
        settings["enabledPlugins"] = serde_json::json!({});
    }
    settings["enabledPlugins"][&plugin_id] = Value::Bool(enabled);

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}
