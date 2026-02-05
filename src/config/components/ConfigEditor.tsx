import { useState } from "react";
import { ConfigScope, ConfigFileKind } from "../types";
import { useConfigMerged, useConfigWrite } from "../hooks/useConfig";
import { useConfigWatcher } from "../hooks/useConfigWatcher";
import { MergeViewer } from "./MergeViewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ConfigEditorProps {
  projectPath?: string;
}

// Map scope to the correct file kind
function getFileKindForScope(scope: ConfigScope): ConfigFileKind {
  switch (scope) {
    case ConfigScope.UserLocal:
    case ConfigScope.ProjectLocal:
      return ConfigFileKind.SettingsLocal;
    case ConfigScope.User:
    case ConfigScope.Project:
    default:
      return ConfigFileKind.Settings;
  }
}

export function ConfigEditor({ projectPath }: ConfigEditorProps) {
  const [targetScope, setTargetScope] = useState<ConfigScope>(ConfigScope.User);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");

  const { data: mergedConfig, isLoading } = useConfigMerged(projectPath);
  const writeMutation = useConfigWrite();

  // Initialize watcher
  useConfigWatcher(projectPath);

  const handleWrite = async () => {
    if (!editKey || !editValue) return;

    try {
      const value = JSON.parse(editValue);
      await writeMutation.mutateAsync({
        kind: getFileKindForScope(targetScope),
        scope: targetScope,
        projectPath,
        key: editKey,
        value,
      });

      // Clear form
      setEditKey("");
      setEditValue("");
    } catch (error) {
      console.error("Failed to write config:", error);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading configuration...</div>;
  }

  if (!mergedConfig) {
    return <div className="p-4 text-center text-muted-foreground">No configuration found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-serif">Configuration Editor</h2>
        <p className="text-sm text-muted-foreground">
          Edit configuration values across different scopes
        </p>
      </div>

      {/* Write Form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Write Configuration</h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Target Scope:</Label>
            <Select
              value={targetScope}
              onValueChange={(value) => setTargetScope(value as ConfigScope)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ConfigScope.User}>User</SelectItem>
                <SelectItem value={ConfigScope.UserLocal}>User Local</SelectItem>
                <SelectItem value={ConfigScope.Project} disabled={!projectPath}>
                  Project
                </SelectItem>
                <SelectItem value={ConfigScope.ProjectLocal} disabled={!projectPath}>
                  Project Local
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <Input
              placeholder="e.g., model"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>Value (JSON)</Label>
            <Input
              placeholder='e.g., "opus"'
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <Button
          onClick={handleWrite}
          disabled={!editKey || !editValue || writeMutation.isPending}
          className="w-full"
        >
          {writeMutation.isPending ? "Writing..." : "Write Configuration"}
        </Button>

        {writeMutation.isError && (
          <div className="text-sm text-destructive">
            Error: {writeMutation.error}
          </div>
        )}

        {writeMutation.isSuccess && (
          <div className="text-sm text-green-600">
            Configuration written successfully
          </div>
        )}
      </div>

      {/* Merge Viewer */}
      <MergeViewer mergedConfig={mergedConfig} />
    </div>
  );
}
