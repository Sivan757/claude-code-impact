import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { WriteResult } from "../types";
import type { MergeMode } from "../templates/types";

/** Export configuration as JSON string */
export function useConfigExport() {
  return useMutation<
    string,
    string,
    { projectPath?: string; includeLocal: boolean }
  >({
    mutationFn: ({ projectPath, includeLocal }) =>
      invoke<string>("config_export", { projectPath, includeLocal }),
  });
}

/** Import configuration from JSON string */
export function useConfigImport() {
  const queryClient = useQueryClient();

  return useMutation<
    WriteResult[],
    string,
    {
      configJson: string;
      targetProjectPath?: string;
      mergeMode: MergeMode;
    }
  >({
    mutationFn: ({ configJson, targetProjectPath, mergeMode }) =>
      invoke<WriteResult[]>("config_import", {
        configJson,
        targetProjectPath,
        mergeMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
