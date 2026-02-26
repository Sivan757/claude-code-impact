use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex, OnceLock};

const DATA_DB_FILENAME: &str = "data.db";
const DATA_DB_DIRNAME: &str = ".claudecodeimpact";
const LEGACY_NESTED_DIRNAME: &str = "claudecodeimpact";
const LEGACY_KV_JSON_FILENAME: &str = "data.json";
const SQLITE_FILE_HEADER: &[u8; 16] = b"SQLite format 3\0";
const KV_MIGRATION_MARKER_KEY: &str = "_system.kv_migrated_v1";
const NATIVE_SCOPE_MIGRATION_DIR: &str = ".migrations/native-scope-v1";

static DATA_STORE_CONN: LazyLock<Mutex<Option<Connection>>> = LazyLock::new(|| Mutex::new(None));
static LAYOUT_MIGRATION_ONCE: OnceLock<Result<(), String>> = OnceLock::new();

fn get_persistence_root_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(DATA_DB_DIRNAME)
}

pub(crate) fn get_data_db_path() -> PathBuf {
    get_persistence_root_dir().join(DATA_DB_FILENAME)
}

fn get_legacy_kv_json_path() -> PathBuf {
    get_persistence_root_dir().join(LEGACY_KV_JSON_FILENAME)
}

fn get_legacy_flat_data_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(LEGACY_NESTED_DIRNAME)
        .join(DATA_DB_FILENAME)
}

fn get_legacy_nested_root_path() -> PathBuf {
    get_persistence_root_dir().join(LEGACY_NESTED_DIRNAME)
}

fn is_sqlite_file(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    let mut header = [0u8; 16];
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };

    if file.read_exact(&mut header).is_err() {
        return false;
    }

    &header == SQLITE_FILE_HEADER
}

fn merge_directory_contents(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }

    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let source_path = entry.path();
        let file_name = entry.file_name();
        let target_path = dst.join(file_name);

        if source_path.is_dir() {
            merge_directory_contents(&source_path, &target_path)?;
            let _ = fs::remove_dir_all(&source_path);
            continue;
        }

        if target_path.exists() {
            let _ = fs::remove_file(&source_path);
            continue;
        }

        if fs::rename(&source_path, &target_path).is_err() {
            fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&source_path);
        }
    }

    Ok(())
}

fn copy_directory_contents(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() || !src.is_dir() {
        return Ok(());
    }

    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let source_path = entry.path();
        let target_path = dst.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_contents(&source_path, &target_path)?;
            continue;
        }
        if target_path.exists() {
            continue;
        }
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn migrate_file_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if target.exists() || !source.exists() || source.is_dir() {
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(source, target).map_err(|e| e.to_string())?;
    Ok(())
}

fn migrate_dir_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if target.exists() || !source.exists() || !source.is_dir() {
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if fs::rename(source, target).is_err() {
        copy_directory_contents(source, target)?;
    }

    Ok(())
}

fn scope_id_for_project_path(path: &Path) -> String {
    URL_SAFE_NO_PAD.encode(path.to_string_lossy().as_bytes())
}

fn managed_scope_claude_dir(project_path: Option<&Path>) -> PathBuf {
    let scope_id = project_path
        .map(scope_id_for_project_path)
        .unwrap_or_else(|| "user".to_string());
    get_claudecodeimpact_dir()
        .join("scopes")
        .join(scope_id)
        .join("claude")
}

fn managed_settings_scope_path(project_path: Option<&Path>) -> PathBuf {
    let base_dir = get_claudecodeimpact_dir().join("settings-scopes");
    if let Some(path) = project_path {
        let encoded = scope_id_for_project_path(path);
        base_dir.join(format!("external-{}.json", encoded))
    } else {
        base_dir.join("user-settings.json")
    }
}

fn managed_mcp_scope_path(project_path: Option<&Path>) -> PathBuf {
    let base_dir = get_claudecodeimpact_dir().join("mcp-scopes");
    if let Some(path) = project_path {
        let encoded = scope_id_for_project_path(path);
        base_dir.join(format!("project-{}.json", encoded))
    } else {
        base_dir.join("user.json")
    }
}

fn native_scope_migration_marker(scope_id: &str) -> PathBuf {
    get_claudecodeimpact_dir()
        .join(NATIVE_SCOPE_MIGRATION_DIR)
        .join(format!("{}.done", scope_id))
}

fn mark_native_scope_migrated(scope_id: &str) {
    let marker = native_scope_migration_marker(scope_id);
    if let Some(parent) = marker.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(marker, "ok");
}

fn ensure_native_user_scope_migrated() -> Result<(), String> {
    let scope_id = "user";
    if native_scope_migration_marker(scope_id).exists() {
        return Ok(());
    }

    let source = managed_scope_claude_dir(None);
    let target = get_legacy_claude_dir();
    if !source.exists() || !source.is_dir() {
        mark_native_scope_migrated(scope_id);
        return Ok(());
    }

    for name in [
        "settings.json",
        "settings.local.json",
        "CLAUDE.md",
        "CLAUDE.local.md",
        "config.json",
        "history.jsonl",
    ] {
        migrate_file_if_missing(&source.join(name), &target.join(name))?;
    }

    for dir_name in [
        "agents",
        "skills",
        "commands",
        ".commands",
        "hooks",
        "teams",
        "projects",
        "debug",
        "shell-snapshots",
        "telemetry",
        "file-history",
        "todos",
    ] {
        migrate_dir_if_missing(&source.join(dir_name), &target.join(dir_name))?;
    }

    let source_plugins = source.join("plugins");
    let target_plugins = target.join("plugins");
    migrate_file_if_missing(
        &source_plugins.join("known_marketplaces.json"),
        &target_plugins.join("known_marketplaces.json"),
    )?;
    migrate_file_if_missing(
        &source_plugins.join("installed_plugins.json"),
        &target_plugins.join("installed_plugins.json"),
    )?;
    migrate_file_if_missing(
        &source_plugins.join("blocklist.json"),
        &target_plugins.join("blocklist.json"),
    )?;
    migrate_dir_if_missing(
        &source_plugins.join("marketplaces"),
        &target_plugins.join("marketplaces"),
    )?;

    migrate_file_if_missing(
        &managed_settings_scope_path(None),
        &target.join("settings.json"),
    )?;
    migrate_file_if_missing(
        &managed_mcp_scope_path(None),
        &get_legacy_claude_json_path(),
    )?;

    mark_native_scope_migrated(scope_id);
    Ok(())
}

fn ensure_native_project_scope_migrated(project_root: &Path) -> Result<(), String> {
    let scope_id = scope_id_for_project_path(project_root);
    if native_scope_migration_marker(&scope_id).exists() {
        return Ok(());
    }

    let source = managed_scope_claude_dir(Some(project_root));
    let target = project_root.join(".claude");
    if source.exists() && source.is_dir() {
        if !target.exists() && fs::rename(&source, &target).is_err() {
            copy_directory_contents(&source, &target)?;
        } else if target.exists() {
            for name in [
                "settings.json",
                "settings.local.json",
                "CLAUDE.md",
                "CLAUDE.local.md",
                "config.json",
            ] {
                migrate_file_if_missing(&source.join(name), &target.join(name))?;
            }
            for dir_name in [
                "agents",
                "skills",
                "commands",
                ".commands",
                "hooks",
                "plugins",
            ] {
                migrate_dir_if_missing(&source.join(dir_name), &target.join(dir_name))?;
            }
        }
    }

    migrate_file_if_missing(
        &managed_settings_scope_path(Some(project_root)),
        &target.join("settings.json"),
    )?;
    migrate_file_if_missing(
        &managed_mcp_scope_path(Some(project_root)),
        &project_root.join(".mcp.json"),
    )?;

    mark_native_scope_migrated(&scope_id);
    Ok(())
}

fn looks_like_json_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
}

fn migrate_legacy_layout_if_needed() -> Result<(), String> {
    let migration_result = LAYOUT_MIGRATION_ONCE.get_or_init(|| -> Result<(), String> {
        let root = get_persistence_root_dir();
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;

        let legacy_root = get_legacy_nested_root_path();
        if !legacy_root.exists() {
            return Ok(());
        }

        merge_directory_contents(&legacy_root, &root)?;
        let _ = fs::remove_dir_all(&legacy_root);
        Ok(())
    });

    migration_result.clone()
}

fn ensure_sqlite_store(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_kv_updated_at ON kv(updated_at);
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn load_json_object(path: &Path) -> Result<Map<String, Value>, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

fn upsert_kv(conn: &Connection, key: &str, value: &Value) -> Result<(), String> {
    let serialized = serde_json::to_string(value).map_err(|e| e.to_string())?;
    conn.execute(
        "
        INSERT INTO kv (key, value, updated_at)
        VALUES (?1, ?2, CAST(strftime('%s','now') AS INTEGER))
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        ",
        params![key, serialized],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn migrate_legacy_kv_if_needed(conn: &Connection) -> Result<(), String> {
    let marker = conn
        .query_row(
            "SELECT value FROM kv WHERE key = ?1",
            params![KV_MIGRATION_MARKER_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if marker.is_some() {
        return Ok(());
    }

    let mut merged = Map::new();
    let candidates = [get_legacy_kv_json_path(), get_legacy_flat_data_db_path()];
    for path in candidates {
        if !path.exists() || is_sqlite_file(&path) {
            continue;
        }
        if let Ok(obj) = load_json_object(&path) {
            for (key, value) in obj {
                merged.insert(key, value);
            }
        }
    }

    for (key, value) in merged {
        upsert_kv(conn, &key, &value)?;
    }
    upsert_kv(conn, KV_MIGRATION_MARKER_KEY, &Value::Bool(true))?;

    let _ = fs::remove_file(get_legacy_kv_json_path());
    let _ = fs::remove_file(get_legacy_flat_data_db_path());
    Ok(())
}

fn with_data_store_conn<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    migrate_legacy_layout_if_needed()?;

    let mut guard = DATA_STORE_CONN.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let db_path = get_data_db_path();
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        ensure_sqlite_store(&conn)?;
        migrate_legacy_kv_if_needed(&conn)?;
        *guard = Some(conn);
    }

    let conn = guard
        .as_ref()
        .ok_or_else(|| "Failed to initialize persistent data connection".to_string())?;
    f(conn)
}

pub(crate) fn read_data_key(key: &str) -> Result<Option<Value>, String> {
    with_data_store_conn(|conn| {
        let raw = conn
            .query_row("SELECT value FROM kv WHERE key = ?1", params![key], |row| {
                row.get::<_, String>(0)
            })
            .optional()
            .map_err(|e| e.to_string())?;

        raw.map(|text| serde_json::from_str(&text).map_err(|e| e.to_string()))
            .transpose()
    })
}

pub(crate) fn write_data_key(key: &str, value: Value) -> Result<(), String> {
    with_data_store_conn(|conn| upsert_kv(conn, key, &value))
}

pub(crate) fn remove_data_key(key: &str) -> Result<(), String> {
    with_data_store_conn(|conn| {
        conn.execute("DELETE FROM kv WHERE key = ?1", params![key])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

pub(crate) fn read_data_keys(keys: &[String]) -> Result<HashMap<String, Value>, String> {
    if keys.is_empty() {
        return Ok(HashMap::new());
    }

    with_data_store_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM kv WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let mut output = HashMap::new();
        for key in keys {
            let raw = stmt
                .query_row(params![key], |row| row.get::<_, String>(0))
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some(text) = raw {
                let value = serde_json::from_str::<Value>(&text).map_err(|e| e.to_string())?;
                output.insert(key.clone(), value);
            }
        }
        Ok(output)
    })
}

fn get_legacy_claude_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude")
}

fn get_legacy_claude_json_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude.json")
}

fn resolve_native_claude_dir_from_input(path: &Path) -> (PathBuf, PathBuf) {
    let is_claude_dir = path.file_name().and_then(|name| name.to_str()) == Some(".claude");
    if is_claude_dir {
        let project_root = path
            .parent()
            .map(|parent| parent.to_path_buf())
            .unwrap_or_else(|| path.to_path_buf());
        return (project_root, path.to_path_buf());
    }

    (path.to_path_buf(), path.join(".claude"))
}

pub(crate) fn get_claude_dir() -> PathBuf {
    get_legacy_claude_dir()
}

pub(crate) fn resolve_claude_dir(project_path: Option<&str>) -> PathBuf {
    if let Some(path) = project_path {
        let resolved = crate::services::platform::resolve_user_path(path);
        let (project_root, target) = resolve_native_claude_dir_from_input(&resolved);
        let _ = ensure_native_project_scope_migrated(&project_root);
        return target;
    }

    let target = get_legacy_claude_dir();
    let _ = ensure_native_user_scope_migrated();
    target
}

pub(crate) fn resolve_mcp_config_path(project_path: Option<&str>) -> PathBuf {
    if let Some(path) = project_path {
        let resolved = crate::services::platform::resolve_user_path(path);
        if looks_like_json_path(&resolved) {
            return resolved;
        }
        let (project_root, _) = resolve_native_claude_dir_from_input(&resolved);
        let target = project_root.join(".mcp.json");
        let _ = migrate_file_if_missing(&managed_mcp_scope_path(Some(&project_root)), &target);
        target
    } else {
        let target = get_legacy_claude_json_path();
        let _ = migrate_file_if_missing(&managed_mcp_scope_path(None), &target);
        target
    }
}

pub(crate) fn get_claudecodeimpact_dir() -> PathBuf {
    let _ = migrate_legacy_layout_if_needed();
    get_persistence_root_dir()
}

// ~/.claudecodeimpact/statusline/
pub(crate) fn get_statusline_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("statusline")
}

// ~/.claudecodeimpact/statusbar/
pub(crate) fn get_statusbar_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("statusbar")
}

pub(crate) fn resolve_settings_path(path: Option<String>) -> PathBuf {
    let input = path.map(|p| p.trim().to_string()).filter(|p| !p.is_empty());

    if let Some(path) = input {
        let resolved = crate::services::platform::resolve_user_path(&path);
        if looks_like_json_path(&resolved) {
            return resolved;
        }
        if resolved.starts_with(get_claudecodeimpact_dir()) {
            let is_claude_dir = resolved
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.eq_ignore_ascii_case(".claude"));

            if is_claude_dir {
                return resolved.join("settings.json");
            }

            return resolved.join(".claude").join("settings.json");
        }
        let (project_root, claude_dir) = resolve_native_claude_dir_from_input(&resolved);
        let target = claude_dir.join("settings.json");
        let _ = migrate_file_if_missing(&managed_settings_scope_path(Some(&project_root)), &target);
        let _ = migrate_file_if_missing(
            &managed_scope_claude_dir(Some(&project_root)).join("settings.json"),
            &target,
        );
        return target;
    }

    let target = get_legacy_claude_dir().join("settings.json");
    let _ = migrate_file_if_missing(&managed_settings_scope_path(None), &target);
    let _ = migrate_file_if_missing(
        &managed_scope_claude_dir(None).join("settings.json"),
        &target,
    );
    target
}

pub(crate) fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ~/.claudecodeimpact/docs/distill/
pub(crate) fn get_distill_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("docs").join("distill")
}

// ~/.claudecodeimpact/docs/reference/
pub(crate) fn get_reference_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("docs").join("reference")
}

pub(crate) fn get_docs_distill_dir() -> PathBuf {
    get_distill_dir()
}

pub(crate) fn get_docs_reference_dir() -> PathBuf {
    get_reference_dir()
}

pub(crate) fn get_command_stats_path() -> PathBuf {
    let target = get_claudecodeimpact_dir().join("command-stats.json");
    if let Some(data_local) = dirs::data_local_dir() {
        let legacy = data_local
            .join("claudecodeimpact")
            .join("command-stats.json");
        let _ = migrate_file_if_missing(&legacy, &target);
    }
    target
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
    write_data_key("settings.disabled_env", Value::Object(disabled.clone()))
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
        let shell = std::env::var("COMSPEC")
            .or_else(|_| std::env::var("SHELL"))
            .unwrap_or_else(|_| "powershell.exe".to_string());
        let shell_lower = shell.to_lowercase();
        let mut cmd = Command::new(&shell);

        if shell_lower.contains("powershell") {
            cmd.args([
                "-NoProfile",
                "-Command",
                &format!("Set-Location '{}'; {}", cwd, command),
            ]);
        } else {
            cmd.args(["/C", &format!("cd /d \"{}\" && {}", cwd, command)]);
        }

        cmd.output()
            .await
            .map_err(|e| format!("Failed to run command: {}", e))?
    };

    #[cfg(not(windows))]
    let output = {
        let shell = crate::services::platform::get_default_unix_shell();
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
