use crate::config::{ConfigError, ConfigFileKind, ConfigScope};
use std::path::{Path, PathBuf};

/// Resolve the path for a configuration file
pub fn resolve_config_path(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<&str>,
) -> Result<PathBuf, ConfigError> {
    match scope {
        ConfigScope::User => resolve_user_path(kind),
        ConfigScope::UserLocal => resolve_user_local_path(kind),
        ConfigScope::Project => resolve_project_path(kind, project_path),
        ConfigScope::ProjectLocal => resolve_project_local_path(kind, project_path),
        ConfigScope::Managed => resolve_managed_path(kind),
        ConfigScope::Default => Err(ConfigError::Other {
            message: "Default scope has no file path".to_string(),
        }),
    }
}

/// Resolve user-level config path (~/.claude/)
fn resolve_user_path(kind: ConfigFileKind) -> Result<PathBuf, ConfigError> {
    let home_dir = dirs::home_dir().ok_or_else(|| ConfigError::Other {
        message: "Could not determine home directory".to_string(),
    })?;

    let base_dir = match kind {
        ConfigFileKind::LegacyConfig => home_dir.clone(),
        _ => home_dir.join(".claude"),
    };

    Ok(base_dir.join(kind.filename()))
}

/// Resolve user-local config path (~/.claude/*.local.json)
fn resolve_user_local_path(kind: ConfigFileKind) -> Result<PathBuf, ConfigError> {
    let home_dir = dirs::home_dir().ok_or_else(|| ConfigError::Other {
        message: "Could not determine home directory".to_string(),
    })?;

    Ok(home_dir.join(".claude").join(kind.filename()))
}

/// Resolve project-level config path (.claude/)
fn resolve_project_path(
    kind: ConfigFileKind,
    project_path: Option<&str>,
) -> Result<PathBuf, ConfigError> {
    let project_dir = project_path.ok_or_else(|| ConfigError::Other {
        message: "Project path required for project scope".to_string(),
    })?;

    let base_dir = match kind {
        ConfigFileKind::McpJson => PathBuf::from(project_dir),
        _ => PathBuf::from(project_dir).join(".claude"),
    };

    Ok(base_dir.join(kind.filename()))
}

/// Resolve project-local config path (.claude/*.local.json)
fn resolve_project_local_path(
    kind: ConfigFileKind,
    project_path: Option<&str>,
) -> Result<PathBuf, ConfigError> {
    let project_dir = project_path.ok_or_else(|| ConfigError::Other {
        message: "Project path required for project-local scope".to_string(),
    })?;

    Ok(PathBuf::from(project_dir)
        .join(".claude")
        .join(kind.filename()))
}

/// Resolve managed config path (OS-specific)
fn resolve_managed_path(kind: ConfigFileKind) -> Result<PathBuf, ConfigError> {
    #[cfg(target_os = "macos")]
    {
        let path = PathBuf::from("/Library/Application Support/ClaudeCode")
            .join(kind.filename());
        return Ok(path);
    }

    #[cfg(target_os = "linux")]
    {
        let path = PathBuf::from("/etc/claude-code").join(kind.filename());
        return Ok(path);
    }

    #[cfg(target_os = "windows")]
    {
        use std::env;
        let program_data = env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
        let path = PathBuf::from(program_data)
            .join("ClaudeCode")
            .join(kind.filename());
        return Ok(path);
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err(ConfigError::Other {
            message: "Managed scope not supported on this platform".to_string(),
        })
    }
}

/// Get all config paths for a given project
pub fn get_all_config_paths(project_path: Option<&str>) -> Result<Vec<(ConfigScope, ConfigFileKind, PathBuf)>, ConfigError> {
    let mut paths = Vec::new();

    // User scope
    for kind in [
        ConfigFileKind::Settings,
        ConfigFileKind::ClaudeMd,
        ConfigFileKind::ApiConfig,
        ConfigFileKind::LegacyConfig,
    ] {
        if let Ok(path) = resolve_config_path(kind, ConfigScope::User, None) {
            paths.push((ConfigScope::User, kind, path));
        }
    }

    // User local scope
    for kind in [ConfigFileKind::SettingsLocal] {
        if let Ok(path) = resolve_config_path(kind, ConfigScope::UserLocal, None) {
            paths.push((ConfigScope::UserLocal, kind, path));
        }
    }

    // Project scopes (if project path provided)
    if project_path.is_some() {
        for kind in [
            ConfigFileKind::Settings,
            ConfigFileKind::ClaudeMd,
            ConfigFileKind::McpJson,
        ] {
            if let Ok(path) = resolve_config_path(kind, ConfigScope::Project, project_path) {
                paths.push((ConfigScope::Project, kind, path));
            }
        }

        for kind in [ConfigFileKind::SettingsLocal, ConfigFileKind::ClaudeMdLocal] {
            if let Ok(path) = resolve_config_path(kind, ConfigScope::ProjectLocal, project_path) {
                paths.push((ConfigScope::ProjectLocal, kind, path));
            }
        }
    }

    // Managed scope
    for kind in [ConfigFileKind::Managed] {
        if let Ok(path) = resolve_config_path(kind, ConfigScope::Managed, None) {
            paths.push((ConfigScope::Managed, kind, path));
        }
    }

    Ok(paths)
}

/// Ensure parent directory exists
pub fn ensure_parent_dir(path: &Path) -> Result<(), ConfigError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| ConfigError::IoError {
            message: format!("Failed to create directory {}: {}", parent.display(), e),
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_path_resolution() {
        let path = resolve_user_path(ConfigFileKind::Settings).unwrap();
        assert!(path.to_string_lossy().contains(".claude"));
        assert!(path.to_string_lossy().ends_with("settings.json"));
    }

    #[test]
    fn test_legacy_config_path() {
        let path = resolve_user_path(ConfigFileKind::LegacyConfig).unwrap();
        assert!(path.to_string_lossy().ends_with(".claude.json"));
    }

    #[test]
    fn test_project_path_requires_project_dir() {
        let result = resolve_project_path(ConfigFileKind::Settings, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_mcp_json_in_project_root() {
        let path = resolve_project_path(ConfigFileKind::McpJson, Some("/tmp/project")).unwrap();
        assert_eq!(path, PathBuf::from("/tmp/project/.mcp.json"));
    }
}
