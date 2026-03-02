import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SessionDropdownMenuItems } from "@/components/shared/SessionMenuItems";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project, SearchResult, Session } from "@/types";

import { LoadingOverlayMask } from "./LoadingOverlayMask";
import { formatDate, formatRelativeTime, stripTeammateMessageTags, useReadableText } from "./utils";
import { useMinimumLoadingOverlay } from "./useMinimumLoadingOverlay";
import { useResizablePanel } from "./useResizablePanel";

const SEARCH_DEBOUNCE_MS = 280;
const SIDEBAR_COLLAPSE_BREAKPOINT = 1080;

interface HistorySessionListPaneProps {
  projects: Project[];
  loadingProjects: boolean;
  selectedProjectId: string | null;
  selectedProject: Project | null;
  selectedSessionId: string | null;
  visibleSessions: Session[];
  loadingSessions: boolean;
  formatPath: (path: string) => string;
  onOpenProject: (projectId: string) => void;
  onOpenSession: (projectId: string, sessionId: string) => void;
}

function getInitialWindowCollapse(breakpoint: number, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  return window.innerWidth < breakpoint;
}

export function HistorySessionListPane(props: HistorySessionListPaneProps): ReactNode {
  const {
    projects,
    loadingProjects,
    selectedProjectId,
    selectedProject,
    selectedSessionId,
    visibleSessions,
    loadingSessions,
    formatPath,
    onOpenProject,
    onOpenSession,
  } = props;
  const { t } = useTranslation();
  const toReadable = useReadableText();

  const [projectFilter, setProjectFilter] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchIndexMissing, setSearchIndexMissing] = useState(false);
  const [buildingIndex, setBuildingIndex] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<"projects" | "sessions">("sessions");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getInitialWindowCollapse(SIDEBAR_COLLAPSE_BREAKPOINT, false),
  );

  const {
    width: sidebarWidth,
    isResizing: sidebarResizing,
    onResizeStart: onSidebarResizeStart,
  } = useResizablePanel({
    defaultWidth: 332,
    minWidth: 250,
    maxWidth: 560,
    storageKey: "chat-history-sidebar-width",
  });

  const sessionListOverlay = useMinimumLoadingOverlay(loadingSessions, {
    minimumDurationMs: 180,
  });

  const filteredProjects = useMemo(() => {
    const keyword = projectFilter.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(keyword) ||
        formatPath(project.path).toLowerCase().includes(keyword),
    );
  }, [formatPath, projectFilter, projects]);

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
    if (!selectedProjectId) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    const query = sessionSearchQuery.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      setSearchIndexMissing(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await invoke<SearchResult[]>("search_chats", {
          query,
          limit: 80,
          projectId: selectedProjectId,
        });
        if (!cancelled) {
          setSearchResults(results);
          setSearchIndexMissing(false);
        }
      } catch (error) {
        if (!cancelled) {
          const message = String(error).toLowerCase();
          setSearchIndexMissing(message.includes("not built"));
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTick, selectedProjectId, sessionSearchQuery]);

  const rebuildIndex = async () => {
    if (buildingIndex) return;
    setBuildingIndex(true);
    try {
      await invoke<number>("build_search_index");
      setSearchIndexMissing(false);
      setSearchTick((value) => value + 1);
    } catch {
      setSearchIndexMissing(true);
    } finally {
      setBuildingIndex(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    sessionListOverlay.show();
    onOpenProject(projectId);
    setSidebarTab("sessions");
  };

  const handleOpenSession = (projectId: string, sessionId: string) => {
    onOpenSession(projectId, sessionId);
    setSidebarTab("sessions");
  };

  const renderSessionListContent = (): ReactNode => {
    if (sessionSearchQuery.trim() && searchResults !== null) {
      return (
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            {t("session.search_results", { count: searchResults.length })}
          </p>
          {searchResults.map((result) => (
            <button
              key={result.uuid}
              type="button"
              onClick={() => handleOpenSession(result.project_id, result.session_id)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-left transition-all duration-200 ease-out"
            >
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {stripTeammateMessageTags(toReadable(result.session_summary)) || t("chat.untitled_session")}
              </p>
              <p className="line-clamp-2 text-sm text-ink">
                {stripTeammateMessageTags(toReadable(result.content))}
              </p>
            </button>
          ))}
          {searchResults.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("session.no_results")}</p>
          ) : null}
        </div>
      );
    }

    if (visibleSessions.length === 0) {
      return <p className="p-3 text-sm text-muted-foreground">{t("chat.no_sessions")}</p>;
    }

    return (
      <div className="space-y-2">
        {visibleSessions.map((session) => {
          const selected = session.id === selectedSessionId;
          return (
            <div
              key={session.id}
              className={cn(
                "group rounded-xl border px-3 py-2 transition-all duration-200 ease-out",
                selected
                  ? "border-primary bg-primary/10 shadow-xs"
                  : "border-border bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => handleOpenSession(session.project_id, session.id)}
                >
                  <p className="line-clamp-2 text-sm font-medium text-ink">
                    {stripTeammateMessageTags(toReadable(session.summary)) || t("chat.untitled_session")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("chat.message_count", { count: session.message_count })} ·{" "}
                    {formatDate(session.last_modified)}
                  </p>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-alt hover:text-ink"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DotsHorizontalIcon />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <SessionDropdownMenuItems
                      projectId={session.project_id}
                      sessionId={session.id}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "relative h-full shrink-0 border-r border-border/60 bg-card-alt/40",
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

          <header className="border-b border-border/60 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("chat.workspace")}
              </p>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-ink"
                aria-label={t("chat.collapse_sidebar")}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setSidebarTab("projects")}
                className={cn(
                  "h-7 flex-1 rounded-md px-2 text-xs font-medium",
                  sidebarTab === "projects"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-card-alt",
                )}
              >
                {t("chat.projects")}
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("sessions")}
                className={cn(
                  "h-7 flex-1 rounded-md px-2 text-xs font-medium",
                  sidebarTab === "sessions"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-card-alt",
                )}
              >
                {t("chat.sessions")}
              </button>
            </div>
          </header>

          {sidebarTab === "projects" ? (
            <div
              key="projects-panel"
              className="flex h-full min-h-0 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2"
            >
              <div className="border-b border-border/60 p-3">
                <input
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  placeholder={t("chat.project_filter_placeholder")}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loadingProjects ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {t("chat.loading", { viewMode: t("chat.projects") })}
                  </p>
                ) : filteredProjects.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {t("chat.no_projects")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => {
                      const selected = project.id === selectedProjectId;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => handleOpenProject(project.id)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out",
                            selected
                              ? "border-primary bg-primary/10 shadow-xs"
                              : "border-border bg-background",
                          )}
                        >
                          <p className="truncate text-sm font-medium text-ink">
                            {formatPath(project.path)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("chat.session_count", { count: project.session_count })} ·{" "}
                            {formatRelativeTime(project.last_active)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              key="sessions-panel"
              className="flex h-full min-h-0 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2"
            >
              <div className="border-b border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                    {selectedProject ? formatPath(selectedProject.path) : t("chat.sessions")}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={sessionSearchQuery}
                    onChange={(event) => setSessionSearchQuery(event.target.value)}
                    placeholder={t("session.search_placeholder")}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  {searching ? <span className="text-xs text-muted-foreground">...</span> : null}
                </div>
                {searchIndexMissing ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">{t("chat.index_not_built")}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={buildingIndex}
                      onClick={rebuildIndex}
                    >
                      {buildingIndex ? t("chat.building") : t("chat.rebuild")}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div
                key={`session-list-${selectedProjectId ?? "none"}`}
                className="relative min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1"
              >
                <div className="h-full overflow-y-auto p-2">{renderSessionListContent()}</div>
                <LoadingOverlayMask
                  label={t("session.loading_project")}
                  visible={sessionListOverlay.visible}
                />
              </div>
            </div>
          )}
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
            onClick={() => {
              setSidebarCollapsed(false);
              setSidebarTab("projects");
            }}
            className={cn(
              "mb-1 flex h-8 w-8 items-center justify-center rounded-md text-xs",
              sidebarTab === "projects"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-background",
            )}
            aria-label={t("chat.projects")}
          >
            P
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarCollapsed(false);
              setSidebarTab("sessions");
            }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-xs",
              sidebarTab === "sessions"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-background",
            )}
            aria-label={t("chat.sessions")}
          >
            S
          </button>
        </div>
      )}
    </aside>
  );
}
