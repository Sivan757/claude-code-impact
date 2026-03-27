export const SORT_KEYS = ["recent", "sessions", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const CHAT_VIEW_MODES = ["projects", "sessions", "chats"] as const;
export type ChatViewMode = (typeof CHAT_VIEW_MODES)[number];

export const EXPORT_FORMATS = ["markdown", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const MARKDOWN_STYLES = ["full", "bullet", "qa"] as const;
export type MarkdownStyle = (typeof MARKDOWN_STYLES)[number];
