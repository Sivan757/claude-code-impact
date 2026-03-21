import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppConfig } from "@/context";
import { useInvokeQuery, useQueryClient } from "@/hooks";
import type { Project, Session } from "@/types";

import { HistorySessionDetailPane } from "./HistorySessionDetailPane";
import { HistorySessionListPane } from "./HistorySessionListPane";

const SESSIONS_REFRESH_MS = 8000;
const PROJECTS_REFRESH_MS = 20000;

function safeDecodePath(value?: string): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseHistoryRoute(pathname: string): {
  projectId: string | null;
  sessionId: string | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "chat") {
    return { projectId: null, sessionId: null };
  }
  return {
    projectId: safeDecodePath(segments[1] ?? undefined),
    sessionId: safeDecodePath(segments[2] ?? undefined),
  };
}

export function HistoryWorkbench() {
  const { formatPath } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const previousProjectIdRef = useRef<string | null>(null);
  const routeInfo = useMemo(() => parseHistoryRoute(location.pathname), [location.pathname]);
  const routeProjectId = routeInfo.projectId;
  const routeSessionId = routeInfo.sessionId;

  const {
    data: projects = [],
    isLoading: loadingProjects,
    refetch: refetchProjects,
  } = useInvokeQuery<Project[]>(["projects"], "list_projects");

  const selectedProjectId = useMemo(() => {
    if (projects.length === 0) return null;
    if (routeProjectId && projects.some((project) => project.id === routeProjectId)) {
      return routeProjectId;
    }
    return projects[0].id;
  }, [projects, routeProjectId]);

  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions,
  } = useQuery<Session[]>({
    queryKey: ["sessions", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => {
      if (!selectedProjectId) return [];
      return invoke<Session[]>("list_sessions", { projectId: selectedProjectId });
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.message_count > 0),
    [sessions],
  );

  const selectedSessionId = useMemo(() => {
    if (!selectedProjectId || !routeSessionId) return null;
    const matched = visibleSessions.some(
      (session) =>
        session.project_id === selectedProjectId
        && session.id === routeSessionId,
    );
    if (matched) return routeSessionId;
    // Keep session id during initial loading so first click navigation is not dropped.
    if (loadingSessions) return routeSessionId;
    return null;
  }, [loadingSessions, routeSessionId, selectedProjectId, visibleSessions]);

  const selectedSessionSummary = useMemo(
    () => visibleSessions.find(
      (session) =>
        session.project_id === selectedProjectId
        && session.id === selectedSessionId,
    )?.summary ?? null,
    [selectedProjectId, selectedSessionId, visibleSessions],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    const previousProjectId = previousProjectIdRef.current;
    if (
      previousProjectId
      && selectedProjectId
      && previousProjectId !== selectedProjectId
    ) {
      void queryClient.cancelQueries({
        queryKey: ["sessions", previousProjectId],
      });
    }
    previousProjectIdRef.current = selectedProjectId;
  }, [queryClient, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    const encodedProject = encodeURIComponent(selectedProjectId);
    const nextPath = selectedSessionId
      ? `/chat/${encodedProject}/${encodeURIComponent(selectedSessionId)}`
      : `/chat/${encodedProject}`;

    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: true });
    }
  }, [location.pathname, navigate, selectedProjectId, selectedSessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refetchProjects();
    }, PROJECTS_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [refetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refetchSessions();
    }, SESSIONS_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [refetchSessions, selectedProjectId]);

  const openProject = useCallback((projectId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}`);
  }, [navigate]);

  const openSession = useCallback((projectId: string, sessionId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`);
  }, [navigate]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <HistorySessionListPane
          projects={projects}
          loadingProjects={loadingProjects}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          formatPath={formatPath}
          onOpenProject={openProject}
          onOpenSession={openSession}
        />

        <HistorySessionDetailPane
          selectedProjectId={selectedProjectId}
          selectedProjectPath={selectedProject?.path ?? null}
          selectedSessionId={selectedSessionId}
          selectedSessionSummary={selectedSessionSummary}
        />
      </div>
    </div>
  );
}
