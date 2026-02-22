use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration scope priority (highest to lowest)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfigScope {
    Managed,
    ProjectLocal,
    Project,
    UserLocal,
    User,
    Default,
}

impl ConfigScope {
    /// Get all scopes in priority order (highest to lowest)
    pub fn all_in_priority_order() -> Vec<ConfigScope> {
        vec![
            ConfigScope::Managed,
            ConfigScope::ProjectLocal,
            ConfigScope::Project,
            ConfigScope::UserLocal,
            ConfigScope::User,
            ConfigScope::Default,
        ]
    }

    /// Check if this scope is writable
    pub fn is_writable(&self) -> bool {
        matches!(
            self,
            ConfigScope::User
                | ConfigScope::UserLocal
                | ConfigScope::Project
                | ConfigScope::ProjectLocal
        )
    }
}

/// Type of configuration file
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfigFileKind {
    Settings,
    SettingsLocal,
    ClaudeMd,
    ClaudeMdLocal,
    McpJson,
    ApiConfig,
    LegacyConfig,
    Managed,
    PluginManifest,
}

impl ConfigFileKind {
    /// Get the filename for this kind
    pub fn filename(&self) -> &str {
        match self {
            ConfigFileKind::Settings => "settings.json",
            ConfigFileKind::SettingsLocal => "settings.local.json",
            ConfigFileKind::ClaudeMd => "CLAUDE.md",
            ConfigFileKind::ClaudeMdLocal => "CLAUDE.local.md",
            ConfigFileKind::McpJson => ".mcp.json",
            ConfigFileKind::ApiConfig => "config.json",
            ConfigFileKind::LegacyConfig => ".claude.json",
            ConfigFileKind::Managed => "managed-settings.json",
            ConfigFileKind::PluginManifest => "plugin.json",
        }
    }

    /// Check if this kind is a JSON file
    pub fn is_json(&self) -> bool {
        !matches!(self, ConfigFileKind::ClaudeMd | ConfigFileKind::ClaudeMdLocal)
    }
}

/// Settings structure matching Claude Code settings.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SettingsJson {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub always_thinking_enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<PermissionsConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub hooks: Option<HashMap<String, Vec<HookEntry>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<HashMap<String, McpServerConfig>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled_plugins: Option<HashMap<String, bool>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub projects: Option<HashMap<String, serde_json::Value>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<SandboxConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub attribution: Option<AttributionConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleanup_period_days: Option<u32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable_all_hooks: Option<bool>,
}

/// Permissions configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PermissionsConfig {
    #[serde(default)]
    pub allow: Vec<String>,

    #[serde(default)]
    pub deny: Vec<String>,

    #[serde(default)]
    pub ask: Vec<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_mode: Option<String>,
}

/// Hook entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEntry {
    pub r#type: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub matcher: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
}

/// MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Sandbox configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SandboxConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

/// Attribution configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AttributionConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

/// Provenance tracking for a configuration value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceEntry {
    pub value: serde_json::Value,
    pub scope: ConfigScope,
    pub file_path: String,
    pub key: String,
}

/// CLAUDE.md view with sources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMdView {
    pub combined_content: String,
    pub sources: Vec<ClaudeMdSource>,
}

/// Source of a CLAUDE.md section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMdSource {
    pub scope: ConfigScope,
    pub file_path: String,
    pub content: String,
}

/// Merged MCP servers view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergedMcpView {
    pub servers: HashMap<String, McpServerConfig>,
    pub sources: HashMap<String, ConfigScope>,
}

/// Complete merged configuration with provenance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergedConfigView {
    pub effective: serde_json::Value,
    pub provenance: HashMap<String, ProvenanceEntry>,
    pub claude_md: ClaudeMdView,
    pub mcp_servers: MergedMcpView,
    pub parse_errors: Vec<ParseError>,
}

/// Parse error encountered during config merge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseError {
    pub scope: ConfigScope,
    pub file_path: String,
    pub error: String,
}

/// Configuration value result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ConfigValue {
    Json { value: serde_json::Value },
    Markdown { content: String },
    NotFound,
}

/// Write result with before/after snapshots
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteResult {
    pub path: String,
    pub before: Option<serde_json::Value>,
    pub after: serde_json::Value,
    pub backup_path: Option<String>,
}

/// Backup entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntry {
    pub path: String,
    pub timestamp: u64,
    pub size: u64,
}
