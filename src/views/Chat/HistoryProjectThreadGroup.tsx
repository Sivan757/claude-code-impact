import { memo, useCallback, useEffect, useMemo, type MouseEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, EyeOff, Folder, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useQueryClient } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project, Session } from "@/types";

import { formatRelativeTime, stripTeammateMessageTags, useReadableText } from "./utils";
import { HistorySessionThreadRow } from "./HistorySessionThreadRow";

const SESSIONS_REFRESH_MS = 8000;
const PAGE_SIZE = 40;

interface HistoryProjectThreadGroupProps {
  project: Project;
  projectLabel: string;
  projectTitle: string;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  expanded: boolean;
  hideDisabled?: boolean;
  onToggleExpanded: (projectId: string) => void;
  onOpenProject: (projectId: string) => void;
  onHideProject: (project: Project) => void;
  onOpenSession: (projectId: string, sessionId: string) => void;
}

function toSessionTitle(summary: string | null | undefined, fallback: string): string {
  if (!summary) return fallback;
  const cleaned = stripTeammateMessageTags(summary).trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function HistoryProjectThreadGroupInner(props: HistoryProjectThreadGroupProps): ReactNode {
  const {
    project,
    projectLabel,
    projectTitle,
    selectedProjectId,
    selectedSessionId,
    expanded,
    hideDisabled = false,
    onToggleExpanded,
    onOpenProject,
    onHideProject,
    onOpenSession,
  } = props;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toReadable = useReadableText();

  const selected = project.id === selectedProjectId;
  const shouldLoadSessions = expanded || selected;

  const {
    data,
    isLoading: loadingSessions,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Session[]>({
    queryKey: ["projectSessionsPaged", project.id],
    enabled: shouldLoadSessions,
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      return invoke<Session[]>("list_sessions", {
        projectId: project.id,
        offset,
        limit: PAGE_SIZE + 1,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length <= PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: shouldLoadSessions && isDocumentVisible()
      ? SESSIONS_REFRESH_MS
      : false,
  });

  useEffect(() => {
    if (shouldLoadSessions) return;
    void queryClient.cancelQueries({ queryKey: ["projectSessionsPaged", project.id] });
  }, [project.id, queryClient, shouldLoadSessions]);

  const pagedSessions = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.slice(0, PAGE_SIZE));
  }, [data]);

  const visibleSessions = useMemo(
    () => pagedSessions.filter((session) => session.message_count > 0),
    [pagedSessions],
  );

  const handleOpenProject = useCallback(() => {
    onOpenProject(project.id);
  }, [onOpenProject, project.id]);

  const handleToggleExpanded = useCallback((event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    onToggleExpanded(project.id);
  }, [onToggleExpanded, project.id]);

  const handleHideProject = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onHideProject(project);
  }, [onHideProject, project]);

  return (
    <div className="group space-y-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleOpenProject}
          className={cn(
            "flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors",
            selected ? "bg-primary/10 text-primary" : "hover:bg-background/70 text-muted-foreground",
          )}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-background"
            onClick={handleToggleExpanded}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </span>
          {expanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate text-[13px] font-medium leading-tight" title={projectTitle}>{projectLabel}</span>
        </button>
        <button
          type="button"
          onClick={handleHideProject}
          disabled={hideDisabled}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-background hover:text-ink disabled:cursor-wait disabled:opacity-60",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          title={t("chat.hide_project", "Hide project")}
          aria-label={t("chat.hide_project", "Hide project")}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-0.5 pl-5">
          {loadingSessions ? (
            <p className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {t("chat.loading", { viewMode: t("chat.sessions") })}
            </p>
          ) : visibleSessions.length > 0 ? (
            <>
              {visibleSessions.map((session) => (
                <HistorySessionThreadRow
                  key={session.id}
                  projectId={session.project_id}
                  sessionId={session.id}
                  selected={session.project_id === selectedProjectId && session.id === selectedSessionId}
                  title={toSessionTitle(toReadable(session.summary), t("chat.untitled_session"))}
                  timeLabel={formatRelativeTime(session.last_modified)}
                  onOpenSession={onOpenSession}
                />
              ))}
              {hasNextPage ? (
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-background"
                  disabled={isFetchingNextPage}
                  onClick={() => {
                    void fetchNextPage();
                  }}
                >
                  {isFetchingNextPage
                    ? t("chat.loading_more", "Loading more...")
                    : t("chat.load_more_threads", "Load more")}
                </button>
              ) : null}
            </>
          ) : (
            <p className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {t("chat.no_sessions")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function areHistoryProjectThreadGroupPropsEqual(
  prev: HistoryProjectThreadGroupProps,
  next: HistoryProjectThreadGroupProps,
): boolean {
  return prev.project.id === next.project.id
    && prev.project.path === next.project.path
    && prev.projectLabel === next.projectLabel
    && prev.projectTitle === next.projectTitle
    && prev.project.last_active === next.project.last_active
    && prev.selectedProjectId === next.selectedProjectId
    && prev.selectedSessionId === next.selectedSessionId
    && prev.expanded === next.expanded
    && prev.hideDisabled === next.hideDisabled
    && prev.onToggleExpanded === next.onToggleExpanded
    && prev.onOpenProject === next.onOpenProject
    && prev.onHideProject === next.onHideProject
    && prev.onOpenSession === next.onOpenSession;
}

export const HistoryProjectThreadGroup = memo(
  HistoryProjectThreadGroupInner,
  areHistoryProjectThreadGroupPropsEqual,
);

HistoryProjectThreadGroup.displayName = "HistoryProjectThreadGroup";
