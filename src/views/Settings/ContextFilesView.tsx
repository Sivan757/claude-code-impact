import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { FileTextIcon, CopyIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { useInvokeQuery, useViewMode } from "../../hooks";
import {
  LoadingState,
  ConfigPage,
} from "../../components/config";
import {
  ActionToolbar,
  ListItemCard,
  SettingsEmptyState,
  StatusBadge,
  ViewModeToggle,
} from "../../components/Settings";
import type { ContextFile } from "../../types";
import { cn } from "../../lib/utils";

export function ContextFilesView({ projectPath }: { projectPath?: string }) {
  const { t } = useTranslation();
  const useProjectContext = Boolean(projectPath);
  const { data: allContextFiles = [], isLoading } = useInvokeQuery<ContextFile[]>(
    ["contextFiles", projectPath ?? "global"],
    useProjectContext ? "get_project_context" : "get_context_files",
    useProjectContext ? { projectPath } : undefined
  );
  const contextFiles = useMemo(() => {
    if (useProjectContext) return allContextFiles;
    return allContextFiles.filter((f) => f.scope === "global");
  }, [allContextFiles, useProjectContext]);

  const [search, setSearch] = useState("");
  const { mode, setMode } = useViewMode("contextfiles");
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);



  const handleCopy = async (e: React.MouseEvent, content: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  const handleOpenInEditor = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await invoke("open_in_editor", { path });
    } catch {
      // Editor might not be available
    }
  };

  const handleFileClick = (file: ContextFile) => {
    setSelectedFile(file);
    setEditDialogOpen(true);
  };

  if (isLoading) return <LoadingState message={t('context_files.loading')} />;

  const filteredContextFiles = contextFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>

      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <ActionToolbar
          searchPlaceholder={t('context_files.search_placeholder')}
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={
            <ViewModeToggle mode={mode} onChange={setMode} />
          }
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-3 pr-3 [scrollbar-gutter:stable]">
          {filteredContextFiles.length > 0 ? (
            <div
              className={cn(
                mode === "card"
                  ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                  : "flex flex-col gap-2"
              )}
            >
              {filteredContextFiles.map((file) => (
                <ListItemCard
                  key={file.path}
                  avatar={<FileTextIcon className="w-4 h-4" />}
                  title={file.name}
                  subtitle={file.path}
                  badges={
                    <StatusBadge variant="muted">{file.scope}</StatusBadge>
                  }
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                        onClick={(e) => handleCopy(e, file.content)}
                        title={t('common.copy')}
                      >
                        <CopyIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                        onClick={(e) => handleOpenInEditor(e, file.path)}
                        title={t('common.open_in_editor', 'Open in editor')}
                      >
                        <Pencil1Icon className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  }
                  onClick={() => handleFileClick(file)}
                  className={mode === "list" ? "p-2" : undefined}
                />
              ))}
            </div>
          ) : search ? (
            <p className="text-muted-foreground text-sm py-4">
              {t('context_files.no_match', { search })}
            </p>
          ) : (
            <SettingsEmptyState
              icon={FileTextIcon}
              title={t('context_files.no_files')}
              description={t('context_files.create_hint')}
            />
          )}
        </div>
      </div>

      {/* View/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">{selectedFile?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {selectedFile?.path}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            <pre className="w-full h-[400px] bg-secondary/40 border border-border/50 rounded-xl px-3.5 py-2 text-sm font-mono overflow-auto whitespace-pre-wrap">
              {selectedFile?.content}
            </pre>
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => selectedFile && handleCopy({ stopPropagation: () => { } } as React.MouseEvent, selectedFile.content)}
              >
                <CopyIcon className="w-3.5 h-3.5 mr-2" />
                {t('common.copy')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => selectedFile && handleOpenInEditor({ stopPropagation: () => { } } as React.MouseEvent, selectedFile.path)}
              >
                <Pencil1Icon className="w-3.5 h-3.5 mr-2" />
                {t('common.open_in_editor', 'Open in editor')}
              </Button>
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditDialogOpen(false)}
            >
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfigPage>
  );
}
