use crate::config::{ConfigError, ConfigFileKind, ConfigScope, ConfigValue};
use std::fs;

/// Read a configuration file
pub fn read_config_file(path: &std::path::Path, kind: ConfigFileKind) -> Result<ConfigValue, ConfigError> {
    // Check if file exists
    if !path.exists() {
        return Ok(ConfigValue::NotFound);
    }

    // Read file content
    let content = fs::read_to_string(path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            ConfigError::PermissionDenied {
                path: path.display().to_string(),
            }
        } else {
            ConfigError::IoError {
                message: format!("Failed to read {}: {}", path.display(), e),
            }
        }
    })?;

    // Parse based on file type
    if kind.is_json() {
        parse_json_content(&content, path)
    } else {
        Ok(ConfigValue::Markdown { content })
    }
}

/// Parse JSON content
fn parse_json_content(content: &str, path: &std::path::Path) -> Result<ConfigValue, ConfigError> {
    match serde_json::from_str::<serde_json::Value>(content) {
        Ok(value) => Ok(ConfigValue::Json { value }),
        Err(e) => Err(ConfigError::ParseError {
            path: path.display().to_string(),
            message: format!("Invalid JSON: {}", e),
        }),
    }
}

/// Read settings.json with typed structure
pub fn read_settings_json(path: &std::path::Path) -> Result<Option<crate::config::SettingsJson>, ConfigError> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|e| ConfigError::IoError {
        message: format!("Failed to read {}: {}", path.display(), e),
    })?;

    match serde_json::from_str(&content) {
        Ok(settings) => Ok(Some(settings)),
        Err(e) => Err(ConfigError::ParseError {
            path: path.display().to_string(),
            message: format!("Invalid settings.json: {}", e),
        }),
    }
}

/// Read multiple config files
pub fn read_multiple_configs(
    paths: Vec<(ConfigScope, ConfigFileKind, std::path::PathBuf)>,
) -> Vec<(
    ConfigScope,
    ConfigFileKind,
    std::path::PathBuf,
    ConfigValue,
)> {
    paths
        .into_iter()
        .map(|(scope, kind, path)| {
            let value = read_config_file(&path, kind).unwrap_or(ConfigValue::NotFound);
            (scope, kind, path, value)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::Path;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_nonexistent_file() {
        let path = Path::new("/nonexistent/file.json");
        let result = read_config_file(path, ConfigFileKind::Settings).unwrap();
        assert!(matches!(result, ConfigValue::NotFound));
    }

    #[test]
    fn test_read_valid_json() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, r#"{{"model": "opus"}}"#).unwrap();

        let result = read_config_file(temp_file.path(), ConfigFileKind::Settings).unwrap();
        match result {
            ConfigValue::Json { value } => {
                assert_eq!(value["model"], "opus");
            }
            _ => panic!("Expected JSON value"),
        }
    }

    #[test]
    fn test_read_invalid_json() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "{{invalid json").unwrap();

        let result = read_config_file(temp_file.path(), ConfigFileKind::Settings);
        assert!(matches!(result, Err(ConfigError::ParseError { .. })));
    }

    #[test]
    fn test_read_markdown() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "# Test\nMarkdown content").unwrap();

        let result = read_config_file(temp_file.path(), ConfigFileKind::ClaudeMd).unwrap();
        match result {
            ConfigValue::Markdown { content } => {
                assert!(content.contains("# Test"));
            }
            _ => panic!("Expected Markdown value"),
        }
    }
}
