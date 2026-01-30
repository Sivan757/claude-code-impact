import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import {
  GearIcon,
  DotsHorizontalIcon,
  ExternalLinkIcon,
  CopyIcon,
  CodeIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  LoadingState,
  EmptyState,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import type { ClaudeSettings } from "../../types";

type PermissionMode = "bypassPermissions" | "allowEdits" | "normal";
type ModelType = "opus" | "sonnet" | "haiku";
type AttributionMode = "none" | "footer" | "coauthor";

const DEFAULT_ATTRIBUTION_FOOTER =
  "Generated with [Claude Code](https://claude.com/claude-code)";
const DEFAULT_ATTRIBUTION_COAUTHOR = `${DEFAULT_ATTRIBUTION_FOOTER}\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;


export function SettingsView(props: { embedded?: boolean; settingsPath?: string }) {
  const { embedded = false, settingsPath } = props;
  const { t } = useTranslation();
  /* Restore missing state/queries */
  const settingsKey = ["settings", settingsPath ?? "default"];
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(
    settingsKey,
    "get_settings",
    settingsPath ? { path: settingsPath } : undefined
  );
  const { data: defaultSettingsPath = "" } = useInvokeQuery<string>(["settingsPath"], "get_settings_path");
  const effectiveSettingsPath = settingsPath ?? defaultSettingsPath ?? "";

  const [showRawJson, setShowRawJson] = useState(false);
  const queryClient = useQueryClient();
  const didNormalizeAttribution = useRef(false);

  const PERMISSION_MODES: { value: PermissionMode; label: string; desc: string }[] = useMemo(() => [
    { value: "bypassPermissions", label: t('settings.bypass'), desc: t('settings.bypass_desc') },
    { value: "allowEdits", label: t('settings.allow_edits'), desc: t('settings.allow_edits_desc') },
    { value: "normal", label: t('settings.normal'), desc: t('settings.normal_desc') },
  ], [t]);

  const ATTRIBUTION_OPTIONS: { value: AttributionMode; label: string; desc: string }[] = useMemo(() => [
    { value: "coauthor", label: t('settings.co_author'), desc: t('settings.co_author_desc') },
    { value: "footer", label: t('settings.footer'), desc: t('settings.footer_desc') },
    { value: "none", label: t('settings.none'), desc: t('settings.none_desc') },
  ], [t]);

  const CLEANUP_OPTIONS = useMemo(() => [
    { value: 0, label: t('settings.never') },
    { value: 7, label: t('settings.days', { count: 7 }) },
    { value: 14, label: t('settings.days', { count: 14 }) },
    { value: 30, label: t('settings.days', { count: 30 }) },
    { value: 90, label: t('settings.days', { count: 90 }) },
  ], [t]);

  const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
    { value: "opus", label: "Opus" },
    { value: "sonnet", label: "Sonnet" },
    { value: "haiku", label: "Haiku" },
  ];



  const raw = (settings?.raw as Record<string, unknown>) || {};
  const model = (raw.model as ModelType) || "sonnet";
  const alwaysThinkingEnabled = raw.alwaysThinkingEnabled === true;
  const spinnerTipsEnabled = raw.spinnerTipsEnabled !== false; // default true
  const cleanupPeriodDays = (raw.cleanupPeriodDays as number) ?? 0;
  const resolveAttributionMode = (value: unknown): AttributionMode => {
    if (typeof value === "string") {
      if (value === "none" || value === "footer" || value === "coauthor") {
        return value;
      }
      return "coauthor";
    }
    if (value && typeof value === "object") {
      const commit = (value as Record<string, unknown>).commit;
      const pr = (value as Record<string, unknown>).pr;
      const commitText = typeof commit === "string" ? commit : "";
      const prText = typeof pr === "string" ? pr : "";
      if (commitText === "" && prText === "") {
        return "none";
      }
      if (commitText.includes("Co-Authored-By")) {
        return "coauthor";
      }
      return "footer";
    }
    return "coauthor";
  };
  const attribution = resolveAttributionMode(raw.attribution);
  const permissions = (raw.permissions as Record<string, unknown>) || {};
  const defaultMode = (permissions.defaultMode as PermissionMode) || "normal";
  const additionalDirectories = (permissions.additionalDirectories as string[]) || [];

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: settingsKey });
  };

  const updateField = async (field: string, value: unknown) => {
    await invoke("update_settings_field", {
      field,
      value,
      path: settingsPath || undefined,
    });
    refreshSettings();
  };

  const getAttributionPr = () => {
    if (raw.attribution && typeof raw.attribution === "object") {
      const pr = (raw.attribution as Record<string, unknown>).pr;
      if (typeof pr === "string" && pr.trim() !== "") {
        return pr;
      }
    }
    return DEFAULT_ATTRIBUTION_FOOTER;
  };

  const updateAttribution = async (mode: AttributionMode) => {
    if (mode === "none") {
      await updateField("attribution", { commit: "", pr: "" });
      return;
    }

    const pr = getAttributionPr();
    if (mode === "footer") {
      await updateField("attribution", { commit: DEFAULT_ATTRIBUTION_FOOTER, pr });
      return;
    }

    await updateField("attribution", { commit: DEFAULT_ATTRIBUTION_COAUTHOR, pr });
  };

  useEffect(() => {
    if (didNormalizeAttribution.current) return;
    if (typeof raw.attribution === "string") {
      const mode = resolveAttributionMode(raw.attribution);
      didNormalizeAttribution.current = true;
      updateAttribution(mode).catch(() => { });
    }
  }, [raw.attribution]);

  if (isLoading) return <LoadingState message={t('settings.loading')} />;

  const updatePermissionField = async (field: string, value: unknown) => {
    await invoke("update_settings_permission_field", {
      field,
      value,
      path: settingsPath || undefined,
    });
    refreshSettings();
  };

  const addDirectory = async (path: string) => {
    await invoke("add_permission_directory", {
      path,
      settings_path: settingsPath || undefined,
    });
    refreshSettings();
  };

  const removeDirectory = async (path: string) => {
    await invoke("remove_permission_directory", {
      path,
      settings_path: settingsPath || undefined,
    });
    refreshSettings();
  };



  const headerAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <DotsHorizontalIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => invoke("open_in_editor", { path: effectiveSettingsPath })}>
          <ExternalLinkIcon className="w-4 h-4 mr-2" />
          {t('settings.open_in_editor')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(effectiveSettingsPath)}>
          <CopyIcon className="w-4 h-4 mr-2" />
          {t('settings.copy_path')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowRawJson(true)}>
          <CodeIcon className="w-4 h-4 mr-2" />
          {t('settings.view_raw_json')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const mainContent = (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 overflow-y-auto">
      {!settings?.raw ? (
        <EmptyState icon={GearIcon} message={t('settings.no_settings')} hint={t('settings.create_hint')} />
      ) : (
        <>
          {/* General Section */}
          <section className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-ink mb-4">{t('settings.general')}</h3>
            <div className="space-y-4">
              {/* Model */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.default_model')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.default_model_desc')}</p>
                </div>
                <Select value={model} onValueChange={(v) => updateField("model", v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Always Thinking */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.extended_thinking')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.extended_thinking_desc')}</p>
                </div>
                <Switch
                  checked={alwaysThinkingEnabled}
                  onCheckedChange={(checked) => updateField("alwaysThinkingEnabled", checked)}
                />
              </div>

              {/* Spinner Tips */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.spinner_tips')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.spinner_tips_desc')}</p>
                </div>
                <Switch
                  checked={spinnerTipsEnabled}
                  onCheckedChange={(checked) => updateField("spinnerTipsEnabled", checked)}
                />
              </div>

              {/* Attribution */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.commit_attribution')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.commit_attribution_desc')}</p>
                </div>
                <Select value={attribution} onValueChange={(v) => updateAttribution(v as AttributionMode)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTRIBUTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cleanup Period */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.chat_retention')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.chat_retention_desc')}</p>
                </div>
                <Select
                  value={String(cleanupPeriodDays)}
                  onValueChange={(v) => updateField("cleanupPeriodDays", Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLEANUP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Permissions Section */}
          <section className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-ink mb-4">{t('settings.permissions')}</h3>
            <div className="space-y-4">
              {/* Default Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{t('settings.permission_mode')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.permission_mode_desc')}</p>
                </div>
                <Select value={defaultMode} onValueChange={(v) => updatePermissionField("defaultMode", v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_MODES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Directories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-ink">{t('settings.additional_directories')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.additional_directories_desc')}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const path = prompt(t('settings.enter_path'));
                      if (path?.trim()) addDirectory(path.trim());
                    }}
                  >
                    {t('common.add')}
                  </Button>
                </div>
                {additionalDirectories.length > 0 ? (
                  <div className="space-y-1">
                    {additionalDirectories.map((dir) => (
                      <div
                        key={dir}
                        className="flex items-center justify-between px-3 py-2 bg-card-alt rounded-lg text-xs"
                      >
                        <span className="font-mono text-muted-foreground">{dir}</span>
                        <button
                          onClick={() => removeDirectory(dir)}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t('settings.no_additional_directories')}</p>
                )}
              </div>
            </div>
          </section>


        </>
      )}
    </div>
  );

  const dialogs = (
    <Dialog open={showRawJson} onOpenChange={setShowRawJson}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>settings.json</DialogTitle>
        </DialogHeader>
        <pre className="bg-card-alt rounded-lg p-4 text-xs font-mono text-ink overflow-auto max-h-96">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        {mainContent}
        {dialogs}
      </div>
    );
  }

  return (
    <ConfigPage>
      <PageHeader title={t('settings.title')} subtitle={effectiveSettingsPath || "~/.claude/settings.json"} action={headerAction} />
      {mainContent}
      {dialogs}
    </ConfigPage>
  );
}
