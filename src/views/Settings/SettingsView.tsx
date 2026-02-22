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
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";
import {
  SettingSection,
  SettingRow,
  SettingsEmptyState,
} from "../../components/Settings";
import { ConfigFileKind } from "../../config/types";
import { useConfigDeleteKey, useConfigMerged, useConfigPaths, useConfigWrite } from "../../config/hooks/useConfig";
import { cn } from "../../lib/utils";
import { getConfigPathFor, getSettingsFileKindForScope } from "../../config/utils";
import { useSettingsScope } from "../../hooks";

type PermissionMode =
  | "acceptEdits"
  | "bypassPermissions"
  | "default"
  | "delegate"
  | "dontAsk"
  | "plan";
type ModelType = "opus" | "sonnet" | "haiku";
type AttributionMode = "none" | "footer" | "coauthor";
type AutoUpdatesChannel = "latest" | "stable";
type TeammateMode = "auto" | "in-process" | "tmux";
type MarketplaceSourceType = "github" | "git" | "url" | "npm" | "file" | "directory" | "hostPattern";

type ExtraKnownMarketplaceSource = {
  source?: string;
  repo?: string;
  url?: string;
  package?: string;
  path?: string;
  hostPattern?: string;
  ref?: string;
};

type ExtraKnownMarketplaceEntry = {
  source?: ExtraKnownMarketplaceSource;
};

const MARKETPLACE_SOURCE_VALUE_FIELD: Record<MarketplaceSourceType, keyof ExtraKnownMarketplaceSource> = {
  github: "repo",
  git: "url",
  url: "url",
  npm: "package",
  file: "path",
  directory: "path",
  hostPattern: "hostPattern",
};

const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const VALID_PERMISSION_MODES = new Set<PermissionMode>([
  "acceptEdits",
  "bypassPermissions",
  "default",
  "delegate",
  "dontAsk",
  "plan",
]);

const normalizePermissionMode = (value: unknown): PermissionMode => {
  if (value === "normal") return "default";
  if (value === "allowEdits") return "acceptEdits";
  if (typeof value === "string" && VALID_PERMISSION_MODES.has(value as PermissionMode)) {
    return value as PermissionMode;
  }
  return "default";
};

const DEFAULT_ATTRIBUTION_FOOTER =
  "Generated with [Claude Code](https://claude.com/claude-code)";
const DEFAULT_ATTRIBUTION_COAUTHOR = `${DEFAULT_ATTRIBUTION_FOOTER}\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

const isTruthyEnv = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return TRUTHY_ENV_VALUES.has(value.trim().toLowerCase());
};


export function SettingsView(props: { embedded?: boolean; settingsPath?: string }) {
  const { embedded = false, settingsPath } = props;
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();

  const { configScope: selectedScope } = useSettingsScope(settingsPath);

  // Fetch merged config
  const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);
  const { data: configPaths } = useConfigPaths(settingsPath);

  // Mutations
  const writeMutation = useConfigWrite();
  const deleteMutation = useConfigDeleteKey();

  const [showRawJson, setShowRawJson] = useState(false);
  const [languageInput, setLanguageInput] = useState("");
  const [taskListIdInput, setTaskListIdInput] = useState("");
  const [newMarketplaceName, setNewMarketplaceName] = useState("");
  const [newMarketplaceSourceType, setNewMarketplaceSourceType] = useState<MarketplaceSourceType>("github");
  const [newMarketplaceSourceValue, setNewMarketplaceSourceValue] = useState("");
  const [newMarketplaceSourceRef, setNewMarketplaceSourceRef] = useState("");
  const [newMarketplaceSourcePath, setNewMarketplaceSourcePath] = useState("");
  const didNormalizeAttribution = useRef(false);

  const PERMISSION_MODES: { value: PermissionMode; label: string; desc: string }[] = useMemo(() => [
    { value: "bypassPermissions", label: t('settings.bypass'), desc: t('settings.bypass_desc') },
    { value: "acceptEdits", label: t('settings.allow_edits'), desc: t('settings.allow_edits_desc') },
    { value: "default", label: t('settings.normal'), desc: t('settings.normal_desc') },
    { value: "plan", label: t('settings.permission_mode_plan', 'Plan'), desc: t('settings.permission_mode_plan_desc', 'Analysis only') },
    { value: "delegate", label: t('settings.permission_mode_delegate', 'Delegate'), desc: t('settings.permission_mode_delegate_desc', 'Delegate actions to subagents') },
    { value: "dontAsk", label: t('settings.permission_mode_dont_ask', "Don't Ask"), desc: t('settings.permission_mode_dont_ask_desc', 'Run without asking for confirmations') },
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
  const AUTO_UPDATES_OPTIONS: { value: AutoUpdatesChannel; label: string }[] = useMemo(() => [
    { value: "latest", label: t('settings.auto_updates_latest') },
    { value: "stable", label: t('settings.auto_updates_stable') },
  ], [t]);
  const TEAMMATE_MODE_OPTIONS: { value: TeammateMode; label: string }[] = useMemo(() => [
    { value: "auto", label: t('settings.teammate_mode_auto') },
    { value: "in-process", label: t('settings.teammate_mode_in_process') },
    { value: "tmux", label: t('settings.teammate_mode_tmux') },
  ], [t]);
  const MARKETPLACE_SOURCE_OPTIONS: { value: MarketplaceSourceType; label: string }[] = useMemo(() => [
    { value: "github", label: t('settings.marketplace_source_github') },
    { value: "git", label: t('settings.marketplace_source_git') },
    { value: "url", label: t('settings.marketplace_source_url') },
    { value: "npm", label: t('settings.marketplace_source_npm') },
    { value: "file", label: t('settings.marketplace_source_file') },
    { value: "directory", label: t('settings.marketplace_source_directory') },
    { value: "hostPattern", label: t('settings.marketplace_source_host_pattern') },
  ], [t]);

  const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
    { value: "opus", label: "Opus" },
    { value: "sonnet", label: "Sonnet" },
    { value: "haiku", label: "Haiku" },
  ];

  const denseLayout = {
    contentGap: "space-y-3",
    contentPadding: "pb-3 pr-3",
    sectionDensity: "dense" as const,
    rowCompact: true,
    rowClassName: "py-2",
    blockPadding: "py-2.5",
  };

  const labelIds = {
    defaultModel: "settings-default-model-label",
    alwaysThinking: "settings-always-thinking-label",
    showTurnDuration: "settings-show-turn-duration-label",
    responseLanguage: "settings-response-language-label",
    autoUpdatesChannel: "settings-auto-updates-channel-label",
    spinnerTips: "settings-spinner-tips-label",
    terminalProgressBar: "settings-terminal-progress-bar-label",
    reducedMotion: "settings-reduced-motion-label",
    teammateMode: "settings-teammate-mode-label",
    agentTeamsEnabled: "settings-agent-teams-enabled-label",
    sharedTaskListId: "settings-shared-task-list-id-label",
    teamName: "settings-team-name-label",
    planModeRequired: "settings-plan-mode-required-label",
    commitAttribution: "settings-commit-attribution-label",
    chatRetention: "settings-chat-retention-label",
    permissionMode: "settings-permission-mode-label",
  };

  // Extract settings from merged config
  const raw = (mergedConfig?.effective || {}) as Record<string, unknown>;
  const model = (raw.model as ModelType) || "sonnet";
  const alwaysThinkingEnabled = raw.alwaysThinkingEnabled === true; // default false
  const showTurnDuration = raw.showTurnDuration !== false; // default true
  const language = typeof raw.language === "string" ? raw.language : "";
  const autoUpdatesChannel: AutoUpdatesChannel = raw.autoUpdatesChannel === "stable" ? "stable" : "latest";
  const spinnerTipsEnabled = raw.spinnerTipsEnabled !== false; // default true
  const terminalProgressBarEnabled = raw.terminalProgressBarEnabled !== false; // default true
  const prefersReducedMotion = raw.prefersReducedMotion === true; // default false
  const teammateMode: TeammateMode = raw.teammateMode === "in-process" || raw.teammateMode === "tmux"
    ? (raw.teammateMode as TeammateMode)
    : "auto";
  const cleanupPeriodDays = (raw.cleanupPeriodDays as number) ?? 0;
  const envValues = (raw.env && typeof raw.env === "object" && !Array.isArray(raw.env))
    ? (raw.env as Record<string, unknown>)
    : {};
  const experimentalAgentTeamsEnabled = isTruthyEnv(envValues.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS);
  const taskListId = typeof envValues.CLAUDE_CODE_TASK_LIST_ID === "string"
    ? envValues.CLAUDE_CODE_TASK_LIST_ID
    : "";
  const teamName = typeof envValues.CLAUDE_CODE_TEAM_NAME === "string"
    ? envValues.CLAUDE_CODE_TEAM_NAME
    : "";
  const planModeRequired = isTruthyEnv(envValues.CLAUDE_CODE_PLAN_MODE_REQUIRED);
  const extraKnownMarketplaces = (raw.extraKnownMarketplaces
    && typeof raw.extraKnownMarketplaces === "object"
    && !Array.isArray(raw.extraKnownMarketplaces))
    ? (raw.extraKnownMarketplaces as Record<string, ExtraKnownMarketplaceEntry>)
    : {};
  const extraKnownMarketplaceEntries = Object.entries(extraKnownMarketplaces)
    .sort(([a], [b]) => a.localeCompare(b));

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
  const defaultMode = normalizePermissionMode(permissions.defaultMode ?? permissions.default_mode);
  const additionalDirectories = (permissions.additionalDirectories as string[]) || [];

  // Get effective settings path from provenance
  const settingsKind = getSettingsFileKindForScope(selectedScope);
  const resolvedSettingsPath = getConfigPathFor(configPaths, selectedScope, settingsKind);
  const settingsFilename = settingsKind === ConfigFileKind.SettingsLocal
    ? "settings.local.json"
    : "settings.json";
  const effectiveSettingsPath = resolvedSettingsPath
    ?? (settingsPath
      ? `${settingsPath}/.claude/${settingsFilename}`
      : `~/.claude/${settingsFilename}`);

  const updateField = async (field: string, value: unknown) => {
    await writeMutation.mutateAsync({
      kind: settingsKind,
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

  useEffect(() => {
    setLanguageInput(language);
  }, [language]);

  useEffect(() => {
    setTaskListIdInput(taskListId);
  }, [taskListId]);

  useEffect(() => {
    if (newMarketplaceSourceType !== "github" && newMarketplaceSourceType !== "git") {
      setNewMarketplaceSourceRef("");
      setNewMarketplaceSourcePath("");
    }
  }, [newMarketplaceSourceType]);

  if (isLoading) return <LoadingState message={t('settings.loading')} />;

  const updatePermissionField = async (field: string, value: unknown) => {
    const nextField = field === "default_mode" ? "defaultMode" : field;
    const nextValue = nextField === "defaultMode"
      ? normalizePermissionMode(value)
      : value;
    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `permissions.${nextField}`,
      value: nextValue,
    });
  };

  const addDirectory = async (path: string) => {
    const updatedDirectories = [...additionalDirectories, path];
    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: "permissions.additionalDirectories",
      value: updatedDirectories,
    });
  };

  const removeDirectory = async (path: string) => {
    const confirmed = await confirmDialog({
      title: t("common.remove", "Remove"),
      description: t("settings.confirm_remove_directory", {
        path,
        defaultValue: `Remove directory "${path}"?`,
      }),
      variant: "destructive",
      confirmText: t("common.remove", "Remove"),
    });
    if (!confirmed) return;

    const updatedDirectories = additionalDirectories.filter((d) => d !== path);
    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: "permissions.additionalDirectories",
      value: updatedDirectories,
    });
  };

  const saveLanguagePreference = async () => {
    const trimmedValue = languageInput.trim();
    const currentValue = language.trim();

    if (trimmedValue === currentValue) {
      if (languageInput !== trimmedValue) {
        setLanguageInput(trimmedValue);
      }
      return;
    }

    if (!trimmedValue) {
      await deleteMutation.mutateAsync({
        kind: settingsKind,
        scope: selectedScope,
        projectPath: settingsPath,
        key: "language",
      });
      setLanguageInput("");
      return;
    }

    await updateField("language", trimmedValue);
    setLanguageInput(trimmedValue);
  };

  const setEnvValue = async (envKey: string, envValue: string) => {
    await updateField(`env.${envKey}`, envValue);
  };

  const deleteKey = async (key: string) => {
    await deleteMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key,
    });
  };

  const deleteEnvValue = async (envKey: string) => {
    await deleteKey(`env.${envKey}`);
  };

  const updateExperimentalAgentTeams = async (enabled: boolean) => {
    if (enabled) {
      await setEnvValue("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1");
      return;
    }
    await deleteEnvValue("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS");
  };

  const saveTaskListId = async () => {
    const trimmedValue = taskListIdInput.trim();
    const currentValue = taskListId.trim();

    if (trimmedValue === currentValue) {
      if (taskListIdInput !== trimmedValue) {
        setTaskListIdInput(trimmedValue);
      }
      return;
    }

    if (!trimmedValue) {
      await deleteEnvValue("CLAUDE_CODE_TASK_LIST_ID");
      setTaskListIdInput("");
      return;
    }

    await setEnvValue("CLAUDE_CODE_TASK_LIST_ID", trimmedValue);
    setTaskListIdInput(trimmedValue);
  };

  const formatMarketplaceSource = (entry: ExtraKnownMarketplaceEntry): string => {
    const source = entry?.source;
    if (!source || typeof source !== "object") {
      return t('settings.marketplace_source_invalid');
    }

    const type = typeof source.source === "string" ? source.source : "unknown";
    const valueField = MARKETPLACE_SOURCE_VALUE_FIELD[type as MarketplaceSourceType];
    const value = valueField && typeof source[valueField] === "string"
      ? source[valueField]
      : "";
    const extras = [
      typeof source.ref === "string" && source.ref ? `ref=${source.ref}` : "",
      valueField !== "path" && typeof source.path === "string" && source.path ? `path=${source.path}` : "",
    ].filter(Boolean);

    return `${type}${value ? `: ${value}` : ""}${extras.length ? ` (${extras.join(", ")})` : ""}`;
  };

  const addExtraKnownMarketplace = async () => {
    const marketplaceName = newMarketplaceName.trim();
    const sourceValue = newMarketplaceSourceValue.trim();
    if (!marketplaceName || !sourceValue) return;

    const sourceField = MARKETPLACE_SOURCE_VALUE_FIELD[newMarketplaceSourceType];
    const sourcePayload: ExtraKnownMarketplaceSource = {
      source: newMarketplaceSourceType,
      [sourceField]: sourceValue,
    };

    if ((newMarketplaceSourceType === "github" || newMarketplaceSourceType === "git") && newMarketplaceSourceRef.trim()) {
      sourcePayload.ref = newMarketplaceSourceRef.trim();
    }
    if ((newMarketplaceSourceType === "github" || newMarketplaceSourceType === "git") && newMarketplaceSourcePath.trim()) {
      sourcePayload.path = newMarketplaceSourcePath.trim();
    }

    const nextValue: Record<string, ExtraKnownMarketplaceEntry> = {
      ...extraKnownMarketplaces,
      [marketplaceName]: {
        ...(extraKnownMarketplaces[marketplaceName] || {}),
        source: sourcePayload,
      },
    };

    await updateField("extraKnownMarketplaces", nextValue);
    setNewMarketplaceName("");
    setNewMarketplaceSourceValue("");
    setNewMarketplaceSourceRef("");
    setNewMarketplaceSourcePath("");
  };

  const removeExtraKnownMarketplace = async (marketplaceName: string) => {
    const confirmed = await confirmDialog({
      title: t("common.remove", "Remove"),
      description: t("settings.confirm_remove_marketplace", {
        name: marketplaceName,
        defaultValue: `Remove marketplace "${marketplaceName}"?`,
      }),
      variant: "destructive",
      confirmText: t("common.remove", "Remove"),
    });
    if (!confirmed) return;

    const nextValue: Record<string, ExtraKnownMarketplaceEntry> = { ...extraKnownMarketplaces };
    delete nextValue[marketplaceName];

    if (Object.keys(nextValue).length === 0) {
      await deleteKey("extraKnownMarketplaces");
      return;
    }

    await updateField("extraKnownMarketplaces", nextValue);
  };

  const headerAction = (
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
  );

  const mainContent = (
    <div
      className={cn(
        "flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
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

            {/* Extended Thinking */}
            <SettingRow
              label={t('settings.extended_thinking')}
              description={t('settings.extended_thinking_desc')}
              labelId={labelIds.alwaysThinking}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={alwaysThinkingEnabled}
                aria-labelledby={labelIds.alwaysThinking}
                onCheckedChange={(checked) => updateField("alwaysThinkingEnabled", checked)}
              />
            </SettingRow>

            {/* Turn Duration */}
            <SettingRow
              label={t('settings.show_turn_duration')}
              description={t('settings.show_turn_duration_desc')}
              labelId={labelIds.showTurnDuration}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={showTurnDuration}
                aria-labelledby={labelIds.showTurnDuration}
                onCheckedChange={(checked) => updateField("showTurnDuration", checked)}
              />
            </SettingRow>

            {/* Response Language */}
            <SettingRow
              label={t('settings.response_language')}
              description={t('settings.response_language_desc')}
              labelId={labelIds.responseLanguage}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <input
                className="h-8 w-36 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-labelledby={labelIds.responseLanguage}
                placeholder={t('settings.response_language_placeholder')}
                value={languageInput}
                onChange={(event) => setLanguageInput(event.target.value)}
                onBlur={() => { void saveLanguagePreference(); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveLanguagePreference();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setLanguageInput(language);
                    event.currentTarget.blur();
                  }
                }}
              />
            </SettingRow>

            {/* Auto Updates Channel */}
            <SettingRow
              label={t('settings.auto_updates_channel')}
              description={t('settings.auto_updates_channel_desc')}
              labelId={labelIds.autoUpdatesChannel}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select
                value={autoUpdatesChannel}
                onValueChange={(value) => updateField("autoUpdatesChannel", value)}
              >
                <SelectTrigger
                  className="w-32 h-8 rounded-lg"
                  aria-labelledby={labelIds.autoUpdatesChannel}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTO_UPDATES_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Terminal Progress Bar */}
            <SettingRow
              label={t('settings.terminal_progress_bar')}
              description={t('settings.terminal_progress_bar_desc')}
              labelId={labelIds.terminalProgressBar}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={terminalProgressBarEnabled}
                aria-labelledby={labelIds.terminalProgressBar}
                onCheckedChange={(checked) => updateField("terminalProgressBarEnabled", checked)}
              />
            </SettingRow>

            {/* Reduced Motion */}
            <SettingRow
              label={t('settings.reduced_motion')}
              description={t('settings.reduced_motion_desc')}
              labelId={labelIds.reducedMotion}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={prefersReducedMotion}
                aria-labelledby={labelIds.reducedMotion}
                onCheckedChange={(checked) => updateField("prefersReducedMotion", checked)}
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

          {/* Agent Teams Section */}
          <SettingSection title={t('settings.agent_teams')} density={denseLayout.sectionDensity}>
            <SettingRow
              label={t('settings.teammate_mode')}
              description={t('settings.teammate_mode_desc')}
              labelId={labelIds.teammateMode}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Select
                value={teammateMode}
                onValueChange={(value) => updateField("teammateMode", value)}
              >
                <SelectTrigger
                  className="w-36 h-8 rounded-lg"
                  aria-labelledby={labelIds.teammateMode}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMMATE_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              label={t('settings.agent_teams_enabled')}
              description={t('settings.agent_teams_enabled_desc')}
              labelId={labelIds.agentTeamsEnabled}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={experimentalAgentTeamsEnabled}
                aria-labelledby={labelIds.agentTeamsEnabled}
                onCheckedChange={(checked) => void updateExperimentalAgentTeams(checked)}
              />
            </SettingRow>

            <SettingRow
              label={t('settings.shared_task_list_id')}
              description={t('settings.shared_task_list_id_desc')}
              labelId={labelIds.sharedTaskListId}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <input
                className="h-8 w-44 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-labelledby={labelIds.sharedTaskListId}
                placeholder={t('settings.shared_task_list_id_placeholder')}
                value={taskListIdInput}
                onChange={(event) => setTaskListIdInput(event.target.value)}
                onBlur={() => { void saveTaskListId(); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveTaskListId();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setTaskListIdInput(taskListId);
                    event.currentTarget.blur();
                  }
                }}
              />
            </SettingRow>

            <SettingRow
              label={t('settings.team_name')}
              description={t('settings.team_name_desc')}
              labelId={labelIds.teamName}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <span
                className="inline-flex h-8 min-w-24 items-center rounded-lg border border-border/60 bg-secondary/40 px-3 text-xs font-mono text-muted-foreground"
                aria-labelledby={labelIds.teamName}
                title={teamName || t('settings.not_set')}
              >
                {teamName || t('settings.not_set')}
              </span>
            </SettingRow>

            <SettingRow
              label={t('settings.plan_mode_required')}
              description={t('settings.plan_mode_required_desc')}
              labelId={labelIds.planModeRequired}
              compact={denseLayout.rowCompact}
              className={denseLayout.rowClassName}
            >
              <Switch
                checked={planModeRequired}
                aria-labelledby={labelIds.planModeRequired}
                disabled
              />
            </SettingRow>
          </SettingSection>

          {/* Plugin Marketplaces Section */}
          <SettingSection title={t('settings.plugin_marketplaces')} density={denseLayout.sectionDensity}>
            <div className={cn(denseLayout.blockPadding, "border-b border-border/30 last:border-0")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{t('settings.extra_known_marketplaces')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t('settings.extra_known_marketplaces_desc')}
                  </p>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="h-8 w-40 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    placeholder={t('settings.marketplace_name_placeholder')}
                    value={newMarketplaceName}
                    onChange={(event) => setNewMarketplaceName(event.target.value)}
                  />
                  <Select
                    value={newMarketplaceSourceType}
                    onValueChange={(value) => setNewMarketplaceSourceType(value as MarketplaceSourceType)}
                  >
                    <SelectTrigger className="w-32 h-8 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    className="h-8 min-w-44 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    placeholder={t(`settings.marketplace_source_placeholder_${newMarketplaceSourceType}`)}
                    value={newMarketplaceSourceValue}
                    onChange={(event) => setNewMarketplaceSourceValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addExtraKnownMarketplace();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg gap-1.5"
                    onClick={() => { void addExtraKnownMarketplace(); }}
                    disabled={!newMarketplaceName.trim() || !newMarketplaceSourceValue.trim()}
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    {t('common.add')}
                  </Button>
                </div>

                {(newMarketplaceSourceType === "github" || newMarketplaceSourceType === "git") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="h-8 w-36 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      placeholder={t('settings.marketplace_source_ref_placeholder')}
                      value={newMarketplaceSourceRef}
                      onChange={(event) => setNewMarketplaceSourceRef(event.target.value)}
                    />
                    <input
                      className="h-8 min-w-44 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      placeholder={t('settings.marketplace_source_path_placeholder')}
                      value={newMarketplaceSourcePath}
                      onChange={(event) => setNewMarketplaceSourcePath(event.target.value)}
                    />
                  </div>
                )}
              </div>

              {extraKnownMarketplaceEntries.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {extraKnownMarketplaceEntries.map(([marketplaceName, marketplaceConfig]) => (
                    <div
                      key={marketplaceName}
                      className="flex items-center justify-between px-3 py-2 bg-secondary/40 rounded-lg group hover:bg-secondary/60 transition-colors gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground font-medium truncate" title={marketplaceName}>
                          {marketplaceName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate" title={formatMarketplaceSource(marketplaceConfig)}>
                          {formatMarketplaceSource(marketplaceConfig)}
                        </p>
                      </div>
                      <button
                        onClick={() => { void removeExtraKnownMarketplace(marketplaceName); }}
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
                <p className="text-xs text-muted-foreground/70 italic mt-2">{t('settings.no_extra_known_marketplaces')}</p>
              )}
            </div>
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
