import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { FolderPlus, Loader2, PanelLeft, PanelLeftClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { useQueryClient } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project, SearchResult } from "@/types";

import { HistoryProjectThreadGroup } from "./HistoryProjectThreadGroup";
import { formatRelativeTime, restoreSlashCommand, stripTeammateMessageTags } from "./utils";
import { useResizablePanel } from "./useResizablePanel";

const SIDEBAR_COLLAPSE_BREAKPOINT = 1080;
const SEARCH_DEBOUNCE_MS = 280;

interface HistorySessionListPaneProps {
  projects: Project[];
  loadingProjects: boolean;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  formatPath: (path: string) => string;
  onOpenProject: (projectId: string) => void;
  onOpenSession: (projectId: string, sessionId: string) => void;
}

function getInitialWindowCollapse(breakpoint: number, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  return window.innerWidth < breakpoint;
}

function formatSearchTimestamp(timestamp: string): string {
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    const seconds = numeric > 1_000_000_000_000 ? numeric / 1000 : numeric;
    return formatRelativeTime(seconds);
  }

  const parsed = Date.parse(timestamp);
  if (Number.isFinite(parsed)) {
    return formatRelativeTime(parsed / 1000);
  }

  return "";
}

function toReadableText(text: string | null | undefined): string {
  return stripTeammateMessageTags(restoreSlashCommand(text ?? ""));
}

export function HistorySessionListPane(props: HistorySessionListPaneProps): ReactNode {
  const {
    projects,
    loadingProjects,
    selectedProjectId,
    selectedSessionId,
    formatPath,
    onOpenProject,
    onOpenSession,
  } = props;
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [projectFilter, setProjectFilter] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getInitialWindowCollapse(SIDEBAR_COLLAPSE_BREAKPOINT, false),
  );
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [searchTick, setSearchTick] = useState(0);
  const [buildingIndex, setBuildingIndex] = useState(false);
  const [showFullProjectPath, setShowFullProjectPath] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [hidingProjectPath, setHidingProjectPath] = useState<string | null>(null);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);

  const {
    width: sidebarWidth,
    isResizing: sidebarResizing,
    onResizeStart: onSidebarResizeStart,
  } = useResizablePanel({
    defaultWidth: 360,
    minWidth: 270,
    maxWidth: 620,
    storageKey: "chat-history-sidebar-width",
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setExpandedProjectIds((prev) => {
      if (prev.has(selectedProjectId)) return prev;
      const next = new Set(prev);
      next.add(selectedProjectId);
      return next;
    });
  }, [selectedProjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(sessionSearchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [sessionSearchQuery]);

  useEffect(() => {
    if (!sessionSearchQuery.trim()) return;
    void queryClient.cancelQueries({ queryKey: ["chatSessionSearch"] });
  }, [queryClient, sessionSearchQuery]);

  const filteredProjects = useMemo(() => {
    const keyword = projectFilter.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(keyword)
        || formatPath(project.path).toLowerCase().includes(keyword),
    );
  }, [formatPath, projectFilter, projects]);

  const inSearchMode = debouncedSearchQuery.length > 0;

  const formatProjectLabel = useCallback((path: string): string => {
    if (showFullProjectPath) return formatPath(path);
    const normalized = path.replace(/[\\/]+$/, "");
    if (!normalized) return path;
    const segments = normalized.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? path;
  }, [formatPath, showFullProjectPath]);

  const {
    data: searchResults = [],
    isFetching: searching,
    error: searchError,
  } = useQuery<SearchResult[]>({
    queryKey: ["chatSessionSearch", debouncedSearchQuery, searchTick],
    enabled: inSearchMode,
    queryFn: async () => invoke<SearchResult[]>("search_chats", {
      query: debouncedSearchQuery,
      limit: 120,
    }),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const searchErrorMessage = useMemo(
    () => (searchError ? String(searchError).toLowerCase() : ""),
    [searchError],
  );
  const searchIndexMissing = inSearchMode && searchErrorMessage.includes("not built");

  const rebuildIndex = useCallback(async () => {
    if (buildingIndex) return;
    setBuildingIndex(true);
    try {
      await invoke<number>("build_search_index");
      setSearchTick((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: ["chatSessionSearch"] });
    } finally {
      setBuildingIndex(false);
    }
  }, [buildingIndex, queryClient]);

  const handleToggleProjectExpanded = useCallback((projectId: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleOpenProject = useCallback((projectId: string) => {
    setExpandedProjectIds((prev) => {
      if (prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });
    onOpenProject(projectId);
  }, [onOpenProject]);

  const handleAddProject = useCallback(async () => {
    if (addingProject) return;
    try {
      setAddingProject(true);
      setProjectActionError(null);
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });

      if (typeof selected !== "string" || selected.trim().length === 0) {
        return;
      }

      const project = await invoke<Project>("add_project", { projectPath: selected });
      queryClient.setQueryData<Project[]>(["projects"], (current = []) => {
        const existingIndex = current.findIndex((item) => item.id === project.id);
        if (existingIndex >= 0) {
          const next = current.slice();
          next[existingIndex] = project;
          return next;
        }
        return [...current, project].sort((left, right) => right.last_active - left.last_active);
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      handleOpenProject(project.id);
    } catch (error) {
      setProjectActionError(
        t("common.failed_with", { error: String(error) }),
      );
    } finally {
      setAddingProject(false);
    }
  }, [addingProject, handleOpenProject, queryClient, t]);

  const handleHideProject = useCallback(async (project: Project) => {
    if (hidingProjectPath) return;
    try {
      setProjectActionError(null);
      setHidingProjectPath(project.path);
      await invoke("hide_project", { projectPath: project.path });
      setExpandedProjectIds((prev) => {
        if (!prev.has(project.id)) return prev;
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      queryClient.setQueryData<Project[]>(["projects"], (current = []) =>
        current.filter((item) => item.id !== project.id),
      );
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      setProjectActionError(
        t("common.failed_with", { error: String(error) }),
      );
    } finally {
      setHidingProjectPath(null);
    }
  }, [hidingProjectPath, queryClient, t]);

  const renderSearchResults = () => {
    if (searchIndexMissing) {
      return (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{t("chat.index_not_built")}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 px-2 text-xs"
            disabled={buildingIndex}
            onClick={rebuildIndex}
          >
            {buildingIndex ? t("chat.building") : t("chat.rebuild")}
          </Button>
        </div>
      );
    }

    if (searching) {
      return (
        <p className="p-3 text-sm text-muted-foreground">
          {t("chat.loading", { viewMode: t("session.search_results", { count: 0 }) })}
        </p>
      );
    }

    if (searchResults.length === 0) {
      return <p className="p-3 text-sm text-muted-foreground">{t("session.no_results")}</p>;
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          {t("session.search_results", { count: searchResults.length })}
        </p>
        <div className="min-h-0 flex-1">
        <Virtuoso
          style={{ height: "100%" }}
          data={searchResults}
          overscan={300}
          itemContent={(_index, result) => {
              const sessionTitle = toReadableText(result.session_summary) || t("chat.untitled_session");
              const snippet = toReadableText(result.content);
              const timeLabel = formatSearchTimestamp(result.timestamp);
            return (
              <div className="pb-1.5">
                <button
                  key={`${result.project_id}:${result.session_id}:${result.uuid}`}
                  type="button"
                  onClick={() => onOpenSession(result.project_id, result.session_id)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-left transition-colors hover:bg-card-alt/60"
                >
                  <p className="line-clamp-1 text-[13px] font-medium leading-tight text-ink">{sessionTitle}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{snippet}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatProjectLabel(result.project_path)}
                    {timeLabel ? ` · ${timeLabel}` : ""}
                  </p>
                </button>
              </div>
              );
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "relative h-full min-h-0 shrink-0 border-r border-border/60 bg-card-alt/40 flex flex-col",
        !sidebarResizing && "transition-[width] duration-200 ease-out",
        sidebarResizing && "select-none",
      )}
      style={
        sidebarCollapsed
          ? { width: 48, minWidth: 48, maxWidth: 48 }
          : { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }
      }
    >
      {!sidebarCollapsed ? (
        <>
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors",
              sidebarResizing ? "bg-primary/40" : "hover:bg-primary/30",
            )}
            onMouseDown={onSidebarResizeStart}
          />

          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("chat.title")}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-background hover:text-ink"
                  onClick={() => setShowFullProjectPath((value) => !value)}
                  title={showFullProjectPath
                    ? t("chat.use_short_project_name", "Use folder name")
                    : t("chat.show_full_project_path", "Show full path")}
                >
                  {showFullProjectPath
                    ? t("chat.path_mode_name", "Name")
                    : t("chat.path_mode_path", "Path")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleAddProject();
                  }}
                  disabled={addingProject}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-ink disabled:cursor-wait disabled:opacity-60"
                  title={t("sidebar.add_project_tip", "Add project")}
                  aria-label={t("sidebar.add_project_tip", "Add project")}
                >
                  {addingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-ink"
                  aria-label={t("chat.collapse_sidebar")}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <input
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                placeholder={t("chat.project_filter_placeholder")}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <input
                value={sessionSearchQuery}
                onChange={(event) => setSessionSearchQuery(event.target.value)}
                placeholder={t("session.search_placeholder")}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            {projectActionError ? (
              <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {projectActionError}
              </p>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 p-2">
            {loadingProjects ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t("chat.loading", { viewMode: t("chat.projects") })}
              </p>
            ) : inSearchMode ? (
              renderSearchResults()
            ) : filteredProjects.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t("chat.no_projects")}</p>
            ) : (
              <Virtuoso
                style={{ height: "100%" }}
                data={filteredProjects}
                overscan={360}
                itemContent={(_index, project) => (
                  <div className="pb-1.5">
                    <HistoryProjectThreadGroup
                      project={project}
                      projectLabel={formatProjectLabel(project.path)}
                      projectTitle={formatPath(project.path)}
                      selectedProjectId={selectedProjectId}
                      selectedSessionId={selectedSessionId}
                      expanded={expandedProjectIds.has(project.id)}
                      hideDisabled={hidingProjectPath === project.path}
                      onToggleExpanded={handleToggleProjectExpanded}
                      onOpenProject={handleOpenProject}
                      onHideProject={handleHideProject}
                      onOpenSession={onOpenSession}
                    />
                  </div>
                )}
              />
            )}
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center py-2">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-ink"
            aria-label={t("chat.expand_sidebar")}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="my-2 h-px w-6 bg-border/60" />
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-background"
            aria-label={t("chat.sessions")}
          >
            S
          </button>
        </div>
      )}
    </aside>
  );
}
