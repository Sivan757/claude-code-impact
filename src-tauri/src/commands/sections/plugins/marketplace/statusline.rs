// ============================================================================
// Statusline & statusbar management

#[tauri::command]
fn update_settings_statusline(
    statusline: serde_json::Value,
    path: Option<String>,
) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    settings["statusLine"] = statusline;

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_settings_statusline(path: Option<String>) -> Result<(), String> {
    let settings_path = resolve_settings_path(path);
    if !settings_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("statusLine");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    ensure_parent_dir(&settings_path)?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn write_statusline_script(content: String) -> Result<String, String> {
    let script_path = get_claudecodeimpact_dir().join("statusline.sh");
    ensure_parent_dir(&script_path)?;
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Install statusline template to ~/.claudecodeimpact/statusline/{name}.sh
#[tauri::command]
fn install_statusline_template(name: String, content: String) -> Result<String, String> {
    let statusline_dir = get_statusline_dir();
    fs::create_dir_all(&statusline_dir).map_err(|e| e.to_string())?;

    let script_path = statusline_dir.join(format!("{}.sh", name));
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Apply statusline: copy from ~/.claudecodeimpact/statusline/{name}.sh to managed settings scope.
/// If an existing statusline exists, backup to ~/.claudecodeimpact/statusline/_previous.sh
#[tauri::command]
fn apply_statusline(name: String) -> Result<String, String> {
    let source_path = get_statusline_dir().join(format!("{}.sh", name));
    if !source_path.exists() {
        return Err(format!("Statusline template not found: {}", name));
    }

    let target_path = get_claudecodeimpact_dir().join("statusline.sh");
    ensure_parent_dir(&target_path)?;
    let backup_dir = get_statusline_dir();
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // Backup existing statusline.sh if it exists and differs from source
    if target_path.exists() {
        let existing_content = fs::read_to_string(&target_path).unwrap_or_default();
        let new_content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;

        if existing_content != new_content {
            let backup_path = backup_dir.join("_previous.sh");
            fs::copy(&target_path, &backup_path).map_err(|e| e.to_string())?;
        }
    }

    let content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(target_path.to_string_lossy().to_string())
}

/// Restore previous statusline from backup
#[tauri::command]
fn restore_previous_statusline() -> Result<String, String> {
    let backup_path = get_statusline_dir().join("_previous.sh");
    if !backup_path.exists() {
        return Err("No previous statusline to restore".to_string());
    }

    let content = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let target_path = get_claudecodeimpact_dir().join("statusline.sh");
    ensure_parent_dir(&target_path)?;
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    // Remove backup after restore
    fs::remove_file(&backup_path).ok();

    Ok(target_path.to_string_lossy().to_string())
}

/// Check if previous statusline backup exists
#[tauri::command]
fn has_previous_statusline() -> bool {
    get_statusline_dir().join("_previous.sh").exists()
}

/// Context passed to Claude Code Impact statusbar script
#[derive(Debug, Serialize, Deserialize)]
pub struct StatusBarContext {
    pub app_name: String,
    pub version: String,
    pub projects_count: usize,
    pub features_count: usize,
    pub today_lines_added: usize,
    pub today_lines_deleted: usize,
    pub timestamp: String,
    pub home_dir: String,
}

/// Execute Claude Code Impact's GUI statusbar script and return output
#[tauri::command]
fn execute_statusbar_script(
    script_path: String,
    context: StatusBarContext,
) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let expanded_path = crate::services::platform::resolve_user_path(&script_path);
    let expanded_path_str = expanded_path.to_string_lossy().to_string();
    let path = std::path::Path::new(&expanded_path);
    if !path.exists() {
        return Err(format!("Script not found: {}", expanded_path_str));
    }

    // Serialize context to JSON
    let context_json = serde_json::to_string(&context).map_err(|e| e.to_string())?;

    // Determine how to execute the script
    #[cfg(unix)]
    let mut child = Command::new(&expanded_path_str)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn script: {}", e))?;

    #[cfg(windows)]
    let mut child = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-File", &expanded_path_str])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn script: {}", e))?;

    // Write context JSON to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(context_json.as_bytes()).ok();
    }

    // Wait for output with timeout
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Script execution failed: {}", e))?;

    // Get first line of stdout
    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().unwrap_or("").to_string();

    Ok(first_line)
}

/// Get Claude Code Impact statusbar settings from ~/.claudecodeimpact/data.db
#[tauri::command]
fn get_statusbar_settings() -> Result<Option<serde_json::Value>, String> {
    crate::infra::load_statusbar_settings()
}

/// Save Claude Code Impact statusbar settings to ~/.claudecodeimpact/data.db
#[tauri::command]
fn save_statusbar_settings(settings: serde_json::Value) -> Result<(), String> {
    crate::infra::save_statusbar_settings(&settings)
}

/// Write Claude Code Impact statusbar script to ~/.claudecodeimpact/statusbar/
#[tauri::command]
fn write_claudecodeimpact_statusbar_script(
    name: String,
    content: String,
) -> Result<String, String> {
    let statusbar_dir = get_statusbar_dir();
    fs::create_dir_all(&statusbar_dir).map_err(|e| e.to_string())?;

    let script_path = statusbar_dir.join(format!("{}.sh", name));
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Remove installed statusline template
#[tauri::command]
fn remove_statusline_template(name: String) -> Result<(), String> {
    let script_path = get_statusline_dir().join(format!("{}.sh", name));
    if script_path.exists() {
        fs::remove_file(&script_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
