// ============================================================================

#[tauri::command]
fn get_settings() -> Result<ClaudeSettings, String> {
    let settings_path = get_claude_dir().join("settings.json");
    let claude_json_path = get_claude_json_path();

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

    // Overlay disabled env from ~/.claudecodeimpact/claudecodeimpact (do not persist in settings.json)
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

    // Overlay custom env keys from ~/.claudecodeimpact/claudecodeimpact (do not persist in settings.json)
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

    // Read ~/.claude.json for MCP servers
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

#[derive(Debug, Deserialize)]
struct LaunchSettingsProvider {
    provider_type: String,
    env: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct LaunchSettingsRequest {
    provider: Option<LaunchSettingsProvider>,
    enabled_plugins: Option<Vec<String>>,
}

#[tauri::command]
fn create_launch_settings(request: LaunchSettingsRequest) -> Result<String, String> {
    let settings_path = get_claude_dir().join("settings.json");
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !settings.is_object() {
        settings = serde_json::json!({});
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
        obj.remove("_claudecodeimpact_custom_env_keys");

        if let Some(provider) = request.provider {
            let mut env_obj = obj
                .get("env")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            for (key, value) in provider.env {
                env_obj.insert(key, Value::String(value));
            }

            obj.insert("env".to_string(), Value::Object(env_obj));

            let mut cci_obj = obj
                .get("claudecodeimpact")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            cci_obj.insert(
                "activeProvider".to_string(),
                Value::String(provider.provider_type),
            );
            obj.insert("claudecodeimpact".to_string(), Value::Object(cci_obj));
        }

        if let Some(enabled_plugins) = request.enabled_plugins {
            let mut plugins_obj = serde_json::Map::new();
            for plugin_id in enabled_plugins {
                plugins_obj.insert(plugin_id, Value::Bool(true));
            }
            obj.insert("enabledPlugins".to_string(), Value::Object(plugins_obj));
        }
    }

    // Return JSON string directly for inline --settings argument
    let output = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    Ok(output)
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
    Ok(summary)
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
    let expanded = if path.starts_with("~") {
        let home = dirs::home_dir().ok_or("Cannot get home dir")?;
        home.join(&path[2..])
    } else {
        std::path::PathBuf::from(&path)
    };

    if !expanded.exists() {
        return Err(format!("Path not found: {}", path));
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
    let expanded = if path.starts_with("~") {
        let home = dirs::home_dir().ok_or("Cannot get home dir")?;
        home.join(&path[2..])
    } else {
        std::path::PathBuf::from(&path)
    };

    if !expanded.exists() {
        return Err(format!("Path not found: {}", path));
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
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_file_at_line(path: String, line: usize) -> Result<(), String> {
    // 尝试用 cursor，失败则用 code (VSCode)
    let editors = ["cursor", "code", "zed"];

    for editor in editors {
        let result = std::process::Command::new(editor)
            .arg("--goto")
            .arg(format!("{}:{}", path, line))
            .spawn();

        if result.is_ok() {
            return Ok(());
        }
    }

    // 都失败则用系统默认方式打开
    open_in_editor(path)
}

#[tauri::command]
fn get_settings_path() -> String {
    get_claude_dir()
        .join("settings.json")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn get_mcp_config_path() -> String {
    get_claude_json_path().to_string_lossy().to_string()
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

#[tauri::command]
fn get_today_coding_stats() -> Result<TodayCodingStats, String> {
    use std::process::Command;

    let workspace_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("claudecodeimpact")
        .join("workspace.json");

    if !workspace_path.exists() {
        return Ok(TodayCodingStats {
            lines_added: 0,
            lines_deleted: 0,
        });
    }

    let content = fs::read_to_string(&workspace_path).map_err(|e| e.to_string())?;
    let workspace: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut total_added: usize = 0;
    let mut total_deleted: usize = 0;

    if let Some(projects) = workspace.get("projects").and_then(|p| p.as_array()) {
        for project in projects {
            if let Some(path) = project.get("path").and_then(|p| p.as_str()) {
                // Run git diff --stat for today
                let output = Command::new("git")
                    .args([
                        "-C",
                        path,
                        "diff",
                        "--shortstat",
                        "--since=midnight",
                        "HEAD",
                    ])
                    .output();

                if let Ok(output) = output {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    // Parse "X files changed, Y insertions(+), Z deletions(-)"
                    for part in stdout.split(',') {
                        let part = part.trim();
                        if part.contains("insertion") {
                            if let Some(num) = part.split_whitespace().next() {
                                total_added += num.parse::<usize>().unwrap_or(0);
                            }
                        } else if part.contains("deletion") {
                            if let Some(num) = part.split_whitespace().next() {
                                total_deleted += num.parse::<usize>().unwrap_or(0);
                            }
                        }
                    }
                }

                // Also check uncommitted changes
                let output = Command::new("git")
                    .args(["-C", path, "diff", "--shortstat"])
                    .output();

                if let Ok(output) = output {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for part in stdout.split(',') {
                        let part = part.trim();
                        if part.contains("insertion") {
                            if let Some(num) = part.split_whitespace().next() {
                                total_added += num.parse::<usize>().unwrap_or(0);
                            }
                        } else if part.contains("deletion") {
                            if let Some(num) = part.split_whitespace().next() {
                                total_deleted += num.parse::<usize>().unwrap_or(0);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(TodayCodingStats {
        lines_added: total_added,
        lines_deleted: total_deleted,
    })
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_mcp_env(server_name: String, env_key: String, env_value: String) -> Result<(), String> {
    let claude_json_path = get_claude_json_path();

    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("~/.claude.json not found".to_string());
    };

    let server = claude_json
        .get_mut("mcpServers")
        .and_then(|s| s.get_mut(&server_name))
        .ok_or_else(|| format!("MCP server '{}' not found", server_name))?;

    if !server.get("env").is_some() {
        server["env"] = serde_json::json!({});
    }
    server["env"][&env_key] = serde_json::Value::String(env_value);

    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

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
) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
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
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
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
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.remove(&env_key);
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
fn disable_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
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
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(current_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
fn enable_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
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
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn update_disabled_settings_env(env_key: String, env_value: String) -> Result<(), String> {
    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(env_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}
