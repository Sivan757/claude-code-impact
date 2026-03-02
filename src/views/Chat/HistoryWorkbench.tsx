import { useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppConfig } from "@/context";
import { useInvokeQuery } from "@/hooks";
import type { Project, Session } from "@/types";

import { HistorySessionDetailPane } from "./HistorySessionDetailPane";
import { HistorySessionListPane } from "./HistorySessionListPane";

const SESSIONS_REFRESH_MS = 8000;
const PROJECTS_REFRESH_MS = 20000;

type HistoryRouteParams = {
  projectId?: string;
  sessionId?: string;
};

function safeDecodePath(value?: string): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function HistoryWorkbench() {
  const { formatPath } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<HistoryRouteParams>();
  const routeProjectId = safeDecodePath(params.projectId);
  const routeSessionId = safeDecodePath(params.sessionId);

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
    if (!routeSessionId) return null;
    if (!visibleSessions.some((session) => session.id === routeSessionId)) {
      return null;
    }
    return routeSessionId;
  }, [routeSessionId, visibleSessions]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedSessionSummary = useMemo(
    () => visibleSessions.find((session) => session.id === selectedSessionId)?.summary ?? null,
    [selectedSessionId, visibleSessions],
  );

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

  const openProject = (projectId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}`);
  };

  const openSession = (projectId: string, sessionId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/50">
        <HistorySessionListPane
          projects={projects}
          loadingProjects={loadingProjects}
          selectedProjectId={selectedProjectId}
          selectedProject={selectedProject}
          selectedSessionId={selectedSessionId}
          visibleSessions={visibleSessions}
          loadingSessions={loadingSessions}
          formatPath={formatPath}
          onOpenProject={openProject}
          onOpenSession={openSession}
        />

        <HistorySessionDetailPane
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          selectedSessionSummary={selectedSessionSummary}
        />
      </div>
    </div>
  );
}
