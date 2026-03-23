// Configuration scope priority (highest to lowest)
export enum ConfigScope {
  Managed = "managed",
  ProjectLocal = "project_local",
  Project = "project",
  UserLocal = "user_local",
  User = "user",
  Default = "default",
}

// Type of configuration file
export enum ConfigFileKind {
  Settings = "settings",
  SettingsLocal = "settings_local",
  ClaudeMd = "claude_md",
  ClaudeMdLocal = "claude_md_local",
  McpJson = "mcp_json",
  ApiConfig = "api_config",
  LegacyConfig = "legacy_config",
  Managed = "managed",
  PluginManifest = "plugin_manifest",
}

// Settings structure
export type SettingsEffortLevel = "low" | "medium" | "high";

export interface SpinnerTipsOverrideConfig {
  excludeDefault?: boolean;
  tips?: string[];
}

export interface SettingsJson {
  model?: string;
  availableModels?: string[];
  modelOverrides?: Record<string, string>;
  effortLevel?: SettingsEffortLevel;
  alwaysThinkingEnabled?: boolean;
  always_thinking_enabled?: boolean;
  autoMemoryDirectory?: string;
  plansDirectory?: string;
  companyAnnouncements?: string[];
  permissions?: PermissionsConfig;
  env?: Record<string, string>;
  hooks?: Record<string, HookMatcher[]>;
  allowManagedHooksOnly?: boolean;
  allowedHttpHookUrls?: string[];
  httpHookAllowedEnvVars?: string[];
  allowManagedPermissionRulesOnly?: boolean;
  allowManagedMcpServersOnly?: boolean;
  mcpServers?: Record<string, McpServerConfig>;
  mcp_servers?: Record<string, McpServerConfig>;
  channelsEnabled?: boolean;
  enabledPlugins?: Record<string, boolean>;
  enabled_plugins?: Record<string, boolean>;
  projects?: Record<string, unknown>;
  sandbox?: SandboxConfig;
  attribution?: AttributionConfig;
  language?: string;
  autoUpdatesChannel?: "latest" | "stable";
  showTurnDuration?: boolean;
  spinnerTipsEnabled?: boolean;
  spinnerTipsOverride?: SpinnerTipsOverrideConfig;
  terminalProgressBarEnabled?: boolean;
  prefersReducedMotion?: boolean;
  feedbackSurveyRate?: number;
  cleanupPeriodDays?: number;
  cleanup_period_days?: number;
  disableAllHooks?: boolean;
  disable_all_hooks?: boolean;
}

// Permissions configuration
export interface PermissionsConfig {
  allow: string[];
  deny: string[];
  ask: string[];
  default_mode?: string;
}

// Hook entry
export interface HookEntry {
  type: string;
  command?: string;
  prompt?: string;
  url?: string;
  async?: boolean;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

// MCP server configuration
export interface McpServerConfig {
  description?: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

// Sandbox configuration
export interface SandboxConfig {
  enabled?: boolean;
}

// Attribution configuration
export interface AttributionConfig {
  enabled?: boolean;
  commit?: string;
  pr?: string;
}

// Provenance tracking
export interface ProvenanceEntry {
  value: unknown;
  scope: ConfigScope;
  file_path: string;
  key: string;
}

// CLAUDE.md view with sources
export interface ClaudeMdView {
  combined_content: string;
  sources: ClaudeMdSource[];
}

// Source of a CLAUDE.md section
export interface ClaudeMdSource {
  scope: ConfigScope;
  file_path: string;
  content: string;
}

// Merged MCP servers view
export interface MergedMcpView {
  servers: Record<string, McpServerConfig>;
  sources: Record<string, ConfigScope>;
}

// Complete merged configuration with provenance
export interface MergedConfigView {
  effective: Record<string, unknown>;
  provenance: Record<string, ProvenanceEntry>;
  claude_md: ClaudeMdView;
  mcp_servers: MergedMcpView;
  parse_errors: ParseError[];
}

// Parse error encountered during config merge
export interface ParseError {
  scope: ConfigScope;
  file_path: string;
  error: string;
}

// Configuration value result
export type ConfigValue =
  | { type: "json"; value: unknown }
  | { type: "markdown"; content: string }
  | { type: "not_found" };

// Write result with before/after snapshots
export interface WriteResult {
  path: string;
  before?: unknown;
  after: unknown;
  backup_path?: string;
}

// Backup entry
export interface BackupEntry {
  path: string;
  timestamp: number;
  size: number;
}

// Validation violation
export interface ValidationViolation {
  severity: "error" | "warning";
  field: string;
  message: string;
}

// Config change event
export interface ConfigChangeEvent {
  kind: string;
  scope: string;
  path: string;
}
