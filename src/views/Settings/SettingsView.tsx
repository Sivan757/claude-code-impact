import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  GearIcon,
  DotsHorizontalIcon,
  ExternalLinkIcon,
  CopyIcon,
  CodeIcon,
  PlusIcon,
  Cross2Icon,
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
  PageHeader,
  ConfigPage,
} from "../../components/config";
import {
  SettingSection,
  SettingRow,
  SettingsEmptyState,
  ScopeSelector,
} from "../../components/Settings";
import { ConfigScope, ConfigFileKind } from "../../config/types";
import { useConfigMerged, useConfigWrite } from "../../config/hooks/useConfig";
import { cn } from "../../lib/utils";

type PermissionMode = "bypassPermissions" | "allowEdits" | "normal";
type ModelType = "opus" | "sonnet" | "haiku";
type AttributionMode = "none" | "footer" | "coauthor";

const DEFAULT_ATTRIBUTION_FOOTER =
  "Generated with [Claude Code](https://claude.com/claude-code)";
const DEFAULT_ATTRIBUTION_COAUTHOR = `${DEFAULT_ATTRIBUTION_FOOTER}\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;


export function SettingsView(props: { embedded?: boolean; settingsPath?: string }) {
  const { embedded = false, settingsPath } = props;
  const { t } = useTranslation();

  // Multi-scope editing state
  const [selectedScope, setSelectedScope] = useState<ConfigScope>(ConfigScope.User);

  // Fetch merged config
  const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);

  // Mutations
  const writeMutation = useConfigWrite();

  const [showRawJson, setShowRawJson] = useState(false);
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

  const denseLayout = {
    contentGap: "space-y-3",
    contentPadding: "pb-3",
    sectionDensity: "dense" as const,
    rowCompact: true,
    rowClassName: "py-2",
    blockPadding: "py-2.5",
  };

  const labelIds = {
    defaultModel: "settings-default-model-label",
    extendedThinking: "settings-extended-thinking-label",
    spinnerTips: "settings-spinner-tips-label",
    commitAttribution: "settings-commit-attribution-label",
    chatRetention: "settings-chat-retention-label",
    permissionMode: "settings-permission-mode-label",
  };

  // Extract settings from merged config
  const raw = (mergedConfig?.effective || {}) as Record<string, unknown>;
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

  // Get effective settings path from provenance
  const effectiveSettingsPath = settingsPath || "~/.claude/settings.json";

  const updateField = async (field: string, value: unknown) => {
    await writeMutation.mutateAsync({
      kind: ConfigFileKind.Settings,
      scope: selectedScope,
      projectPath: settingsPath,
      key: field,
      value,
    });
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
    await writeMutation.mutateAsync({
      kind: ConfigFileKind.Settings,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `permissions.${field}`,
      value,
    });
  };

  const addDirectory = async (path: string) => {
    const updatedDirectories = [...additionalDirectories, path];
    await writeMutation.mutateAsync({
      kind: ConfigFileKind.Settings,
      scope: selectedScope,
      projectPath: settingsPath,
      key: "permissions.additionalDirectories",
      value: updatedDirectories,
    });
  };

  const removeDirectory = async (path: string) => {
    const updatedDirectories = additionalDirectories.filter((d) => d !== path);
    await writeMutation.mutateAsync({
      kind: ConfigFileKind.Settings,
      scope: selectedScope,
      projectPath: settingsPath,
      key: "permissions.additionalDirectories",
      value: updatedDirectories,
    });
  };

  const headerAction = (
    <div className="flex items-center gap-2">
      <ScopeSelector
        value={selectedScope}
        onChange={setSelectedScope}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t('settings.more_actions')}>
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
    </div>
  );

  const mainContent = (
    <div
      className={cn(
        "flex-1 flex flex-col min-h-0 overflow-y-auto",
        denseLayout.contentGap,
        denseLayout.contentPadding
      )}
    >
      {!mergedConfig?.effective ? (
        <SettingsEmptyState
          icon={GearIcon}
          title={t('settings.no_settings')}
          description={t('settings.create_hint')}
        />
      ) : (
        <>
          {/* General Section */}
          <SettingSection
            title={t('settings.general')}
            density={denseLayout.sectionDensity}
          >
            {/* Model */}
            <SettingRow
              label={t('settings.default_model')}
              description={t('settings.default_model_desc')}
              labelId={labelIds.defaultModel}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select value={model} onValueChange={(v) => updateField("model", v)}>
                <SelectTrigger
                  className="w-28 h-8 rounded-lg"
                  aria-labelledby={labelIds.defaultModel}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Always Thinking */}
            <SettingRow
              label={t('settings.extended_thinking')}
              description={t('settings.extended_thinking_desc')}
              labelId={labelIds.extendedThinking}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={alwaysThinkingEnabled}
                aria-labelledby={labelIds.extendedThinking}
                onCheckedChange={(checked) => updateField("alwaysThinkingEnabled", checked)}
              />
            </SettingRow>

            {/* Spinner Tips */}
            <SettingRow
              label={t('settings.spinner_tips')}
              description={t('settings.spinner_tips_desc')}
              labelId={labelIds.spinnerTips}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={spinnerTipsEnabled}
                aria-labelledby={labelIds.spinnerTips}
                onCheckedChange={(checked) => updateField("spinnerTipsEnabled", checked)}
              />
            </SettingRow>

            {/* Attribution */}
            <SettingRow
              label={t('settings.commit_attribution')}
              description={t('settings.commit_attribution_desc')}
              labelId={labelIds.commitAttribution}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select value={attribution} onValueChange={(v) => updateAttribution(v as AttributionMode)}>
                <SelectTrigger
                  className="w-28 h-8 rounded-lg"
                  aria-labelledby={labelIds.commitAttribution}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Cleanup Period */}
            <SettingRow
              label={t('settings.chat_retention')}
              description={t('settings.chat_retention_desc')}
              labelId={labelIds.chatRetention}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select
                value={String(cleanupPeriodDays)}
                onValueChange={(v) => updateField("cleanupPeriodDays", Number(v))}
              >
                <SelectTrigger
                  className="w-28 h-8 rounded-lg"
                  aria-labelledby={labelIds.chatRetention}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLEANUP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </SettingSection>

          {/* Permissions Section */}
          <SettingSection title={t('settings.permissions')} density={denseLayout.sectionDensity}>
            {/* Default Mode */}
            <SettingRow
              label={t('settings.permission_mode')}
              description={t('settings.permission_mode_desc')}
              labelId={labelIds.permissionMode}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select value={defaultMode} onValueChange={(v) => updatePermissionField("defaultMode", v)}>
                <SelectTrigger
                  className="w-28 h-8 rounded-lg"
                  aria-labelledby={labelIds.permissionMode}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_MODES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Additional Directories */}
            <div className={cn(denseLayout.blockPadding, "border-b border-border/30 last:border-0")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{t('settings.additional_directories')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t('settings.additional_directories_desc')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg gap-1.5"
                  onClick={() => {
                    const path = prompt(t('settings.enter_path'));
                    if (path?.trim()) addDirectory(path.trim());
                  }}
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  {t('common.add')}
                </Button>
              </div>

              {additionalDirectories.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {additionalDirectories.map((dir) => (
                    <div
                      key={dir}
                      className="flex items-center justify-between px-3 py-2 bg-secondary/40 rounded-lg group hover:bg-secondary/60 transition-colors"
                    >
                      <span className="font-mono text-xs text-muted-foreground truncate">{dir}</span>
                      <button
                        onClick={() => removeDirectory(dir)}
                        aria-label={t('common.remove')}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-all"
                        title={t('common.remove')}
                      >
                        <Cross2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic mt-2">{t('settings.no_additional_directories')}</p>
              )}
            </div>
          </SettingSection>
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
      <PageHeader title={t('settings.title')} subtitle={effectiveSettingsPath} action={headerAction} />
      {mainContent}
      {dialogs}
    </ConfigPage>
  );
}
