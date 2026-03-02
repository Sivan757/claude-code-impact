import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Copy, Download } from "lucide-react";
import { ExternalLinkIcon, ChatBubbleIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useRevealLabel } from "@/hooks";

export interface SessionMenuConfig {
  projectId: string;
  sessionId: string;
  onExport?: () => void;
  onResume?: () => void;
  onCopySessionId?: () => void;
}

// Shared handlers
export function useSessionMenuHandlers(projectId: string, sessionId: string) {
  const handleReveal = () => invoke("reveal_session_file", { projectId, sessionId });
  const handleOpenInEditor = () => invoke("open_session_in_editor", { projectId, sessionId });
  const handleCopyPath = async () => {
    const path = await invoke<string>("get_session_file_path", { projectId, sessionId });
    await invoke("copy_to_clipboard", { text: path });
  };
  const handleCopySessionId = () => invoke("copy_to_clipboard", { text: sessionId });

  return { handleReveal, handleOpenInEditor, handleCopyPath, handleCopySessionId };
}

// DropdownMenu items
export function SessionDropdownMenuItems({
  projectId,
  sessionId,
  onExport,
  onResume,
}: SessionMenuConfig) {
  const { t } = useTranslation();
  const { handleReveal, handleOpenInEditor, handleCopyPath, handleCopySessionId } =
    useSessionMenuHandlers(projectId, sessionId);
  const revealLabel = useRevealLabel();

  return (
    <>
      {onResume && (
        <>
          <DropdownMenuItem onClick={handleCopySessionId} className="gap-2">
            <Copy size={14} />
            {t("session_menu.copy_session_id")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResume} className="gap-2">
            <ChatBubbleIcon className="w-3.5 h-3.5" />
            {t("session_menu.resume_session")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={handleReveal} className="gap-2">
        <FolderOpen size={14} />
        {revealLabel}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleOpenInEditor} className="gap-2">
        <ExternalLinkIcon width={14} />
        {t("common.open_in_editor")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleCopyPath} className="gap-2">
        <Copy size={14} />
        {t("common.copy_path")}
      </DropdownMenuItem>
      {onExport && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport} className="gap-2">
            <Download size={14} />
            {t("common.export")}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

// ContextMenu items
export function SessionContextMenuItems({
  projectId,
  sessionId,
  onExport,
  onResume,
}: SessionMenuConfig) {
  const { t } = useTranslation();
  const { handleReveal, handleOpenInEditor, handleCopyPath, handleCopySessionId } =
    useSessionMenuHandlers(projectId, sessionId);
  const revealLabel = useRevealLabel();

  return (
    <>
      {onResume && (
        <>
          <ContextMenuItem onClick={handleCopySessionId} className="gap-2">
            <Copy size={14} />
            {t("session_menu.copy_session_id")}
          </ContextMenuItem>
          <ContextMenuItem onClick={onResume} className="gap-2">
            <ChatBubbleIcon className="w-3.5 h-3.5" />
            {t("session_menu.resume_session")}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem onClick={handleReveal} className="gap-2">
        <FolderOpen size={14} />
        {revealLabel}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleOpenInEditor} className="gap-2">
        <ExternalLinkIcon width={14} />
        {t("common.open_in_editor")}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyPath} className="gap-2">
        <Copy size={14} />
        {t("common.copy_path")}
      </ContextMenuItem>
      {onExport && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onExport} className="gap-2">
            <Download size={14} />
            {t("common.export")}
          </ContextMenuItem>
        </>
      )}
    </>
  );
}
