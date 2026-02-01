import { useState, useCallback, useEffect } from "react";

export type ViewMode = "list" | "card";

const STORAGE_PREFIX = "claudecodeimpact_view_mode_";

/**
 * Hook for managing view mode state with localStorage persistence.
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
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "list" || stored === "card") {
        return stored;
      }
    } catch {
      // localStorage might not be available
    }
    return defaultMode;
  });

  const setMode = useCallback(
    (newMode: ViewMode) => {
      setModeState(newMode);
      try {
        localStorage.setItem(storageKey, newMode);
      } catch {
        // localStorage might not be available
      }
    },
    [storageKey]
  );

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        if (e.newValue === "list" || e.newValue === "card") {
          setModeState(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [storageKey]);

  return { mode, setMode };
}
