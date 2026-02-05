import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { ConfigChangeEvent } from "../types";

// Hook to watch config changes
export function useConfigWatcher(projectPath?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initialize watcher
    invoke("config_init_watcher", { projectPath }).catch((err) => {
      console.error("Failed to initialize config watcher:", err);
    });

    // Listen for config change events
    const unlisten = listen<ConfigChangeEvent>("config:changed", (event) => {
      const { kind, scope, path } = event.payload;

      console.log(`Config changed: ${kind} at ${scope} (${path})`);

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["config"],
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectPath, queryClient]);
}
