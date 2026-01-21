// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
enum ClaudeCodeInstallType {
    Native,
    Npm,
    None,
}

#[derive(Debug, Serialize)]
struct VersionWithDownloads {
    version: String,
    downloads: u64,
}

#[derive(Debug, Serialize)]
struct ClaudeCodeVersionInfo {
    install_type: ClaudeCodeInstallType,
    current_version: Option<String>,
    available_versions: Vec<VersionWithDownloads>,
    autoupdater_disabled: bool,
}

/// Run a command in user's interactive login shell (to get proper PATH with nvm, etc.)
fn run_shell_command(cmd: &str) -> std::io::Result<std::process::Output> {
    #[cfg(windows)]
    {
        // On Windows, use PowerShell to run commands (better PATH handling than cmd.exe)
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", cmd])
            .output()
    }

    #[cfg(not(windows))]
    {
        // Use user's default shell from $SHELL, fallback to /bin/zsh (macOS default)
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        std::process::Command::new(&shell)
            .args(["-ilc", cmd]) // -i for interactive (loads .zshrc), -l for login, -c for command
            .output()
    }
}

/// Detect Claude Code installation type
/// Prioritizes native install (~/.local/bin/claude) over npm when both exist
fn detect_claude_code_install_type() -> (ClaudeCodeInstallType, Option<String>) {
    // Helper to get version from a specific claude binary path
    let get_version = |path: &str| -> Option<String> {
        if let Ok(output) = std::process::Command::new(path).arg("--version").output() {
            if output.status.success() {
                let version_str = String::from_utf8_lossy(&output.stdout);
                return version_str
                    .trim()
                    .split_whitespace()
                    .next()
                    .map(|s| s.to_string());
            }
        }
        None
    };

    // Check native install first (preferred) - ~/.local/bin/claude
    let native_path = dirs::home_dir()
        .map(|h| h.join(".local/bin/claude"))
        .filter(|p| p.exists());

    if let Some(ref path) = native_path {
        if let Some(version) = get_version(path.to_str().unwrap_or("")) {
            return (ClaudeCodeInstallType::Native, Some(version));
        }
    }

    // Check npm install via `which claude` in user's shell
    if let Ok(which_output) = run_shell_command("which claude 2>/dev/null") {
        if which_output.status.success() {
            let claude_path = String::from_utf8_lossy(&which_output.stdout);
            let claude_path = claude_path.trim();

            // Skip if it's the native path we already checked
            if !claude_path.contains(".local/bin/claude") && !claude_path.is_empty() {
                if let Some(version) = get_version(claude_path) {
                    return (ClaudeCodeInstallType::Npm, Some(version));
                }
            }
        }
    }

    (ClaudeCodeInstallType::None, None)
}

#[tauri::command]
async fn get_claude_code_version_info() -> Result<ClaudeCodeVersionInfo, String> {
    // Detect installation type and current version
    let (install_type, current_version) =
        tauri::async_runtime::spawn_blocking(detect_claude_code_install_type)
            .await
            .map_err(|e| e.to_string())?;

    // Fetch available versions from npm registry API (no local npm needed)
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    // Get versions list from npm registry
    let versions: Vec<String> = match client
        .get("https://registry.npmjs.org/@anthropic-ai/claude-code")
        .send()
        .await
    {
        Ok(resp) => resp
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|json| {
                json.get("versions")?.as_object().map(|obj| {
                    let mut versions: Vec<String> = obj.keys().cloned().collect();
                    // Sort by semver (simple string sort works for most cases)
                    versions.sort_by(|a, b| {
                        let parse = |s: &str| -> Vec<u32> {
                            s.split('.').filter_map(|p| p.parse().ok()).collect()
                        };
                        parse(b).cmp(&parse(a))
                    });
                    versions.into_iter().take(20).collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => vec![],
    };

    // Fetch download counts from npm API
    let downloads_map: std::collections::HashMap<String, u64> = match client
        .get("https://api.npmjs.org/versions/@anthropic-ai%2Fclaude-code/last-week")
        .send()
        .await
    {
        Ok(resp) => resp
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|json| {
                json.get("downloads")?.as_object().map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| Some((k.clone(), v.as_u64()?)))
                        .collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => std::collections::HashMap::new(),
    };

    // Combine versions with download counts
    let available_versions: Vec<VersionWithDownloads> = versions
        .into_iter()
        .map(|v| {
            let downloads = downloads_map.get(&v).copied().unwrap_or(0);
            VersionWithDownloads {
                version: v,
                downloads,
            }
        })
        .collect();

    // Check autoupdater setting
    let settings_path = get_claude_dir().join("settings.json");
    let autoupdater_disabled = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|content| {
            let json: serde_json::Value = serde_json::from_str(&content).ok()?;
            json.get("env")?
                .get("DISABLE_AUTOUPDATER")?
                .as_str()
                .map(|s| s == "true" || s == "1")
        })
        .unwrap_or(false);

    Ok(ClaudeCodeVersionInfo {
        install_type,
        current_version,
        available_versions,
        autoupdater_disabled,
    })
}

#[tauri::command]
async fn install_claude_code_version(
    app: tauri::AppHandle,
    version: String,
    install_type: Option<String>,
) -> Result<String, String> {
    use std::io::{BufRead, BufReader};
    use std::process::{Command, Stdio};

    let is_specific_version = version != "latest";
    let install_type_str = install_type.unwrap_or_else(|| "native".to_string());

    let result = tauri::async_runtime::spawn_blocking(move || {
        let cmd = if install_type_str == "npm" {
            // Remove native binary if exists (so detection shows npm after install)
            if let Some(home) = dirs::home_dir() {
                let native_bin = home.join(".local/bin/claude");
                if native_bin.exists() {
                    let _ = app.emit("cc-install-progress", "Removing native install...");
                    let _ = std::fs::remove_file(&native_bin);
                }
            }

            let package = if version == "latest" {
                "@anthropic-ai/claude-code@latest".to_string()
            } else {
                format!("@anthropic-ai/claude-code@{}", version)
            };
            format!("npm install -g --force {}", package)
        } else {
            // Clean up stale downloads that may cause "another process installing" error
            if let Some(home) = dirs::home_dir() {
                let downloads_dir = home.join(".claude/downloads");
                if downloads_dir.exists() {
                    let _ = app.emit("cc-install-progress", "Cleaning up stale downloads...");
                    let _ = std::fs::remove_dir_all(&downloads_dir);
                }
            }

            let version_arg = if version == "latest" { "".to_string() } else { version };
            let display_version = if version_arg.is_empty() { "latest" } else { &version_arg };
            let _ = app.emit("cc-install-progress", format!("Installing Claude Code {}...", display_version));

            // Download script, patch to show progress bar for binary download, then run
            // Change 'curl -fsSL -o' to 'curl -fL --progress-bar -o' for visible download progress
            format!(
                r#"echo "Downloading install script..." && curl -fsSL https://claude.ai/install.sh | sed 's/"$binary_path" install/"$binary_path" install --force/' | sed 's/curl -fsSL -o/curl -fL --progress-bar -o/g' > /tmp/cc-install.sh && echo "Downloading Claude Code (~170MB)..." && CI=1 bash /tmp/cc-install.sh {} </dev/null && echo "Done!" || echo "Installation failed"; rm -f /tmp/cc-install.sh"#,
                version_arg
            )
        };

        // Use appropriate shell based on platform
        println!("[DEBUG] cmd={}", cmd);

        #[cfg(windows)]
        let mut child = {
            // On Windows, use PowerShell for npm commands
            // Native install is not supported on Windows (uses Unix-specific tools)
            if install_type_str != "npm" {
                return Err("Native install is only supported on macOS/Linux. Please use npm install on Windows.".to_string());
            }
            Command::new("powershell")
                .args(["-NoProfile", "-Command", &cmd])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn: {}", e))?
        };

        #[cfg(not(windows))]
        let mut child = Command::new("/bin/bash")
            .args(["-c", &cmd])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn: {}", e))?;

        // Store PID for cancellation support
        CC_INSTALL_PID.store(child.id(), std::sync::atomic::Ordering::SeqCst);
        println!("[DEBUG] Child spawned, pid={}", child.id());

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Read stdout in a thread - use byte reading to capture progress bar updates
        let app_clone = app.clone();
        let stdout_handle = std::thread::spawn(move || {
            use std::io::Read;
            let mut output = String::new();
            if let Some(mut out) = stdout {
                let mut buf = [0u8; 1024];
                let mut current_line = String::new();

                while let Ok(n) = out.read(&mut buf) {
                    if n == 0 { break; }

                    let chunk = String::from_utf8_lossy(&buf[..n]);
                    for ch in chunk.chars() {
                        if ch == '\n' {
                            // Complete line - emit if not debug
                            if !current_line.starts_with("[DEBUG]") && !current_line.is_empty() {
                                let _ = app_clone.emit("cc-install-progress", &current_line);
                            }
                            output.push_str(&current_line);
                            output.push('\n');
                            current_line.clear();
                        } else if ch == '\r' {
                            // Carriage return - emit current content as progress update
                            if !current_line.is_empty() {
                                let _ = app_clone.emit("cc-install-progress", format!("\r{}", &current_line));
                            }
                            current_line.clear();
                        } else {
                            current_line.push(ch);
                        }
                    }
                }
                // Emit any remaining content
                if !current_line.is_empty() && !current_line.starts_with("[DEBUG]") {
                    let _ = app_clone.emit("cc-install-progress", &current_line);
                    output.push_str(&current_line);
                }
            }
            output
        });

        // Read stderr in a thread - curl progress bar goes to stderr
        let app_clone2 = app.clone();
        let stderr_handle = std::thread::spawn(move || {
            use std::io::Read;
            let mut output = String::new();
            if let Some(mut err) = stderr {
                let mut buf = [0u8; 1024];
                let mut current_line = String::new();

                while let Ok(n) = err.read(&mut buf) {
                    if n == 0 { break; }

                    let chunk = String::from_utf8_lossy(&buf[..n]);
                    output.push_str(&chunk);

                    for ch in chunk.chars() {
                        if ch == '\n' || ch == '\r' {
                            if !current_line.is_empty() {
                                // Check if this looks like progress (contains % or is mostly # symbols)
                                let is_progress = current_line.contains('%') ||
                                    current_line.chars().filter(|c| *c == '#').count() > 2;

                                if is_progress {
                                    // Progress update - use \r prefix to replace last line
                                    let _ = app_clone2.emit("cc-install-progress", format!("\r{}", &current_line));
                                } else {
                                    // Real error - prefix with [error]
                                    let _ = app_clone2.emit("cc-install-progress", format!("[error] {}", &current_line));
                                }
                            }
                            current_line.clear();
                        } else {
                            current_line.push(ch);
                        }
                    }
                }
                // Emit any remaining content
                if !current_line.is_empty() {
                    let _ = app_clone2.emit("cc-install-progress", format!("[error] {}", &current_line));
                }
            }
            output
        });

        let stdout_output = stdout_handle.join().unwrap_or_default();
        let stderr_output = stderr_handle.join().unwrap_or_default();

        let status = child.wait().map_err(|e| format!("Failed to wait: {}", e))?;

        // Clear PID after process ends
        CC_INSTALL_PID.store(0, std::sync::atomic::Ordering::SeqCst);

        if status.success() {
            Ok(stdout_output)
        } else {
            Err(stderr_output)
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if is_specific_version {
        let _ = set_claude_code_autoupdater(true);
    }

    Ok(result)
}

#[tauri::command]
fn cancel_claude_code_install() -> Result<(), String> {
    let pid = CC_INSTALL_PID.load(std::sync::atomic::Ordering::SeqCst);
    if pid == 0 {
        return Err("No install process running".to_string());
    }

    #[cfg(unix)]
    {
        // Use pkill to kill child processes first (curl, bash, etc.)
        let _ = std::process::Command::new("pkill")
            .args(["-9", "-P", &pid.to_string()])
            .output();

        // Kill the main process with SIGKILL
        unsafe {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }

    #[cfg(windows)]
    {
        // On Windows, use taskkill to kill the process tree
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }

    CC_INSTALL_PID.store(0, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn set_claude_code_autoupdater(disabled: bool) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");

    // Read existing settings or create empty object
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure env object exists
    if !settings.get("env").is_some() {
        settings["env"] = serde_json::json!({});
    }

    // Set DISABLE_AUTOUPDATER
    settings["env"]["DISABLE_AUTOUPDATER"] = serde_json::Value::String(if disabled {
        "true".to_string()
    } else {
        "false".to_string()
    });

    // Write back
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

