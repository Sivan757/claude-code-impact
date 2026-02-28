import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { DotsHorizontalIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Copy, FileCode, PanelLeft, PanelLeftClose } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import i18n from "@/i18n";
import { useAppConfig } from "@/context";
import { useInvokeQuery } from "@/hooks";
import { cn } from "@/lib/utils";
import { SessionDropdownMenuItems } from "@/components/shared/SessionMenuItems";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hideEmptySessionsAtom, markdownPreviewAtom, originalChatAtom } from "@/store";
import type { Message, Project, SearchResult, Session } from "@/types";

import { ExportDialog } from "./ExportDialog";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { MessageNavigator } from "./MessageNavigator";
import {
  formatDate,
  formatRelativeTime,
  parseTeammateMessage,
  stripTeammateMessageTags,
  useReadableText,
} from "./utils";
import { useResizablePanel } from "./useResizablePanel";

const LIVE_REFRESH_MS = 6000;
const SEARCH_DEBOUNCE_MS = 280;
const SIDEBAR_COLLAPSE_BREAKPOINT = 1080;
const NAVIGATOR_COLLAPSE_BREAKPOINT = 1380;

type HistoryRouteParams = {
  projectId?: string;
  sessionId?: string;
};

interface RenderMessageGroup {
  id: string;
  message: Message;
  sourceMessages: Message[];
}

interface MessageDisplayMeta {
  role: string;
  isTeammate: boolean;
  teammateId: string | null;
}

function safeDecodePath(value?: string): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizedFileName(raw: string): string {
  return raw.slice(0, 50).replace(/[/\\?%*:|"<>]/g, "-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractRawContentText(rawContent: unknown): string {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";

  const parts: string[] = [];
  for (const item of rawContent) {
    if (!isRecord(item)) {
      const text = toText(item);
      if (text) parts.push(text);
      continue;
    }

    const type = typeof item.type === "string" ? item.type : "";
    if (type === "text" && typeof item.text === "string") {
      parts.push(item.text);
      continue;
    }
    if (type === "thinking" && typeof item.thinking === "string") {
      parts.push(item.thinking);
      continue;
    }
    if (type === "tool_use") {
      const name = typeof item.name === "string" ? item.name : "tool_use";
      parts.push(`[tool_use] ${name}`);
      const input = toText(item.input);
      if (input) parts.push(input);
      continue;
    }
    if (type === "tool_result") {
      parts.push(`[tool_result] ${toText(item.content)}`);
      continue;
    }

    const fallback = toText(item);
    if (fallback) parts.push(fallback);
  }

  return parts.join("\n");
}

function getMessageId(message: Message): string {
  return `${message.uuid}:${message.line_number}`;
}

function canMergeAssistantMessage(message: Message): boolean {
  return message.role === "assistant";
}

function isAssistantOrProtocolToolMessage(message: Message): boolean {
  return message.role === "assistant" || isProtocolToolResultMessage(message);
}

function getMessageSourceText(message: Message): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  if (!Array.isArray(message.raw_content)) {
    return "";
  }
  for (const item of message.raw_content) {
    if (
      isRecord(item) &&
      item.type === "text" &&
      typeof item.text === "string" &&
      item.text.trim()
    ) {
      return item.text;
    }
  }
  return "";
}

function hasContentType(rawContent: unknown, type: string): boolean {
  if (!Array.isArray(rawContent)) return false;
  return rawContent.some(
    (item) =>
      isRecord(item) &&
      typeof item.type === "string" &&
      item.type === type,
  );
}

function isProtocolToolResultMessage(message: Message): boolean {
  if (message.role !== "user") return false;
  if (!Array.isArray(message.raw_content) || message.raw_content.length === 0) return false;

  let hasToolResult = false;
  for (const item of message.raw_content) {
    if (!isRecord(item) || typeof item.type !== "string") {
      return false;
    }
    if (item.type === "tool_result") {
      hasToolResult = true;
      continue;
    }
    if (
      item.type === "text" &&
      typeof item.text === "string" &&
      item.text.trim().length === 0
    ) {
      continue;
    }
    return false;
  }

  return hasToolResult;
}

function getMessageDisplayMeta(message: Message): MessageDisplayMeta {
  if (isProtocolToolResultMessage(message)) {
    return {
      role: "tool",
      isTeammate: false,
      teammateId: null,
    };
  }
  const teammateMeta = parseTeammateMessage(getMessageSourceText(message));
  if (teammateMeta.isTeammate) {
    return {
      role: "teammate",
      isTeammate: true,
      teammateId: teammateMeta.teammateId,
    };
  }
  return {
    role: message.role,
    isTeammate: false,
    teammateId: null,
  };
}

function getInitialWindowCollapse(breakpoint: number, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  return window.innerWidth < breakpoint;
}

function getRoleLabel(role: string): string {
  return i18n.t(`chat.roles.${role}`, { defaultValue: role });
}

export function HistoryWorkbench() {
  const { t } = useTranslation();
  const { formatPath } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<HistoryRouteParams>();
  const routeProjectId = safeDecodePath(params.projectId);
  const routeSessionId = safeDecodePath(params.sessionId);

  const [originalChat, setOriginalChat] = useAtom(originalChatAtom);
  const [markdownPreview, setMarkdownPreview] = useAtom(markdownPreviewAtom);
  const [hideEmptySessions, setHideEmptySessions] = useAtom(hideEmptySessionsAtom);
  const toReadable = useReadableText();

  const [projectFilter, setProjectFilter] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchIndexMissing, setSearchIndexMissing] = useState(false);
  const [buildingIndex, setBuildingIndex] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [sidebarTab, setSidebarTab] = useState<"projects" | "sessions">("sessions");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [trailingMode, setTrailingMode] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getInitialWindowCollapse(SIDEBAR_COLLAPSE_BREAKPOINT, false),
  );
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(() =>
    getInitialWindowCollapse(NAVIGATOR_COLLAPSE_BREAKPOINT, true),
  );

  const messageListRef = useRef<VirtuosoHandle | null>(null);
  const isNearBottomRef = useRef(true);
  const selectedScrollRequestedRef = useRef(false);

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

  const {
    width: navigatorWidth,
    isResizing: navigatorResizing,
    onResizeStart: onNavigatorResizeStart,
  } = useResizablePanel({
    defaultWidth: 310,
    minWidth: 220,
    maxWidth: 460,
    direction: "left",
    storageKey: "chat-history-navigator-width",
  });

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

  const selectedSessionId = useMemo(() => {
    if (sessions.length === 0) return null;
    if (routeSessionId && sessions.some((session) => session.id === routeSessionId)) {
      return routeSessionId;
    }
    return sessions[0].id;
  }, [sessions, routeSessionId]);

  const {
    data: messages = [],
    isLoading: loadingMessages,
    refetch: refetchMessages,
  } = useQuery<Message[]>({
    queryKey: ["sessionMessages", selectedProjectId, selectedSessionId],
    enabled: Boolean(selectedProjectId && selectedSessionId),
    queryFn: async () => {
      if (!selectedProjectId || !selectedSessionId) return [];
      return invoke<Message[]>("get_session_messages", {
        projectId: selectedProjectId,
        sessionId: selectedSessionId,
      });
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const totalSessionCount = useMemo(
    () => projects.reduce((total, project) => total + project.session_count, 0),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const keyword = projectFilter.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(keyword) ||
        formatPath(project.path).toLowerCase().includes(keyword),
    );
  }, [formatPath, projectFilter, projects]);

  const visibleSessions = useMemo(() => {
    if (!hideEmptySessions) return sessions;
    return sessions.filter((session) => session.message_count > 0);
  }, [hideEmptySessions, sessions]);

  const displayMessages = useMemo(
    () => (originalChat ? messages.filter((msg) => !msg.is_meta) : messages),
    [messages, originalChat],
  );

  const filteredMessages = useMemo(() => {
    const query = messageSearchQuery.trim().toLowerCase();
    if (!query) return displayMessages;

    return displayMessages.filter((message) => {
      const rawText = extractRawContentText(message.raw_content);
      const haystack = `${message.role}\n${stripTeammateMessageTags(toReadable(message.content))}\n${stripTeammateMessageTags(toReadable(rawText))}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [displayMessages, messageSearchQuery, toReadable]);

  const renderedMessageGroups = useMemo<RenderMessageGroup[]>(() => {
    const groups: RenderMessageGroup[] = [];

    const toMessageRawBlocks = (message: Message): unknown[] => {
      if (Array.isArray(message.raw_content)) {
        return message.raw_content;
      }
      const text =
        stripTeammateMessageTags(toReadable(message.content)) ||
        stripTeammateMessageTags(toReadable(extractRawContentText(message.raw_content)));
      if (!text.trim()) {
        return [];
      }
      return [{ type: "text", text }];
    };

    for (const message of filteredMessages) {
      const previous = groups[groups.length - 1];
      const canMergeIntoAssistantToolChain =
        previous !== undefined &&
        previous.sourceMessages.every(isAssistantOrProtocolToolMessage) &&
        previous.sourceMessages.some((item) => item.role === "assistant");
      const previousHasToolUse =
        previous !== undefined &&
        previous.sourceMessages.some((item) => hasContentType(item.raw_content, "tool_use"));

      const shouldMergeAssistant =
        canMergeAssistantMessage(message) && canMergeIntoAssistantToolChain;
      const shouldMergeProtocolToolResult =
        isProtocolToolResultMessage(message) &&
        canMergeIntoAssistantToolChain &&
        previousHasToolUse;

      if (shouldMergeAssistant || shouldMergeProtocolToolResult) {
        previous.sourceMessages.push(message);
        const first = previous.sourceMessages[0];
        const last = previous.sourceMessages[previous.sourceMessages.length - 1];
        const mergedContent = previous.sourceMessages
          .map(
            (item) =>
              stripTeammateMessageTags(toReadable(item.content)) ||
              stripTeammateMessageTags(toReadable(extractRawContentText(item.raw_content))),
          )
          .filter((item) => item.trim().length > 0)
          .join("\n\n");

        const mergedMessage: Message = {
          ...first,
          uuid: `merged:${first.uuid}:${last.uuid}`,
          line_number: first.line_number,
          content: mergedContent,
          raw_content: (() => {
            const mergedRaw = previous.sourceMessages.flatMap(toMessageRawBlocks);
            return mergedRaw.length > 0 ? mergedRaw : undefined;
          })(),
          timestamp: last.timestamp,
          is_meta: false,
          is_tool: false,
        };
        previous.message = mergedMessage;
        previous.id = getMessageId(mergedMessage);
        continue;
      }

      groups.push({
        id: getMessageId(message),
        message,
        sourceMessages: [message],
      });
    }

    return groups;
  }, [filteredMessages, toReadable]);

  const messageIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    renderedMessageGroups.forEach((group, index) => {
      map.set(group.id, index);
    });
    return map;
  }, [renderedMessageGroups]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT) {
        setSidebarCollapsed(true);
      }
      if (window.innerWidth < NAVIGATOR_COLLAPSE_BREAKPOINT) {
        setNavigatorCollapsed(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    setSelectedMessageIds(new Set());
    setMessageSearchQuery("");
    setSelectedMessageId(null);
    setTrailingMode(true);
    setIsNearBottom(true);
    isNearBottomRef.current = true;
    selectedScrollRequestedRef.current = false;
  }, [selectedSessionId]);

  useEffect(() => {
    if (renderedMessageGroups.length === 0) {
      setSelectedMessageId(null);
      return;
    }

    const firstId = renderedMessageGroups[0].id;
    const lastId = renderedMessageGroups[renderedMessageGroups.length - 1].id;

    if (trailingMode) {
      if (selectedMessageId !== lastId) {
        setSelectedMessageId(lastId);
      }
      return;
    }

    if (!selectedMessageId) {
      setSelectedMessageId(firstId);
      return;
    }

    const exists = renderedMessageGroups.some((group) => group.id === selectedMessageId);
    if (!exists) {
      setSelectedMessageId(firstId);
    }
  }, [renderedMessageGroups, selectedMessageId, trailingMode]);

  useEffect(() => {
    if (!selectedMessageId) return;
    const index = messageIdToIndex.get(selectedMessageId);
    if (index === undefined) return;
    if (trailingMode) {
      messageListRef.current?.scrollToIndex({
        index,
        align: "end",
        behavior: "auto",
      });
      return;
    }
    if (!selectedScrollRequestedRef.current) {
      return;
    }
    selectedScrollRequestedRef.current = false;
    messageListRef.current?.scrollToIndex({
      index,
      align: "center",
      behavior: "smooth",
    });
  }, [messageIdToIndex, selectedMessageId, trailingMode]);

  useEffect(() => {
    if (messageSearchQuery.trim()) {
      setTrailingMode(false);
    }
  }, [messageSearchQuery]);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (sidebarResizing || navigatorResizing) {
        return;
      }
      void refetchProjects();
      if (selectedProjectId) {
        void refetchSessions();
      }
      if (selectedProjectId && selectedSessionId) {
        void refetchMessages();
      }
    }, LIVE_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [
    refetchProjects,
    refetchSessions,
    refetchMessages,
    sidebarResizing,
    navigatorResizing,
    selectedProjectId,
    selectedSessionId,
  ]);

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

  const refreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProjects(),
        selectedProjectId ? refetchSessions() : Promise.resolve(),
        selectedProjectId && selectedSessionId ? refetchMessages() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const openProject = (projectId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}`);
    setSidebarTab("sessions");
  };

  const openSession = (projectId: string, sessionId: string) => {
    navigate(`/chat/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`);
    setSidebarTab("sessions");
    setTrailingMode(true);
  };

  const handleCopyContent = (content: string) => {
    void invoke("copy_to_clipboard", { text: content });
  };

  const handleCopyFileLine = async (lineNumber: number) => {
    if (!selectedProjectId || !selectedSessionId) return;
    try {
      const path = await invoke<string>("get_session_file_path", {
        projectId: selectedProjectId,
        sessionId: selectedSessionId,
      });
      await invoke("copy_to_clipboard", { text: `${path}:${lineNumber}` });
    } catch {
      // Ignore copy failures in UI path.
    }
  };

  const selectedSessionTitle =
    stripTeammateMessageTags(toReadable(selectedSession?.summary)) || t("chat.untitled_session");

  const renderedMessageCountLabel = t("chat.message_count", {
    count: renderedMessageGroups.length,
  });

  const selectMessage = (
    messageId: string,
    options: { disableTrailing?: boolean; requestScroll?: boolean } = {},
  ) => {
    if (options.disableTrailing) {
      setTrailingMode(false);
    }
    if (options.requestScroll) {
      selectedScrollRequestedRef.current = true;
    }
    setSelectedMessageId(messageId);
  };

  const enableTrailingMode = () => {
    setTrailingMode(true);
    const latest = renderedMessageGroups[renderedMessageGroups.length - 1];
    if (latest) {
      setSelectedMessageId(latest.id);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{t("chat.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("chat.stats", { projects: projects.length, sessions: totalSessionCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="gap-2"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className="hidden sm:inline">{t("chat.sidebar")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNow}
            className="gap-2"
            disabled={refreshing}
          >
            <ReloadIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {t("common.refresh")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/50">
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
                <div className="flex h-full min-h-0 flex-col">
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
                              onClick={() => openProject(project.id)}
                              className={cn(
                                "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                selected
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/50",
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
                <div className="flex h-full min-h-0 flex-col">
                  <div className="border-b border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedProject ? formatPath(selectedProject.path) : t("chat.sessions")}
                      </p>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={hideEmptySessions} onCheckedChange={setHideEmptySessions} />
                        {t("chat.hide_empty")}
                      </label>
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

                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {loadingSessions ? (
                      <p className="p-3 text-sm text-muted-foreground">{t("session.loading_project")}</p>
                    ) : sessionSearchQuery.trim() && searchResults !== null ? (
                      <div className="space-y-2">
                        <p className="px-1 text-xs text-muted-foreground">
                          {t("session.search_results", { count: searchResults.length })}
                        </p>
                        {searchResults.map((result) => (
                          <button
                            key={result.uuid}
                            type="button"
                            onClick={() => openSession(result.project_id, result.session_id)}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/50"
                          >
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {stripTeammateMessageTags(toReadable(result.session_summary)) || t("chat.untitled_session")}
                            </p>
                            <p className="line-clamp-2 text-sm text-ink">{stripTeammateMessageTags(toReadable(result.content))}</p>
                          </button>
                        ))}
                        {searchResults.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">{t("session.no_results")}</p>
                        ) : null}
                      </div>
                    ) : visibleSessions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t("chat.no_sessions")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {visibleSessions.map((session) => {
                          const selected = session.id === selectedSessionId;
                          return (
                            <div
                              key={session.id}
                              className={cn(
                                "group rounded-xl border px-3 py-2 transition-colors",
                                selected
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/50",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => openSession(session.project_id, session.id)}
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
                    )}
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

        <main className="flex min-w-0 flex-1 flex-col bg-card/20">
          {!selectedProjectId || !selectedSessionId || !selectedSession ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              {t("chat.select_session_to_view")}
            </div>
          ) : (
            <>
              <header className="border-b border-border/60 px-4 py-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-base font-semibold text-ink">{selectedSessionTitle}</p>
                    <p className="mt-1 truncate text-xs font-mono text-primary">{selectedSession.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (trailingMode) {
                          setTrailingMode(false);
                        } else {
                          enableTrailingMode();
                        }
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        trailingMode
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-ink",
                      )}
                    >
                      {trailingMode ? t("chat.following_latest") : t("chat.follow_latest")}
                      {!trailingMode && isNearBottom ? ` (${t("chat.at_bottom")})` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavigatorCollapsed((value) => !value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-ink"
                    >
                      {t("chat.navigator_label")}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-alt hover:text-ink"
                        >
                          <DotsHorizontalIcon />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <SessionDropdownMenuItems
                          projectId={selectedProjectId}
                          sessionId={selectedSessionId}
                          originalChat={originalChat}
                          setOriginalChat={setOriginalChat}
                          markdownPreview={markdownPreview}
                          setMarkdownPreview={setMarkdownPreview}
                          onExport={() => setExportDialogOpen(true)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <input
                    value={messageSearchQuery}
                    onChange={(event) => setMessageSearchQuery(event.target.value)}
                    placeholder={t("chat.message_search_placeholder")}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground">{renderedMessageCountLabel}</p>
                </div>
              </header>

              <div className="min-h-0 flex-1">
                {loadingMessages ? (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground">{t("message_view.loading")}</p>
                  </div>
                ) : renderedMessageGroups.length === 0 ? (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground">
                      {t("chat.no_messages_in_session")}
                    </p>
                  </div>
                ) : (
                  <Virtuoso
                    ref={messageListRef}
                    className="h-full"
                    data={renderedMessageGroups}
                    followOutput={trailingMode ? "auto" : false}
                    increaseViewportBy={{ top: 320, bottom: 640 }}
                    atBottomThreshold={96}
                    computeItemKey={(_index, group) => group.id}
                    atBottomStateChange={(atBottom) => {
                      if (isNearBottomRef.current !== atBottom) {
                        isNearBottomRef.current = atBottom;
                        setIsNearBottom(atBottom);
                      }
                      if (!atBottom && trailingMode) {
                        setTrailingMode(false);
                      }
                    }}
                    itemContent={(index, group) => {
                      const message = group.message;
                      const displayMeta = getMessageDisplayMeta(message);
                      const displayRole = displayMeta.role;
                      const messageId = group.id;
                      const selected = selectedMessageId === messageId;
                      const hasToolUse = hasContentType(message.raw_content, "tool_use");
                      const hasToolResult = hasContentType(message.raw_content, "tool_result");
                      const hasThinking = hasContentType(message.raw_content, "thinking");
                      const copyableText = group.sourceMessages
                        .map(
                          (sourceMessage) =>
                            stripTeammateMessageTags(toReadable(sourceMessage.content)) ||
                            stripTeammateMessageTags(toReadable(extractRawContentText(sourceMessage.raw_content))),
                        )
                        .filter((text) => text.trim().length > 0)
                        .join("\n\n");

                      return (
                        <div className={cn("px-4 pb-3", index === 0 && "pt-4")}>
                          <article
                            onClick={() => {
                              selectMessage(messageId, {
                                disableTrailing: true,
                                requestScroll: true,
                              });
                            }}
                            className={cn(
                              "group rounded-xl border p-3 transition-colors",
                              displayRole === "user"
                                ? "border-border bg-card-alt"
                                : "border-border bg-background",
                              displayMeta.isTeammate && "border-amber-500/45 bg-amber-500/[0.06]",
                              hasToolUse && "border-blue-500/40 bg-blue-500/[0.03]",
                              hasToolResult && "border-emerald-500/35 bg-emerald-500/[0.03]",
                              selected && "border-primary/70 ring-1 ring-primary/30",
                            )}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                    displayMeta.isTeammate
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                      : displayRole === "tool"
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                        : "bg-primary/10 text-primary",
                                  )}
                                >
                                  {getRoleLabel(displayRole)}
                                </span>
                                {displayMeta.isTeammate && displayMeta.teammateId ? (
                                  <span className="rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                    @{displayMeta.teammateId}
                                  </span>
                                ) : null}
                                <span className="text-xs text-muted-foreground">
                                  {message.timestamp ? new Date(message.timestamp).toLocaleString() : ""}
                                </span>
                                {hasThinking ? (
                                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                    {t("chat.badges.thinking")}
                                  </span>
                                ) : null}
                                {hasToolUse ? (
                                  <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                    {t("chat.badges.tool_use")}
                                  </span>
                                ) : null}
                                {hasToolResult ? (
                                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    {t("chat.badges.tool_result")}
                                  </span>
                                ) : null}
                                {group.sourceMessages.length > 1 ? (
                                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                    {t("chat.badges.merged_count", { count: group.sourceMessages.length })}
                                  </span>
                                ) : null}
                              </div>
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
                                  <DropdownMenuItem
                                    onClick={() => handleCopyContent(copyableText)}
                                    className="gap-2"
                                  >
                                    <Copy size={14} />
                                    {t("message_view.copy_content")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void handleCopyFileLine(message.line_number);
                                    }}
                                    className="gap-2"
                                  >
                                    <FileCode size={14} />
                                    {t("message_view.copy_file_line")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <MessageContentRenderer
                              message={message}
                              markdown={markdownPreview}
                              toReadable={toReadable}
                            />
                          </article>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </>
          )}
        </main>

        <MessageNavigator
          messages={renderedMessageGroups.map((group) => group.message)}
          selectedMessageId={selectedMessageId}
          collapsed={navigatorCollapsed}
          width={navigatorWidth}
          isResizing={navigatorResizing}
          toReadable={toReadable}
          onSelectMessage={(messageId) => {
            selectMessage(messageId, {
              disableTrailing: true,
              requestScroll: true,
            });
          }}
          onToggleCollapsed={() => setNavigatorCollapsed((value) => !value)}
          onResizeStart={onNavigatorResizeStart}
        />
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        allMessages={displayMessages}
        selectedIds={selectedMessageIds}
        onSelectedIdsChange={setSelectedMessageIds}
        defaultName={sanitizedFileName(selectedSessionTitle || "session")}
      />
    </div>
  );
}
