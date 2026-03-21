export type ModelType = "opus" | "sonnet" | "haiku";

export interface LaunchSettingsRequest {
  project_path?: string;
  provider_name?: string;
  model?: string;
  permission_mode?: "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan";
  env_overrides?: Record<string, string>;
  enabled_plugins?: Record<string, boolean>;
}

export interface LaunchDraftResponse {
  settings: Record<string, unknown>;
}

export interface MaterializedLaunchDraftResponse {
  draft_id: string;
  project_path: string;
  settings_path: string;
}

export const MODEL_OPTIONS: ReadonlyArray<{ value: ModelType; label: string }> = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

export function getProjectDisplayName(projectPath: string, fallback?: string): string {
  return fallback || projectPath.split("/").filter(Boolean).pop() || projectPath;
}

function normalizeLaunchPrompt(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractFirstLaunchSentence(value: string): string {
  const normalized = normalizeLaunchPrompt(value);
  if (!normalized) return "";

  const sentenceMatch = normalized.match(/^(.+?[。！？.!?])(?:\s|$)/u);
  return sentenceMatch?.[1]?.trim() ?? normalized;
}

function sanitizePromptForShell(value: string): string {
  return extractFirstLaunchSentence(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["`]/g, "'")
    .trim();
}

export function buildClaudeLaunchCommand(settingsPath: string, prompt?: string): string {
  const escapedSettingsPath = settingsPath.replace(/"/g, '\\"');
  const base = `claude --settings "${escapedSettingsPath}"`;
  const launchPrompt = sanitizePromptForShell(prompt ?? "");

  if (!launchPrompt) {
    return base;
  }

  return `${base} "${launchPrompt}"`;
}
