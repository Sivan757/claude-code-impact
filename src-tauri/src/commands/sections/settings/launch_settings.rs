// NOTE: This file is textually included via include!() in handlers.rs
// build_merged_config is already imported by templates.rs
// get_claudecodeimpact_dir is already imported below
use crate::infra::get_claudecodeimpact_dir;

#[derive(Debug, Deserialize)]
struct LaunchSettingsRequest {
    project_path: Option<String>,
    provider_name: Option<String>,
    model: Option<String>,
    env_overrides: Option<HashMap<String, String>>,
    enabled_plugins: Option<Vec<String>>,
    template_id: Option<String>,
    template_merge_mode: Option<MergeMode>,
    template_payload: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct LaunchDraftResponse {
    draft_project_path: String,
    settings_path: String,
    settings: serde_json::Value,
}

fn normalize_launch_permission_mode(value: &str) -> Option<String> {
    match value {
        "normal" => Some("default".to_string()),
        "allowEdits" => Some("acceptEdits".to_string()),
        "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan" => {
            Some(value.to_string())
        }
        _ => None,
    }
}

fn normalize_permissions_for_snapshot(settings_obj: &mut serde_json::Map<String, serde_json::Value>) {
    let Some(permissions) = settings_obj
        .get_mut("permissions")
        .and_then(|value| value.as_object_mut())
    else {
        return;
    };

    let raw_mode = permissions
        .get("defaultMode")
        .and_then(|value| value.as_str())
        .or_else(|| {
            permissions
                .get("default_mode")
                .and_then(|value| value.as_str())
        });

    if let Some(mode) = raw_mode {
        let normalized_mode =
            normalize_launch_permission_mode(mode).unwrap_or_else(|| "default".to_string());
        permissions.insert(
            "defaultMode".to_string(),
            serde_json::Value::String(normalized_mode),
        );
    }

    permissions.remove("default_mode");
}

fn build_launch_settings_snapshot(request: &LaunchSettingsRequest) -> Result<serde_json::Value, String> {
    // 1. Read merged config for the project (or global if no project_path)
    let merged = build_merged_config(request.project_path.as_deref())
        .map_err(|e| format!("Failed to read merged config: {}", e))?;

    let mut settings = merged.effective;

    if !settings.is_object() {
        settings = serde_json::json!({});
    }

    // 1.5 Apply selected template or inline template payload into the launch snapshot.
    // This is ephemeral and does not modify project/global settings files.
    let merge_mode = request.template_merge_mode.unwrap_or(MergeMode::Merge);
    let inline_template = request.template_payload.clone();
    let template_to_merge = if let Some(payload) = inline_template {
        Some(payload)
    } else if let Some(template_id) = request.template_id.as_deref() {
        let template = get_template(template_id)
            .map_err(|e| format!("Failed to load template '{}': {}", template_id, e))?;

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
        Some(template_config)
    } else {
        None
    };

    if let Some(template_value) = template_to_merge {
        settings = apply_merge_mode(settings, template_value, merge_mode);
        if !settings.is_object() {
            settings = serde_json::json!({});
        }
    }

    if let Some(obj) = settings.as_object_mut() {
        // Remove internal keys that should not leak into the launch settings file
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");
        normalize_permissions_for_snapshot(obj);

        // 2. Apply model override
        if let Some(model) = &request.model {
            obj.insert("model".to_string(), serde_json::Value::String(model.clone()));
        }

        // 3. Apply provider name override
        if let Some(provider_name) = &request.provider_name {
            let mut cci_obj = obj
                .get("claudecodeimpact")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            cci_obj.insert(
                "activeProvider".to_string(),
                serde_json::Value::String(provider_name.clone()),
            );
            obj.insert("claudecodeimpact".to_string(), serde_json::Value::Object(cci_obj));
        }

        // 4. Apply env overrides
        if let Some(env_overrides) = &request.env_overrides {
            let mut env_obj = obj
                .get("env")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            for (key, value) in env_overrides {
                env_obj.insert(key.clone(), serde_json::Value::String(value.clone()));
            }

            obj.insert("env".to_string(), serde_json::Value::Object(env_obj));
        }

        // 5. Apply enabled plugins override
        if let Some(enabled_plugins) = &request.enabled_plugins {
            let mut plugins_obj = serde_json::Map::new();
            for plugin_id in enabled_plugins {
                plugins_obj.insert(plugin_id.clone(), serde_json::Value::Bool(true));
            }
            obj.insert("enabledPlugins".to_string(), serde_json::Value::Object(plugins_obj));
        }
    }

    Ok(settings)
}

/// Create a session-specific launch settings file.
///
/// Reads the merged config for the given project, applies optional overrides,
/// and writes the result to `~/.claudecodeimpact/claudecodeimpact/launch-settings/settings-{uuid}.json`.
/// Returns the absolute file path so the frontend can pass `--settings "<path>"` to claude.
#[tauri::command]
fn create_launch_settings(request: LaunchSettingsRequest) -> Result<String, String> {
    let settings = build_launch_settings_snapshot(&request)?;

    // 6. Write to launch-settings directory
    let launch_dir = get_claudecodeimpact_dir().join("launch-settings");
    fs::create_dir_all(&launch_dir)
        .map_err(|e| format!("Failed to create launch-settings directory: {}", e))?;

    let id = uuid::Uuid::new_v4();
    let filename = format!("settings-{}.json", id);
    let file_path = launch_dir.join(&filename);

    let output = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize launch settings: {}", e))?;

    fs::write(&file_path, output)
        .map_err(|e| format!("Failed to write launch settings file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Prepare a writable draft project containing `.claude/settings.json`.
///
/// The draft lives under `~/.claudecodeimpact/launch-drafts/<uuid>/` and is intended
/// for temporary in-dialog editing. It does not modify real project/global config files.
#[tauri::command]
fn prepare_launch_draft(request: LaunchSettingsRequest) -> Result<LaunchDraftResponse, String> {
    let settings = build_launch_settings_snapshot(&request)?;

    let drafts_root = get_claudecodeimpact_dir().join("launch-drafts");
    fs::create_dir_all(&drafts_root)
        .map_err(|e| format!("Failed to create launch-drafts directory: {}", e))?;

    let draft_id = uuid::Uuid::new_v4().to_string();
    let draft_project_path = drafts_root.join(draft_id);
    let settings_path = draft_project_path.join(".claude").join("settings.json");

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create draft settings directory: {}", e))?;
    }

    let output = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize launch draft settings: {}", e))?;
    fs::write(&settings_path, output)
        .map_err(|e| format!("Failed to write launch draft settings file: {}", e))?;

    Ok(LaunchDraftResponse {
        draft_project_path: draft_project_path.to_string_lossy().to_string(),
        settings_path: settings_path.to_string_lossy().to_string(),
        settings,
    })
}

/// Remove launch settings files older than 24 hours.
#[tauri::command]
fn cleanup_launch_settings() -> Result<u32, String> {
    let launch_dir = get_claudecodeimpact_dir().join("launch-settings");
    let drafts_dir = get_claudecodeimpact_dir().join("launch-drafts");

    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(24 * 60 * 60))
        .unwrap_or(SystemTime::UNIX_EPOCH);

    let mut removed: u32 = 0;

    if launch_dir.exists() {
        let entries = fs::read_dir(&launch_dir)
            .map_err(|e| format!("Failed to read launch-settings directory: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();

            // Only clean up settings-*.json files
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !name.starts_with("settings-") || !name.ends_with(".json") {
                    continue;
                }
            } else {
                continue;
            }

            if let Ok(metadata) = fs::metadata(&path) {
                let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                if modified < cutoff {
                    if fs::remove_file(&path).is_ok() {
                        removed += 1;
                    }
                }
            }
        }
    }

    if drafts_dir.exists() {
        let entries = fs::read_dir(&drafts_dir)
            .map_err(|e| format!("Failed to read launch-drafts directory: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let settings_path = path.join(".claude").join("settings.json");
            let modified = fs::metadata(&settings_path)
                .and_then(|meta| meta.modified())
                .or_else(|_| fs::metadata(&path).and_then(|meta| meta.modified()))
                .unwrap_or(SystemTime::UNIX_EPOCH);

            if modified < cutoff {
                if fs::remove_dir_all(&path).is_ok() {
                    removed += 1;
                }
            }
        }
    }

    Ok(removed)
}
