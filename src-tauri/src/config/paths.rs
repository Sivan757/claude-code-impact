use crate::config::{ConfigError, ConfigFileKind, ConfigScope};
use crate::infra::{
    get_claudecodeimpact_dir, resolve_claude_dir, resolve_mcp_config_path, resolve_settings_path,
};
use std::fs;
use std::path::{Path, PathBuf};

fn get_config_root_dir() -> Result<PathBuf, ConfigError> {
    let home_dir = dirs::home_dir().ok_or_else(|| ConfigError::Other {
        message: "Could not determine home directory".to_string(),
    })?;
    Ok(home_dir.join(".claudecodeimpact").join("config"))
}

fn migrate_legacy_config_file_if_needed(target: &Path, legacy: &Path) -> Result<(), ConfigError> {
    if target.exists() || !legacy.exists() || legacy.is_dir() {
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| ConfigError::IoError {
            message: format!(
                "Failed to create migration parent {}: {}",
                parent.display(),
                e
            ),
        })?;
    }
    fs::copy(legacy, target).map_err(|e| ConfigError::IoError {
        message: format!(
            "Failed to migrate legacy config {} -> {}: {}",
            legacy.display(),
            target.display(),
            e
        ),
    })?;
    Ok(())
}

fn managed_settings_dir() -> PathBuf {
    get_claudecodeimpact_dir().join("settings-scopes")
}

fn resolve_settings_scope_path(
    scope: ConfigScope,
    project_path: Option<&str>,
    local_variant: bool,
) -> Result<PathBuf, ConfigError> {
    let mut target = match scope {
        ConfigScope::User | ConfigScope::UserLocal => resolve_settings_path(None),
        ConfigScope::Project | ConfigScope::ProjectLocal => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            resolve_settings_path(Some(project_dir.to_string()))
        }
        ConfigScope::Managed => managed_settings_dir().join("managed-settings.json"),
        ConfigScope::Default => {
            return Err(ConfigError::Other {
                message: "Default scope has no file path".to_string(),
            })
        }
    };

    if local_variant {
        let stem = target
            .file_stem()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| "settings".to_string());
        target.set_file_name(format!("{}.local.json", stem));
    }

    Ok(target)
}

fn resolve_claude_scope_path(
    scope: ConfigScope,
    project_path: Option<&str>,
    local_variant: bool,
) -> Result<PathBuf, ConfigError> {
    let mut base = match scope {
        ConfigScope::User | ConfigScope::UserLocal => resolve_claude_dir(None),
        ConfigScope::Project | ConfigScope::ProjectLocal => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            resolve_claude_dir(Some(project_dir))
        }
        ConfigScope::Managed => {
            return Err(ConfigError::Other {
                message: "Managed scope has no CLAUDE.md path".to_string(),
            })
        }
        ConfigScope::Default => {
            return Err(ConfigError::Other {
                message: "Default scope has no file path".to_string(),
            })
        }
    };
    base.push(if local_variant {
        "CLAUDE.local.md"
    } else {
        "CLAUDE.md"
    });
    Ok(base)
}

fn legacy_path_for_kind(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<&str>,
) -> Option<PathBuf> {
    let legacy_root = get_config_root_dir().ok()?;
    let legacy = match scope {
        ConfigScope::User => match kind {
            ConfigFileKind::Settings => legacy_root.join("user").join("settings.json"),
            ConfigFileKind::SettingsLocal => {
                legacy_root.join("user-local").join("settings.local.json")
            }
            ConfigFileKind::ClaudeMd => legacy_root.join("user").join("CLAUDE.md"),
            ConfigFileKind::ClaudeMdLocal => legacy_root.join("user-local").join("CLAUDE.local.md"),
            ConfigFileKind::McpJson => legacy_root.join("user").join(".mcp.json"),
            ConfigFileKind::ApiConfig => legacy_root.join("user").join("config.json"),
            ConfigFileKind::LegacyConfig => legacy_root.join("user").join(".claude.json"),
            ConfigFileKind::Managed => legacy_root.join("managed").join("managed-settings.json"),
            ConfigFileKind::PluginManifest => legacy_root.join("user").join("plugin.json"),
        },
        ConfigScope::UserLocal => match kind {
            ConfigFileKind::Settings | ConfigFileKind::SettingsLocal => {
                legacy_root.join("user-local").join(kind.filename())
            }
            ConfigFileKind::ClaudeMd | ConfigFileKind::ClaudeMdLocal => {
                legacy_root.join("user-local").join(kind.filename())
            }
            _ => return None,
        },
        ConfigScope::Project | ConfigScope::ProjectLocal => {
            let project_dir = project_path?;
            let scope_id = crate::services::project_paths::encode_project_path(
                crate::services::platform::resolve_user_path(project_dir)
                    .to_string_lossy()
                    .as_ref(),
            );
            let folder = if scope == ConfigScope::Project {
                "projects"
            } else {
                "projects-local"
            };
            legacy_root
                .join(folder)
                .join(scope_id)
                .join(kind.filename())
        }
        ConfigScope::Managed => legacy_root.join("managed").join(kind.filename()),
        ConfigScope::Default => return None,
    };
    Some(legacy)
}

/// Resolve the path for a configuration file
pub fn resolve_config_path(
    kind: ConfigFileKind,
    scope: ConfigScope,
    project_path: Option<&str>,
) -> Result<PathBuf, ConfigError> {
    let target = match (kind, scope) {
        (ConfigFileKind::Settings, _) => resolve_settings_scope_path(scope, project_path, false)?,
        (ConfigFileKind::SettingsLocal, _) => {
            resolve_settings_scope_path(scope, project_path, true)?
        }
        (ConfigFileKind::ClaudeMd, _) => resolve_claude_scope_path(scope, project_path, false)?,
        (ConfigFileKind::ClaudeMdLocal, _) => resolve_claude_scope_path(scope, project_path, true)?,
        (ConfigFileKind::McpJson, ConfigScope::User | ConfigScope::UserLocal) => {
            resolve_mcp_config_path(None)
        }
        (ConfigFileKind::McpJson, ConfigScope::Project | ConfigScope::ProjectLocal) => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            resolve_mcp_config_path(Some(project_dir))
        }
        (ConfigFileKind::McpJson, ConfigScope::Managed) => {
            return Err(ConfigError::Other {
                message: "Managed scope has no MCP json path".to_string(),
            });
        }
        (ConfigFileKind::ApiConfig, ConfigScope::User | ConfigScope::UserLocal) => {
            resolve_claude_dir(None).join("config.json")
        }
        (ConfigFileKind::ApiConfig, ConfigScope::Project | ConfigScope::ProjectLocal) => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            resolve_claude_dir(Some(project_dir)).join("config.json")
        }
        (ConfigFileKind::ApiConfig, ConfigScope::Managed) => {
            return Err(ConfigError::Other {
                message: "Managed scope has no API config path".to_string(),
            });
        }
        (ConfigFileKind::LegacyConfig, ConfigScope::User | ConfigScope::UserLocal) => {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".claude.json")
        }
        (ConfigFileKind::LegacyConfig, ConfigScope::Project | ConfigScope::ProjectLocal) => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            crate::services::platform::resolve_user_path(project_dir).join(".claude.json")
        }
        (ConfigFileKind::LegacyConfig, ConfigScope::Managed) => {
            return Err(ConfigError::Other {
                message: "Managed scope has no legacy config path".to_string(),
            });
        }
        (ConfigFileKind::Managed, _) => managed_settings_dir().join("managed-settings.json"),
        (ConfigFileKind::PluginManifest, ConfigScope::User | ConfigScope::UserLocal) => {
            resolve_claude_dir(None).join("plugins").join("plugin.json")
        }
        (ConfigFileKind::PluginManifest, ConfigScope::Project | ConfigScope::ProjectLocal) => {
            let project_dir = project_path.ok_or_else(|| ConfigError::Other {
                message: "Project path required for project scope".to_string(),
            })?;
            resolve_claude_dir(Some(project_dir))
                .join("plugins")
                .join("plugin.json")
        }
        (ConfigFileKind::PluginManifest, ConfigScope::Managed) => {
            return Err(ConfigError::Other {
                message: "Managed scope has no plugin manifest path".to_string(),
            });
        }
        (_, ConfigScope::Default) => {
            return Err(ConfigError::Other {
                message: "Default scope has no file path".to_string(),
            });
        }
    };

    if let Some(legacy) = legacy_path_for_kind(kind, scope, project_path) {
        migrate_legacy_config_file_if_needed(&target, &legacy)?;
    }

    Ok(target)
}

/// Get all config paths for a given project
pub fn get_all_config_paths(
    project_path: Option<&str>,
) -> Result<Vec<(ConfigScope, ConfigFileKind, PathBuf)>, ConfigError> {
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
        let path = resolve_config_path(ConfigFileKind::Settings, ConfigScope::User, None).unwrap();
        assert!(path.to_string_lossy().contains(".claude"));
        assert!(path.to_string_lossy().ends_with("settings.json"));
    }

    #[test]
    fn test_legacy_config_path() {
        let path =
            resolve_config_path(ConfigFileKind::LegacyConfig, ConfigScope::User, None).unwrap();
        assert!(path.to_string_lossy().ends_with(".claude.json"));
    }

    #[test]
    fn test_project_path_requires_project_dir() {
        let result = resolve_config_path(ConfigFileKind::Settings, ConfigScope::Project, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_mcp_json_in_project_root() {
        let path = resolve_config_path(
            ConfigFileKind::McpJson,
            ConfigScope::Project,
            Some("/tmp/project"),
        )
        .unwrap();
        assert!(path.to_string_lossy().contains("/tmp/project"));
        assert!(path.to_string_lossy().ends_with(".mcp.json"));
    }

    #[test]
    fn test_user_claude_md_path_resolution() {
        let path = resolve_config_path(ConfigFileKind::ClaudeMd, ConfigScope::User, None).unwrap();
        assert!(path.to_string_lossy().contains(".claude"));
        assert!(path.to_string_lossy().ends_with("CLAUDE.md"));
    }
}
