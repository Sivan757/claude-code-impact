import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ListTree, PanelRight, PanelRightClose, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { parseTeammateMessage, stripTeammateMessageTags } from "./utils";

interface MessageNavigatorProps {
  messages: Message[];
  selectedMessageId: string | null;
  collapsed: boolean;
  width: number;
  isResizing: boolean;
  toReadable: (text: string | null | undefined) => string;
  onSelectMessage: (messageId: string) => void;
  onToggleCollapsed: () => void;
  onResizeStart: (event: ReactMouseEvent<HTMLElement>) => void;
}

interface NavigatorEntry {
  id: string;
  role: string;
  preview: string;
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function getDisplayRole(message: Message): string {
  const teammateMeta = parseTeammateMessage(getMessageSourceText(message));
  if (teammateMeta.isTeammate) return "teammate";

  if (message.role !== "user") return message.role;
  if (!Array.isArray(message.raw_content) || message.raw_content.length === 0) return message.role;

  let hasToolResult = false;
  for (const item of message.raw_content) {
    if (!isRecord(item) || typeof item.type !== "string") {
      return message.role;
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
    return message.role;
  }

  return hasToolResult ? "tool" : message.role;
}

function getPreview(
  message: Message,
  toReadable: (text: string | null | undefined) => string,
): string {
  if (Array.isArray(message.raw_content)) {
    for (const item of message.raw_content) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const block = item as Record<string, unknown>;
        const type = typeof block.type === "string" ? block.type : "";
        if (type === "text" && typeof block.text === "string" && block.text.trim()) {
          return stripTeammateMessageTags(toReadable(block.text));
        }
        if (type === "thinking" && typeof block.thinking === "string" && block.thinking.trim()) {
          return i18n.t("chat.navigator.preview_thinking", { content: block.thinking });
        }
        if (type === "tool_use" && typeof block.name === "string") {
          return i18n.t("chat.navigator.preview_tool_use", { name: block.name });
        }
        if (type === "tool_result") {
          return i18n.t("chat.navigator.preview_tool_result");
        }
      }
    }
  }
  return stripTeammateMessageTags(toReadable(message.content));
}

function getRoleLabel(role: string): string {
  return i18n.t(`chat.roles.${role}`, { defaultValue: role });
}

function getRoleAccentClass(role: string): string {
  if (role === "teammate" || role === "summary") {
    return "text-amber-700 dark:text-amber-300";
  }
  if (role === "tool") {
    return "text-emerald-700 dark:text-emerald-300";
  }
  return "text-primary";
}

export function MessageNavigator({
  messages,
  selectedMessageId,
  collapsed,
  width,
  isResizing,
  toReadable,
  onSelectMessage,
  onToggleCollapsed,
  onResizeStart,
}: MessageNavigatorProps) {
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const entryRefs = useRef(new Map<string, HTMLButtonElement>());

  const entries = useMemo<NavigatorEntry[]>(() => {
    const allEntries = messages.map((message) => ({
      id: `${message.uuid}:${message.line_number}`,
      role: getDisplayRole(message),
      preview: getPreview(message, toReadable),
      timestamp: message.timestamp,
    }));

    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return allEntries;
    return allEntries.filter((entry) =>
      entry.preview.toLowerCase().includes(keyword) ||
      entry.role.toLowerCase().includes(keyword),
    );
  }, [filterText, messages, toReadable, i18n.language]);

  useEffect(() => {
    if (!selectedMessageId) return;
    const listNode = listRef.current;
    const entryNode = entryRefs.current.get(selectedMessageId);
    if (!listNode || !entryNode) return;

    const entryTop = entryNode.offsetTop;
    const entryBottom = entryTop + entryNode.offsetHeight;
    const viewportTop = listNode.scrollTop;
    const viewportBottom = viewportTop + listNode.clientHeight;
    if (entryTop >= viewportTop && entryBottom <= viewportBottom) return;

    listNode.scrollTo({
      top: Math.max(0, entryTop - 12),
      behavior: "smooth",
    });
  }, [entries.length, selectedMessageId]);

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 shrink-0 flex-col items-center border-l border-border/60 bg-card-alt/50 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-ink"
          aria-label={t("chat.expand_navigator")}
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <div className="my-2 h-px w-6 bg-border/60" />
        <ListTree className="h-4 w-4 text-muted-foreground" />
        <span className="mt-1 text-[10px] font-mono text-muted-foreground">{messages.length}</span>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-l border-border/60 bg-card-alt/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2",
        !isResizing && "transition-[width] duration-200 ease-out",
        isResizing && "select-none",
      )}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors",
          isResizing ? "bg-primary/40" : "hover:bg-primary/30",
        )}
        onMouseDown={onResizeStart}
      />

      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex-1 text-xs font-semibold text-ink">{t("chat.navigator_label")}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{entries.length}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-ink"
          aria-label={t("chat.collapse_navigator")}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="border-b border-border/50 px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder={t("chat.navigator.filter_placeholder")}
            className="h-7 w-full rounded border border-border bg-background pl-6 pr-6 text-xs text-ink placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {filterText ? (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-card-alt hover:text-ink"
              aria-label={t("chat.navigator.clear_filter")}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {t("chat.navigator.no_entries")}
        </div>
      ) : (
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scroll-smooth"
        >
          <div className="space-y-1">
            {entries.map((entry) => {
              const active = selectedMessageId === entry.id;
              return (
                <button
                  key={entry.id}
                  ref={(node) => {
                    if (node) {
                      entryRefs.current.set(entry.id, node);
                      return;
                    }
                    entryRefs.current.delete(entry.id);
                  }}
                  type="button"
                  onClick={() => onSelectMessage(entry.id)}
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-left transition-all duration-200 ease-out",
                    active
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-background",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn("text-[11px] font-medium uppercase tracking-wide", getRoleAccentClass(entry.role))}
                    >
                      {getRoleLabel(entry.role)}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink">
                    {entry.preview || t("chat.navigator.empty_preview")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
