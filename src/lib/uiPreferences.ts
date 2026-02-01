import { invoke } from "@tauri-apps/api/core";

const UI_PREF_PREFIX = "ui.";

export const UI_PREFERENCE_KEYS = [
  // Home view
  "claudecodeimpact:home:activityViewMode",
  "claudecodeimpact:home:commandRange",
  "claudecodeimpact:home:commandMode",
  // Chat view
  "claudecodeimpact:originalChat",
  "claudecodeimpact:markdownPreview",
  "claudecodeimpact:sessions:contextTab",
  "claudecodeimpact:sessionSelectMode",
  "claudecodeimpact-hide-empty-sessions",
  "claudecodeimpact:userPromptsOnly",
  "claudecodeimpact:chatViewMode",
  "claudecodeimpact:allProjects:sortBy",
  "claudecodeimpact-hide-empty-sessions-all",
  // App
  "claudecodeimpact:sidebarCollapsed",
  "claudecodeimpact:marketplaceCategory",
  "claudecodeimpact:shortenPaths",
  "claudecodeimpact:profile",
  "claudecodeimpact:primaryFeature",
  // Components
  "claudecodeimpact:collapsibleStates",
  "claudecodeimpact:docReader:collapsedGroups",
  // Knowledge
  "claudecodeimpact:reference:collapsedGroups",
  "claudecodeimpact:reference:expandedSource",
  // Commands
  "claudecodeimpact:commands:sortKey",
  "claudecodeimpact:commands:sortDir",
  "claudecodeimpact:commands:showDeprecated",
  "claudecodeimpact:commands:viewMode",
  "claudecodeimpact:commands:expandedFolders",
  // Extensions
  "claudecodeimpact:extensions:viewMode",
  // Export dialog
  "claudecodeimpact:exportFormat",
  "claudecodeimpact:exportMdStyle",
  "claudecodeimpact:exportTruncate",
  "claudecodeimpact:exportSeparator",
  "claudecodeimpact:exportOriginal",
  "claudecodeimpact:exportWatermark",
  "claudecodeimpact:exportJsonPretty",
  // Analytics
  "claudecodeimpact:analytics:enabled",
  "claudecodeimpact:analytics:clientId",
  // Terminal
  "terminal:autoCopyOnSelect",
];

const RAW_STRING_KEYS = new Set<string>(["claudecodeimpact:analytics:clientId"]);

const preferenceCache = new Map<string, unknown>();
let initialized = false;

const toDataKey = (key: string) => `${UI_PREF_PREFIX}${key}`;

const canInvokeTauri = () =>
  typeof window !== "undefined" && typeof (window as { __TAURI__?: unknown }).__TAURI__ !== "undefined";
const canUseLocalStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

async function persistPreference(key: string, value: unknown): Promise<void> {
  if (!canInvokeTauri()) {
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore persistence failures to avoid blocking UI.
      }
    }
    return;
  }
  try {
    await invoke("set_ui_preference", { key: toDataKey(key), value });
  } catch {
    // Ignore persistence failures to avoid blocking UI.
  }
}

async function removePreference(key: string): Promise<void> {
  if (!canInvokeTauri()) {
    if (canUseLocalStorage()) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore removal failures to avoid blocking UI.
      }
    }
    return;
  }
  try {
    await invoke("remove_ui_preference", { key: toDataKey(key) });
  } catch {
    // Ignore persistence failures to avoid blocking UI.
  }
}

function migrateLocalStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!canUseLocalStorage()) {
    return;
  }

  const shouldRemoveLocal = canInvokeTauri();

  for (const key of UI_PREFERENCE_KEYS) {
    if (preferenceCache.has(key)) {
      if (shouldRemoveLocal) {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore removal errors.
        }
      }
      continue;
    }

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw === null) {
      continue;
    }

    let parsed: unknown = raw;
    if (!RAW_STRING_KEYS.has(key)) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    preferenceCache.set(key, parsed);
    if (shouldRemoveLocal) {
      void invoke("set_ui_preference", { key: toDataKey(key), value: parsed })
        .then(() => {
          try {
            localStorage.removeItem(key);
          } catch {
            // Ignore removal errors.
          }
        })
        .catch(() => {});
    }
  }
}

export async function initializeUiPreferences(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (canInvokeTauri()) {
    try {
      const keys = UI_PREFERENCE_KEYS.map(toDataKey);
      const stored = await invoke<Record<string, unknown>>("get_ui_preferences", { keys });
      if (stored) {
        for (const [dataKey, value] of Object.entries(stored)) {
          if (dataKey.startsWith(UI_PREF_PREFIX)) {
            const key = dataKey.slice(UI_PREF_PREFIX.length);
            if (!preferenceCache.has(key)) {
              preferenceCache.set(key, value);
            }
          }
        }
      }
    } catch {
      // Ignore load errors to keep UI responsive.
    }
  }

  migrateLocalStorage();
}

export function getUiPreference<T>(key: string): T | undefined {
  return preferenceCache.get(key) as T | undefined;
}

export function setUiPreference<T>(key: string, value: T): void {
  preferenceCache.set(key, value);
  void persistPreference(key, value);
}

export function removeUiPreference(key: string): void {
  preferenceCache.delete(key);
  void removePreference(key);
}

export function getSerializedUiPreference(key: string): string | null {
  if (preferenceCache.has(key)) {
    return JSON.stringify(preferenceCache.get(key));
  }
  if (!canInvokeTauri()) {
    try {
      return canUseLocalStorage() ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function setSerializedUiPreference(key: string, value: string): void {
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }
  setUiPreference(key, parsed);
}
