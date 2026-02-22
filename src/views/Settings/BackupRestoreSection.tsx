import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResetIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { LoadingState } from "../../components/config";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";
import {
  useConfigBackups,
  useConfigRestoreBackup,
  useConfigPaths,
} from "../../config/hooks/useConfig";
import { ConfigFileKind, ConfigScope } from "../../config/types";

interface BackupRestoreSectionProps {
  settingsPath?: string;
}

const CONFIG_FILES: { kind: ConfigFileKind; scope: ConfigScope; label: string }[] = [
  { kind: ConfigFileKind.Settings, scope: ConfigScope.User, label: "User Settings" },
  { kind: ConfigFileKind.SettingsLocal, scope: ConfigScope.UserLocal, label: "User Local Settings" },
  { kind: ConfigFileKind.Settings, scope: ConfigScope.Project, label: "Project Settings" },
  { kind: ConfigFileKind.SettingsLocal, scope: ConfigScope.ProjectLocal, label: "Project Local Settings" },
];

export function BackupRestoreSection({ settingsPath }: BackupRestoreSectionProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const [activeFile, setActiveFile] = useState(CONFIG_FILES[0]);
  const restoreMutation = useConfigRestoreBackup();

  const { data: backups, isLoading } = useConfigBackups(
    activeFile.kind,
    activeFile.scope,
    settingsPath
  );

  const { data: configPaths } = useConfigPaths(settingsPath);

  // Only show project scopes when settingsPath is set
  const availableFiles = useMemo(
    () =>
      CONFIG_FILES.filter((f) => {
        if (!settingsPath) {
          return f.scope === ConfigScope.User || f.scope === ConfigScope.UserLocal;
        }
        return true;
      }),
    [settingsPath]
  );

  const handleRestore = async (backupPath: string) => {
    if (!configPaths) return;
    // Find the actual target path from configPaths - match by scope_kind pattern
    const targetPath = Object.entries(configPaths).find(
      ([key]) => key.toLowerCase().includes(activeFile.scope) && key.toLowerCase().includes(activeFile.kind.replace("_", ""))
    )?.[1];

    if (!targetPath) return;

    const confirmed = await confirmDialog({
      title: t("backup.title", "Backup & Restore"),
      description: t("backup.confirm_restore", "Restore this backup? Current config will be overwritten."),
      variant: "destructive",
      confirmText: t("common.reset", "Restore"),
    });
    if (!confirmed) return;

    await restoreMutation.mutateAsync({ backupPath, targetPath });
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">
          {t("backup.title") || "Backup & Restore"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("backup.description") || "View and restore previous configuration backups"}
        </p>
      </div>

      {/* File selector */}
      <div className="flex gap-1 flex-wrap">
        {availableFiles.map((file) => (
          <button
            key={`${file.kind}-${file.scope}`}
            onClick={() => setActiveFile(file)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              activeFile === file
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {file.label}
          </button>
        ))}
      </div>

      {/* Backups list */}
      {isLoading ? (
        <LoadingState message="Loading backups..." />
      ) : !backups || backups.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4">
          {t("backup.no_backups") || "No backups found for this file"}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {backups.map((backup) => (
            <div
              key={backup.path}
              className="flex items-center justify-between px-3 py-2 bg-secondary/40 rounded-lg hover:bg-secondary/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">
                  {formatTimestamp(backup.timestamp)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(backup.size)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg text-xs gap-1"
                onClick={() => handleRestore(backup.path)}
                disabled={restoreMutation.isPending}
              >
                <ResetIcon className="w-3 h-3" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {restoreMutation.isError && (
        <p className="text-xs text-destructive">
          {t("common.failed_with", { error: restoreMutation.error })}
        </p>
      )}
    </div>
  );
}
