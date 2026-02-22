// NOTE: This file is textually included via include!() in handlers.rs
// std::collections::HashMap is already imported from handlers.rs

fn normalized_terminal_app(terminal_app: Option<&str>) -> Option<String> {
    terminal_app
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalized_command(command: Option<&str>) -> Option<&str> {
    command.map(str::trim).filter(|value| !value.is_empty())
}

fn terminal_matches(app: &str, candidates: &[&str]) -> bool {
    let app_lower = app.to_ascii_lowercase();
    let app_file_name_lower = Path::new(app)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(app)
        .to_ascii_lowercase();

    candidates.iter().any(|candidate| {
        let candidate_lower = candidate.to_ascii_lowercase();
        app_lower == candidate_lower || app_file_name_lower == candidate_lower
    })
}

fn apply_env_vars(cmd: &mut std::process::Command, env_vars: Option<&HashMap<String, String>>) {
    if let Some(vars) = env_vars {
        for (key, value) in vars {
            cmd.env(key, value);
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Launch a system terminal at the specified working directory
#[tauri::command]
pub fn launch_system_terminal(
    cwd: String,
    env_vars: Option<HashMap<String, String>>,
    terminal_app: Option<String>,
    command: Option<String>,
) -> Result<String, String> {
    let cwd_path = std::path::Path::new(&cwd);
    if !cwd_path.exists() {
        return Err(format!("Directory does not exist: {}", cwd));
    }

    #[cfg(target_os = "macos")]
    {
        launch_macos_terminal(
            &cwd,
            env_vars.as_ref(),
            terminal_app.as_deref(),
            command.as_deref(),
        )
    }

    #[cfg(target_os = "windows")]
    {
        launch_windows_terminal(
            &cwd,
            env_vars.as_ref(),
            terminal_app.as_deref(),
            command.as_deref(),
        )
    }

    #[cfg(target_os = "linux")]
    {
        launch_linux_terminal(
            &cwd,
            env_vars.as_ref(),
            terminal_app.as_deref(),
            command.as_deref(),
        )
    }
}

#[cfg(target_os = "macos")]
fn launch_macos_terminal(
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    terminal_app: Option<&str>,
    command: Option<&str>,
) -> Result<String, String> {
    let app = normalized_terminal_app(terminal_app).unwrap_or_else(|| "Terminal".to_string());

    // Known macOS terminal apps are handled via AppleScript to preserve cwd/env/command behavior.
    if terminal_matches(&app, &["iTerm", "iTerm2", "iTerm.app", "iTerm2.app"]) {
        let mut shell_steps = vec![format!("cd -- {}", shell_single_quote(cwd))];
        if let Some(vars) = env_vars {
            for (key, value) in vars {
                shell_steps.push(format!("export {}={}", key, shell_single_quote(value)));
            }
        }
        if let Some(exec_cmd) = normalized_command(command) {
            shell_steps.push(exec_cmd.to_string());
        }

        let script = String::from(
            r#"on run argv
tell application "iTerm2"
    create window with default profile
    tell current session of current window
"#,
        );
        let mut cmd = std::process::Command::new("osascript");
        cmd.arg("-e").arg(script);

        cmd.arg("-e").arg(
            r#"        repeat with cmdText in argv
            write text cmdText
        end repeat"#,
        );
        cmd.arg("-e").arg(
            r#"    end tell
end tell"#,
        );
        cmd.arg("-e").arg("end run");
        for step in &shell_steps {
            cmd.arg(step);
        }

        cmd
            .spawn()
            .map_err(|e| format!("Failed to launch iTerm: {}", e))?;

        return Ok(format!("Launched {} at {}", app, cwd));
    }

    if terminal_matches(&app, &["Terminal", "Terminal.app"]) {
        let mut shell_steps = vec![format!("cd -- {}", shell_single_quote(cwd))];
        if let Some(vars) = env_vars {
            for (key, value) in vars {
                shell_steps.push(format!("export {}={}", key, shell_single_quote(value)));
            }
        }
        if let Some(exec_cmd) = normalized_command(command) {
            shell_steps.push(exec_cmd.to_string());
        }
        let shell_command = shell_steps.join(" && ");

        let script = r#"on run argv
    set shellCommand to item 1 of argv
    tell application "Terminal"
    do script shellCommand
    activate
end tell
end run"#;

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .arg(shell_command)
            .spawn()
            .map_err(|e| format!("Failed to launch Terminal: {}", e))?;

        return Ok(format!("Launched {} at {}", app, cwd));
    }

    // If users provide a .app bundle path, open it directly.
    let app_lower = app.to_ascii_lowercase();
    if app_lower.ends_with(".app") || app_lower.contains(".app/") {
        std::process::Command::new("open")
            .arg("-a")
            .arg(&app)
            .spawn()
            .map_err(|e| format!("Failed to launch app bundle {}: {}", app, e))?;
        return Ok(format!("Launched {} at {}", app, cwd));
    }

    // Fallback for custom executable path: best-effort process launch.
    if let Some(exec_cmd) = normalized_command(command) {
        let mut custom_with_command = std::process::Command::new(&app);
        custom_with_command.current_dir(cwd);
        apply_env_vars(&mut custom_with_command, env_vars);
        custom_with_command
            .arg("-e")
            .arg("bash")
            .arg("-lc")
            .arg(exec_cmd);
        if custom_with_command.spawn().is_ok() {
            return Ok(format!("Launched {} at {}", app, cwd));
        }
    }

    let mut custom_cmd = std::process::Command::new(&app);
    custom_cmd.current_dir(cwd);
    apply_env_vars(&mut custom_cmd, env_vars);
    custom_cmd
        .spawn()
        .map_err(|e| format!("Failed to launch custom terminal {}: {}", app, e))?;

    Ok(format!("Launched {} at {}", app, cwd))
}

#[cfg(target_os = "windows")]
fn launch_windows_terminal(
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    terminal_app: Option<&str>,
    command: Option<&str>,
) -> Result<String, String> {
    let requested_app = normalized_terminal_app(terminal_app);
    let app = requested_app.as_deref().unwrap_or("wt");

    if terminal_matches(app, &["wt", "wt.exe", "Windows Terminal", "windowsterminal.exe"]) {
        if launch_windows_terminal_wt(app, cwd, env_vars, command).is_ok() {
            return Ok(format!("Launched {} at {}", app, cwd));
        }
        if requested_app.is_some() {
            return Err(format!("Failed to launch Windows Terminal: {}", app));
        }
    }

    if terminal_matches(app, &["powershell", "powershell.exe", "pwsh", "pwsh.exe"]) {
        launch_windows_powershell(app, cwd, env_vars, command)
            .map_err(|e| format!("Failed to launch PowerShell {}: {}", app, e))?;
        return Ok(format!("Launched {} at {}", app, cwd));
    }

    if terminal_matches(app, &["cmd", "cmd.exe"]) {
        launch_windows_cmd(app, cwd, env_vars, command)
            .map_err(|e| format!("Failed to launch cmd {}: {}", app, e))?;
        return Ok(format!("Launched {} at {}", app, cwd));
    }

    if launch_windows_custom_terminal(app, cwd, env_vars, command).is_ok() {
        return Ok(format!("Launched {} at {}", app, cwd));
    }

    if requested_app.is_none() {
        if launch_windows_powershell("powershell", cwd, env_vars, command).is_ok() {
            return Ok(format!("Launched powershell at {}", cwd));
        }
        if launch_windows_cmd("cmd", cwd, env_vars, command).is_ok() {
            return Ok(format!("Launched cmd at {}", cwd));
        }
    }

    Err(format!("Failed to launch terminal app: {}", app))
}

#[cfg(target_os = "windows")]
fn launch_windows_terminal_wt(
    executable: &str,
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    command: Option<&str>,
) -> Result<(), std::io::Error> {
    let mut cmd = std::process::Command::new(executable);
    cmd.arg("-d").arg(cwd);

    if let Some(exec_cmd) = normalized_command(command) {
        cmd.arg("cmd").arg("/c").arg(exec_cmd);
    }

    apply_env_vars(&mut cmd, env_vars);
    cmd.spawn().map(|_| ())
}

#[cfg(target_os = "windows")]
fn launch_windows_powershell(
    executable: &str,
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    command: Option<&str>,
) -> Result<(), std::io::Error> {
    let escaped_cwd = cwd.replace('\'', "''");
    let mut startup = format!("Set-Location '{}'", escaped_cwd);
    if let Some(exec_cmd) = normalized_command(command) {
        startup.push_str("; ");
        startup.push_str(exec_cmd);
    }

    let mut cmd = std::process::Command::new(executable);
    cmd.arg("-NoExit").arg("-Command").arg(startup);
    apply_env_vars(&mut cmd, env_vars);
    cmd.spawn().map(|_| ())
}

#[cfg(target_os = "windows")]
fn launch_windows_cmd(
    executable: &str,
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    command: Option<&str>,
) -> Result<(), std::io::Error> {
    let escaped_cwd = cwd.replace('"', "\\\"");
    let mut startup = format!("cd /d \"{}\"", escaped_cwd);
    if let Some(exec_cmd) = normalized_command(command) {
        startup.push_str(" && ");
        startup.push_str(exec_cmd);
    }

    let mut cmd = std::process::Command::new(executable);
    cmd.arg("/k").arg(startup);
    apply_env_vars(&mut cmd, env_vars);
    cmd.spawn().map(|_| ())
}

#[cfg(target_os = "windows")]
fn launch_windows_custom_terminal(
    executable: &str,
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    command: Option<&str>,
) -> Result<(), std::io::Error> {
    if let Some(exec_cmd) = normalized_command(command) {
        let mut as_wt = std::process::Command::new(executable);
        as_wt
            .arg("-d")
            .arg(cwd)
            .arg("cmd")
            .arg("/k")
            .arg(exec_cmd)
            .current_dir(cwd);
        apply_env_vars(&mut as_wt, env_vars);
        if as_wt.spawn().is_ok() {
            return Ok(());
        }

        let mut as_working_dir = std::process::Command::new(executable);
        as_working_dir
            .arg("--working-directory")
            .arg(cwd)
            .arg("-e")
            .arg("cmd")
            .arg("/k")
            .arg(exec_cmd)
            .current_dir(cwd);
        apply_env_vars(&mut as_working_dir, env_vars);
        if as_working_dir.spawn().is_ok() {
            return Ok(());
        }
    }

    let mut cmd = std::process::Command::new(executable);
    cmd.current_dir(cwd);
    apply_env_vars(&mut cmd, env_vars);
    cmd.spawn().map(|_| ())
}

#[cfg(target_os = "linux")]
fn launch_linux_terminal(
    cwd: &str,
    env_vars: Option<&HashMap<String, String>>,
    terminal_app: Option<&str>,
    command: Option<&str>,
) -> Result<String, String> {
    let requested_app = normalized_terminal_app(terminal_app);
    let has_custom_app = requested_app.is_some();
    let terminals: Vec<String> = if let Some(app) = requested_app {
        vec![app]
    } else {
        vec![
            "x-terminal-emulator".to_string(),
            "gnome-terminal".to_string(),
            "konsole".to_string(),
            "xfce4-terminal".to_string(),
            "xterm".to_string(),
        ]
    };

    for terminal in &terminals {
        let mut cmd = std::process::Command::new(terminal);

        if terminal_matches(terminal, &["gnome-terminal"]) {
            cmd.arg("--working-directory").arg(cwd);
            if let Some(exec_cmd) = normalized_command(command) {
                cmd.arg("--").arg("bash").arg("-lc").arg(exec_cmd);
            }
        } else if terminal_matches(terminal, &["konsole"]) {
            cmd.arg("--workdir").arg(cwd);
            if let Some(exec_cmd) = normalized_command(command) {
                cmd.arg("-e").arg("bash").arg("-lc").arg(exec_cmd);
            }
        } else {
            let mut shell_cmd = format!("cd -- {}", shell_single_quote(cwd));
            if let Some(exec_cmd) = normalized_command(command) {
                shell_cmd.push_str(" && ");
                shell_cmd.push_str(exec_cmd);
            } else {
                shell_cmd.push_str(" && exec bash");
            }
            cmd.arg("-e").arg("bash").arg("-lc").arg(shell_cmd);
        }

        apply_env_vars(&mut cmd, env_vars);

        if cmd.spawn().is_ok() {
            return Ok(format!("Launched {} at {}", terminal, cwd));
        }

        if has_custom_app {
            let mut fallback_cmd = std::process::Command::new(terminal);
            fallback_cmd.current_dir(cwd);
            apply_env_vars(&mut fallback_cmd, env_vars);
            if fallback_cmd.spawn().is_ok() {
                return Ok(format!("Launched {} at {}", terminal, cwd));
            }
        }
    }

    Err("No terminal emulator found".to_string())
}
