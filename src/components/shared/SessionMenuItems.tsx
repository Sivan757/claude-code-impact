import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Copy, Download, Trash2 } from "lucide-react";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, ChatBubbleIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";
import { useRevealLabel } from "@/hooks";
import type { Session } from "@/types";

export interface SessionMenuConfig {
  projectId: string;
  sessionId: string;
  onExport?: () => void;
  onResume?: () => void;
  onCopySessionId?: () => void;
  mergeMessagesChecked?: boolean;
  onMergeMessagesCheckedChange?: (checked: boolean) => void;
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
  mergeMessagesChecked,
  onMergeMessagesCheckedChange,
}: SessionMenuConfig) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const confirmDialog = useConfirmDialog();
  const { handleReveal, handleOpenInEditor, handleCopyPath, handleCopySessionId } =
    useSessionMenuHandlers(projectId, sessionId);
  const revealLabel = useRevealLabel();
  const compactItemClassName = "h-7 min-h-7 gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium";
  const compactCheckboxClassName =
    "h-7 min-h-7 rounded-lg py-1 pl-6 pr-1.5 text-[11px] font-medium";
  const handleDeleteSession = async () => {
    const confirmed = await confirmDialog({
      title: t("session_menu.delete_session", "Delete Session"),
      description: t("session_menu.confirm_delete_session", "Delete this session?"),
      confirmText: t("common.confirm", "Confirm"),
      cancelText: t("common.cancel", "Cancel"),
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await invoke("delete_session", { projectId, sessionId });
      queryClient.setQueryData<Session[]>(["sessions", projectId], (current = []) =>
        current.filter((session) => session.id !== sessionId),
      );
      queryClient.setQueryData<InfiniteData<Session[]>>(
        ["projectSessionsPaged", projectId],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => page.filter((session) => session.id !== sessionId)),
          };
        },
      );
      queryClient.removeQueries({ queryKey: ["sessionMessagesSnapshot", projectId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projectSessionsPaged", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      const targetPath = `/chat/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`;
      if (location.pathname === targetPath) {
        navigate(`/chat/${encodeURIComponent(projectId)}`, { replace: true });
      }
    } catch (error) {
      window.alert(
        t("common.failed_with", { error: String(error) }),
      );
    }
  };

  return (
    <>
      {onResume && (
        <>
          <DropdownMenuItem onClick={handleCopySessionId} className={compactItemClassName}>
            <Copy size={12} />
            {t("session_menu.copy_session_id")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResume} className={compactItemClassName}>
            <ChatBubbleIcon className="h-3 w-3" />
            {t("session_menu.resume_session")}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="-mx-[3px] my-[3px]" />
        </>
      )}
      {typeof mergeMessagesChecked === "boolean" && onMergeMessagesCheckedChange && (
        <>
          <DropdownMenuCheckboxItem
            checked={mergeMessagesChecked}
            onCheckedChange={(checked) => onMergeMessagesCheckedChange(checked === true)}
            className={compactCheckboxClassName}
          >
            {t("session_menu.merge_messages", "Merged View")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className="-mx-[3px] my-[3px]" />
        </>
      )}
      <DropdownMenuItem onClick={handleReveal} className={compactItemClassName}>
        <FolderOpen size={12} />
        {revealLabel}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleOpenInEditor} className={compactItemClassName}>
        <ExternalLinkIcon width={12} />
        {t("common.open_in_editor")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleCopyPath} className={compactItemClassName}>
        <Copy size={12} />
        {t("common.copy_path")}
      </DropdownMenuItem>
      {onExport && (
        <>
          <DropdownMenuSeparator className="-mx-[3px] my-[3px]" />
          <DropdownMenuItem onClick={onExport} className={compactItemClassName}>
            <Download size={12} />
            {t("common.export")}
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuSeparator className="-mx-[3px] my-[3px]" />
      <DropdownMenuItem
        onClick={() => {
          void handleDeleteSession();
        }}
        className={`${compactItemClassName} text-destructive focus:bg-destructive/10 focus:text-destructive`}
      >
        <Trash2 size={12} />
        {t("session_menu.delete_session", "Delete session")}
      </DropdownMenuItem>
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const confirmDialog = useConfirmDialog();
  const { handleReveal, handleOpenInEditor, handleCopyPath, handleCopySessionId } =
    useSessionMenuHandlers(projectId, sessionId);
  const revealLabel = useRevealLabel();
  const compactItemClassName = "h-7 min-h-7 gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium";
  const handleDeleteSession = async () => {
    const confirmed = await confirmDialog({
      title: t("session_menu.delete_session", "Delete Session"),
      description: t("session_menu.confirm_delete_session", "Delete this session?"),
      confirmText: t("common.confirm", "Confirm"),
      cancelText: t("common.cancel", "Cancel"),
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await invoke("delete_session", { projectId, sessionId });
      queryClient.setQueryData<Session[]>(["sessions", projectId], (current = []) =>
        current.filter((session) => session.id !== sessionId),
      );
      queryClient.setQueryData<InfiniteData<Session[]>>(
        ["projectSessionsPaged", projectId],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => page.filter((session) => session.id !== sessionId)),
          };
        },
      );
      queryClient.removeQueries({ queryKey: ["sessionMessagesSnapshot", projectId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projectSessionsPaged", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      const targetPath = `/chat/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`;
      if (location.pathname === targetPath) {
        navigate(`/chat/${encodeURIComponent(projectId)}`, { replace: true });
      }
    } catch (error) {
      window.alert(
        t("common.failed_with", { error: String(error) }),
      );
    }
  };

  return (
    <>
      {onResume && (
        <>
          <ContextMenuItem onClick={handleCopySessionId} className={compactItemClassName}>
            <Copy size={12} />
            {t("session_menu.copy_session_id")}
          </ContextMenuItem>
          <ContextMenuItem onClick={onResume} className={compactItemClassName}>
            <ChatBubbleIcon className="h-3 w-3" />
            {t("session_menu.resume_session")}
          </ContextMenuItem>
          <ContextMenuSeparator className="-mx-[3px] my-[3px]" />
        </>
      )}
      <ContextMenuItem onClick={handleReveal} className={compactItemClassName}>
        <FolderOpen size={12} />
        {revealLabel}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleOpenInEditor} className={compactItemClassName}>
        <ExternalLinkIcon width={12} />
        {t("common.open_in_editor")}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyPath} className={compactItemClassName}>
        <Copy size={12} />
        {t("common.copy_path")}
      </ContextMenuItem>
      {onExport && (
        <>
          <ContextMenuSeparator className="-mx-[3px] my-[3px]" />
          <ContextMenuItem onClick={onExport} className={compactItemClassName}>
            <Download size={12} />
            {t("common.export")}
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator className="-mx-[3px] my-[3px]" />
      <ContextMenuItem
        onClick={() => {
          void handleDeleteSession();
        }}
        className={`${compactItemClassName} text-destructive focus:bg-destructive/10 focus:text-destructive`}
      >
        <Trash2 size={12} />
        {t("session_menu.delete_session", "Delete session")}
      </ContextMenuItem>
    </>
  );
}
