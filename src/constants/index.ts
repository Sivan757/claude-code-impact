import type { FeatureConfig, TemplateCategory } from "../types";

// ============================================================================
// Features Configuration
// ============================================================================

export const FEATURES: FeatureConfig[] = [


  // Basic settings (no marketplace) - grouped under "Basic"
  {
    type: "settings",
    label: "Settings",
    description: "settings.json templates",
    available: true,
    group: "basic",
  },
  {
    type: "basic-env",
    label: "Environment",
    description: "Environment variables",
    available: true,
    group: "basic",
  },
  {
    type: "basic-llm",
    label: "LLM Provider",
    description: "LLM proxy configuration",
    available: true,
    group: "basic",
  },
  {
    type: "extensions",
    label: "Extensions",
    description: "Claude Code plugins",
    available: true,
    group: "basic",
  },
  {
    type: "hooks",
    label: "Hooks",
    description: "Automation triggers",
    available: true,
    group: "basic",
  },

  // Features (with marketplace) - 顺序: 上下文/插件/技能/子代理/MCP/LSP/挂钩
  {
    type: "context",
    label: "Context",
    description: "CLAUDE.md context files",
    available: true,
    group: "config",
  },

  {
    type: "skills",
    label: "Skills",
    description: "Reusable skill templates",
    available: true,
    group: "config",
  },
  {
    type: "sub-agents",
    label: "Sub Agents",
    description: "AI agents with models",
    available: true,
    group: "config",
  },
  {
    type: "mcp",
    label: "MCPs",
    description: "MCP servers",
    available: true,
    group: "config",
  },

];

// ============================================================================
// Source Filters
// ============================================================================

export const SOURCE_FILTERS = [
  { id: "all", label: "All", tooltip: "All sources" },
  { id: "anthropic", label: "Anthropic", tooltip: "github.com/anthropics/claude-plugins-official" },
] as const;

export type SourceFilterId = (typeof SOURCE_FILTERS)[number]["id"];

// ============================================================================
// Template Categories
// ============================================================================

export const TEMPLATE_CATEGORIES: {
  key: TemplateCategory;
  label: string;
}[] = [
    { key: "settings", label: "Settings" },
    { key: "context", label: "Context" },
    { key: "mcps", label: "MCPs" },
    { key: "skills", label: "Skills" },
    { key: "hooks", label: "Hooks" },
    { key: "agents", label: "Sub Agents" },
  ];
