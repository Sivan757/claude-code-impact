import type { FeatureConfig, TemplateCategory } from "../types";

// ============================================================================
// Features Configuration
// ============================================================================

export const FEATURES: FeatureConfig[] = [
  // Workspace (parallel vibe coding)
  {
    type: "workspace",
    label: "Workspace",
    description: "Parallel vibe coding workspace",
    available: true,
    group: "history",
  },

  // Basic settings (no marketplace) - grouped under "Basic"
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
    type: "basic-version",
    label: "CC Version",
    description: "Claude Code version management",
    available: true,
    group: "basic",
  },
  {
    type: "settings",
    label: "Settings",
    description: "settings.json templates",
    available: true,
    group: "basic",
  },

  // Features (with marketplace) - 顺序: 上下文/插件/技能/子代理/指令/MCP/LSP/挂钩/状态栏
  {
    type: "context",
    label: "Context",
    description: "CLAUDE.md context files",
    available: true,
    group: "config",
  },
  {
    type: "extensions",
    label: "Extensions",
    description: "Claude Code plugins",
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
    type: "commands",
    label: "Commands",
    description: "Slash commands",
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
  {
    type: "lsp",
    label: "LSPs",
    description: "Language Server Protocol servers",
    available: true,
    group: "config",
  },
  {
    type: "hooks",
    label: "Hooks",
    description: "Automation triggers",
    available: true,
    group: "config",
  },
  {
    type: "statusline",
    label: "Status Line",
    description: "Custom CLI status line",
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
  { id: "lovstudio", label: "Lovstudio", tooltip: "github.com/markshawn2020/lovstudio-plugins-official" },
  { id: "community", label: "CCT", tooltip: "github.com/davila7/claude-code-templates" },
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
    { key: "commands", label: "Commands" },
    { key: "mcps", label: "MCPs" },
    { key: "skills", label: "Skills" },
    { key: "hooks", label: "Hooks" },
    { key: "agents", label: "Sub Agents" },
    { key: "output-styles", label: "Output Styles" },
    { key: "statuslines", label: "Status Line" },
  ];
