use crate::config::{ConfigError, ConfigFileKind, ConfigScope};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Config change event
#[derive(Debug, Clone, serde::Serialize)]
pub struct ConfigChangeEvent {
    pub kind: String,
    pub scope: String,
    pub path: String,
}

/// Config watcher state
pub struct ConfigWatcher {
    _watcher: RecommendedWatcher,
    _receiver: Arc<Mutex<Receiver<notify::Result<Event>>>>,
}

impl ConfigWatcher {
    /// Create a new config watcher
    pub fn new(app: AppHandle, project_path: Option<String>) -> Result<Self, ConfigError> {
        let (tx, rx) = channel();

        // Create debounced watcher
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_millis(300)),
        )
        .map_err(|e| ConfigError::WatchError {
            message: format!("Failed to create watcher: {}", e),
        })?;

        // Watch native Claude paths.
        if let Some(home_dir) = dirs::home_dir() {
            let user_claude_dir = home_dir.join(".claude");
            if !user_claude_dir.exists() {
                let _ = std::fs::create_dir_all(&user_claude_dir);
            }
            watcher
                .watch(&user_claude_dir, RecursiveMode::Recursive)
                .map_err(|e| ConfigError::WatchError {
                    message: format!("Failed to watch user Claude directory: {}", e),
                })?;

            let user_mcp = home_dir.join(".claude.json");
            if user_mcp.exists() {
                watcher
                    .watch(&user_mcp, RecursiveMode::NonRecursive)
                    .map_err(|e| ConfigError::WatchError {
                        message: format!("Failed to watch user .claude.json: {}", e),
                    })?;
            }
        }

        if let Some(project) = project_path.as_deref() {
            let project_root = crate::services::platform::resolve_user_path(project);
            if project_root.exists() {
                // Watch project root non-recursively for .mcp.json and .claude directory creation.
                watcher
                    .watch(&project_root, RecursiveMode::NonRecursive)
                    .map_err(|e| ConfigError::WatchError {
                        message: format!("Failed to watch project root: {}", e),
                    })?;
            }

            let project_claude_dir = project_root.join(".claude");
            if project_claude_dir.exists() {
                watcher
                    .watch(&project_claude_dir, RecursiveMode::Recursive)
                    .map_err(|e| ConfigError::WatchError {
                        message: format!("Failed to watch project .claude directory: {}", e),
                    })?;
            }
        }

        let receiver = Arc::new(Mutex::new(rx));

        // Spawn event processing task
        let receiver_clone = Arc::clone(&receiver);
        let app_clone = app.clone();
        let project_path_clone = project_path.clone();
        std::thread::spawn(move || {
            process_events(receiver_clone, app_clone, project_path_clone);
        });

        Ok(ConfigWatcher {
            _watcher: watcher,
            _receiver: receiver,
        })
    }
}

/// Process watcher events
fn process_events(
    receiver: Arc<Mutex<Receiver<notify::Result<Event>>>>,
    app: AppHandle,
    project_path: Option<String>,
) {
    // Debounce state
    let mut last_event_time = std::time::Instant::now();
    let debounce_duration = Duration::from_millis(300);

    loop {
        if let Ok(rx) = receiver.lock() {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    // Debounce: only process if enough time has passed
                    let now = std::time::Instant::now();
                    if now.duration_since(last_event_time) < debounce_duration {
                        continue;
                    }
                    last_event_time = now;

                    // Process event
                    if let Some(change_event) = process_event(&event, project_path.as_deref()) {
                        // Emit Tauri event
                        let _ = app.emit("config:changed", change_event);
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {:?}", e);
                }
                Err(RecvTimeoutError::Timeout) => {
                    // Timeout is normal, continue
                }
                Err(RecvTimeoutError::Disconnected) => {
                    // Channel disconnected (watcher was dropped), exit loop
                    eprintln!("Config watcher channel disconnected, stopping event processor");
                    break;
                }
            }
        } else {
            // Failed to lock receiver, break loop
            break;
        }
    }
}

/// Process a single filesystem event
fn process_event(event: &Event, project_path: Option<&str>) -> Option<ConfigChangeEvent> {
    // Only process modify and create events
    match event.kind {
        EventKind::Modify(_) | EventKind::Create(_) => {}
        _ => return None,
    }

    for path in &event.paths {
        let path_str = path.display().to_string();
        // Normalize path separators for cross-platform compatibility
        let normalized_path = path_str.replace('\\', "/");

        // Determine kind and scope
        let (kind, scope) = if normalized_path.contains("/.claudecodeimpact/settings-scopes/")
            && normalized_path.ends_with(".json")
        {
            (
                ConfigFileKind::Settings,
                infer_scope(&path_str, "settings.json", project_path),
            )
        } else if normalized_path.contains("/.claudecodeimpact/mcp-scopes/")
            && normalized_path.ends_with(".json")
        {
            (
                ConfigFileKind::McpJson,
                infer_scope(&path_str, ".mcp.json", project_path),
            )
        } else if normalized_path.ends_with("settings.json") {
            (
                ConfigFileKind::Settings,
                infer_scope(&path_str, "settings.json", project_path),
            )
        } else if normalized_path.ends_with("settings.local.json") {
            (
                ConfigFileKind::SettingsLocal,
                infer_scope(&path_str, "settings.local.json", project_path),
            )
        } else if normalized_path.ends_with("CLAUDE.md") {
            (
                ConfigFileKind::ClaudeMd,
                infer_scope(&path_str, "CLAUDE.md", project_path),
            )
        } else if normalized_path.ends_with("CLAUDE.local.md") {
            (
                ConfigFileKind::ClaudeMdLocal,
                infer_scope(&path_str, "CLAUDE.local.md", project_path),
            )
        } else if normalized_path.ends_with("config.json") {
            (ConfigFileKind::ApiConfig, ConfigScope::User)
        } else if normalized_path.ends_with(".claude.json") {
            (ConfigFileKind::LegacyConfig, ConfigScope::User)
        } else if normalized_path.ends_with(".mcp.json") {
            (ConfigFileKind::McpJson, ConfigScope::Project)
        } else {
            continue;
        };

        return Some(ConfigChangeEvent {
            kind: serde_json::to_string(&kind)
                .unwrap_or_else(|_| format!("{:?}", kind))
                .trim_matches('"')
                .to_string(),
            scope: serde_json::to_string(&scope)
                .unwrap_or_else(|_| format!("{:?}", scope))
                .trim_matches('"')
                .to_string(),
            path: path_str,
        });
    }

    None
}

/// Infer scope from path
fn infer_scope(path: &str, filename: &str, _project_path: Option<&str>) -> ConfigScope {
    // Check if it's a local file
    let is_local = filename.contains(".local.");

    // Normalize path separators for cross-platform comparison
    let normalized_path = path.replace('\\', "/");
    if let Some(home_dir) = dirs::home_dir() {
        let home = home_dir.to_string_lossy().replace('\\', "/");
        let home = home.trim_end_matches('/');
        let user_claude_prefix = format!("{}/.claude/", home);
        if normalized_path.starts_with(&user_claude_prefix) {
            return if is_local {
                ConfigScope::UserLocal
            } else {
                ConfigScope::User
            };
        }
        if normalized_path == format!("{}/.claude.json", home) {
            return ConfigScope::User;
        }
    }

    if normalized_path.ends_with("/.claude.json") {
        return ConfigScope::User;
    }

    if normalized_path.contains("/.claude/") {
        return if is_local {
            ConfigScope::ProjectLocal
        } else {
            ConfigScope::Project
        };
    }

    if normalized_path.ends_with("/.mcp.json") {
        return ConfigScope::Project;
    }

    // Legacy managed paths (kept for backward compatibility during migration)
    if normalized_path.contains("/.claudecodeimpact/settings-scopes/") {
        if normalized_path.contains("/external-") {
            return ConfigScope::Project;
        }
        return ConfigScope::User;
    }
    if normalized_path.contains("/.claudecodeimpact/mcp-scopes/") {
        if normalized_path.contains("/project-") {
            return ConfigScope::Project;
        }
        return ConfigScope::User;
    }
    if normalized_path.contains("/.claudecodeimpact/scopes/user/") {
        return ConfigScope::User;
    }
    if normalized_path.contains("/.claudecodeimpact/scopes/") {
        return if is_local {
            ConfigScope::ProjectLocal
        } else {
            ConfigScope::Project
        };
    }
    if normalized_path.contains("/.claudecodeimpact/config/user-local/") {
        return ConfigScope::UserLocal;
    }
    if normalized_path.contains("/.claudecodeimpact/config/user/") {
        return ConfigScope::User;
    }
    if normalized_path.contains("/.claudecodeimpact/config/projects-local/") {
        return if is_local {
            ConfigScope::ProjectLocal
        } else {
            ConfigScope::Project
        };
    }
    if normalized_path.contains("/.claudecodeimpact/config/projects/") {
        return ConfigScope::Project;
    }
    if normalized_path.contains("/.claudecodeimpact/config/managed/") {
        return ConfigScope::Managed;
    }
    ConfigScope::User
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_scope_user() {
        if let Some(home_dir) = dirs::home_dir() {
            let path = home_dir.join(".claude/settings.json");
            let scope = infer_scope(&path.to_string_lossy(), "settings.json", None);
            assert_eq!(format!("{:?}", scope), "User");
        }
    }

    #[test]
    fn test_infer_scope_user_local() {
        if let Some(home_dir) = dirs::home_dir() {
            let path = home_dir.join(".claude/settings.local.json");
            let scope = infer_scope(&path.to_string_lossy(), "settings.local.json", None);
            assert_eq!(format!("{:?}", scope), "UserLocal");
        }
    }

    #[test]
    fn test_infer_scope_project() {
        let path = "/tmp/home/project/.claude/settings.json";
        let scope = infer_scope(&path, "settings.json", Some("/tmp/test-project"));
        assert_eq!(format!("{:?}", scope), "Project");
    }

    #[test]
    fn test_infer_scope_project_local() {
        let path = "/tmp/home/project/.claude/settings.local.json";
        let scope = infer_scope(&path, "settings.local.json", Some("/tmp/test-project"));
        assert_eq!(format!("{:?}", scope), "ProjectLocal");
    }

    #[test]
    fn test_config_change_event_serialization() {
        // Test that ConfigScope and ConfigFileKind are serialized to snake_case
        let scope = ConfigScope::ProjectLocal;
        let kind = ConfigFileKind::SettingsLocal;

        let scope_str = serde_json::to_string(&scope)
            .unwrap()
            .trim_matches('"')
            .to_string();
        let kind_str = serde_json::to_string(&kind)
            .unwrap()
            .trim_matches('"')
            .to_string();

        assert_eq!(scope_str, "project_local");
        assert_eq!(kind_str, "settings_local");
    }
}
