import { memo, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Hammer,
  Image as ImageIcon,
  Search,
  Terminal,
  Users,
} from "lucide-react";

import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

import { CollapsibleContent } from "./CollapsibleContent";
import { parseTeammateMessage } from "./utils";

interface MessageContentRendererProps {
  message: Message;
  markdown: boolean;
}

type ContentRecord = Record<string, unknown>;

type NormalizedEntry =
  | {
      kind: "toolExecution";
      key: string;
      toolUse: ContentRecord;
      toolResults: ContentRecord[];
    }
  | {
      kind: "item";
      key: string;
      item: unknown;
      index: number;
    };

type ToolExecutionStatus = "pending" | "completed" | "error";
type CardTone = "neutral" | "info" | "success" | "warning" | "danger";

interface AnsiSpan {
  text: string;
  className: string;
}

interface CommandTagPayload {
  commandName: string | null;
  commandMessage: string | null;
  commandArgs: string | null;
  commandCaveat: string | null;
  stdoutBlocks: Array<{ label: string; content: string }>;
  stderrBlocks: Array<{ label: string; content: string }>;
  remainingText: string;
}

const ANSI_COLORS: Record<string, string> = {
  "30": "text-gray-900",
  "31": "text-red-500",
  "32": "text-green-500",
  "33": "text-yellow-500",
  "34": "text-blue-500",
  "35": "text-purple-500",
  "36": "text-cyan-500",
  "37": "text-gray-300",
  "90": "text-gray-500",
  "91": "text-red-400",
  "92": "text-green-400",
  "93": "text-yellow-400",
  "94": "text-blue-400",
  "95": "text-purple-400",
  "96": "text-cyan-400",
  "97": "text-white",
};

const CARD_TONE_STYLES: Record<
  CardTone,
  {
    container: string;
    accent: string;
    badge: string;
  }
> = {
  neutral: {
    container: "border-border bg-card/70",
    accent: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  info: {
    container: "border-sky-500/30 bg-sky-500/8",
    accent: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  success: {
    container: "border-emerald-500/30 bg-emerald-500/8",
    accent: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    container: "border-amber-500/30 bg-amber-500/8",
    accent: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  danger: {
    container: "border-red-500/35 bg-red-500/8",
    accent: "text-red-700 dark:text-red-300",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
};

function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as any) as string;
}

function isRecord(value: unknown): value is ContentRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isReadTool(toolName: string): boolean {
  return /^read$/i.test(toolName) || /read[_-]?file|^view$/i.test(toolName);
}

function isBashTool(toolName: string): boolean {
  return /^bash$|^terminal$|run_command|shell/i.test(toolName);
}

function isEditTool(toolName: string): boolean {
  return /^edit$/i.test(toolName) || /multi[_-]?edit|str_replace|replace|patch|write/i.test(toolName);
}

function isWebSearchTool(toolName: string): boolean {
  return /^websearch$/i.test(toolName) || /web[_-]?search|search[_-]?web/i.test(toolName);
}

function normalizeToolResultPayload(result: ContentRecord): unknown {
  return result.content ?? result;
}

function shortenText(text: string, maxLength = 1200): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...`;
}

function toCollapsedPreview(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isLikelyBase64(value: string): boolean {
  const sample = value.trim();
  if (sample.length < 80) return false;
  return /^[A-Za-z0-9+/=\n\r]+$/.test(sample);
}

function extractTextPayload(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (!isRecord(item)) {
        const text = asString(item);
        if (text) parts.push(text);
        continue;
      }

      if (typeof item.text === "string" && item.text.trim()) {
        parts.push(item.text);
        continue;
      }
      if (typeof item.content === "string" && item.content.trim()) {
        parts.push(item.content);
        continue;
      }
      if (typeof item.thinking === "string" && item.thinking.trim()) {
        parts.push(item.thinking);
        continue;
      }
      if (item.content) {
        const nestedText = extractTextPayload(item.content);
        if (nestedText) parts.push(nestedText);
      }
    }
    return parts.join("\n\n");
  }

  if (isRecord(value)) {
    if (typeof value.text === "string" && value.text.trim()) return value.text;
    if (typeof value.content === "string" && value.content.trim()) return value.content;
    if (value.content) {
      const nested = extractTextPayload(value.content);
      if (nested) return nested;
    }

    if (isRecord(value.source)) {
      const sourceType = typeof value.source.type === "string" ? value.source.type : "";
      if (
        sourceType !== "base64" &&
        typeof value.source.data === "string" &&
        value.source.data.trim() &&
        !isLikelyBase64(value.source.data)
      ) {
        return value.source.data;
      }
      if (typeof value.source.url === "string" && value.source.url.trim()) {
        return value.source.url;
      }
    }
  }

  return "";
}

function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~)/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /!\[[^\]]*\]\([^)]+\)/.test(text) ||
    /(^|\n)\|.+\|/.test(text)
  );
}

function shouldRenderMarkdown(text: string, preferMarkdown: boolean): boolean {
  if (preferMarkdown) return true;
  return looksLikeMarkdown(text);
}

function extractTaggedBlock(text: string, tagName: string): string | null {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = text.match(regex);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function extractStreamBlocks(
  text: string,
  suffix: "stdout" | "stderr",
): Array<{ label: string; content: string }> {
  const regex = new RegExp(
    `<([A-Za-z0-9_.-]+-${suffix})>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  const blocks: Array<{ label: string; content: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const label = match[1].replace(`-${suffix}`, "").trim() || suffix;
    const content = match[2]?.trim();
    if (content) {
      blocks.push({ label, content });
    }
  }

  return blocks;
}

function stripCommandTags(text: string): string {
  return text
    .replace(/<command-message>[\s\S]*?<\/command-message>/gi, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/gi, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/gi, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, "")
    .replace(/<([A-Za-z0-9_.-]+-(?:stdout|stderr))>[\s\S]*?<\/\1>/gi, "")
    .trim();
}

function parseCommandTagPayload(text: string): CommandTagPayload | null {
  const hasCommandTag = /<(command-name|command-message|command-args|local-command-caveat)>/i.test(text);
  const hasStreamTag = /<[A-Za-z0-9_.-]+-(stdout|stderr)>/i.test(text);
  if (!hasCommandTag && !hasStreamTag) return null;

  const commandName = extractTaggedBlock(text, "command-name");
  const commandMessage = extractTaggedBlock(text, "command-message");
  const commandArgs = extractTaggedBlock(text, "command-args");
  const commandCaveat = extractTaggedBlock(text, "local-command-caveat");
  const stdoutBlocks = extractStreamBlocks(text, "stdout");
  const stderrBlocks = extractStreamBlocks(text, "stderr");
  const remainingText = stripCommandTags(text);

  if (
    !commandName &&
    !commandMessage &&
    !commandArgs &&
    !commandCaveat &&
    stdoutBlocks.length === 0 &&
    stderrBlocks.length === 0
  ) {
    return null;
  }

  return {
    commandName,
    commandMessage,
    commandArgs,
    commandCaveat,
    stdoutBlocks,
    stderrBlocks,
    remainingText,
  };
}

function pickPreferredText(content: ContentRecord): string | null {
  const candidates: unknown[] = [
    content.text,
    content.markdown,
    content.md,
    content.message,
    content.output,
    content.result,
    content.value,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function normalizeEntries(content: unknown[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = [];
  const pendingToolUseMap = new Map<string, number>();

  for (let index = 0; index < content.length; index += 1) {
    const item = content[index];
    if (!isRecord(item)) {
      entries.push({ kind: "item", key: `item-${index}`, item, index });
      continue;
    }

    if (item.type === "tool_use" && typeof item.id === "string") {
      entries.push({
        kind: "toolExecution",
        key: `tool-${index}`,
        toolUse: item,
        toolResults: [],
      });
      pendingToolUseMap.set(item.id, entries.length - 1);
      continue;
    }

    if (typeof item.tool_use_id === "string") {
      const targetIndex = pendingToolUseMap.get(item.tool_use_id);
      if (targetIndex !== undefined) {
        const target = entries[targetIndex];
        if (target?.kind === "toolExecution") {
          target.toolResults.push(item);
          continue;
        }
      }
    }

    entries.push({ kind: "item", key: `item-${index}`, item, index });
  }

  return entries;
}

function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const regex = /\x1b\[([0-9;]+)m/g;
  let lastIndex = 0;
  let currentClass = "";
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index), className: currentClass });
    }

    const codes = match[1].split(";");
    for (const code of codes) {
      if (code === "0") {
        currentClass = "";
      } else if (code === "1") {
        currentClass += " font-bold";
      } else if (ANSI_COLORS[code]) {
        currentClass = ANSI_COLORS[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex), className: currentClass });
  }

  return spans.filter((span) => span.text.length > 0);
}

function getToolExecutionStatus(results: ContentRecord[]): ToolExecutionStatus {
  if (results.length === 0) return "pending";
  if (results.some((result) => result.is_error === true)) return "error";
  return "completed";
}

function getToolTone(toolName: string, status: ToolExecutionStatus): CardTone {
  if (status === "error") return "danger";

  if (/bash|terminal/i.test(toolName)) return "info";
  if (/read|write|edit|patch|file|notebook/i.test(toolName)) return "success";
  if (/search|grep|glob|web|fetch/i.test(toolName)) return "info";
  if (/task|plan|todo/i.test(toolName)) return "warning";

  return status === "completed" ? "success" : "neutral";
}

function getToolPreview(input: ContentRecord): string | null {
  const candidates: unknown[] = [
    input.command,
    input.file_path,
    input.path,
    input.pattern,
    input.query,
    input.url,
    input.server,
    input.tool,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function getToolResultPreview(toolResult: ContentRecord): string {
  const payload = normalizeToolResultPayload(toolResult);
  if (typeof payload === "string") {
    return toCollapsedPreview(payload, 220);
  }

  const textPayload = extractTextPayload(payload);
  if (textPayload.trim()) {
    return toCollapsedPreview(textPayload, 220);
  }

  if (payload === null || payload === undefined) {
    return "";
  }

  return toCollapsedPreview(stringify(payload), 220);
}

function getToolLabel(toolName: string): string {
  if (!toolName) return translate("message_view.tool");
  if (toolName === "Bash") return translate("message_view.terminal");
  return toolName;
}

function getToolResultLabel(toolResult: ContentRecord): string {
  const candidates: unknown[] = [
    toolResult.tool_name,
    toolResult.toolName,
    toolResult.name,
    toolResult.tool,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return getToolLabel(candidate.trim());
    }
  }
  return translate("message_view.tool_result");
}

function getStatusMeta(status: ToolExecutionStatus): {
  label: string;
  icon: ReactNode;
} {
  if (status === "error") {
    return {
      label: translate("message_view.status_error"),
      icon: <AlertTriangle className="h-3 w-3" />,
    };
  }
  if (status === "completed") {
    return {
      label: translate("message_view.status_completed"),
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  return {
    label: translate("message_view.status_pending"),
    icon: <Clock3 className="h-3 w-3" />,
  };
}

function AnsiBlock({ text }: { text: string }) {
  const spans = useMemo(() => parseAnsi(text), [text]);
  return (
    <pre className="overflow-auto rounded-md border border-border bg-black px-3 py-2 text-xs text-zinc-200">
      {spans.map((span, index) => (
        <span key={`${index}-${span.text.length}`} className={span.className}>
          {span.text}
        </span>
      ))}
    </pre>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-ink">
      {stringify(value)}
    </pre>
  );
}

function CommandPayloadBlock({
  payload,
  preferMarkdown,
}: {
  payload: CommandTagPayload;
  preferMarkdown: boolean;
}) {
  const commandLine = [payload.commandName, payload.commandArgs]
    .filter((segment): segment is string => Boolean(segment && segment.trim()))
    .join(" ");

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      {commandLine ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            {translate("message_view.command")}
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-ink">
            {commandLine}
          </pre>
        </div>
      ) : null}

      {payload.commandMessage ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            {translate("message_view.message")}
          </p>
          <CollapsibleContent
            content={payload.commandMessage}
            markdown={shouldRenderMarkdown(payload.commandMessage, preferMarkdown)}
          />
        </div>
      ) : null}

      {payload.commandCaveat ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {translate("message_view.caveat")}
          </p>
          <CollapsibleContent content={payload.commandCaveat} markdown={false} />
        </div>
      ) : null}

      {payload.stdoutBlocks.length > 0 ? (
        <div className="space-y-2">
          {payload.stdoutBlocks.map((block, index) => (
            <div key={`stdout-${index}`}>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {translate("message_view.stream_stdout", { label: block.label })}
              </p>
              {renderStructuredResultContent(block.content, { preferMarkdown: false })}
            </div>
          ))}
        </div>
      ) : null}

      {payload.stderrBlocks.length > 0 ? (
        <div className="space-y-2">
          {payload.stderrBlocks.map((block, index) => (
            <div key={`stderr-${index}`}>
              <p className="mb-1 text-[11px] font-medium text-red-600 dark:text-red-300">
                {translate("message_view.stream_stderr", { label: block.label })}
              </p>
              {renderStructuredResultContent(block.content, { preferMarkdown: false })}
            </div>
          ))}
        </div>
      ) : null}

      {payload.remainingText ? (
        <CollapsibleContent
          content={payload.remainingText}
          markdown={shouldRenderMarkdown(payload.remainingText, preferMarkdown)}
        />
      ) : null}
    </div>
  );
}

function TeammateMessageBlock({
  teammateId,
  content,
  preferMarkdown,
}: {
  teammateId: string | null;
  content: string;
  preferMarkdown: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border border-amber-500/35 bg-amber-500/[0.08] p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <Users className="h-3.5 w-3.5" />
        <span>{translate("message_view.teammate_message")}</span>
        {teammateId ? (
          <code className="rounded bg-amber-500/15 px-1.5 py-0.5 normal-case tracking-normal">
            @{teammateId}
          </code>
        ) : null}
      </div>
      {content ? (
        renderStructuredResultContent(content, { preferMarkdown })
      ) : (
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          {translate("message_view.empty_teammate_message")}
        </p>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  tone,
  children,
  subtitle,
  badge,
  collapsible = false,
  defaultExpanded = true,
  collapsedPreview,
}: {
  title: string;
  icon: ReactNode;
  tone: CardTone;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  collapsedPreview?: string | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const styles = CARD_TONE_STYLES[tone];

  return (
    <section className={cn("rounded-lg border", styles.container)}>
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className={cn("flex min-w-0 items-center gap-2 text-xs font-semibold", styles.accent)}>
          {icon}
          <span className="truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {badge}
          {subtitle ? (
            <code className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", styles.badge)}>
              {subtitle}
            </code>
          ) : null}
          {collapsible ? (
            <button
              type="button"
              className={cn("ml-auto rounded p-0.5 transition-colors", styles.badge)}
              onClick={() => setExpanded((value) => !value)}
              aria-label={
                expanded
                  ? translate("message_view.collapse_card")
                  : translate("message_view.expand_card")
              }
            >
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          ) : null}
        </div>
      </header>

      {!collapsible || expanded ? (
        <div className="space-y-2 px-3 py-2 empty:hidden">{children}</div>
      ) : (
        <div className="px-3 py-2">
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {collapsedPreview?.trim() || translate("message_view.collapsed_preview_empty")}
          </p>
        </div>
      )}
    </section>
  );
}

function renderStructuredResultContent(
  content: unknown,
  options: { preferMarkdown?: boolean } = {},
): ReactNode {
  const preferMarkdown = options.preferMarkdown ?? false;

  if (typeof content === "string") {
    const teammatePayload = parseTeammateMessage(content);
    if (teammatePayload.isTeammate) {
      return (
        <TeammateMessageBlock
          teammateId={teammatePayload.teammateId}
          content={teammatePayload.content}
          preferMarkdown={preferMarkdown}
        />
      );
    }

    const commandPayload = parseCommandTagPayload(content);
    if (commandPayload) {
      return <CommandPayloadBlock payload={commandPayload} preferMarkdown={preferMarkdown} />;
    }

    const hasAnsi = /\x1b\[/.test(content);
    if (hasAnsi) {
      return <AnsiBlock text={content} />;
    }

    return (
      <CollapsibleContent
        content={content}
        markdown={shouldRenderMarkdown(content, preferMarkdown)}
      />
    );
  }

  if (Array.isArray(content)) {
    const text = extractTextPayload(content);
    if (text) {
      return (
        <CollapsibleContent
          content={text}
          markdown={shouldRenderMarkdown(text, preferMarkdown)}
        />
      );
    }
    return <JsonBlock value={content} />;
  }

  if (isRecord(content)) {
    const stdout = asString(content.stdout);
    const stderr = asString(content.stderr);
    const exitCode = content.exit_code;

    if (stdout || stderr || exitCode !== undefined) {
      return (
        <div className="space-y-2">
          {exitCode !== undefined ? (
            <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
              {translate("message_view.exit_code", { code: String(exitCode) })}
            </div>
          ) : null}
          {stdout ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {translate("message_view.stdout")}
              </p>
              {renderStructuredResultContent(stdout, { preferMarkdown: false })}
            </div>
          ) : null}
          {stderr ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-red-600 dark:text-red-300">
                {translate("message_view.stderr")}
              </p>
              {renderStructuredResultContent(stderr, { preferMarkdown: false })}
            </div>
          ) : null}
        </div>
      );
    }

    const preferredText = pickPreferredText(content);
    if (preferredText) {
      return (
        <CollapsibleContent
          content={preferredText}
          markdown={shouldRenderMarkdown(preferredText, preferMarkdown)}
        />
      );
    }

    if (content.content !== undefined) {
      const nested = renderStructuredResultContent(content.content, {
        preferMarkdown,
      });
      return (
        <div className="space-y-2">
          {nested}
          {Object.keys(content).some((key) => key !== "content") ? <JsonBlock value={content} /> : null}
        </div>
      );
    }

    return <JsonBlock value={content} />;
  }

  return <JsonBlock value={content} />;
}

function extractReadResult(result: ContentRecord): {
  filePath: string | null;
  startLine: number | null;
  numLines: number | null;
  totalLines: number | null;
  content: unknown;
  isError: boolean;
} {
  const payload = normalizeToolResultPayload(result);
  const isError = result.is_error === true;

  if (isRecord(payload) && isRecord(payload.file)) {
    const fileBlock = payload.file;
    return {
      filePath: asString(fileBlock.filePath) ?? asString(fileBlock.path),
      startLine: asNumber(fileBlock.startLine),
      numLines: asNumber(fileBlock.numLines),
      totalLines: asNumber(fileBlock.totalLines),
      content: fileBlock.content ?? payload.content ?? payload,
      isError,
    };
  }

  if (isRecord(payload)) {
    return {
      filePath: asString(payload.filePath) ?? asString(payload.path),
      startLine: asNumber(payload.startLine),
      numLines: asNumber(payload.numLines),
      totalLines: asNumber(payload.totalLines),
      content: payload.content ?? payload,
      isError,
    };
  }

  return {
    filePath: null,
    startLine: null,
    numLines: null,
    totalLines: null,
    content: payload,
    isError,
  };
}

function renderReadToolBody(input: ContentRecord, toolResults: ContentRecord[]): ReactNode {
  const filePath = asString(input.file_path) ?? asString(input.path);
  const offset = asNumber(input.offset);
  const limit = asNumber(input.limit);

  const readResults = toolResults.map(extractReadResult);

  return (
    <div className="space-y-2">
      {filePath ? (
        <div className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{translate("message_view.file")}</p>
          <code className="block truncate pt-0.5 text-xs text-ink">{filePath}</code>
        </div>
      ) : null}

      {offset !== null || limit !== null ? (
        <div className="flex flex-wrap gap-1">
          {offset !== null ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {translate("message_view.offset", { value: offset })}
            </span>
          ) : null}
          {limit !== null ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {translate("message_view.limit", { value: limit })}
            </span>
          ) : null}
        </div>
      ) : null}

      {readResults.length > 0 ? (
        <div className="space-y-2">
          {readResults.map((result, index) => (
            <details key={`read-result-${index}`} open={index === 0}>
              <summary
                className={cn(
                  "cursor-pointer text-xs",
                  result.isError ? "text-red-600 dark:text-red-300" : "text-muted-foreground",
                )}
              >
                {translate("message_view.read_result", { index: index + 1 })}
              </summary>
              <div className="mt-2 space-y-2">
                {result.filePath ? (
                  <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
                    <code className="block truncate text-xs text-ink">{result.filePath}</code>
                  </div>
                ) : null}
                {result.startLine !== null || result.numLines !== null || result.totalLines !== null ? (
                  <div className="flex flex-wrap gap-1">
                    {result.startLine !== null ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {translate("message_view.start", { value: result.startLine })}
                      </span>
                    ) : null}
                    {result.numLines !== null ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {translate("message_view.lines", { value: result.numLines })}
                      </span>
                    ) : null}
                    {result.totalLines !== null ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {translate("message_view.total", { value: result.totalLines })}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {renderStructuredResultContent(result.content, { preferMarkdown: true })}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {translate("message_view.waiting_read_result")}
        </p>
      )}
    </div>
  );
}

function extractBashResult(result: ContentRecord): {
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  interrupted: boolean;
  payload: unknown;
  isError: boolean;
} {
  const payload = normalizeToolResultPayload(result);
  const isError = result.is_error === true;

  if (isRecord(payload)) {
    return {
      stdout: asString(payload.stdout),
      stderr: asString(payload.stderr),
      exitCode: asNumber(payload.exit_code) ?? asNumber(payload.exitCode),
      interrupted: payload.interrupted === true,
      payload,
      isError,
    };
  }

  return {
    stdout: typeof payload === "string" ? payload : null,
    stderr: null,
    exitCode: null,
    interrupted: false,
    payload,
    isError,
  };
}

function renderBashToolBody(input: ContentRecord, toolResults: ContentRecord[]): ReactNode {
  const command = asString(input.command);
  const description = asString(input.description);
  const bashResults = toolResults.map(extractBashResult);

  return (
    <div className="space-y-2">
      {description ? (
        <p className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {command ? (
        <pre className="overflow-x-auto rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-ink">
          {command}
        </pre>
      ) : null}

      {bashResults.length > 0 ? (
        <div className="space-y-2">
          {bashResults.map((result, index) => {
            const hasStructuredStreams = Boolean(
              result.stdout || result.stderr || result.exitCode !== null || result.interrupted,
            );

            return (
              <details key={`bash-result-${index}`} open={index === 0}>
                <summary
                  className={cn(
                    "cursor-pointer text-xs",
                    result.isError ? "text-red-600 dark:text-red-300" : "text-muted-foreground",
                  )}
                >
                  {translate("message_view.bash_result", { index: index + 1 })}
                </summary>
                <div className="mt-2 space-y-2">
                  {result.exitCode !== null ? (
                    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                      {translate("message_view.exit_code", { code: result.exitCode })}
                    </div>
                  ) : null}
                  {result.interrupted ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                      {translate("message_view.execution_interrupted")}
                    </div>
                  ) : null}
                  {result.stdout ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                        {translate("message_view.stdout")}
                      </p>
                      {renderStructuredResultContent(result.stdout, { preferMarkdown: false })}
                    </div>
                  ) : null}
                  {result.stderr ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-red-600 dark:text-red-300">
                        {translate("message_view.stderr")}
                      </p>
                      {renderStructuredResultContent(result.stderr, { preferMarkdown: false })}
                    </div>
                  ) : null}
                  {!hasStructuredStreams ? renderStructuredResultContent(result.payload, { preferMarkdown: false }) : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {translate("message_view.waiting_bash_result")}
        </p>
      )}
    </div>
  );
}

function renderEditToolBody(input: ContentRecord, toolResults: ContentRecord[]): ReactNode {
  const filePath = asString(input.file_path) ?? asString(input.path);
  const oldString = asString(input.old_string);
  const newString = asString(input.new_string);
  const replaceAll = input.replace_all === true;
  const editResults = toolResults.map((result) => normalizeToolResultPayload(result));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {filePath ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {translate("message_view.file_with_value", { value: filePath })}
          </span>
        ) : null}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {translate("message_view.replace_all", { value: String(replaceAll) })}
        </span>
      </div>

      {oldString ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {translate("message_view.before")}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-ink">
            {shortenText(oldString)}
          </pre>
        </details>
      ) : null}

      {newString ? (
        <details open>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {translate("message_view.after")}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 font-mono text-xs text-ink">
            {shortenText(newString)}
          </pre>
        </details>
      ) : null}

      {editResults.length > 0 ? (
        <div className="space-y-2">
          {editResults.map((payload, index) => (
            <details key={`edit-result-${index}`}>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {translate("message_view.edit_result", { index: index + 1 })}
              </summary>
              <div className="mt-2 space-y-2">
                {renderStructuredResultContent(payload, { preferMarkdown: true })}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {translate("message_view.waiting_edit_result")}
        </p>
      )}
    </div>
  );
}

function extractWebSearchRows(payload: unknown): Array<{
  title: string | null;
  url: string | null;
  snippet: string | null;
}> {
  const rows: Array<{ title: string | null; url: string | null; snippet: string | null }> = [];
  const sources: unknown[] = [];

  if (Array.isArray(payload)) {
    sources.push(...payload);
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.results)) {
      sources.push(...payload.results);
    }
    if (Array.isArray(payload.content)) {
      sources.push(...payload.content);
    }
  }

  for (const item of sources) {
    if (!isRecord(item)) continue;
    const title = asString(item.title) ?? asString(item.name);
    const url = asString(item.url) ?? asString(item.link) ?? asString(item.source);
    const snippet =
      asString(item.snippet) ??
      asString(item.description) ??
      asString(item.text) ??
      extractTextPayload(item.content);

    if (!title && !url && !snippet) continue;
    rows.push({ title, url, snippet: snippet || null });
  }

  return rows;
}

function renderWebSearchToolBody(input: ContentRecord, toolResults: ContentRecord[]): ReactNode {
  const query = asString(input.query);
  const rows = toolResults.flatMap((result) =>
    extractWebSearchRows(normalizeToolResultPayload(result)),
  );

  return (
    <div className="space-y-2">
      {query ? (
        <div className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{translate("message_view.query")}</p>
          <p className="pt-0.5 text-xs text-ink">{query}</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={`web-row-${index}`} className="rounded-md border border-border bg-background px-2.5 py-2">
              <p className="text-xs font-medium text-ink">
                {row.title ?? translate("message_view.result", { index: index + 1 })}
              </p>
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-xs text-primary underline-offset-2 hover:underline"
                >
                  {row.url}
                </a>
              ) : null}
              {row.snippet ? (
                <p className="mt-1 text-xs text-muted-foreground">{shortenText(row.snippet, 500)}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : toolResults.length > 0 ? (
        <div className="space-y-2">
          {toolResults.map((result, index) => (
            <details key={`web-result-${index}`}>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {translate("message_view.search_result", { index: index + 1 })}
              </summary>
              <div className="mt-2">
                {renderStructuredResultContent(normalizeToolResultPayload(result), {
                  preferMarkdown: true,
                })}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {translate("message_view.waiting_web_search_result")}
        </p>
      )}
    </div>
  );
}

function ToolExecutionCard({
  toolUse,
  toolResults,
}: {
  toolUse: ContentRecord;
  toolResults: ContentRecord[];
}) {
  const toolName = asString(toolUse.name) ?? "";
  const toolId = asString(toolUse.id) ?? undefined;
  const input = isRecord(toolUse.input) ? toolUse.input : {};
  const [expanded, setExpanded] = useState(false);

  const status = getToolExecutionStatus(toolResults);
  const tone = getToolTone(toolName, status);
  const statusMeta = getStatusMeta(status);
  const preview = useMemo(() => getToolPreview(input), [input]);
  const collapsedPreview = useMemo(
    () =>
      toCollapsedPreview(
        [preview, toolResults[0] ? getToolResultPreview(toolResults[0]) : ""]
          .filter((segment): segment is string => Boolean(segment && segment.trim()))
          .join(" · "),
        220,
      ),
    [preview, toolResults],
  );
  const specializedBody = useMemo(() => {
    if (!expanded) return null;
    if (isReadTool(toolName)) return renderReadToolBody(input, toolResults);
    if (isBashTool(toolName)) return renderBashToolBody(input, toolResults);
    if (isEditTool(toolName)) return renderEditToolBody(input, toolResults);
    if (isWebSearchTool(toolName)) return renderWebSearchToolBody(input, toolResults);
    return null;
  }, [expanded, input, toolName, toolResults]);

  return (
    <Card
      title={getToolLabel(toolName)}
      tone={tone}
      icon={<Hammer className="h-3.5 w-3.5" />}
      badge={
        <div className="flex items-center gap-1">
          {expanded ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                CARD_TONE_STYLES[tone].badge,
              )}
            >
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          ) : null}
          {expanded && toolId ? (
            <code
              className={cn(
                "max-w-[18ch] truncate rounded px-1.5 py-0.5 font-mono text-[11px]",
                CARD_TONE_STYLES[tone].badge,
              )}
            >
              {toolId}
            </code>
          ) : null}
          <button
            type="button"
            className={cn("ml-auto rounded p-0.5 transition-colors", CARD_TONE_STYLES[tone].badge)}
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? translate("message_view.collapse_tool_card") : translate("message_view.expand_tool_card")}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        </div>
      }
    >
      {expanded ? (
        specializedBody ? (
          <>
            {specializedBody}
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {translate("message_view.input_raw_json")}
              </summary>
              <div className="mt-2">
                <JsonBlock value={input} />
              </div>
            </details>
          </>
        ) : (
          <>
            {preview ? (
              <pre className="overflow-x-auto rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-ink">
                {preview}
              </pre>
            ) : null}

            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {translate("message_view.input")}
              </summary>
              <div className="mt-2">
                <JsonBlock value={input} />
              </div>
            </details>

            {toolResults.length > 0 ? (
              <div className="space-y-2">
                {toolResults.map((result, index) => {
                  const content = result.content ?? result;
                  const isError = result.is_error === true;
                  return (
                    <details key={`${toolId ?? toolName}-result-${index}`}>
                      <summary className={cn("cursor-pointer text-xs", isError ? "text-red-600 dark:text-red-300" : "text-muted-foreground")}>
                        {translate("message_view.tool_result_entry", { index: index + 1 })}
                        {isError ? translate("message_view.tool_result_error_suffix") : ""}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {renderStructuredResultContent(content, { preferMarkdown: true })}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {translate("message_view.waiting_tool_result")}
              </p>
            )}
          </>
        )
      ) : (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {collapsedPreview || translate("message_view.collapsed_preview_empty")}
        </p>
      )}
    </Card>
  );
}

function SingleToolResultCard({ toolResult }: { toolResult: ContentRecord }) {
  const toolUseId = asString(toolResult.tool_use_id) ?? undefined;
  const isError = toolResult.is_error === true;
  const tone: CardTone = isError ? "danger" : "success";
  const [expanded, setExpanded] = useState(false);
  const collapsedPreview = getToolResultPreview(toolResult);

  return (
    <Card
      title={getToolResultLabel(toolResult)}
      tone={tone}
      icon={isError ? <AlertTriangle className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
      badge={
        <div className="flex items-center gap-1">
          {expanded && toolUseId ? (
            <code
              className={cn(
                "max-w-[18ch] truncate rounded px-1.5 py-0.5 font-mono text-[11px]",
                CARD_TONE_STYLES[tone].badge,
              )}
            >
              {toolUseId}
            </code>
          ) : null}
          <button
            type="button"
            className={cn("ml-auto rounded p-0.5 transition-colors", CARD_TONE_STYLES[tone].badge)}
            onClick={() => setExpanded((value) => !value)}
            aria-label={
              expanded
                ? translate("message_view.collapse_tool_result_card")
                : translate("message_view.expand_tool_result_card")
            }
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        </div>
      }
    >
      {expanded ? (
        renderStructuredResultContent(toolResult.content ?? toolResult, {
          preferMarkdown: true,
        })
      ) : (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {collapsedPreview || translate("message_view.collapsed_preview_empty")}
        </p>
      )}
    </Card>
  );
}

function renderContentItem({
  item,
  key,
  markdown,
  preferMarkdown,
}: {
  item: ContentRecord;
  key: string;
  markdown: boolean;
  preferMarkdown: boolean;
}) {
  const itemType = asString(item.type) ?? "unknown";

  if (itemType === "text") {
    const text = asString(item.text);
    if (!text) return null;
    const preferMarkdownForText = markdown || preferMarkdown;
    return (
      <div key={key} className="rounded-lg border border-border bg-card px-3 py-2">
        {renderStructuredResultContent(text, {
          preferMarkdown: preferMarkdownForText,
        })}
      </div>
    );
  }

  if (itemType === "thinking") {
    const thinking = asString(item.thinking);
    if (!thinking) return null;
    return (
      <Card
        key={key}
        title={translate("message_view.thinking")}
        icon={<Brain className="h-3.5 w-3.5" />}
        tone="warning"
        collapsible
        defaultExpanded={false}
        collapsedPreview={toCollapsedPreview(thinking)}
      >
        <CollapsibleContent content={thinking} markdown={false} />
      </Card>
    );
  }

  if (itemType === "redacted_thinking") {
    return (
      <Card
        key={key}
        title={translate("message_view.redacted_thinking")}
        icon={<Brain className="h-3.5 w-3.5" />}
        tone="warning"
        collapsible
        defaultExpanded={false}
        collapsedPreview={toCollapsedPreview(translate("message_view.redacted_thinking_desc"))}
      >
        <p className="text-xs text-muted-foreground">{translate("message_view.redacted_thinking_desc")}</p>
      </Card>
    );
  }

  if (itemType === "tool_use") {
    return <ToolExecutionCard key={key} toolUse={item} toolResults={[]} />;
  }

  if (itemType === "tool_result") {
    return <SingleToolResultCard key={key} toolResult={item} />;
  }

  if (itemType === "image") {
    let imageUrl: string | null = null;
    if (isRecord(item.source)) {
      const sourceType = asString(item.source.type);
      if (sourceType === "url") {
        imageUrl = asString(item.source.url);
      } else if (sourceType === "base64") {
        const mediaType = asString(item.source.media_type) ?? "image/png";
        const data = asString(item.source.data);
        if (data) imageUrl = `data:${mediaType};base64,${data}`;
      }
    }

    if (!imageUrl) return null;

    return (
      <Card
        key={key}
        title={translate("message_view.image")}
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        tone="info"
        collapsible
        collapsedPreview={toCollapsedPreview(translate("message_view.image"))}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          src={imageUrl}
          className="max-h-[420px] max-w-full rounded-md border border-border object-contain"
        />
      </Card>
    );
  }

  if (itemType === "document") {
    const title = asString(item.title) ?? translate("message_view.document");
    const context = asString(item.context);
    const source = isRecord(item.source) ? item.source : null;
    const sourceType = source ? asString(source.type) : null;
    const sourceData = source ? asString(source.data) : null;
    const sourceUrl = source ? asString(source.url) : null;

    return (
      <Card
        key={key}
        title={title}
        icon={<FileText className="h-3.5 w-3.5" />}
        tone="info"
        subtitle={sourceType ?? undefined}
        collapsible
        collapsedPreview={toCollapsedPreview(context ?? sourceUrl ?? sourceData ?? title)}
      >
        {context ? (
          <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            {context}
          </p>
        ) : null}

        {sourceType === "text" && sourceData ? (
          <CollapsibleContent content={sourceData} markdown />
        ) : sourceType === "url" && sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {sourceUrl}
          </a>
        ) : sourceType === "base64" ? (
          <p className="text-xs text-muted-foreground">
            {translate("message_view.binary_document_payload", {
              mediaType: asString(source?.media_type) ?? translate("message_view.unknown_media_type"),
            })}
          </p>
        ) : (
          <JsonBlock value={item} />
        )}
      </Card>
    );
  }

  if (itemType === "search_result") {
    const title = asString(item.title) ?? translate("message_view.search_result_title");
    const source = asString(item.source);
    const contentText = extractTextPayload(item.content);
    return (
      <Card
        key={key}
        title={title}
        icon={<Search className="h-3.5 w-3.5" />}
        tone="info"
        subtitle={source ?? undefined}
        collapsible
        collapsedPreview={toCollapsedPreview(contentText || source || title)}
      >
        {contentText ? (
          <CollapsibleContent
            content={contentText}
            markdown={shouldRenderMarkdown(contentText, true)}
          />
        ) : (
          <JsonBlock value={item} />
        )}
      </Card>
    );
  }

  if (itemType === "command") {
    const commandText = asString(item.content) ?? extractTextPayload(item.content);
    return (
      <Card
        key={key}
        title={translate("message_view.command")}
        icon={<Terminal className="h-3.5 w-3.5" />}
        tone="neutral"
        collapsible
        collapsedPreview={toCollapsedPreview(commandText ?? "")}
      >
        {commandText ? (
          <CollapsibleContent content={commandText} markdown={false} />
        ) : (
          <JsonBlock value={item} />
        )}
      </Card>
    );
  }

  return (
    <Card
      key={key}
      title={translate("message_view.content_type", { type: itemType })}
      icon={<AlertTriangle className="h-3.5 w-3.5" />}
      tone="warning"
      collapsible
      collapsedPreview={toCollapsedPreview(stringify(item))}
    >
      <JsonBlock value={item} />
    </Card>
  );
}

function MessageContentRendererInner({
  message,
  markdown,
}: MessageContentRendererProps) {
  const raw = message.raw_content;

  if (Array.isArray(raw)) {
    const entries = normalizeEntries(raw);
    return (
      <div className="space-y-2">
        {entries.map((entry) => {
          if (entry.kind === "toolExecution") {
            return (
              <ToolExecutionCard
                key={entry.key}
                toolUse={entry.toolUse}
                toolResults={entry.toolResults}
              />
            );
          }

          const { item, key, index } = entry;
          if (!isRecord(item)) {
            return (
              <div
                key={`${key}-${index}`}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                {String(item)}
              </div>
            );
          }

          return renderContentItem({
            item,
            key,
            markdown,
            preferMarkdown: message.role === "assistant",
          });
        })}
      </div>
    );
  }

  const content = message.content;
  if (!content) return null;
  return renderStructuredResultContent(content, {
    preferMarkdown: markdown || message.role === "assistant",
  });
}

function areMessageContentRendererPropsEqual(
  prev: MessageContentRendererProps,
  next: MessageContentRendererProps,
): boolean {
  return prev.message === next.message &&
    prev.markdown === next.markdown;
}

export const MessageContentRenderer = memo(
  MessageContentRendererInner,
  areMessageContentRendererPropsEqual,
);

MessageContentRenderer.displayName = "MessageContentRenderer";
