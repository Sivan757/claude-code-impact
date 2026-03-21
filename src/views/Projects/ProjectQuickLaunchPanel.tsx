import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Blocks,
  List as ListIcon,
  LayoutGrid,
  LoaderCircle,
} from "lucide-react";

import { useAppConfig } from "@/context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useConfigMerged, useConfigWrite } from "@/config/hooks/useConfig";
import { ConfigFileKind, ConfigScope } from "@/config/types";
import { useInvokeQuery, useQueryClient, useTerminalLauncher } from "@/hooks";
import { resolveLaunchDraftRetentionSeconds } from "@/lib/launchDraftRetention";
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  getEnvFromSettings,
  normalizeProviderBaseUrl,
  normalizeProviderToken,
  resolveProviderDisplayName,
  type LlmProfilesState,
  type ProviderProfile,
} from "@/lib/llmProfiles";
import { getPreferredTerminalApp } from "@/lib/terminalPreference";
import { cn } from "@/lib/utils";
import { profileAtom } from "@/store";
import type { PluginComponents, PluginScanResult, Project, ScannedPlugin } from "@/types";
import { PluginCard } from "@/views/Extensions/PluginCard";
import type { MergedConfigView, ProvenanceEntry } from "@/config/types";

import {
  buildClaudeLaunchCommand,
  getProjectDisplayName,
  type LaunchDraftResponse,
  type LaunchSettingsRequest,
  type MaterializedLaunchDraftResponse,
  MODEL_OPTIONS,
  type ModelType,
} from "./launcherShared";

type ModelChoice = ModelType | "_default";
type PermissionMode = "acceptEdits" | "bypassPermissions" | "default" | "delegate" | "dontAsk" | "plan";
type PermissionChoice = PermissionMode | "_default";
type PluginDialogViewMode = "card" | "list";

interface PreparedLaunchDraft {
  draftId: string;
  settingsPath: string;
  signature: string;
}

interface PluginRuntimeState {
  id: string;
  scope: "user" | "project" | "local" | "managed";
  enabled: boolean;
  projectPath?: string | null;
}

const VALID_PERMISSION_MODES = new Set<PermissionMode>([
  "acceptEdits",
  "bypassPermissions",
  "default",
  "delegate",
  "dontAsk",
  "plan",
]);

function normalizePermissionMode(value: unknown): PermissionMode {
  if (value === "normal") return "default";
  if (value === "allowEdits") return "acceptEdits";
  if (typeof value === "string" && VALID_PERMISSION_MODES.has(value as PermissionMode)) {
    return value as PermissionMode;
  }
  return "default";
}

function normalizePluginIds(pluginIds: string[]): string[] {
  return Array.from(new Set(pluginIds.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildEnabledPluginsValue(
  pluginIds: string[],
  selectedPluginIds: string[],
): Record<string, boolean> {
  const selectedSet = new Set(selectedPluginIds);
  return Object.fromEntries(
    normalizePluginIds(pluginIds).map((pluginId) => [pluginId, selectedSet.has(pluginId)]),
  );
}

const EMPTY_PLUGIN_COMPONENTS: PluginComponents = {
  agents: [],
  commands: [],
  skills: [],
  hooks: [],
  claudeMd: [],
  mcps: [],
  lsps: [],
};

const PROVIDER_PROFILE_ENV_FIELDS = [
  { envKey: "ANTHROPIC_DEFAULT_OPUS_MODEL", profileKey: "defaultOpusModel" as const },
  { envKey: "ANTHROPIC_DEFAULT_SONNET_MODEL", profileKey: "defaultSonnetModel" as const },
  { envKey: "ANTHROPIC_DEFAULT_HAIKU_MODEL", profileKey: "defaultHaikuModel" as const },
  { envKey: "ANTHROPIC_MODEL", profileKey: "model" as const },
  { envKey: "ANTHROPIC_SMALL_FAST_MODEL", profileKey: "smallFastModel" as const },
] as const;

function buildProviderLaunchOverrides(
  selectedProviderId: string,
  profiles: ProviderProfile[],
): Pick<LaunchSettingsRequest, "provider_name" | "env_overrides"> {
  if (selectedProviderId === "_default") {
    return {};
  }

  const selectedProfile = profiles.find((profile) => profile.id === selectedProviderId);
  if (!selectedProfile) {
    return {
      provider_name: selectedProviderId,
    };
  }

  const envOverrides: Record<string, string> = {
    ANTHROPIC_AUTH_TOKEN: selectedProfile.authToken.trim(),
    ANTHROPIC_BASE_URL: selectedProfile.baseUrl.trim() || DEFAULT_ANTHROPIC_BASE_URL,
  };

  for (const { envKey, profileKey } of PROVIDER_PROFILE_ENV_FIELDS) {
    envOverrides[envKey] = (selectedProfile[profileKey] ?? "").trim();
  }

  return {
    provider_name: selectedProfile.name,
    env_overrides: envOverrides,
  };
}

function buildLaunchSignature(request: LaunchSettingsRequest): string {
  return JSON.stringify({
    projectPath: request.project_path ?? null,
    model: request.model ?? null,
    providerName: request.provider_name ?? null,
    envOverrides: request.env_overrides ?? null,
    permissionMode: request.permission_mode ?? null,
    enabledPlugins: request.enabled_plugins ?? null,
  });
}

function isProjectScopedProvenance(entry?: ProvenanceEntry): boolean {
  return entry?.scope === ConfigScope.Project || entry?.scope === ConfigScope.ProjectLocal;
}

function hasProjectScopedValue(
  provenance: Record<string, ProvenanceEntry> | undefined,
  keys: string[],
): boolean {
  if (!provenance) return false;
  return keys.some((key) => isProjectScopedProvenance(provenance[key]));
}

function resolveInitialProviderSelection(
  settings: Record<string, unknown>,
  profiles: ProviderProfile[],
): string {
  if (profiles.length === 0) {
    return "_default";
  }

  const cci = settings.claudecodeimpact;
  if (cci && typeof cci === "object" && !Array.isArray(cci)) {
    const activeProvider = (cci as Record<string, unknown>).activeProvider;
    if (typeof activeProvider === "string" && activeProvider.trim()) {
      const directMatch = profiles.find(
        (profile) =>
          profile.id === activeProvider.trim() || profile.name === activeProvider.trim(),
      );
      if (directMatch) {
        return directMatch.id;
      }
    }
  }

  const env = getEnvFromSettings(settings);
  const token = normalizeProviderToken(env.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_API_KEY);
  const baseUrl = normalizeProviderBaseUrl(env.ANTHROPIC_BASE_URL);
  const currentModels = PROVIDER_PROFILE_ENV_FIELDS.map(({ envKey }) => (env[envKey] ?? "").trim());

  const exactMatch = profiles.find((profile) => {
    const profileModels = PROVIDER_PROFILE_ENV_FIELDS.map(({ profileKey }) =>
      (profile[profileKey] ?? "").trim(),
    );
    return (
      normalizeProviderToken(profile.authToken) === token
      && normalizeProviderBaseUrl(profile.baseUrl) === baseUrl
      && profileModels.every((value, index) => value === currentModels[index])
    );
  });

  if (exactMatch) {
    return exactMatch.id;
  }

  const tokenMatches = token
    ? profiles.filter((profile) => normalizeProviderToken(profile.authToken) === token)
    : [];
  if (tokenMatches.length === 1) {
    return tokenMatches[0].id;
  }

  const baseMatches = profiles.filter(
    (profile) => normalizeProviderBaseUrl(profile.baseUrl) === baseUrl,
  );
  if (baseMatches.length === 1) {
    return baseMatches[0].id;
  }

  return "_default";
}

function resolveInitialLauncherSelections(
  mergedConfig: MergedConfigView,
  profiles: ProviderProfile[],
): {
  model: ModelChoice;
  providerId: string;
  permissionMode: PermissionChoice;
  pluginIds: string[] | null;
} {
  const effective = (mergedConfig.effective ?? {}) as Record<string, unknown>;
  const provenance = mergedConfig.provenance ?? {};

  const modelValue =
    typeof effective.model === "string" ? effective.model.trim().toLowerCase() : "";
  const model = hasProjectScopedValue(provenance, ["model"])
    && MODEL_OPTIONS.some((option) => option.value === modelValue)
      ? (modelValue as ModelType)
      : "_default";

  const permissions = effective.permissions;
  const currentPermissionMode =
    permissions && typeof permissions === "object" && !Array.isArray(permissions)
      ? normalizePermissionMode(
        (permissions as Record<string, unknown>).defaultMode
        ?? (permissions as Record<string, unknown>).default_mode,
      )
      : "default";
  const permissionMode = hasProjectScopedValue(provenance, [
    "permissions.defaultMode",
    "permissions.default_mode",
  ])
    ? currentPermissionMode
    : "_default";

  const hasProjectScopedProviderConfig = hasProjectScopedValue(provenance, [
    "claudecodeimpact.activeProvider",
    "env.ANTHROPIC_AUTH_TOKEN",
    "env.ANTHROPIC_API_KEY",
    "env.ANTHROPIC_BASE_URL",
    "env.ANTHROPIC_DEFAULT_OPUS_MODEL",
    "env.ANTHROPIC_DEFAULT_SONNET_MODEL",
    "env.ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "env.ANTHROPIC_MODEL",
    "env.ANTHROPIC_SMALL_FAST_MODEL",
  ]);
  const providerId = hasProjectScopedProviderConfig
    ? resolveInitialProviderSelection(effective, profiles)
    : "_default";

  const hasProjectScopedPluginConfig = hasProjectScopedValue(provenance, [
    "enabledPlugins",
    "enabled_plugins",
  ]);
  const rawEnabledPlugins =
    effective.enabledPlugins && typeof effective.enabledPlugins === "object" && !Array.isArray(effective.enabledPlugins)
      ? (effective.enabledPlugins as Record<string, unknown>)
      : effective.enabled_plugins && typeof effective.enabled_plugins === "object" && !Array.isArray(effective.enabled_plugins)
        ? (effective.enabled_plugins as Record<string, unknown>)
        : null;
  const pluginIds = hasProjectScopedPluginConfig && rawEnabledPlugins
    ? normalizePluginIds(
      Object.entries(rawEnabledPlugins)
        .filter(([, enabled]) => enabled === true)
        .map(([pluginId]) => pluginId),
    )
    : hasProjectScopedPluginConfig
      ? []
      : null;

  return {
    model,
    providerId,
    permissionMode,
    pluginIds,
  };
}

interface ProjectQuickLaunchPanelProps {
  projectPath: string;
  projectName?: string | null;
  className?: string;
}

function ToolbarField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex h-7 shrink-0 items-center gap-1 rounded-xl bg-transparent px-2 text-sm transition-colors hover:bg-background/55 focus-within:bg-background/70",
        className,
      )}
    >
      <span className="shrink-0 text-[12px] font-medium text-muted-foreground/85">
        {label}
        <span className="ml-1 text-muted-foreground/60">:</span>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ToolbarSelect({
  value,
  onValueChange,
  options,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; triggerLabel?: string }>;
  className?: string;
}) {
  const selectedOption = options.find((option) => option.value === value);
  const triggerLabel = selectedOption?.triggerLabel ?? selectedOption?.label ?? "";

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-[26px] w-auto min-w-0 justify-start gap-0.5 border-0 bg-transparent px-0 text-[12px] font-medium text-foreground shadow-none focus-visible:ring-0 [&_svg]:size-3 [&_svg]:text-muted-foreground/80 [&_svg]:opacity-100",
          className,
        )}
      >
        <span className="truncate">{triggerLabel}</span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        viewportClassName="p-0.5"
        className="rounded-[16px] border-border/50 bg-popover text-popover-foreground shadow-lg data-[side=bottom]:translate-y-0 data-[side=top]:translate-y-0"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="rounded-[12px] py-1 pr-7 pl-2 text-[12px] leading-5 text-foreground focus:bg-secondary focus:text-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PluginSelectionDialog({
  open,
  onOpenChange,
  plugins,
  selectedPluginIds,
  onTogglePlugin,
  onSaveToProject,
  onApply,
  isLoading,
  isSaving,
  isApplying,
  error,
  notice,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugins: ScannedPlugin[];
  selectedPluginIds: string[];
  onTogglePlugin: (pluginId: string) => void;
  onSaveToProject: () => void;
  onApply: () => void;
  isLoading: boolean;
  isSaving: boolean;
  isApplying: boolean;
  error: string | null;
  notice: string | null;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<PluginDialogViewMode>("card");
  const selectedSet = useMemo(() => new Set(selectedPluginIds), [selectedPluginIds]);
  const filteredPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plugins;

    return plugins.filter((plugin) => {
      return (
        plugin.name.toLowerCase().includes(query) ||
        plugin.marketplace.toLowerCase().includes(query) ||
        (plugin.description ?? "").toLowerCase().includes(query) ||
        (plugin.author ?? "").toLowerCase().includes(query)
      );
    });
  }, [plugins, search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setViewMode("card");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-none grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] rounded-[32px] border-border/40 bg-background/95 p-5 backdrop-blur-xl"
        style={{
          width: "88vw",
          minWidth: "88vw",
          maxWidth: "88vw",
          height: "80vh",
          maxHeight: "80vh",
        }}
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-xl font-semibold text-foreground">
            {t("launcher.plugin_dialog_title", "Launch Plugins")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t(
              "launcher.plugin_dialog_desc",
              "Select installed plugins for this launch. Apply creates a temporary settings snapshot; Save to Project writes enabledPlugins into the project settings.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("launcher.plugin_dialog_search", "Search plugins...")}
              className="h-12 rounded-full border-border/60 bg-background/80 px-4 text-sm shadow-none"
            />
          </div>
          <div className="flex items-center justify-between gap-3 lg:shrink-0">
            <p className="text-sm text-muted-foreground">
              {t("launcher.plugin_selected_count", "{{count}} selected", {
                count: selectedPluginIds.length,
              })}
            </p>
            <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm">
              <button
                type="button"
                aria-label={t("llm.view_list", "List view")}
                title={t("llm.view_list", "List view")}
                onClick={() => setViewMode("list")}
                className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t("llm.view_card", "Card view")}
                title={t("llm.view_card", "Card view")}
                onClick={() => setViewMode("card")}
                className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                  viewMode === "card"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              {t("launcher.plugin_dialog_loading", "Loading installed plugins...")}
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
              {t("launcher.plugin_dialog_empty", "No installed plugins")}
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
              {t("launcher.plugin_dialog_empty_filtered", "No matching plugins")}
            </div>
          ) : (
            <div
              className={
                viewMode === "card"
                  ? "grid gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                  : "flex flex-col gap-2.5"
              }
            >
              {filteredPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  variant={viewMode}
                  mode="select"
                  isSelected={selectedSet.has(plugin.id)}
                  onSelectedChange={() => onTogglePlugin(plugin.id)}
                  onSelect={() => onTogglePlugin(plugin.id)}
                  onInstall={() => undefined}
                  onUninstall={() => undefined}
                  onToggle={() => undefined}
                  onUpdate={() => undefined}
                  isActionLoading={false}
                  isToggleLoading={false}
                  isUpdateLoading={false}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveToProject}
            disabled={isLoading || isSaving || isApplying || plugins.length === 0}
            className="rounded-full"
          >
            {isSaving ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("launcher.plugin_dialog_save_project", "Save to Project")}
          </Button>
          <Button
            type="button"
            onClick={onApply}
            disabled={isLoading || isSaving || isApplying || plugins.length === 0}
            className="rounded-full"
          >
            {isApplying ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("launcher.plugin_dialog_apply", "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectQuickLaunchPanel({
  projectPath,
  projectName,
  className,
}: ProjectQuickLaunchPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatPath } = useAppConfig();
  const [profile] = useAtom(profileAtom);
  const preferredTerminalApp = getPreferredTerminalApp(profile);
  const queryClient = useQueryClient();
  const launchDraftRetentionSeconds = useMemo(
    () => resolveLaunchDraftRetentionSeconds(profile),
    [profile],
  );
  const terminalLauncher = useTerminalLauncher();
  const configWrite = useConfigWrite();

  const mergedConfigQuery = useConfigMerged(projectPath);
  const mergedConfig = mergedConfigQuery.data;
  const { data: projects = [] } = useInvokeQuery<Project[]>(["projects"], "list_projects");
  const pluginScanQuery = useInvokeQuery<PluginScanResult>(["pluginScan"], "scan_plugins");
  const pluginRuntimeStateQuery = useInvokeQuery<PluginRuntimeState[]>(
    ["pluginRuntimeState"],
    "list_plugin_runtime_state",
  );
  const llmProfilesStateQuery = useInvokeQuery<LlmProfilesState>(
    ["llmProfilesState"],
    "get_llm_profiles_state",
  );
  const llmProfilesState = llmProfilesStateQuery.data;

  const [launchPrompt, setLaunchPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("_default");
  const [selectedProviderId, setSelectedProviderId] = useState("_default");
  const [selectedPermissionMode, setSelectedPermissionMode] = useState<PermissionChoice>("_default");
  const [didHydrateProjectSelections, setDidHydrateProjectSelections] = useState(false);
  const [pluginOverrideIds, setPluginOverrideIds] = useState<string[] | null>(null);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const [pluginDialogSelection, setPluginDialogSelection] = useState<string[]>([]);
  const [pluginDialogError, setPluginDialogError] = useState<string | null>(null);
  const [pluginDialogNotice, setPluginDialogNotice] = useState<string | null>(null);
  const [isApplyingPlugins, setIsApplyingPlugins] = useState(false);
  const [isSavingPlugins, setIsSavingPlugins] = useState(false);
  const [preparedLaunchDraft, setPreparedLaunchDraft] = useState<PreparedLaunchDraft | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedModel("_default");
    setSelectedProviderId("_default");
    setSelectedPermissionMode("_default");
    setDidHydrateProjectSelections(false);
    setPluginOverrideIds(null);
    setPluginDialogOpen(false);
    setPluginDialogSelection([]);
    setPluginDialogError(null);
    setPluginDialogNotice(null);
    setPreparedLaunchDraft(null);
    setLaunchPrompt("");
    setLaunchError(null);
  }, [projectPath]);

  const providerProfiles = llmProfilesState?.profiles ?? [];
  useEffect(() => {
    if (didHydrateProjectSelections) return;
    if (mergedConfigQuery.isLoading || llmProfilesStateQuery.isLoading) return;
    if (!mergedConfig) return;

    const initialSelections = resolveInitialLauncherSelections(mergedConfig, providerProfiles);
    setSelectedModel(initialSelections.model);
    setSelectedProviderId(initialSelections.providerId);
    setSelectedPermissionMode(initialSelections.permissionMode);
    setPluginOverrideIds(initialSelections.pluginIds);
    setDidHydrateProjectSelections(true);
  }, [
    didHydrateProjectSelections,
    llmProfilesStateQuery.isLoading,
    mergedConfig,
    mergedConfigQuery.isLoading,
    providerProfiles,
  ]);

  const selectablePlugins = useMemo(
    () => {
      const pluginMap = new Map<string, ScannedPlugin>();
      const scannedPlugins = new Map(
        (pluginScanQuery.data?.plugins ?? []).map((plugin) => [plugin.id, plugin]),
      );

      for (const state of pluginRuntimeStateQuery.data ?? []) {
        if (state.scope !== "user" && state.scope !== "managed") {
          continue;
        }

        const scannedPlugin = scannedPlugins.get(state.id);
        if (scannedPlugin) {
          pluginMap.set(state.id, {
            ...scannedPlugin,
            isInstalled: true,
            isEnabled: state.enabled,
          });
          continue;
        }

        const parts = state.id.split("@");
        const name = parts[0] ?? state.id;
        const marketplace = parts.length > 1 ? parts.slice(1).join("@") : "unknown";

        pluginMap.set(state.id, {
          id: state.id,
          name,
          description: null,
          version: null,
          repositoryVersion: null,
          lastUpdated: null,
          author: null,
          repository: null,
          marketplace,
          isInstalled: true,
          isEnabled: state.enabled,
          localPath: null,
          components: EMPTY_PLUGIN_COMPONENTS,
          componentsSource: null,
        });
      }

      return [...pluginMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      );
    },
    [pluginRuntimeStateQuery.data, pluginScanQuery.data?.plugins],
  );
  const currentProject = useMemo(
    () => projects.find((project) => project.path === projectPath) ?? null,
    [projectPath, projects],
  );
  const currentProjectId = currentProject?.id ?? "_current";
  const displayName = useMemo(
    () => getProjectDisplayName(projectPath, projectName ?? undefined),
    [projectName, projectPath],
  );

  const currentSettings = useMemo(
    () => (mergedConfig?.effective ?? {}) as Record<string, unknown>,
    [mergedConfig?.effective],
  );
  const defaultModelLabel = useMemo(() => {
    const raw = typeof currentSettings.model === "string" ? currentSettings.model.trim() : "";
    return raw || t("common.default", "Default");
  }, [currentSettings.model, t]);
  const defaultProviderLabel = useMemo(() => {
    return resolveProviderDisplayName(currentSettings, providerProfiles, t("common.default", "Default"))
      ?? t("common.default", "Default");
  }, [currentSettings, providerProfiles, t]);
  const currentPermissionMode = useMemo(() => {
    const permissions = currentSettings.permissions;
    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
      return "default" as PermissionMode;
    }
    return normalizePermissionMode(
      (permissions as Record<string, unknown>).defaultMode
      ?? (permissions as Record<string, unknown>).default_mode,
    );
  }, [currentSettings.permissions]);
  const permissionOptionsBase = useMemo(
    () => [
      { value: "bypassPermissions" as const, label: t("settings.bypass", "Bypass Permissions") },
      { value: "acceptEdits" as const, label: t("settings.allow_edits", "Allow Edits") },
      { value: "default" as const, label: t("settings.normal", "Normal") },
      { value: "plan" as const, label: t("settings.permission_mode_plan", "Plan") },
      { value: "delegate" as const, label: t("settings.permission_mode_delegate", "Delegate") },
      { value: "dontAsk" as const, label: t("settings.permission_mode_dont_ask", "Don't Ask") },
    ],
    [t],
  );
  const permissionLabelByValue = useMemo(
    () => Object.fromEntries(permissionOptionsBase.map((option) => [option.value, option.label])),
    [permissionOptionsBase],
  );
  const defaultPermissionLabel = permissionLabelByValue[currentPermissionMode] ?? t("settings.normal", "Normal");
  const defaultEnabledPluginIds = useMemo(
    () => normalizePluginIds(selectablePlugins.filter((plugin) => plugin.isEnabled).map((plugin) => plugin.id)),
    [selectablePlugins],
  );
  const effectivePluginIds = pluginOverrideIds ?? defaultEnabledPluginIds;

  const handleProjectChange = useCallback((projectId: string) => {
    if (projectId === currentProjectId) return;
    navigate(`/chat/${encodeURIComponent(projectId)}`);
  }, [currentProjectId, navigate]);

  const buildLaunchRequest = useCallback((pluginIds = effectivePluginIds): LaunchSettingsRequest => {
    const enabledPlugins = pluginOverrideIds === null
      ? undefined
      : buildEnabledPluginsValue(selectablePlugins.map((plugin) => plugin.id), pluginIds);
    const providerOverrides = buildProviderLaunchOverrides(selectedProviderId, providerProfiles);

    return {
      project_path: projectPath,
      model: selectedModel === "_default" ? undefined : selectedModel,
      provider_name: providerOverrides.provider_name,
      env_overrides: providerOverrides.env_overrides,
      permission_mode: selectedPermissionMode === "_default" ? undefined : selectedPermissionMode,
      enabled_plugins: enabledPlugins,
    };
  }, [
    effectivePluginIds,
    pluginOverrideIds,
    projectPath,
    providerProfiles,
    selectedModel,
    selectedPermissionMode,
    selectedProviderId,
    selectablePlugins,
  ]);

  const currentLaunchSignature = useMemo(
    () => buildLaunchSignature(buildLaunchRequest()),
    [buildLaunchRequest],
  );

  useEffect(() => {
    if (!preparedLaunchDraft) return;
    if (preparedLaunchDraft.signature === currentLaunchSignature) return;
    setPreparedLaunchDraft(null);
  }, [currentLaunchSignature, preparedLaunchDraft]);

  useEffect(() => {
    const draftId = preparedLaunchDraft?.draftId;
    if (!draftId) return;

    return () => {
      void invoke("release_launch_draft", { draftId }).catch(() => undefined);
    };
  }, [preparedLaunchDraft?.draftId]);

  const materializeLaunchRequest = useCallback(async (request: LaunchSettingsRequest) => {
    const snapshot = await invoke<LaunchDraftResponse>("prepare_launch_snapshot", { request });
    return invoke<MaterializedLaunchDraftResponse>("materialize_launch_draft", {
      request: {
        settings: snapshot.settings,
        retention_secs: launchDraftRetentionSeconds,
      },
    });
  }, [launchDraftRetentionSeconds]);

  const handleLaunch = useCallback(async () => {
    setLaunchError(null);

    try {
      const request = buildLaunchRequest();
      const signature = buildLaunchSignature(request);
      const settingsPath = preparedLaunchDraft?.signature === signature
        ? preparedLaunchDraft.settingsPath
        : (await materializeLaunchRequest(request)).settings_path;

      const command = buildClaudeLaunchCommand(settingsPath, launchPrompt);
      await terminalLauncher.mutateAsync({
        cwd: projectPath,
        terminalApp: preferredTerminalApp,
        command,
      });
    } catch (error) {
      setLaunchError(String(error));
    }
  }, [
    buildLaunchRequest,
    launchPrompt,
    materializeLaunchRequest,
    preparedLaunchDraft,
    preferredTerminalApp,
    projectPath,
    terminalLauncher,
  ]);

  const handlePromptKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleLaunch();
    }
  }, [handleLaunch]);

  const openPluginDialog = useCallback(() => {
    setPluginDialogSelection(effectivePluginIds);
    setPluginDialogError(null);
    setPluginDialogNotice(null);
    setPluginDialogOpen(true);
  }, [effectivePluginIds]);

  const togglePluginSelection = useCallback((pluginId: string) => {
    setPluginDialogSelection((current) => {
      if (current.includes(pluginId)) {
        return current.filter((id) => id !== pluginId);
      }
      return normalizePluginIds([...current, pluginId]);
    });
  }, []);

  const handleApplyPlugins = useCallback(async () => {
    setPluginDialogError(null);
    setPluginDialogNotice(null);
    setIsApplyingPlugins(true);

    try {
      const normalizedSelection = normalizePluginIds(pluginDialogSelection);
      const providerOverrides = buildProviderLaunchOverrides(selectedProviderId, providerProfiles);
      const request = {
        project_path: projectPath,
        model: selectedModel === "_default" ? undefined : selectedModel,
        provider_name: providerOverrides.provider_name,
        env_overrides: providerOverrides.env_overrides,
        permission_mode: selectedPermissionMode === "_default" ? undefined : selectedPermissionMode,
        enabled_plugins: buildEnabledPluginsValue(
          selectablePlugins.map((plugin) => plugin.id),
          normalizedSelection,
        ),
      } satisfies LaunchSettingsRequest;
      const materialized = await materializeLaunchRequest(request);

      setPluginOverrideIds(normalizedSelection);
      setPreparedLaunchDraft({
        draftId: materialized.draft_id,
        settingsPath: materialized.settings_path,
        signature: buildLaunchSignature(request),
      });
      setPluginDialogOpen(false);
    } catch (error) {
      setPluginDialogError(
        error instanceof Error
          ? error.message
          : t("launcher.plugin_dialog_apply_failed", "Failed to apply plugin selection"),
      );
    } finally {
      setIsApplyingPlugins(false);
    }
  }, [
    materializeLaunchRequest,
    pluginDialogSelection,
    projectPath,
    providerProfiles,
    selectedModel,
    selectedPermissionMode,
    selectedProviderId,
    selectablePlugins,
    t,
  ]);

  const handleSavePluginsToProject = useCallback(async () => {
    setPluginDialogError(null);
    setPluginDialogNotice(null);
    setIsSavingPlugins(true);

    try {
      const normalizedSelection = normalizePluginIds(pluginDialogSelection);
      await configWrite.mutateAsync({
        kind: ConfigFileKind.Settings,
        scope: ConfigScope.Project,
        projectPath,
        key: "enabledPlugins",
        value: buildEnabledPluginsValue(
          selectablePlugins.map((plugin) => plugin.id),
          normalizedSelection,
        ),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["config", "merged", projectPath] }),
        queryClient.invalidateQueries({ queryKey: ["config"] }),
      ]);

      setPluginOverrideIds(null);
      setPreparedLaunchDraft(null);
      setPluginDialogNotice(t("launcher.plugin_dialog_saved", "Saved to project settings"));
    } catch (error) {
      setPluginDialogError(
        error instanceof Error
          ? error.message
          : t("launcher.plugin_dialog_save_failed", "Failed to save plugin selection"),
      );
    } finally {
      setIsSavingPlugins(false);
    }
  }, [configWrite, pluginDialogSelection, projectPath, queryClient, selectablePlugins, t]);

  const projectOptions = useMemo(() => {
    const items = projects.map((project) => ({
      value: project.id,
      label: getProjectDisplayName(project.path),
    }));
    if (items.length === 0 || currentProject) {
      return items;
    }
    return [
      {
        value: "_current",
        label: displayName,
      },
      ...items,
    ];
  }, [currentProject, displayName, projects]);

  const modelOptions = useMemo(() => {
    const globalConfigLabel = t("launcher.current_config_short", "Global Config");
    return [
      {
        value: "_default",
        label: globalConfigLabel,
        triggerLabel: defaultModelLabel,
      },
      ...MODEL_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ];
  }, [defaultModelLabel, t]);

  const permissionOptions = useMemo(() => {
    const globalConfigLabel = t("launcher.current_config_short", "Global Config");
    return [
      {
        value: "_default",
        label: globalConfigLabel,
        triggerLabel: defaultPermissionLabel,
      },
      ...permissionOptionsBase.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ];
  }, [defaultPermissionLabel, permissionOptionsBase, t]);

  const providerOptions = useMemo(() => {
    const globalConfigLabel = t("launcher.current_config_short", "Global Config");
    const providerNameCounts = providerProfiles.reduce<Record<string, number>>((acc, provider) => {
      const normalizedName = provider.name.trim();
      if (!normalizedName) return acc;
      acc[normalizedName] = (acc[normalizedName] ?? 0) + 1;
      return acc;
    }, {});

    return [
      {
        value: "_default",
        label: globalConfigLabel,
        triggerLabel: defaultProviderLabel,
      },
      ...providerProfiles.map((provider) => ({
        value: provider.id,
        label:
          (providerNameCounts[provider.name.trim()] ?? 0) > 1
            ? `${provider.name} (${provider.id})`
            : provider.name,
      })),
    ];
  }, [defaultProviderLabel, providerProfiles, t]);
  const selectedPluginsSummary = useMemo(() => {
    if (selectablePlugins.length === 0) {
      return t("launcher.plugin_dialog_empty", "No installed plugins");
    }
    return t("launcher.plugin_selected_count", "{{count}} selected", {
      count: effectivePluginIds.length,
    });
  }, [effectivePluginIds.length, selectablePlugins.length, t]);

  const isLaunching = terminalLauncher.isPending;

  return (
    <>
      <section
        className={cn(
          "relative flex h-full min-h-0 flex-col bg-background text-foreground",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(204,120,92,0.08),transparent_30%)]" />
          <div className="absolute left-[12%] top-[18%] h-[280px] w-[280px] rounded-full bg-primary/6 blur-[120px]" />
          <div className="absolute right-[10%] bottom-[14%] h-[260px] w-[260px] rounded-full bg-secondary/85 blur-[130px]" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-6 pt-8 md:px-10 md:pb-8 md:pt-10">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="flex max-w-[560px] flex-col items-center text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
                {t("projects.quick_launch")}
              </p>

              <Select value={currentProjectId} onValueChange={handleProjectChange}>
                <SelectTrigger
                  className="mt-3 h-auto w-auto max-w-full border-none bg-transparent p-0 font-sans text-[36px] font-medium tracking-[-0.04em] text-primary/85 shadow-none focus-visible:ring-0 [&_svg]:text-primary/45 md:text-[52px]"
                >
                  <SelectValue placeholder={displayName} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="center"
                  className="border-border/60 bg-popover text-popover-foreground shadow-xl"
                >
                  {projectOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-foreground focus:bg-secondary focus:text-foreground"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="mt-4 max-w-full truncate text-sm text-muted-foreground">
                {formatPath(projectPath)}
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl">
            <div className="relative overflow-hidden rounded-[32px] border border-border/25 bg-background/72 p-3 shadow-[0_20px_48px_rgba(24,24,24,0.04)] backdrop-blur-md">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.12))]" />
              <textarea
                value={launchPrompt}
                onChange={(event) => setLaunchPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder={t("launcher.composer_placeholder", "Ask anything about this project, add context, or describe what to build")}
                rows={5}
                className="relative min-h-[128px] w-full resize-none rounded-[24px] bg-transparent px-4 py-3 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/60"
              />

              <div className="relative mt-2 flex items-center justify-between gap-2 border-t border-border/30 px-2 pb-1 pt-3">
                <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="inline-flex min-w-max items-center gap-x-[15px] whitespace-nowrap">
                    <ToolbarField
                      label={t("launcher.model", "Model")}
                      className="w-auto"
                    >
                      <ToolbarSelect
                        value={selectedModel}
                        onValueChange={(value) => setSelectedModel(value as ModelChoice)}
                        options={modelOptions}
                        className="min-w-0"
                      />
                    </ToolbarField>

                    <ToolbarField
                      label={t("settings.permissions", "Permissions")}
                      className="w-auto"
                    >
                      <ToolbarSelect
                        value={selectedPermissionMode}
                        onValueChange={(value) => setSelectedPermissionMode(value as PermissionChoice)}
                        options={permissionOptions}
                        className="min-w-0"
                      />
                    </ToolbarField>

                    {providerProfiles.length > 0 ? (
                      <ToolbarField
                        label={t("launcher.provider_field_label", "Provider")}
                        className="w-auto"
                      >
                        <ToolbarSelect
                          value={selectedProviderId}
                          onValueChange={setSelectedProviderId}
                          options={providerOptions}
                          className="min-w-0"
                        />
                      </ToolbarField>
                    ) : null}

                    <ToolbarField
                      label={t("launcher.plugins", "Plugins")}
                      className="w-auto"
                    >
                      <button
                        type="button"
                        onClick={openPluginDialog}
                        className="flex h-7 min-w-0 w-full items-center gap-1 bg-transparent text-left text-[13px] font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                      >
                        <Blocks className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                        <span className="truncate">{selectedPluginsSummary}</span>
                      </button>
                    </ToolbarField>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end">
                  <Button
                    size="icon"
                    onClick={() => void handleLaunch()}
                    disabled={isLaunching}
                    className="h-10 w-10 shrink-0 rounded-[18px] bg-primary text-primary-foreground hover:bg-primary/90"
                    title={t("launcher.launch", "Launch")}
                  >
                    {isLaunching ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {launchError ? (
              <p className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {launchError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <PluginSelectionDialog
        open={pluginDialogOpen}
        onOpenChange={setPluginDialogOpen}
        plugins={selectablePlugins}
        selectedPluginIds={pluginDialogSelection}
        onTogglePlugin={togglePluginSelection}
        onSaveToProject={() => void handleSavePluginsToProject()}
        onApply={() => void handleApplyPlugins()}
        isLoading={pluginRuntimeStateQuery.isLoading || pluginScanQuery.isLoading}
        isSaving={isSavingPlugins || configWrite.isPending}
        isApplying={isApplyingPlugins}
        error={pluginDialogError}
        notice={pluginDialogNotice}
        t={(key, fallback, options) => t(key, { defaultValue: fallback, ...options })}
      />
    </>
  );
}
