import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getUiPreference, setUiPreference } from "@/lib/uiPreferences";

export type ViewMode = "list" | "card";

const VIEW_MODE_KEY_PREFIX = "claudecodeimpact:viewMode:";

/**
 * Hook for managing view mode state persisted by the backend UI preference store.
 * @param key - Unique key for this view mode (e.g., "skills", "agents")
 * @param defaultMode - Default view mode if none is stored
 */
export function useViewMode(
  key: string,
  defaultMode: ViewMode = "list"
): {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
} {
  const preferenceKey = `${VIEW_MODE_KEY_PREFIX}${key}`;

  const [mode, setModeState] = useState<ViewMode>(() => {
    const stored = getUiPreference<ViewMode>(preferenceKey);
    if (stored === "list" || stored === "card") {
      return stored;
    }
    return defaultMode;
  });

  const setMode = useCallback(
    (newMode: ViewMode) => {
      setModeState(newMode);
      setUiPreference(preferenceKey, newMode);
    },
    [preferenceKey]
  );

  useEffect(() => {
    const tauriAvailable = typeof window !== "undefined" && typeof (window as { __TAURI__?: unknown }).__TAURI__ !== "undefined";
    if (!tauriAvailable) {
      return;
    }

    let active = true;
    void invoke<unknown>("get_ui_preference", { key: `ui.${preferenceKey}` })
      .then((value) => {
        if (!active) return;
        if (value === "list" || value === "card") {
          setModeState(value);
          setUiPreference(preferenceKey, value);
        }
      })
      .catch(() => {
        // Ignore load failures.
      });

    return () => {
      active = false;
    };
  }, [preferenceKey]);

  return { mode, setMode };
}
