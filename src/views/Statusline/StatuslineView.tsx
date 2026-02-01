import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { RowsIcon, Pencil1Icon, CheckIcon, Cross1Icon, TrashIcon, ChevronDownIcon, ResetIcon } from "@radix-ui/react-icons";
import { ConfigPage, PageHeader, EmptyState, LoadingState } from "../../components/config";
import { CollapsibleCard, CodePreview } from "../../components/shared";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../../components/ui/collapsible";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import type { ClaudeSettings } from "../../types";

const JSON_REFERENCE = `{
  "hook_event_name": "Status",
  "session_id": "abc123...",
  "cwd": "/current/working/directory",
  "model": {
    "id": "claude-opus-4-1",
    "display_name": "Opus"
  },

  "version": "1.0.80",
  "cost": {
    "total_cost_usd": 0.01234,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15234,
    "context_window_size": 200000,
    "current_usage": { ... }
  }
}`;

interface StatusLineConfig {
  type: "command";
  command: string;
  padding?: number;
}

export function StatuslineView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsKey = ["settings", "default"];
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(settingsKey, "get_settings");
  const [editing, setEditing] = useState(false);
  const [command, setCommand] = useState("");
  const [padding, setPadding] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const statusLine = settings?.raw && typeof settings.raw === "object"
    ? (settings.raw as Record<string, unknown>).statusLine as StatusLineConfig | undefined
    : undefined;

  const [scriptContent, setScriptContent] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  // Check if previous backup exists
  useEffect(() => {
    invoke<boolean>("has_previous_statusline").then(setHasPrevious).catch(() => setHasPrevious(false));
  }, []);

  useEffect(() => {
    if (statusLine) {
      setCommand(statusLine.command || "");
      setPadding(statusLine.padding);
      // Load script content - expand ~ to home dir
      setLoadingScript(true);
      (async () => {
        try {
          const scriptPath = await invoke<string>("resolve_user_path", { path: statusLine.command });
          const content = await invoke<string>("read_file", { path: scriptPath });
          setScriptContent(content);
        } catch {
          setScriptContent(null);
        } finally {
          setLoadingScript(false);
        }
      })();
    }
  }, [statusLine]);

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: settingsKey });
  };

  const handleSave = async () => {
    if (!command.trim()) return;
    setSaving(true);
    try {
      const newStatusLine: StatusLineConfig = {
        type: "command",
        command: command.trim(),
      };
      if (padding !== undefined && padding >= 0) {
        newStatusLine.padding = padding;
      }
      await invoke("update_settings_statusline", { statusline: newStatusLine });
      refreshSettings();
      setEditing(false);
    } catch (e) {
      console.error("Failed to save statusline:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await invoke("remove_settings_statusline");
      refreshSettings();
      setCommand("");
      setPadding(undefined);
      setScriptContent(null);
    } catch (e) {
      console.error("Failed to remove statusline:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    setSaving(true);
    try {
      await invoke("restore_previous_statusline");
      refreshSettings();
      setHasPrevious(false);
      // Reload script content
      const scriptPath = await invoke<string>("resolve_user_path", { path: "~/.claude/statusline.sh" });
      const content = await invoke<string>("read_file", { path: scriptPath });
      setScriptContent(content);
    } catch (e) {
      console.error("Failed to restore statusline:", e);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState message={t('statusline_view.loading')} />;

  return (
    <ConfigPage>
      <PageHeader
        title={t('statusline_view.title')}
        subtitle={t('statusline_view.subtitle')}
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-y-auto">
        <CollapsibleCard
          storageKey="claudecodeimpact:statusline:configOpen"
          title={t('statusline_view.current_config')}
          subtitle={statusLine ? `${t('statusline_view.command')}: ${statusLine.command}` : t('statusline_view.not_configured')}
          bodyClassName="p-4 space-y-4"
          defaultOpen
        >
          {statusLine && !editing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">{t('statusline_view.command')}</span>
                <code className="text-xs px-2 py-1 rounded bg-muted text-ink font-mono flex-1">
                  {statusLine.command}
                </code>
              </div>
              {statusLine.padding !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">{t('statusline_view.padding')}</span>
                  <span className="text-xs text-ink">{statusLine.padding}</span>
                </div>
              )}
              {scriptContent !== null && (
                <Collapsible defaultOpen>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors">
                      <span className="text-xs font-medium text-ink">{t('statusline_view.script_content')}</span>
                      <ChevronDownIcon className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CodePreview value={scriptContent} language="shell" height={300} />
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
              {loadingScript && (
                <p className="text-xs text-muted-foreground">{t('statusline_view.loading_script')}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil1Icon className="w-4 h-4 mr-1" />
                  {t('statusline_view.edit')}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={handleRemove} disabled={saving}>
                  <TrashIcon className="w-4 h-4 mr-1" />
                  {t('statusline_view.remove')}
                </Button>
                {hasPrevious && (
                  <Button size="sm" variant="outline" onClick={handleRestore} disabled={saving}>
                    <ResetIcon className="w-4 h-4 mr-1" />
                    {t('statusline_view.restore_previous')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink">{t('statusline_view.command')}</label>
                <input
                  className="w-full text-xs px-3 py-2 rounded-lg bg-canvas border border-border text-ink font-mono"
                  placeholder="~/.claude/statusline.sh"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  {t('statusline_view.command_hint')}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink">{t('statusline_view.padding')}</label>
                <input
                  type="number"
                  min={0}
                  className="w-24 text-xs px-3 py-2 rounded-lg bg-canvas border border-border text-ink"
                  placeholder="0"
                  value={padding ?? ""}
                  onChange={(e) => setPadding(e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <p className="text-[10px] text-muted-foreground">
                  {t('statusline_view.padding_hint')}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={!command.trim() || saving}>
                  <CheckIcon className="w-4 h-4 mr-1" />
                  {t('common.save')}
                </Button>
                {statusLine && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditing(false);
                    setCommand(statusLine.command || "");
                    setPadding(statusLine.padding);
                  }}>
                    <Cross1Icon className="w-4 h-4 mr-1" />
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          storageKey="claudecodeimpact:statusline:helpOpen"
          title={t('statusline_view.json_reference')}
          subtitle={t('statusline_view.json_reference_subtitle')}
          bodyClassName="p-4"
        >
          <CodePreview value={JSON_REFERENCE} language="json" height={280} />
          <p className="text-[10px] text-muted-foreground mt-2">
            {t('statusline_view.parse_hint')}
          </p>
        </CollapsibleCard>

        {!statusLine && !editing && (
          <div className="text-center py-8">
            <EmptyState
              icon={RowsIcon}
              message={t('statusline_view.no_statusline')}
            />

          </div>
        )}
      </div>
    </ConfigPage>
  );
}
