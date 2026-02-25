import type { TerminalPreference, UserProfile } from "@/types";

export const DEFAULT_TERMINAL_PREFERENCE: TerminalPreference = {
  mode: "system",
  customPath: "",
};

export type TerminalPlatform = "macos" | "windows" | "linux" | "unknown";

export interface TerminalAppOption {
  value: string;
  labelKey: string;
  fallbackLabel: string;
}

function normalizePlatformToken(platform: string): string {
  return platform.trim().toLowerCase();
}

export function detectTerminalPlatform(): TerminalPlatform {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const platform = normalizePlatformToken(navigator.platform || "");
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "unknown";
}

export function getTerminalAppOptions(platform = detectTerminalPlatform()): TerminalAppOption[] {
  switch (platform) {
    case "macos":
      return [
        { value: "Terminal", labelKey: "terminal_apps.macos.terminal", fallbackLabel: "Terminal.app" },
        { value: "iTerm2", labelKey: "terminal_apps.macos.iterm2", fallbackLabel: "iTerm2" },
        { value: "Warp", labelKey: "terminal_apps.macos.warp", fallbackLabel: "Warp" },
        { value: "WezTerm", labelKey: "terminal_apps.macos.wezterm", fallbackLabel: "WezTerm" },
        { value: "Ghostty", labelKey: "terminal_apps.macos.ghostty", fallbackLabel: "Ghostty" },
      ];
    case "windows":
      return [
        { value: "wt", labelKey: "terminal_apps.windows.wt", fallbackLabel: "Windows Terminal" },
        { value: "powershell", labelKey: "terminal_apps.windows.powershell", fallbackLabel: "PowerShell" },
        { value: "cmd", labelKey: "terminal_apps.windows.cmd", fallbackLabel: "Command Prompt" },
      ];
    case "linux":
      return [
        { value: "x-terminal-emulator", labelKey: "terminal_apps.linux.system", fallbackLabel: "System Terminal" },
        { value: "gnome-terminal", labelKey: "terminal_apps.linux.gnome_terminal", fallbackLabel: "GNOME Terminal" },
        { value: "konsole", labelKey: "terminal_apps.linux.konsole", fallbackLabel: "Konsole" },
        { value: "xfce4-terminal", labelKey: "terminal_apps.linux.xfce_terminal", fallbackLabel: "Xfce Terminal" },
        { value: "xterm", labelKey: "terminal_apps.linux.xterm", fallbackLabel: "xterm" },
      ];
    default:
      return [];
  }
}

function normalizeAppValue(value: string): string {
  return value.trim().toLowerCase();
}

function pickFileName(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : value;
}

export function resolveTerminalAppLabel(
  appValue: string,
  platform = detectTerminalPlatform(),
  translate?: (key: string, fallback: string) => string,
): string {
  const normalized = normalizeAppValue(appValue);
  const options = getTerminalAppOptions(platform);
  const matched = options.find((option) => normalizeAppValue(option.value) === normalized);
  if (matched) {
    return translate ? translate(matched.labelKey, matched.fallbackLabel) : matched.fallbackLabel;
  }
  return pickFileName(appValue);
}

export function normalizeTerminalPreference(
  preference?: Partial<TerminalPreference> | null,
): TerminalPreference {
  const mode = preference?.mode === "custom" ? "custom" : "system";
  const customPath = typeof preference?.customPath === "string" ? preference.customPath : "";

  return {
    mode,
    customPath,
  };
}

export function getPreferredTerminalApp(profile?: UserProfile | null): string | undefined {
  const preference = normalizeTerminalPreference(profile?.terminalPreference);
  if (preference.mode !== "custom") {
    return undefined;
  }

  const customPath = preference.customPath.trim();
  return customPath.length > 0 ? customPath : undefined;
}
