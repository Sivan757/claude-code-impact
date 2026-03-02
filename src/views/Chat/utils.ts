import i18n from "../../i18n";

export interface TeammateMessageMeta {
  isTeammate: boolean;
  teammateId: string | null;
  content: string;
}

const TEAMMATE_OPEN_TAG_RE = /<teammate-message\b([^>]*)>/i;
const TEAMMATE_OPEN_TAG_GLOBAL_RE = /<teammate-message\b[^>]*>/gi;
const TEAMMATE_CLOSE_TAG_GLOBAL_RE = /<\/teammate-message>/gi;

function parseTeammateId(attributeChunk: string): string | null {
  const match = attributeChunk.match(
    /\bteammate_id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const candidate = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseTeammateMessage(text: string | null | undefined): TeammateMessageMeta {
  const raw = text ?? "";
  const openTagMatch = raw.match(TEAMMATE_OPEN_TAG_RE);
  if (!openTagMatch) {
    return {
      isTeammate: false,
      teammateId: null,
      content: raw,
    };
  }

  const teammateId = parseTeammateId(openTagMatch[1] ?? "");
  const content = raw
    .replace(TEAMMATE_OPEN_TAG_GLOBAL_RE, "")
    .replace(TEAMMATE_CLOSE_TAG_GLOBAL_RE, "")
    .trim();

  return {
    isTeammate: true,
    teammateId,
    content,
  };
}

export function stripTeammateMessageTags(text: string | null | undefined): string {
  return parseTeammateMessage(text).content;
}

export function restoreSlashCommand(content: string): string {
  // Use [\s\S]*? to match any chars including newlines between tags
  const pattern = /<command-message>[\s\S]*?<\/command-message>[\s\S]*?<command-name>(\/[^\n<]+)<\/command-name>(?:[\s\S]*?<command-args>([\s\S]*?)<\/command-args>)?/g;
  return content.replace(pattern, (_match, cmd, args) => {
    const trimmedArgs = (args || "").trim();
    return trimmedArgs ? `${cmd} ${trimmedArgs}` : cmd;
  });
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return i18n.t("common.relative_time.just_now", { defaultValue: "just now" });
  if (diff < 3600) {
    return i18n.t("common.relative_time.minutes_ago", {
      count: Math.floor(diff / 60),
      defaultValue: "{{count}}m ago",
    });
  }
  if (diff < 86400) {
    return i18n.t("common.relative_time.hours_ago", {
      count: Math.floor(diff / 3600),
      defaultValue: "{{count}}h ago",
    });
  }
  if (diff < 604800) {
    return i18n.t("common.relative_time.days_ago", {
      count: Math.floor(diff / 86400),
      defaultValue: "{{count}}d ago",
    });
  }
  return new Date(ts * 1000).toLocaleDateString();
}

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

/** Hook that returns a function to convert text based on global readable setting */
export function useReadableText(): (text: string | null | undefined) => string {
  return (text) => {
    if (!text) return "";
    return restoreSlashCommand(text);
  };
}
