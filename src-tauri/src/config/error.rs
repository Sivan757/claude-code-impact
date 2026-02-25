use std::fmt;

/// Configuration error types
#[derive(Debug, Clone)]
pub enum ConfigError {
    /// File not found at the specified path
    NotFound { path: String },

    /// Failed to parse the configuration file
    ParseError { path: String, message: String },

    /// Validation failed
    ValidationError {
        violations: Vec<ValidationViolation>,
    },

    /// Scope is read-only
    ReadOnly { scope: String, reason: String },

    /// Write operation failed
    WriteFailed {
        path: String,
        backup: Option<String>,
        message: String,
    },

    /// Permission denied
    PermissionDenied { path: String },

    /// File watching error
    WatchError { message: String },

    /// IO error
    IoError { message: String },

    /// Other error
    Other { message: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::NotFound { path } => {
                write!(f, "Configuration file not found: {}", path)
            }
            ConfigError::ParseError { path, message } => {
                write!(f, "Failed to parse {}: {}", path, message)
            }
            ConfigError::ValidationError { violations } => {
                write!(f, "Validation failed: {} violation(s)", violations.len())
            }
            ConfigError::ReadOnly { scope, reason } => {
                write!(f, "Scope '{}' is read-only: {}", scope, reason)
            }
            ConfigError::WriteFailed {
                path,
                backup,
                message,
            } => {
                if let Some(backup_path) = backup {
                    write!(
                        f,
                        "Write failed for {}: {}. Backup at: {}",
                        path, message, backup_path
                    )
                } else {
                    write!(f, "Write failed for {}: {}", path, message)
                }
            }
            ConfigError::PermissionDenied { path } => {
                write!(f, "Permission denied: {}", path)
            }
            ConfigError::WatchError { message } => {
                write!(f, "File watching error: {}", message)
            }
            ConfigError::IoError { message } => {
                write!(f, "IO error: {}", message)
            }
            ConfigError::Other { message } => write!(f, "{}", message),
        }
    }
}

impl std::error::Error for ConfigError {}

impl From<std::io::Error> for ConfigError {
    fn from(err: std::io::Error) -> Self {
        ConfigError::IoError {
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ConfigError {
    fn from(err: serde_json::Error) -> Self {
        ConfigError::Other {
            message: format!("JSON error: {}", err),
        }
    }
}

/// Validation violation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationViolation {
    pub severity: ViolationSeverity,
    pub field: String,
    pub message: String,
}

/// Violation severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViolationSeverity {
    Error,
    Warning,
}
