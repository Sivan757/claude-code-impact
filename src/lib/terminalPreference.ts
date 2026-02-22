import type { TerminalPreference, UserProfile } from "@/types";

export const DEFAULT_TERMINAL_PREFERENCE: TerminalPreference = {
  mode: "system",
  customPath: "",
};

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
