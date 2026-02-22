import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { MergedConfigView } from "../types";

/** Batch-read merged configs for multiple projects */
export function useMultiProjectConfig(projectPaths: string[]) {
  return useQuery<Record<string, MergedConfigView>, string>({
    queryKey: ["config", "multi-merged", ...projectPaths],
    queryFn: () =>
      invoke<Record<string, MergedConfigView>>("config_read_multi_merged", {
        projectPaths,
      }),
    enabled: projectPaths.length > 0,
  });
}
