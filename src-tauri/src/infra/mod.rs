use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub(crate) fn get_claude_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude")
}

pub(crate) fn get_claude_json_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude.json")
}

pub(crate) fn get_lovstudio_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".lovstudio")
        .join("claudecodeimpact")
}

pub(crate) fn get_command_stats_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("claudecodeimpact")
        .join("command-stats.json")
}

fn get_disabled_env_path() -> PathBuf {
    get_lovstudio_dir().join("disabled_env.json")
}

pub(crate) fn load_disabled_env() -> Result<serde_json::Map<String, Value>, String> {
    let path = get_disabled_env_path();
    if !path.exists() {
        return Ok(serde_json::Map::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

pub(crate) fn save_disabled_env(disabled: &serde_json::Map<String, Value>) -> Result<(), String> {
    let path = get_disabled_env_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let output = serde_json::to_string_pretty(&Value::Object(disabled.clone()))
        .map_err(|e| e.to_string())?;
    fs::write(&path, output).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) async fn exec_shell_command(command: String, cwd: String) -> Result<String, String> {
    use tokio::process::Command;

    #[cfg(windows)]
    let output = {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("Set-Location '{}'; {}", cwd, command),
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run command: {}", e))?
    };

    #[cfg(not(windows))]
    let output = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        Command::new(&shell)
            .args(["-ilc", &format!("cd '{}' && {}", cwd, command)])
            .output()
            .await
            .map_err(|e| format!("Failed to run command: {}", e))?
    };

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}
