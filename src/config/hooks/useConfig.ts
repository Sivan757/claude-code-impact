import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  ConfigScope,
  ConfigFileKind,
  ConfigValue,
  MergedConfigView,
  WriteResult,
  ValidationViolation,
  BackupEntry,
} from "../types";

// Hook to read a single config file
export function useConfigRead(
  kind: ConfigFileKind,
  scope: ConfigScope,
  projectPath?: string
) {
  return useQuery<ConfigValue, string>({
    queryKey: ["config", kind, scope, projectPath],
    queryFn: async () => {
      return await invoke<ConfigValue>("config_read", {
        kind,
        scope,
        projectPath,
      });
    },
  });
}

// Hook to read merged config view
export function useConfigMerged(projectPath?: string) {
  return useQuery<MergedConfigView, string>({
    queryKey: ["config", "merged", projectPath],
    queryFn: async () => {
      return await invoke<MergedConfigView>("config_read_merged", {
        projectPath,
      });
    },
  });
}

// Hook to write config
export function useConfigWrite() {
  const queryClient = useQueryClient();

  return useMutation<
    WriteResult,
    string,
    {
      kind: ConfigFileKind;
      scope: ConfigScope;
      projectPath?: string;
      key?: string;
      value: unknown;
    }
  >({
    mutationFn: async ({ kind, scope, projectPath, key, value }) => {
      return await invoke<WriteResult>("config_write", {
        kind,
        scope,
        projectPath,
        key,
        value,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["config", variables.kind, variables.scope],
      });
      queryClient.invalidateQueries({
        queryKey: ["config", "merged"],
      });
    },
  });
}

// Hook to write markdown
export function useConfigWriteMarkdown() {
  const queryClient = useQueryClient();

  return useMutation<
    WriteResult,
    string,
    {
      kind: ConfigFileKind;
      scope: ConfigScope;
      projectPath?: string;
      content: string;
    }
  >({
    mutationFn: async ({ kind, scope, projectPath, content }) => {
      return await invoke<WriteResult>("config_write_markdown", {
        kind,
        scope,
        projectPath,
        content,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["config", variables.kind, variables.scope],
      });
      queryClient.invalidateQueries({
        queryKey: ["config", "merged"],
      });
    },
  });
}

// Hook to delete a config key
export function useConfigDeleteKey() {
  const queryClient = useQueryClient();

  return useMutation<
    WriteResult,
    string,
    {
      kind: ConfigFileKind;
      scope: ConfigScope;
      projectPath?: string;
      key: string;
    }
  >({
    mutationFn: async ({ kind, scope, projectPath, key }) => {
      return await invoke<WriteResult>("config_delete_key", {
        kind,
        scope,
        projectPath,
        key,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["config", variables.kind, variables.scope],
      });
      queryClient.invalidateQueries({
        queryKey: ["config", "merged"],
      });
    },
  });
}

// Hook to validate config
export function useConfigValidate() {
  return useMutation<
    ValidationViolation[],
    string,
    {
      kind: ConfigFileKind;
      value: unknown;
    }
  >({
    mutationFn: async ({ kind, value }) => {
      return await invoke<ValidationViolation[]>("config_validate", {
        kind,
        value,
      });
    },
  });
}

// Hook to list backups
export function useConfigBackups(
  kind: ConfigFileKind,
  scope: ConfigScope,
  projectPath?: string
) {
  return useQuery<BackupEntry[], string>({
    queryKey: ["config", "backups", kind, scope, projectPath],
    queryFn: async () => {
      return await invoke<BackupEntry[]>("config_list_backups", {
        kind,
        scope,
        projectPath,
      });
    },
  });
}

// Hook to restore backup
export function useConfigRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    string,
    {
      backupPath: string;
      targetPath: string;
    }
  >({
    mutationFn: async ({ backupPath, targetPath }) => {
      return await invoke<void>("config_restore_backup", {
        backupPath,
        targetPath,
      });
    },
    onSuccess: () => {
      // Invalidate all config queries
      queryClient.invalidateQueries({
        queryKey: ["config"],
      });
    },
  });
}

// Hook to get all config paths
export function useConfigPaths(projectPath?: string) {
  return useQuery<Record<string, string>, string>({
    queryKey: ["config", "paths", projectPath],
    queryFn: async () => {
      return await invoke<Record<string, string>>("config_get_paths", {
        projectPath,
      });
    },
  });
}
