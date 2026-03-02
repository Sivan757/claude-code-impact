// ============================================================================

#[tauri::command]
fn get_settings(path: Option<String>) -> Result<ClaudeSettings, String> {
    let settings_path = resolve_settings_path(path);
    let claude_json_path = resolve_mcp_config_path(None);

    // Read ~/.claude/settings.json for permissions, hooks, etc.
    let (mut raw, permissions, hooks) = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let raw: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        let permissions = raw.get("permissions").cloned();
        let hooks = raw.get("hooks").cloned();
        (raw, permissions, hooks)
    } else {
        (Value::Null, None, None)
    };

    // Overlay disabled env from ~/.claudecodeimpact/data.db (do not persist in settings.json)
    if let Ok(disabled_env) = load_disabled_env() {
        if !disabled_env.is_empty() {
            if let Some(obj) = raw.as_object_mut() {
                obj.insert(
                    "_claudecodeimpact_disabled_env".to_string(),
                    Value::Object(disabled_env),
                );
            } else {
                raw = serde_json::json!({
                    "_claudecodeimpact_disabled_env": disabled_env
                });
            }
        } else if let Some(obj) = raw.as_object_mut() {
            obj.remove("_claudecodeimpact_disabled_env");
        }
    }

    // Overlay custom env keys from ~/.claudecodeimpact/data.db (do not persist in settings.json)
    let mut custom_keys = load_custom_keys().unwrap_or_default();

    // Merge legacy keys from settings if present
    if let Some(legacy_keys) = raw
        .get("_claudecodeimpact_custom_env_keys")
        .and_then(|v| v.as_array())
    {
        for k in legacy_keys {
            if let Some(s) = k.as_str() {
                if !custom_keys.contains(&s.to_string()) {
                    custom_keys.push(s.to_string());
                }
            }
        }
        // We will save merged keys to new storage if we write, but here we just ensure frontend gets the full list.
        // If we wanted to migrate immediately, we could save_custom_keys here, but let's avoid side effects in get_settings unless necessary.
        // Actually, let's just make sure the frontend gets the complete list.
    }

    if !custom_keys.is_empty() {
        if let Some(obj) = raw.as_object_mut() {
            obj.insert(
                "_claudecodeimpact_custom_env_keys".to_string(),
                serde_json::Value::Array(
                    custom_keys
                        .iter()
                        .map(|s| serde_json::Value::String(s.clone()))
                        .collect(),
                ),
            );
        } else if raw.is_null() {
            raw = serde_json::json!({
                "_claudecodeimpact_custom_env_keys": custom_keys
            });
        }
    }

    // Read managed MCP config for MCP servers
    let mut mcp_servers = Vec::new();
    if claude_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&claude_json_path) {
            if let Ok(claude_json) = serde_json::from_str::<Value>(&content) {
                if let Some(mcp_obj) = claude_json.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, config) in mcp_obj {
                        if let Some(obj) = config.as_object() {
                            // Handle nested mcpServers format (from some installers)
                            let actual_config = if let Some(nested) =
                                obj.get("mcpServers").and_then(|v| v.as_object())
                            {
                                nested.values().next().and_then(|v| v.as_object())
                            } else {
                                Some(obj)
                            };

                            if let Some(cfg) = actual_config {
                                let description = cfg
                                    .get("description")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let server_type =
                                    cfg.get("type").and_then(|v| v.as_str()).map(String::from);
                                let url = cfg.get("url").and_then(|v| v.as_str()).map(String::from);
                                let command = cfg
                                    .get("command")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let args: Vec<String> = cfg
                                    .get("args")
                                    .and_then(|v| v.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|v| v.as_str().map(String::from))
                                            .collect()
                                    })
                                    .unwrap_or_default();
                                let env: HashMap<String, String> = cfg
                                    .get("env")
                                    .and_then(|v| v.as_object())
                                    .map(|m| {
                                        m.iter()
                                            .filter_map(|(k, v)| {
                                                v.as_str().map(|s| (k.clone(), s.to_string()))
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_default();

                                mcp_servers.push(McpServer {
                                    name: name.clone(),
                                    description,
                                    server_type,
                                    url,
                                    command,
                                    args,
                                    env,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ClaudeSettings {
        raw,
        permissions,
        hooks,
        mcp_servers,
    })
}

fn get_session_path(project_id: &str, session_id: &str) -> PathBuf {
    get_claude_dir()
        .join("projects")
        .join(project_id)
        .join(format!("{}.jsonl", session_id))
}

#[tauri::command]
fn open_session_in_editor(project_id: String, session_id: String) -> Result<(), String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    open_in_editor(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_session_file_path(project_id: String, session_id: String) -> Result<String, String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_session_summary(project_id: String, session_id: String) -> Result<Option<String>, String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    let (summary, _) = read_session_head(&path, 20);
    let history_display = build_session_index_from_history()
        .get(&(project_id, session_id))
        .and_then(|(_, display)| display.clone());
    Ok(resolve_session_summary(summary, history_display))
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal_session_file(project_id: String, session_id: String) -> Result<(), String> {
    let session_path = get_session_path(&project_id, &session_id);

    if !session_path.exists() {
        return Err("Session file not found".to_string());
    }

    let path = session_path.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(session_path.parent().unwrap_or(&session_path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    let expanded = crate::services::platform::resolve_user_path(&path);

    if !expanded.exists() {
        return Err(format!("Path not found: {}", expanded.to_string_lossy()));
    }

    let path_str = expanded.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(expanded.parent().unwrap_or(&expanded))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let expanded = crate::services::platform::resolve_user_path(&path);

    if !expanded.exists() {
        return Err(format!("Path not found: {}", expanded.to_string_lossy()));
    }

    let path_str = expanded.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_in_editor(path: String) -> Result<(), String> {
    let expanded = crate::services::platform::resolve_user_path(&path);
    let expanded_str = expanded.to_string_lossy().to_string();
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&expanded_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &expanded_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&expanded_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_file_at_line(path: String, line: usize) -> Result<(), String> {
    let expanded = crate::services::platform::resolve_user_path(&path);
    let expanded_str = expanded.to_string_lossy().to_string();
    // 尝试用 cursor，失败则用 code (VSCode)
    let editors = ["cursor", "code", "zed"];

    for editor in editors {
        let result = std::process::Command::new(editor)
            .arg("--goto")
            .arg(format!("{}:{}", expanded_str, line))
            .spawn();

        if result.is_ok() {
            return Ok(());
        }
    }

    // 都失败则用系统默认方式打开
    open_in_editor(expanded_str)
}

#[tauri::command]
fn resolve_user_path(path: String) -> Result<String, String> {
    Ok(crate::services::platform::resolve_user_path(&path)
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
fn get_platform_kind() -> String {
    crate::services::platform::platform_kind().to_string()
}

#[tauri::command]
fn get_reveal_label() -> String {
    crate::services::platform::reveal_label().to_string()
}

#[tauri::command]
fn get_path_separator() -> String {
    crate::services::platform::path_separator().to_string()
}

#[tauri::command]
fn get_distill_command_path() -> String {
    resolve_claude_dir(None)
        .join("commands")
        .join("distill.md")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn get_docs_distill_dir_path() -> String {
    get_docs_distill_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn get_docs_reference_dir_path() -> String {
    get_docs_reference_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn get_docs_distill_file_path(file: String) -> String {
    get_docs_distill_dir()
        .join(file)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn get_settings_path() -> String {
    resolve_settings_path(None).to_string_lossy().to_string()
}

#[tauri::command]
fn get_mcp_config_path() -> String {
    resolve_mcp_config_path(None).to_string_lossy().to_string()
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
fn get_env_var(name: String) -> Option<String> {
    std::env::var(&name).ok()
}

#[derive(Debug, Serialize)]
pub struct TodayCodingStats {
    pub lines_added: usize,
    pub lines_deleted: usize,
}

impl Clone for TodayCodingStats {
    fn clone(&self) -> Self {
        Self {
            lines_added: self.lines_added,
            lines_deleted: self.lines_deleted,
        }
    }
}

static TODAY_CODING_STATS_CACHE: std::sync::LazyLock<
    std::sync::Mutex<Option<(std::time::Instant, TodayCodingStats)>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(None));

fn parse_shortstat_line(output: &str, added: &mut usize, deleted: &mut usize) {
    for part in output.split(',') {
        let part = part.trim();
        if part.contains("insertion") {
            if let Some(num) = part.split_whitespace().next() {
                *added += num.parse::<usize>().unwrap_or(0);
            }
        } else if part.contains("deletion") {
            if let Some(num) = part.split_whitespace().next() {
                *deleted += num.parse::<usize>().unwrap_or(0);
            }
        }
    }
}

#[tauri::command]
async fn get_today_coding_stats() -> Result<TodayCodingStats, String> {
    use std::process::Command;

    const TODAY_STATS_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(60);

    if let Ok(cache) = TODAY_CODING_STATS_CACHE.lock() {
        if let Some((cached_at, cached_stats)) = cache.as_ref() {
            if cached_at.elapsed() < TODAY_STATS_CACHE_TTL {
                return Ok(cached_stats.clone());
            }
        }
    }

    let stats = tauri::async_runtime::spawn_blocking(move || -> Result<TodayCodingStats, String> {
        let workspace_paths: Vec<String> = match read_data_key("ui.claudecodeimpact:workspaces")? {
            Some(Value::Array(arr)) => arr
                .iter()
                .filter_map(|item| item.as_str().map(str::to_owned))
                .collect(),
            _ => Vec::new(),
        };

        if workspace_paths.is_empty() {
            return Ok(TodayCodingStats {
                lines_added: 0,
                lines_deleted: 0,
            });
        }

        let mut total_added: usize = 0;
        let mut total_deleted: usize = 0;

        for path in workspace_paths {
            let today_output = Command::new("git")
                .args([
                    "-C",
                    &path,
                    "diff",
                    "--shortstat",
                    "--since=midnight",
                    "HEAD",
                ])
                .output();
            if let Ok(output) = today_output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                parse_shortstat_line(&stdout, &mut total_added, &mut total_deleted);
            }

            let working_tree_output = Command::new("git")
                .args(["-C", &path, "diff", "--shortstat"])
                .output();
            if let Ok(output) = working_tree_output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                parse_shortstat_line(&stdout, &mut total_added, &mut total_deleted);
            }
        }

        Ok(TodayCodingStats {
            lines_added: total_added,
            lines_deleted: total_deleted,
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Ok(mut cache) = TODAY_CODING_STATS_CACHE.lock() {
        *cache = Some((std::time::Instant::now(), stats.clone()));
    }

    Ok(stats)
}

#[tauri::command]
fn write_managed_file(path: String, content: String) -> Result<(), String> {
    let resolved = crate::services::platform::resolve_user_path(&path);
    let managed_root = get_claudecodeimpact_dir();
    if !resolved.starts_with(&managed_root) {
        return Err(format!(
            "Managed persistence path required. Expected under {}",
            managed_root.to_string_lossy()
        ));
    }
    ensure_parent_dir(&resolved)?;
    fs::write(&resolved, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_managed_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let resolved = crate::services::platform::resolve_user_path(&path);
    let managed_root = get_claudecodeimpact_dir();
    if !resolved.starts_with(&managed_root) {
        return Err(format!(
            "Managed persistence path required. Expected under {}",
            managed_root.to_string_lossy()
        ));
    }
    ensure_parent_dir(&resolved)?;
    fs::write(&resolved, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_file(path: String, content: String) -> Result<(), String> {
    let resolved = crate::services::platform::resolve_user_path(&path);
    ensure_parent_dir(&resolved)?;
    fs::write(&resolved, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let resolved = crate::services::platform::resolve_user_path(&path);
    ensure_parent_dir(&resolved)?;
    fs::write(&resolved, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_mcp_env(
    server_name: String,
    env_key: String,
    env_value: String,
    project_path: Option<String>,
) -> Result<(), String> {
    let mcp_config_path = resolve_mcp_config_path(project_path.as_deref());

    let mut mcp_json: serde_json::Value = if mcp_config_path.exists() {
        let content = fs::read_to_string(&mcp_config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else if project_path.is_some() {
        return Err(".mcp.json not found".to_string());
    } else {
        return Err("Managed MCP config not found".to_string());
    };

    if project_path.is_some() {
        let server = mcp_json
            .get_mut(&server_name)
            .ok_or_else(|| format!("MCP server '{}' not found", server_name))?;

        if !server.get("env").is_some() {
            server["env"] = serde_json::json!({});
        }
        server["env"][&env_key] = serde_json::Value::String(env_value);
    } else {
        let server = mcp_json
            .get_mut("mcpServers")
            .and_then(|s| s.get_mut(&server_name))
            .ok_or_else(|| format!("MCP server '{}' not found", server_name))?;

        if !server.get("env").is_some() {
            server["env"] = serde_json::json!({});
        }
        server["env"][&env_key] = serde_json::Value::String(env_value);
    }

    let output = serde_json::to_string_pretty(&mcp_json).map_err(|e| e.to_string())?;
    fs::write(&mcp_config_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

fn migrate_and_cleanup_custom_keys(settings: &mut serde_json::Value) -> Result<(), String> {
    if settings.get("_claudecodeimpact_custom_env_keys").is_some() {
        let mut custom_keys = load_custom_keys().unwrap_or_default();
        let mut changed = false;

        if let Some(legacy_keys) = settings
            .get("_claudecodeimpact_custom_env_keys")
            .and_then(|v| v.as_array())
        {
            for k in legacy_keys {
                if let Some(s) = k.as_str() {
                    if !custom_keys.contains(&s.to_string()) {
                        custom_keys.push(s.to_string());
                        changed = true;
                    }
                }
            }
        }

        if changed {
            save_custom_keys(&custom_keys)?;
        }

        if let Some(obj) = settings.as_object_mut() {
            obj.remove("_claudecodeimpact_custom_env_keys");
        }
    }
    Ok(())
}

#[tauri::command]
fn update_settings_env(
    env_key: String,
    env_value: String,
    is_new: Option<bool>,
    path: Option<String>,
) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    migrate_and_cleanup_custom_keys(&mut settings)?;

    if !settings.get("env").and_then(|v| v.as_object()).is_some() {
        settings["env"] = serde_json::json!({});
    }
    settings["env"][&env_key] = serde_json::Value::String(env_value);

    // Track custom env keys when is_new=true
    if is_new == Some(true) {
        let mut custom_keys = load_custom_keys()?;
        if !custom_keys.contains(&env_key) {
            custom_keys.push(env_key.clone());
            save_custom_keys(&custom_keys)?;
        }
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_settings_env(env_key: String, path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    migrate_and_cleanup_custom_keys(&mut settings)?;

    if let Some(env) = settings.get_mut("env").and_then(|v| v.as_object_mut()) {
        env.remove(&env_key);
    }

    // Also remove from custom keys list
    let mut custom_keys = load_custom_keys().unwrap_or_default();
    if custom_keys.contains(&env_key) {
        custom_keys.retain(|v| v != &env_key);
        // ignore save error
        let _ = save_custom_keys(&custom_keys);
    }

    // Also remove from disabled env if present
    if let Some(disabled) = settings
        .get_mut("_claudecodeimpact_disabled_env")
        .and_then(|v| v.as_object_mut())
    {
        disabled.remove(&env_key);
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.remove(&env_key);
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
fn disable_settings_env(env_key: String, path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    if !settings_path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    migrate_and_cleanup_custom_keys(&mut settings)?;

    // Get current value before removing
    let current_value = settings
        .get("env")
        .and_then(|v| v.get(&env_key))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Remove from active env
    if let Some(env) = settings.get_mut("env").and_then(|v| v.as_object_mut()) {
        env.remove(&env_key);
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(current_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
fn enable_settings_env(env_key: String, path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    migrate_and_cleanup_custom_keys(&mut settings)?;

    // Get value from disabled env
    let mut disabled_env = load_disabled_env()?;
    let disabled_value = disabled_env
        .get(&env_key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    disabled_env.remove(&env_key);
    save_disabled_env(&disabled_env)?;

    // Add back to active env
    if !settings.get("env").and_then(|v| v.as_object()).is_some() {
        settings["env"] = serde_json::json!({});
    }
    settings["env"][&env_key] = serde_json::Value::String(disabled_value);

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn update_disabled_settings_env(
    env_key: String,
    env_value: String,
    _path: Option<String>,
) -> Result<(), String> {
    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(env_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}
