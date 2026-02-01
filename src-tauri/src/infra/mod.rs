use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const DATA_DB_FILENAME: &str = "data.db";
const DATA_DB_DIRNAME: &str = "claudecodeimpact";

pub(crate) fn get_data_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(DATA_DB_DIRNAME)
        .join(DATA_DB_FILENAME)
}

fn load_data_db() -> Result<Value, String> {
    let path = get_data_db_path();
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).unwrap_or_else(|_| Value::Object(Map::new()));
    if value.is_object() {
        Ok(value)
    } else {
        Ok(Value::Object(Map::new()))
    }
}

fn save_data_db(value: &Value) -> Result<(), String> {
    let path = get_data_db_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let output = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&path, output).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn read_data_key(key: &str) -> Result<Option<Value>, String> {
    let data = load_data_db()?;
    Ok(data
        .as_object()
        .and_then(|obj| obj.get(key).cloned()))
}

pub(crate) fn write_data_key(key: &str, value: Value) -> Result<(), String> {
    let mut data = load_data_db()?;
    if !data.is_object() {
        data = Value::Object(Map::new());
    }
    if let Some(obj) = data.as_object_mut() {
        obj.insert(key.to_string(), value);
    }
    save_data_db(&data)
}

pub(crate) fn remove_data_key(key: &str) -> Result<(), String> {
    let mut data = load_data_db()?;
    if let Some(obj) = data.as_object_mut() {
        obj.remove(key);
    }
    save_data_db(&data)
}

pub(crate) fn get_claude_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude")
}

pub(crate) fn get_claude_json_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude.json")
}

pub(crate) fn get_claudecodeimpact_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claudecodeimpact")
        .join("claudecodeimpact")
}

// ~/.claudecodeimpact/claudecodeimpact/statusline/
pub(crate) fn get_statusline_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("statusline")
}

// ~/.claudecodeimpact/claudecodeimpact/statusbar/
pub(crate) fn get_statusbar_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("statusbar")
}

pub(crate) fn resolve_settings_path(path: Option<String>) -> PathBuf {
    let input = path
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());

    if let Some(path) = input {
        if path == "~" || path.starts_with("~/") {
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            let suffix = path.trim_start_matches('~').trim_start_matches('/');
            return home.join(suffix);
        }
        return PathBuf::from(path);
    }

    get_claude_dir().join("settings.json")
}

pub(crate) fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ~/.claudecodeimpact/docs/distill/
pub(crate) fn get_distill_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claudecodeimpact")
        .join("docs")
        .join("distill")
}

// ~/.claudecodeimpact/docs/reference/
pub(crate) fn get_reference_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claudecodeimpact")
        .join("docs")
        .join("reference")
}

pub(crate) fn get_docs_distill_dir() -> PathBuf {
    get_distill_dir()
}

pub(crate) fn get_docs_reference_dir() -> PathBuf {
    get_reference_dir()
}

pub(crate) fn get_command_stats_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("claudecodeimpact")
        .join("command-stats.json")
}

fn get_disabled_env_path() -> PathBuf {
    get_claudecodeimpact_dir().join("disabled_env.json")
}

pub(crate) fn load_disabled_env() -> Result<serde_json::Map<String, Value>, String> {
    if let Some(Value::Object(obj)) = read_data_key("settings.disabled_env")? {
        return Ok(obj);
    }
    let path = get_disabled_env_path();
    if !path.exists() {
        return Ok(serde_json::Map::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let obj = value.as_object().cloned().unwrap_or_default();
    if !obj.is_empty() {
        let _ = write_data_key("settings.disabled_env", Value::Object(obj.clone()));
    }
    Ok(obj)
}

pub(crate) fn save_disabled_env(disabled: &serde_json::Map<String, Value>) -> Result<(), String> {
    write_data_key(
        "settings.disabled_env",
        Value::Object(disabled.clone()),
    )
}

fn get_custom_keys_path() -> PathBuf {
    get_claudecodeimpact_dir().join("custom_env_keys.json")
}

pub(crate) fn load_custom_keys() -> Result<Vec<String>, String> {
    if let Some(Value::Array(arr)) = read_data_key("settings.custom_env_keys")? {
        return Ok(arr
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect());
    }
    let path = get_custom_keys_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let keys = if let Some(arr) = value.as_array() {
        arr.iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect::<Vec<String>>()
    } else {
        Vec::new()
    };
    if !keys.is_empty() {
        let _ = write_data_key(
            "settings.custom_env_keys",
            Value::Array(keys.iter().cloned().map(Value::String).collect()),
        );
    }
    Ok(keys)
}

pub(crate) fn save_custom_keys(keys: &[String]) -> Result<(), String> {
    write_data_key(
        "settings.custom_env_keys",
        Value::Array(keys.iter().cloned().map(Value::String).collect()),
    )
}

fn get_disabled_hooks_path() -> PathBuf {
    get_claudecodeimpact_dir().join("disabled_hooks.json")
}

pub(crate) fn load_disabled_hooks() -> Result<Value, String> {
    if let Some(value) = read_data_key("settings.disabled_hooks")? {
        return Ok(value);
    }
    let path = get_disabled_hooks_path();
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let _ = write_data_key("settings.disabled_hooks", value.clone());
    Ok(value)
}

pub(crate) fn save_disabled_hooks(disabled_hooks: &Value) -> Result<(), String> {
    write_data_key("settings.disabled_hooks", disabled_hooks.clone())
}

fn get_statusbar_settings_path() -> PathBuf {
    get_claudecodeimpact_dir().join("statusbar-settings.json")
}

pub(crate) fn load_statusbar_settings() -> Result<Option<Value>, String> {
    if let Some(value) = read_data_key("settings.statusbar_settings")? {
        return Ok(Some(value));
    }
    let path = get_statusbar_settings_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let _ = write_data_key("settings.statusbar_settings", value.clone());
    Ok(Some(value))
}

pub(crate) fn save_statusbar_settings(settings: &Value) -> Result<(), String> {
    write_data_key("settings.statusbar_settings", settings.clone())
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
