// NOTE: This file is textually included via include!() in handlers.rs
// build_merged_config is already imported by templates.rs
// get_claudecodeimpact_dir is already imported in handlers.rs

const LAUNCH_DRAFT_RETENTION_DEFAULT_SECS: u64 = 24 * 60 * 60;
const LAUNCH_DRAFT_RETENTION_MIN_SECS: u64 = 60 * 60;
const LAUNCH_DRAFT_RETENTION_MAX_SECS: u64 = 30 * 24 * 60 * 60;

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

#[derive(Debug, Deserialize)]
struct MaterializeLaunchDraftRequest {
    settings: serde_json::Value,
    draft_id: Option<String>,
    retention_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
struct LaunchSnapshotResponse {
    settings: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct MaterializedLaunchDraftResponse {
    draft_id: String,
    project_path: String,
    settings_path: String,
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

fn resolve_launch_draft_retention_secs(retention_secs: Option<u64>) -> u64 {
    retention_secs
        .unwrap_or(LAUNCH_DRAFT_RETENTION_DEFAULT_SECS)
        .clamp(
            LAUNCH_DRAFT_RETENTION_MIN_SECS,
            LAUNCH_DRAFT_RETENTION_MAX_SECS,
        )
}

fn launch_runtime_drafts_root() -> PathBuf {
    get_claudecodeimpact_dir().join("runtime").join("launch-drafts")
}

fn legacy_launch_drafts_root() -> PathBuf {
    get_claudecodeimpact_dir().join("launch-drafts")
}

fn legacy_launch_settings_root() -> PathBuf {
    get_claudecodeimpact_dir().join("launch-settings")
}

fn normalize_launch_draft_id(draft_id: Option<String>) -> Result<String, String> {
    match draft_id {
        Some(candidate) => {
            let trimmed = candidate.trim();
            if trimmed.is_empty() {
                return Err("Draft id cannot be empty".to_string());
            }
            let parsed = uuid::Uuid::parse_str(trimmed)
                .map_err(|e| format!("Invalid draft id: {}", e))?;
            Ok(parsed.to_string())
        }
        None => Ok(uuid::Uuid::new_v4().to_string()),
    }
}

fn draft_project_dir_for(root: &Path, draft_id: &str) -> PathBuf {
    root.join(draft_id)
}

fn draft_settings_path_for(project_dir: &Path) -> PathBuf {
    project_dir.join(".claude").join("settings.json")
}

fn write_json_atomic(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    ensure_parent_dir(path)?;

    let output = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize launch draft settings: {}", e))?;

    let tmp_path = path.with_extension(format!("json.tmp-{}", uuid::Uuid::new_v4()));
    fs::write(&tmp_path, output)
        .map_err(|e| format!("Failed to write launch draft temp settings file: {}", e))?;

    if let Err(rename_err) = fs::rename(&tmp_path, path) {
        fs::copy(&tmp_path, path)
            .map_err(|e| format!("Failed to finalize launch draft settings file: {}", e))?;
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(cleanup_err) = fs::remove_file(&tmp_path) {
            eprintln!(
                "launch draft temp cleanup warning after rename failure ({}): {}",
                rename_err, cleanup_err
            );
        }
    }

    Ok(())
}

fn materialize_launch_draft_impl(
    settings: &serde_json::Value,
    draft_id: Option<String>,
    retention_secs: Option<u64>,
) -> Result<MaterializedLaunchDraftResponse, String> {
    if !settings.is_object() {
        return Err("Launch settings must be an object".to_string());
    }

    let retention = Duration::from_secs(resolve_launch_draft_retention_secs(retention_secs));
    let _ = cleanup_launch_artifacts(retention);

    let drafts_root = launch_runtime_drafts_root();
    fs::create_dir_all(&drafts_root)
        .map_err(|e| format!("Failed to create launch runtime drafts directory: {}", e))?;

    let normalized_draft_id = normalize_launch_draft_id(draft_id)?;
    let draft_project_path = draft_project_dir_for(&drafts_root, &normalized_draft_id);
    let settings_path = draft_settings_path_for(&draft_project_path);

    write_json_atomic(&settings_path, settings)?;

    Ok(MaterializedLaunchDraftResponse {
        draft_id: normalized_draft_id,
        project_path: draft_project_path.to_string_lossy().to_string(),
        settings_path: settings_path.to_string_lossy().to_string(),
    })
}

fn prune_launch_settings_files_older_than(root: &Path, cutoff: SystemTime) -> Result<u32, String> {
    if !root.exists() {
        return Ok(0);
    }

    let entries = fs::read_dir(root)
        .map_err(|e| format!("Failed to read launch settings directory {}: {}", root.display(), e))?;

    let mut removed = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        if !name.starts_with("settings-") || !name.ends_with(".json") {
            continue;
        }

        let modified = fs::metadata(&path)
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);

        if modified < cutoff && fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}

fn prune_launch_draft_dirs_older_than(root: &Path, cutoff: SystemTime) -> Result<u32, String> {
    if !root.exists() {
        return Ok(0);
    }

    let entries = fs::read_dir(root)
        .map_err(|e| format!("Failed to read launch draft directory {}: {}", root.display(), e))?;

    let mut removed = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let settings_path = draft_settings_path_for(&path);
        let modified = fs::metadata(&settings_path)
            .and_then(|meta| meta.modified())
            .or_else(|_| fs::metadata(&path).and_then(|meta| meta.modified()))
            .unwrap_or(SystemTime::UNIX_EPOCH);

        if modified < cutoff && fs::remove_dir_all(&path).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}

fn cleanup_launch_artifacts(retention: Duration) -> Result<u32, String> {
    let cutoff = SystemTime::now()
        .checked_sub(retention)
        .unwrap_or(SystemTime::UNIX_EPOCH);

    let mut removed = 0;
    removed += prune_launch_settings_files_older_than(&legacy_launch_settings_root(), cutoff)?;
    removed += prune_launch_draft_dirs_older_than(&legacy_launch_drafts_root(), cutoff)?;
    removed += prune_launch_draft_dirs_older_than(&launch_runtime_drafts_root(), cutoff)?;

    Ok(removed)
}

fn release_launch_draft_impl(draft_id: &str) -> Result<(), String> {
    let normalized = normalize_launch_draft_id(Some(draft_id.to_string()))?;

    for root in [launch_runtime_drafts_root(), legacy_launch_drafts_root()] {
        let draft_dir = root.join(&normalized);
        if draft_dir.exists() {
            fs::remove_dir_all(&draft_dir).map_err(|e| {
                format!(
                    "Failed to remove launch draft {}: {}",
                    draft_dir.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

#[tauri::command]
fn prepare_launch_snapshot(request: LaunchSettingsRequest) -> Result<LaunchSnapshotResponse, String> {
    let settings = build_launch_settings_snapshot(&request)?;
    Ok(LaunchSnapshotResponse { settings })
}

#[tauri::command]
fn materialize_launch_draft(
    request: MaterializeLaunchDraftRequest,
) -> Result<MaterializedLaunchDraftResponse, String> {
    materialize_launch_draft_impl(&request.settings, request.draft_id, request.retention_secs)
}

/// Backward-compatible wrapper: produce a launch settings file path
/// through the new draft materialization pipeline.
#[tauri::command]
fn create_launch_settings(request: LaunchSettingsRequest) -> Result<String, String> {
    let settings = build_launch_settings_snapshot(&request)?;
    let materialized = materialize_launch_draft_impl(&settings, None, None)?;
    Ok(materialized.settings_path)
}

/// Remove launch artifacts older than retention window.
#[tauri::command]
fn cleanup_launch_settings(retention_secs: Option<u64>) -> Result<u32, String> {
    let retention = Duration::from_secs(resolve_launch_draft_retention_secs(retention_secs));
    cleanup_launch_artifacts(retention)
}

#[tauri::command]
fn release_launch_draft(draft_id: String) -> Result<(), String> {
    release_launch_draft_impl(&draft_id)
}
