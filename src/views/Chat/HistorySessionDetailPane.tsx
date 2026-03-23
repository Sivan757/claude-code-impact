import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileCode } from "lucide-react";
import {
  Virtuoso,
  type ScrollSeekConfiguration,
  type ScrollSeekPlaceholderProps,
  type VirtuosoHandle,
} from "react-virtuoso";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { SessionDropdownMenuItems } from "@/components/shared/SessionMenuItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { ProjectQuickLaunchPanel } from "@/views/Projects/ProjectQuickLaunchPanel";

import { ExportDialog } from "./ExportDialog";
import { LoadingOverlayMask } from "./LoadingOverlayMask";
import { MessageContentRenderer } from "./MessageContentRenderer";
import { MessageEdgeNavigation } from "./MessageEdgeNavigation";
import { MessageNavigator } from "./MessageNavigator";
import { parseTeammateMessage, stripTeammateMessageTags, useReadableText } from "./utils";
import { useMinimumLoadingOverlay } from "./useMinimumLoadingOverlay";
import { useResizablePanel } from "./useResizablePanel";

const MESSAGE_REFRESH_MS = 1800;
const NAVIGATOR_COLLAPSE_BREAKPOINT = 1380;
const EDGE_JUMP_RETRY_MS = 56;
const EDGE_JUMP_RELEASE_MS = 180;

interface HistorySessionDetailPaneProps {
  selectedProjectId: string | null;
  selectedProjectPath: string | null;
  selectedSessionId: string | null;
  selectedSessionSummary: string | null;
}

interface RenderMessageGroup {
  id: string;
  message: Message;
  sourceMessages: Message[];
  mergedRawBlocks: unknown[];
  mergedTextParts: string[];
}

interface RenderMessageRow {
  id: string;
  message: Message;
  mergedCount: number;
  displayMeta: MessageDisplayMeta;
  displayRole: string;
  roleLabel: string;
  hasToolUse: boolean;
  hasToolResult: boolean;
  hasThinking: boolean;
  isSummaryMessage: boolean;
  timestampLabel: string;
  copyableText: string;
}

interface SessionMessagesChunk {
  messages: Message[];
  last_line: number;
  next_offset: number;
  reset_required: boolean;
}

interface MessageDisplayMeta {
  role: string;
  isTeammate: boolean;
  teammateId: string | null;
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

function dedupeMessagesByLine(messages: Message[]): Message[] {
  if (messages.length <= 1) return messages;

  const seenLines = new Set<number>();
  const deduped: Message[] = [];
  for (const message of messages) {
    if (seenLines.has(message.line_number)) {
      continue;
    }
    seenLines.add(message.line_number);
    deduped.push(message);
  }
  return deduped;
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

function clearTimer(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function clearAnimationFrame(frameRef: MutableRefObject<number | null>): void {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
}

function FastScrollPlaceholder(props: ScrollSeekPlaceholderProps): ReactNode {
  const { height } = props;
  const placeholderHeight = Number.isFinite(height) ? Math.max(72, height) : 72;
  return (
    <div className="px-4 pb-3">
      <div
        className="rounded-xl border border-border/70 bg-card-alt/70 animate-pulse"
        style={{ height: placeholderHeight }}
      />
    </div>
  );
}

function HistorySessionDetailPaneInner(props: HistorySessionDetailPaneProps): ReactNode {
  const {
    selectedProjectId,
    selectedProjectPath,
    selectedSessionId,
    selectedSessionSummary,
  } = props;
  const { t } = useTranslation();
  const toReadable = useReadableText();
  const markdownPreview = true;

  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [sessionIdCopied, setSessionIdCopied] = useState(false);
  const [readableSlashCommandEnabled, setReadableSlashCommandEnabled] = useState(false);
  const [mergeMessagesEnabled, setMergeMessagesEnabled] = useState(true);
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(() =>
    getInitialWindowCollapse(NAVIGATOR_COLLAPSE_BREAKPOINT, true),
  );

  const messageListRef = useRef<VirtuosoHandle | null>(null);
  const selectedScrollRequestedRef = useRef(false);
  const sessionIdCopiedTimerRef = useRef<number | null>(null);
  const messageCursorRef = useRef<{ line: number; offset: number }>({ line: 0, offset: 0 });
  const messageSyncingRef = useRef(false);
  const previousSessionKeyRef = useRef<string | null>(null);
  const edgeJumpFrameRef = useRef<number | null>(null);
  const edgeJumpRetryTimerRef = useRef<number | null>(null);
  const edgeJumpReleaseTimerRef = useRef<number | null>(null);
  const edgeJumpInProgressRef = useRef(false);

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
    data: messageSnapshot,
    isLoading: loadingMessageSnapshot,
  } = useQuery<SessionMessagesChunk>({
    queryKey: ["sessionMessagesSnapshot", selectedProjectId, selectedSessionId],
    enabled: Boolean(selectedProjectId && selectedSessionId),
    queryFn: async () => {
      if (!selectedProjectId || !selectedSessionId) {
        return {
          messages: [],
          last_line: 0,
          next_offset: 0,
          reset_required: false,
        };
      }
      return invoke<SessionMessagesChunk>("get_session_messages_snapshot", {
        projectId: selectedProjectId,
        sessionId: selectedSessionId,
      });
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const {
    visible: messagePanelOverlayVisible,
    show: showMessagePanelOverlay,
    hide: hideMessagePanelOverlay,
  } = useMinimumLoadingOverlay(loadingMessageSnapshot, {
    minimumDurationMs: 180,
  });

  const displayMessages = useMemo(
    () => liveMessages.filter((message) => !message.is_meta),
    [liveMessages],
  );

  const searchableMessages = useMemo(
    () =>
      displayMessages.map((message) => {
        const rawText = extractRawContentText(message.raw_content);
        const haystack = `${message.role}\n${stripTeammateMessageTags(toReadable(message.content))}\n${stripTeammateMessageTags(toReadable(rawText))}`.toLowerCase();
        return {
          message,
          haystack,
        };
      }),
    [displayMessages, toReadable],
  );

  const filteredMessages = useMemo(() => {
    const query = messageSearchQuery.trim().toLowerCase();
    if (!query) return displayMessages;

    return searchableMessages
      .filter((entry) => entry.haystack.includes(query))
      .map((entry) => entry.message);
  }, [displayMessages, messageSearchQuery, searchableMessages]);

  const renderedMessageGroups = useMemo<RenderMessageGroup[]>(() => {
    const groups: RenderMessageGroup[] = [];

    const toMessageText = (message: Message): string =>
      stripTeammateMessageTags(toReadable(message.content)) ||
      stripTeammateMessageTags(toReadable(extractRawContentText(message.raw_content)));

    const toMessageRawBlocks = (message: Message): unknown[] => {
      if (Array.isArray(message.raw_content)) {
        // Never reuse the original message array here. The merge pipeline appends blocks
        // while building grouped rows, and sharing the same array would mutate source
        // messages across re-renders, causing merged content to duplicate progressively.
        return [...message.raw_content];
      }
      const text = toMessageText(message);
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

      if (
        mergeMessagesEnabled &&
        (shouldMergeAssistant || shouldMergeProtocolToolResult)
      ) {
        previous.sourceMessages.push(message);
        const appendedText = toMessageText(message);
        if (appendedText.trim()) {
          previous.mergedTextParts.push(appendedText);
        }
        const appendedRawBlocks = toMessageRawBlocks(message);
        if (appendedRawBlocks.length > 0) {
          previous.mergedRawBlocks.push(...appendedRawBlocks);
        }

        const first = previous.sourceMessages[0];
        const last = previous.sourceMessages[previous.sourceMessages.length - 1];
        const mergedContent = previous.mergedTextParts.join("\n\n");

        const mergedMessage: Message = {
          ...first,
          uuid: `merged:${first.uuid}:${last.uuid}`,
          line_number: first.line_number,
          content: mergedContent,
          raw_content:
            previous.mergedRawBlocks.length > 0
              ? [...previous.mergedRawBlocks]
              : undefined,
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
        mergedRawBlocks: toMessageRawBlocks(message),
        mergedTextParts: (() => {
          const text = toMessageText(message);
          return text.trim() ? [text] : [];
        })(),
      });
    }

    return groups;
  }, [filteredMessages, mergeMessagesEnabled, toReadable]);

  const renderRows = useMemo<RenderMessageRow[]>(
    () =>
      renderedMessageGroups.map((group) => {
        const message = group.message;
        const displayMeta = getMessageDisplayMeta(message);
        const displayRole = displayMeta.role;
        const copyableText = group.sourceMessages
          .map(
            (sourceMessage) =>
              stripTeammateMessageTags(toReadable(sourceMessage.content)) ||
              stripTeammateMessageTags(toReadable(extractRawContentText(sourceMessage.raw_content))),
          )
          .filter((text) => text.trim().length > 0)
          .join("\n\n");

        return {
          id: group.id,
          message,
          mergedCount: group.sourceMessages.length,
          displayMeta,
          displayRole,
          roleLabel: getRoleLabel(displayRole),
          hasToolUse: hasContentType(message.raw_content, "tool_use"),
          hasToolResult: hasContentType(message.raw_content, "tool_result"),
          hasThinking: hasContentType(message.raw_content, "thinking"),
          isSummaryMessage: displayRole === "summary",
          timestampLabel: message.timestamp ? new Date(message.timestamp).toLocaleString() : "",
          copyableText,
        };
      }),
    [renderedMessageGroups, toReadable, i18n.language],
  );

  const messageIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    renderRows.forEach((row, index) => {
      map.set(row.id, index);
    });
    return map;
  }, [renderRows]);

  const navigatorMessages = useMemo(
    () => renderRows.map((row) => row.message),
    [renderRows],
  );

  const loadingMessages = loadingMessageSnapshot && liveMessages.length === 0;

  const clearEdgeJumpScheduling = useCallback(() => {
    clearAnimationFrame(edgeJumpFrameRef);
    clearTimer(edgeJumpRetryTimerRef);
    clearTimer(edgeJumpReleaseTimerRef);
    edgeJumpInProgressRef.current = false;
  }, []);

  const requestEdgeJump = useCallback((
    target: {
      index: number | "LAST";
      align: "start" | "end";
    },
  ) => {
    clearAnimationFrame(edgeJumpFrameRef);
    clearTimer(edgeJumpRetryTimerRef);
    clearTimer(edgeJumpReleaseTimerRef);
    edgeJumpInProgressRef.current = true;

    // Two staged instant jumps are more stable than a single long smooth jump on huge virtualized logs.
    const performJump = () => {
      messageListRef.current?.scrollToIndex({
        index: target.index,
        align: target.align,
        behavior: "auto",
      });
    };

    performJump();

    edgeJumpFrameRef.current = window.requestAnimationFrame(() => {
      performJump();
      edgeJumpRetryTimerRef.current = window.setTimeout(() => {
        performJump();
        edgeJumpRetryTimerRef.current = null;
      }, EDGE_JUMP_RETRY_MS);
    });

    edgeJumpReleaseTimerRef.current = window.setTimeout(() => {
      edgeJumpInProgressRef.current = false;
      edgeJumpReleaseTimerRef.current = null;
    }, EDGE_JUMP_RELEASE_MS);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < NAVIGATOR_COLLAPSE_BREAKPOINT) {
        setNavigatorCollapsed(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const currentSessionKey = selectedProjectId && selectedSessionId
    ? `${selectedProjectId}:${selectedSessionId}`
    : null;

  useEffect(() => {
    if (!currentSessionKey) {
      previousSessionKeyRef.current = null;
      hideMessagePanelOverlay();
      return;
    }
    if (previousSessionKeyRef.current !== currentSessionKey) {
      showMessagePanelOverlay();
    }
    previousSessionKeyRef.current = currentSessionKey;
  }, [currentSessionKey, hideMessagePanelOverlay, showMessagePanelOverlay]);

  useEffect(() => {
    if (!selectedProjectId || !selectedSessionId) {
      setLiveMessages([]);
      messageCursorRef.current = { line: 0, offset: 0 };
      return;
    }
    if (!messageSnapshot) return;

    setLiveMessages(dedupeMessagesByLine(messageSnapshot.messages));
    messageCursorRef.current = {
      line: messageSnapshot.last_line,
      offset: messageSnapshot.next_offset,
    };
  }, [messageSnapshot, selectedProjectId, selectedSessionId]);

  useEffect(() => {
    setSelectedMessageIds(new Set());
    setMessageSearchQuery("");
    setSelectedMessageId(null);
    setLiveMessages([]);
    setSessionIdCopied(false);
    setMergeMessagesEnabled(true);
    selectedScrollRequestedRef.current = false;
    messageCursorRef.current = { line: 0, offset: 0 };
    messageSyncingRef.current = false;
    clearEdgeJumpScheduling();
  }, [clearEdgeJumpScheduling, currentSessionKey]);

  useEffect(
    () => () => {
      clearTimer(sessionIdCopiedTimerRef);
      clearEdgeJumpScheduling();
    },
    [clearEdgeJumpScheduling],
  );

  useEffect(() => {
    if (renderRows.length === 0) {
      setSelectedMessageId(null);
      return;
    }

    const firstId = renderRows[0].id;
    if (!selectedMessageId) {
      setSelectedMessageId(firstId);
      return;
    }

    const exists = messageIdToIndex.has(selectedMessageId);
    if (!exists) {
      setSelectedMessageId(firstId);
    }
  }, [messageIdToIndex, renderRows, selectedMessageId]);

  useEffect(() => {
    if (!selectedMessageId) return;
    const index = messageIdToIndex.get(selectedMessageId);
    if (index === undefined) return;
    if (!selectedScrollRequestedRef.current) {
      return;
    }
    selectedScrollRequestedRef.current = false;
    messageListRef.current?.scrollToIndex({
      index,
      align: "start",
      behavior: "smooth",
    });
  }, [messageIdToIndex, selectedMessageId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedSessionId) return;

    let cancelled = false;

    const syncDelta = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (navigatorResizing) return;
      if (messageSyncingRef.current) return;
      if (edgeJumpInProgressRef.current) return;
      if (loadingMessageSnapshot && messageCursorRef.current.offset === 0) return;

      messageSyncingRef.current = true;
      try {
        const chunk = await invoke<SessionMessagesChunk>("get_session_messages_delta", {
          projectId: selectedProjectId,
          sessionId: selectedSessionId,
          fromLine: messageCursorRef.current.line,
          fromOffset: messageCursorRef.current.offset,
        });
        if (cancelled) return;

        if (chunk.reset_required) {
          const snapshot = await invoke<SessionMessagesChunk>("get_session_messages_snapshot", {
            projectId: selectedProjectId,
            sessionId: selectedSessionId,
          });
          if (cancelled) return;
          setLiveMessages(dedupeMessagesByLine(snapshot.messages));
          messageCursorRef.current = {
            line: snapshot.last_line,
            offset: snapshot.next_offset,
          };
          return;
        }

        messageCursorRef.current = {
          line: chunk.last_line,
          offset: chunk.next_offset,
        };

        if (chunk.messages.length > 0) {
          setLiveMessages((current) => {
            const lastLine = current[current.length - 1]?.line_number ?? 0;
            const appended = chunk.messages.filter((message) => message.line_number > lastLine);
            if (appended.length === 0) return current;
            return dedupeMessagesByLine([...current, ...appended]);
          });
        }
      } catch {
        // Keep live polling resilient to transient file access races.
      } finally {
        messageSyncingRef.current = false;
      }
    };

    void syncDelta();
    const timer = window.setInterval(() => {
      void syncDelta();
    }, MESSAGE_REFRESH_MS);

    return () => {
      cancelled = true;
      messageSyncingRef.current = false;
      window.clearInterval(timer);
    };
  }, [
    loadingMessageSnapshot,
    navigatorResizing,
    selectedProjectId,
    selectedSessionId,
  ]);

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

  const handleCopySessionId = async () => {
    if (!selectedSessionId) return;
    try {
      await invoke("copy_to_clipboard", { text: selectedSessionId });
      setSessionIdCopied(true);
      if (sessionIdCopiedTimerRef.current !== null) {
        window.clearTimeout(sessionIdCopiedTimerRef.current);
      }
      sessionIdCopiedTimerRef.current = window.setTimeout(() => {
        setSessionIdCopied(false);
      }, 1400);
    } catch {
      // Ignore copy failures in UI path.
    }
  };

  const selectedSessionTitle =
    stripTeammateMessageTags(toReadable(selectedSessionSummary)) || t("chat.untitled_session");

  const detailMessageTextTransform = useCallback(
    (text: string | null | undefined) =>
      readableSlashCommandEnabled ? toReadable(text) : text ?? "",
    [readableSlashCommandEnabled, toReadable],
  );

  const renderedMessageCountLabel = t("chat.message_count", {
    count: renderRows.length,
  });

  const scrollSeekConfiguration = useMemo<ScrollSeekConfiguration>(
    () => ({
      enter: (velocity) => Math.abs(velocity) > 900,
      exit: (velocity) => Math.abs(velocity) < 120,
    }),
    [],
  );

  const selectMessage = (
    messageId: string,
    options: { requestScroll?: boolean } = {},
  ) => {
    if (options.requestScroll) {
      selectedScrollRequestedRef.current = true;
    }
    setSelectedMessageId(messageId);
  };

  const scrollToTop = () => {
    if (renderRows.length === 0) return;
    const first = renderRows[0];
    setSelectedMessageId(first.id);
    selectedScrollRequestedRef.current = false;
    messageListRef.current?.scrollToIndex({
      index: 0,
      align: "start",
      behavior: "smooth",
    });
  };

  const scrollToBottom = () => {
    if (renderRows.length === 0) return;
    const last = renderRows[renderRows.length - 1];
    setSelectedMessageId(last.id);
    selectedScrollRequestedRef.current = false;
    requestEdgeJump({
      index: "LAST",
      align: "end",
    });
  };

  return (
    <>
      <main className="relative flex min-w-0 flex-1 flex-col bg-card/20">
        {!selectedProjectId || !selectedSessionId ? (
          <div className="flex h-full min-h-0 flex-col">
            {selectedProjectPath ? (
              <ProjectQuickLaunchPanel
                projectPath={selectedProjectPath}
                className="flex-1"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("chat.select_session_to_view")}
              </div>
            )}
          </div>
        ) : (
          <div
            key={`session-detail-${selectedSessionId}`}
            className="flex h-full min-h-0 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-1"
          >
            <header className="border-b border-border/60 px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-base font-semibold text-ink">{selectedSessionTitle}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopySessionId();
                    }}
                    className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-mono text-primary transition-colors hover:text-primary/80"
                    title={sessionIdCopied ? t("chat.session_id_copied") : t("chat.copy_session_id_hint")}
                    aria-label={sessionIdCopied ? t("chat.session_id_copied") : t("chat.copy_session_id_hint")}
                  >
                    <span className="truncate">{selectedSessionId}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card-alt hover:text-ink"
                      >
                        <DotsHorizontalIcon />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-lg p-[3px] shadow-md">
                      <SessionDropdownMenuItems
                        projectId={selectedProjectId}
                        sessionId={selectedSessionId}
                        onExport={() => setExportDialogOpen(true)}
                        readableSlashCommandChecked={readableSlashCommandEnabled}
                        onReadableSlashCommandCheckedChange={setReadableSlashCommandEnabled}
                        mergeMessagesChecked={mergeMessagesEnabled}
                        onMergeMessagesCheckedChange={setMergeMessagesEnabled}
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

            <div className="relative min-h-0 flex-1">
              <MessageEdgeNavigation
                topLabel={t("chat.scroll_to_top")}
                bottomLabel={t("chat.scroll_to_bottom")}
                onScrollTop={scrollToTop}
                onScrollBottom={scrollToBottom}
              />
              {loadingMessages ? (
                <div className="space-y-3 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
                  <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-24 rounded-xl border border-border/60 bg-card-alt/70 animate-pulse" />
                  <div className="h-20 rounded-xl border border-border/60 bg-background/80 animate-pulse" />
                  <p className="text-sm text-muted-foreground">{t("message_view.loading")}</p>
                </div>
              ) : renderRows.length === 0 ? (
                <div className="p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
                  <p className="text-sm text-muted-foreground">
                    {t("chat.no_messages_in_session")}
                  </p>
                </div>
              ) : (
                <Virtuoso
                  ref={messageListRef}
                  className="h-full [scrollbar-gutter:stable]"
                  data={renderRows}
                  followOutput={false}
                  increaseViewportBy={{ top: 140, bottom: 240 }}
                  overscan={{ main: 320, reverse: 180 }}
                  computeItemKey={(_index, row) => row.id}
                  scrollSeekConfiguration={scrollSeekConfiguration}
                  components={{
                    ScrollSeekPlaceholder: FastScrollPlaceholder,
                  }}
                  itemContent={(index, row) => {
                    const message = row.message;
                    const messageId = row.id;
                    const selected = selectedMessageId === messageId;

                    return (
                      <div className={cn("px-4 pb-3", index === 0 && "pt-4")}>
                        <article
                          onClick={() => {
                            selectMessage(messageId);
                          }}
                          className={cn(
                            "group rounded-xl border p-3 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
                            row.displayRole === "user"
                              ? "border-border bg-card-alt"
                              : "border-border bg-background",
                            row.isSummaryMessage && "border-amber-500/40 bg-amber-500/[0.05]",
                            row.displayMeta.isTeammate && "border-amber-500/45 bg-amber-500/[0.06]",
                            row.hasToolUse && "border-blue-500/40 bg-blue-500/[0.03]",
                            row.hasToolResult && "border-emerald-500/35 bg-emerald-500/[0.03]",
                            selected && "border-primary/70 ring-1 ring-primary/30",
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                  row.displayMeta.isTeammate
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : row.isSummaryMessage
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : row.displayRole === "tool"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : "bg-primary/10 text-primary",
                                )}
                              >
                                {row.roleLabel}
                              </span>
                              {row.displayMeta.isTeammate && row.displayMeta.teammateId ? (
                                <span className="rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                  @{row.displayMeta.teammateId}
                                </span>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {row.timestampLabel}
                              </span>
                              {row.hasThinking ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                  {t("chat.badges.thinking")}
                                </span>
                              ) : null}
                              {row.hasToolUse ? (
                                <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                  {t("chat.badges.tool_use")}
                                </span>
                              ) : null}
                              {row.hasToolResult ? (
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                  {t("chat.badges.tool_result")}
                                </span>
                              ) : null}
                              {row.mergedCount > 1 ? (
                                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                  {t("chat.badges.merged_count", { count: row.mergedCount })}
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
                                  onClick={() => handleCopyContent(row.copyableText)}
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
                            toReadable={detailMessageTextTransform}
                          />
                        </article>
                      </div>
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}
        <LoadingOverlayMask
          label={t("message_view.loading")}
          visible={messagePanelOverlayVisible}
        />
      </main>

      <MessageNavigator
        messages={navigatorMessages}
        selectedMessageId={selectedMessageId}
        collapsed={navigatorCollapsed}
        width={navigatorWidth}
        isResizing={navigatorResizing}
        toReadable={toReadable}
        onSelectMessage={(messageId) => {
          selectMessage(messageId, {
            requestScroll: true,
          });
        }}
        onToggleCollapsed={() => setNavigatorCollapsed((value) => !value)}
        onResizeStart={onNavigatorResizeStart}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        allMessages={displayMessages}
        selectedIds={selectedMessageIds}
        onSelectedIdsChange={setSelectedMessageIds}
        defaultName={sanitizedFileName(selectedSessionTitle || "session")}
      />
    </>
  );
}

function areHistorySessionDetailPanePropsEqual(
  prev: HistorySessionDetailPaneProps,
  next: HistorySessionDetailPaneProps,
): boolean {
  return prev.selectedProjectId === next.selectedProjectId &&
    prev.selectedProjectPath === next.selectedProjectPath &&
    prev.selectedSessionId === next.selectedSessionId &&
    prev.selectedSessionSummary === next.selectedSessionSummary;
}

export const HistorySessionDetailPane = memo(
  HistorySessionDetailPaneInner,
  areHistorySessionDetailPanePropsEqual,
);

HistorySessionDetailPane.displayName = "HistorySessionDetailPane";
