import type { McpServerConfig } from "../types";

/** Template merge mode */
export type MergeMode = "replace" | "merge" | "fill";

/** A full configuration template */
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  created_at: number;
  updated_at: number;
  is_builtin: boolean;
  config: Record<string, unknown>;
  env?: Record<string, string> | null;
  hooks?: Record<string, unknown> | null;
  mcp_servers?: Record<string, McpServerConfig> | null;
}

/** Lightweight template listing entry */
export interface TemplateListEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  is_builtin: boolean;
  created_at: number;
  updated_at: number;
  model?: string | null;
  mcp_count: number;
  env_count: number;
  permission_mode?: string | null;
  provider_name?: string | null;
  has_hooks: boolean;
}

/** Exported config bundle */
export interface ExportedConfig {
  version: number;
  timestamp: number;
  source_project?: string | null;
  files: Record<string, unknown>;
}
