import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useMutation } from "@tanstack/react-query";
import {
  PlusIcon,
  RocketIcon,
  ReloadIcon,
  UploadIcon,
  DownloadIcon,
  MagnifyingGlassIcon,
  CodeIcon,
  DotsHorizontalIcon,
  Cross2Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useAtom } from "jotai";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
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
import { cn } from "../../lib/utils";
import { LoadingState } from "../../components/config";
import { StatusBadge } from "../../components/Settings";
import { useConfigMerged } from "../../config/hooks/useConfig";
import { useTemplateDelete, useTemplateGet, useTemplateList, useTemplateSave } from "../../config/templates/hooks";
import type { ConfigTemplate } from "../../config/templates/types";
import { useInvokeQuery, useTerminalLauncher } from "../../hooks";
import { profileAtom } from "@/store";
import { getPreferredTerminalApp } from "@/lib/terminalPreference";
import { resolveLaunchDraftRetentionSeconds } from "@/lib/launchDraftRetention";
import { getUiPreference, setUiPreference } from "../../lib/uiPreferences";
import { ExtensionsView } from "../Extensions/ExtensionsView";
import { SettingsView } from "../Settings/SettingsView";
import { LlmProviderView } from "../Settings/LlmProviderView";
import { EnvSettingsView } from "../Settings/EnvSettingsView";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";
import {
  resolveProviderNameFromProfiles,
  type LlmProfilesState,
} from "../../lib/llmProfiles";
import type { PluginScanResult } from "../../types";

type MergeMode = "merge" | "fill" | "replace";
type PreviewMode = "form" | "json";
type SettingsTab = "general" | "provider" | "plugins" | "env";
type PermissionMode =
  | "bypassPermissions"
  | "acceptEdits"
  | "default";
type ModelType = "opus" | "sonnet" | "haiku";

interface LaunchSettingsRequest {
  project_path?: string;
  template_id?: string;
  template_merge_mode?: MergeMode;
  template_payload?: Record<string, unknown>;
  provider_name?: string;
  model?: string;
  env_overrides?: Record<string, string>;
  enabled_plugins?: string[];
}

interface LaunchDraftResponse {
  settings: Record<string, unknown>;
}

interface MaterializedLaunchDraftResponse {
  draft_id: string;
  project_path: string;
  settings_path: string;
}

interface DraftBaseline {
  settingsSignature: string;
}

interface PluginRuntimeState {
  id: string;
  scope: "user" | "project" | "local" | "managed";
  enabled: boolean;
  projectPath?: string | null;
}

interface SessionLauncherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  projectName?: string;
}

function usePrepareLaunchDraft() {
  return useMutation<LaunchDraftResponse, string, LaunchSettingsRequest>({
    mutationFn: (request) => invoke<LaunchDraftResponse>("prepare_launch_snapshot", { request }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index);
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === "string" ? item : String(item);
  }
  return result;
}

function normalizeEnabledPluginsMap(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const result: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    result[key] = raw === true;
  }
  return result;
}

function collectPluginAliasKeys(enabledPlugins: Record<string, boolean>, pluginId: string): string[] {
  const shortId = pluginId.split("@")[0];
  const prefixed = `${shortId}@`;
  const keys = new Set<string>([pluginId, shortId]);

  for (const key of Object.keys(enabledPlugins)) {
    if (key === pluginId || key === shortId || key.startsWith(prefixed)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function countEnabledPlugins(enabledPlugins: Record<string, boolean>): number {
  const logical = new Map<string, boolean>();

  for (const [pluginId, enabled] of Object.entries(enabledPlugins)) {
    const key = pluginId.split("@")[0];
    const previous = logical.get(key);

    if (previous === false) continue;
    if (enabled === false) {
      logical.set(key, false);
      continue;
    }
    if (previous === undefined) {
      logical.set(key, true);
    }
  }

  return Array.from(logical.values()).reduce<number>(
    (count, enabled) => count + (enabled ? 1 : 0),
    0,
  );
}

const VALID_PERMISSION_MODES = new Set<PermissionMode>([
  "bypassPermissions",
  "acceptEdits",
  "default",
]);

function normalizePermissionMode(value: unknown): PermissionMode {
  if (value === "normal") return "default";
  if (value === "allowEdits") return "acceptEdits";
  if (
    typeof value === "string"
    && (value === "plan" || value === "delegate" || value === "dontAsk")
  ) {
    return "default";
  }
  if (typeof value === "string" && VALID_PERMISSION_MODES.has(value as PermissionMode)) {
    return value as PermissionMode;
  }
  return "default";
}

function normalizePermissionsObject(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const permissions = { ...value };
  const mode = permissions.defaultMode ?? permissions.default_mode;
  if (mode !== undefined) {
    permissions.defaultMode = normalizePermissionMode(mode);
  }
  delete permissions.default_mode;
  return permissions;
}

function sanitizeLaunchSettings(value: unknown): Record<string, unknown> {
  const settings = isRecord(value) ? cloneJson(value) : {};
  delete settings._claudecodeimpact_disabled_env;
  delete settings._claudecodeimpact_custom_env_keys;
  const normalizedPermissions = normalizePermissionsObject(settings.permissions);
  if (normalizedPermissions) {
    settings.permissions = normalizedPermissions;
  }
  return settings;
}

function buildTemplateId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const normalized = slug.length > 0 ? slug : "template";
  return `custom-${normalized}-${Date.now().toString(36)}`;
}

function splitTemplateSettings(settings: Record<string, unknown>) {
  const normalized = sanitizeLaunchSettings(settings);
  const config = cloneJson(normalized);

  const env = normalizeStringMap(config.env);
  const hooks = isRecord(config.hooks)
    ? (cloneJson(config.hooks) as ConfigTemplate["hooks"])
    : null;
  const mcpServers = isRecord(config.mcp_servers)
    ? (cloneJson(config.mcp_servers) as ConfigTemplate["mcp_servers"])
    : null;

  delete config.env;
  delete config.hooks;
  delete config.mcp_servers;

  return {
    config,
    env: Object.keys(env).length > 0 ? env : null,
    hooks: hooks && Object.keys(hooks).length > 0 ? hooks : null,
    mcp_servers: mcpServers && Object.keys(mcpServers).length > 0 ? mcpServers : null,
  };
}

function sanitizeFilename(value: string): string {
  const safe = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
  return safe || "template";
}

function normalizeImportedTemplatePayload(value: unknown): ConfigTemplate | null {
  if (!isRecord(value)) return null;

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;

  const now = Math.floor(Date.now() / 1000);
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const id = rawId.length > 0 && !rawId.startsWith("builtin-")
    ? rawId
    : buildTemplateId(name);

  const tags = Array.isArray(value.tags)
    ? value.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
    : [];

  const config = isRecord(value.config)
    ? (cloneJson(value.config) as Record<string, unknown>)
    : {};
  const normalizedPermissions = normalizePermissionsObject(config.permissions);
  if (normalizedPermissions) {
    config.permissions = normalizedPermissions;
  }

  const env = (() => {
    const map = normalizeStringMap(value.env);
    return Object.keys(map).length > 0 ? map : null;
  })();

  const hooks = isRecord(value.hooks)
    ? (cloneJson(value.hooks) as ConfigTemplate["hooks"])
    : null;

  const mcpServers = isRecord(value.mcp_servers)
    ? (cloneJson(value.mcp_servers) as ConfigTemplate["mcp_servers"])
    : null;

  return {
    id,
    name,
    description: typeof value.description === "string" ? value.description : "",
    author: typeof value.author === "string" && value.author.trim().length > 0
      ? value.author.trim()
      : "Imported",
    tags,
    created_at: typeof value.created_at === "number" ? value.created_at : now,
    updated_at: now,
    is_builtin: false,
    config,
    env,
    hooks: hooks && Object.keys(hooks).length > 0 ? hooks : null,
    mcp_servers: mcpServers && Object.keys(mcpServers).length > 0 ? mcpServers : null,
  };
}

function extractImportedTemplateItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value.templates)) {
    return value.templates;
  }
  return [value];
}

const SETTINGS_TABS: SettingsTab[] = ["general", "provider", "plugins", "env"];
const LAUNCHER_TEMPLATE_PREF_KEY = "claudecodeimpact:launcher:lastTemplateByProject";

const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

function getRememberedTemplateMap(): Record<string, string> {
  const raw = getUiPreference<unknown>(LAUNCHER_TEMPLATE_PREF_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [path, templateId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof templateId === "string" && templateId.length > 0) {
      result[path] = templateId;
    }
  }
  return result;
}

function getRememberedTemplateId(projectPath: string): string {
  const remembered = getRememberedTemplateMap();
  return remembered[projectPath] ?? "_none";
}

function setRememberedTemplateId(projectPath: string, templateId: string) {
  const remembered = getRememberedTemplateMap();
  remembered[projectPath] = templateId;
  setUiPreference(LAUNCHER_TEMPLATE_PREF_KEY, remembered);
}

export function SessionLauncherDialog({
  open,
  onOpenChange,
  projectPath,
  projectName,
}: SessionLauncherDialogProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { data: templates = [], isLoading: templatesLoading } = useTemplateList();
  const templateSave = useTemplateSave();
  const templateDelete = useTemplateDelete();

  const [profile] = useAtom(profileAtom);
  const preferredTerminalApp = getPreferredTerminalApp(profile);
  const launchDraftRetentionSeconds = useMemo(
    () => resolveLaunchDraftRetentionSeconds(profile),
    [profile],
  );

  const prepareLaunchDraft = usePrepareLaunchDraft();
  const terminalLauncher = useTerminalLauncher();

  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => getRememberedTemplateId(projectPath),
  );
  const [mergeMode, setMergeMode] = useState<MergeMode>("merge");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("form");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<Record<string, boolean>>({});

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTagsInput, setTemplateTagsInput] = useState("");

  const [draftWorkspaceId, setDraftWorkspaceId] = useState<string | null>(null);
  const [draftProjectPath, setDraftProjectPath] = useState<string | null>(null);
  const [draftSettingsPath, setDraftSettingsPath] = useState<string | null>(null);
  const [draftSettingsSnapshot, setDraftSettingsSnapshot] = useState<Record<string, unknown>>({});

  const [launchError, setLaunchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [templateActionError, setTemplateActionError] = useState<string | null>(null);
  const [templateActionNotice, setTemplateActionNotice] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [quickUpdating, setQuickUpdating] = useState<"model" | "permission" | null>(null);
  const [templateApplying, setTemplateApplying] = useState(false);

  const seedRunRef = useRef(0);
  const draftWorkspaceIdRef = useRef<string | null>(null);
  const preserveDraftOnCloseRef = useRef(false);

  const [draftBaseline, setDraftBaseline] = useState<DraftBaseline>({
    settingsSignature: "{}",
  });

  const selectedTemplateQueryId = selectedTemplateId === "_none" ? null : selectedTemplateId;
  const { data: selectedTemplate, isLoading: selectedTemplateLoading } =
    useTemplateGet(selectedTemplateQueryId);
  const {
    data: draftMergedConfig,
    isLoading: draftConfigLoading,
    refetch: refetchDraftMerged,
  } = useConfigMerged(draftProjectPath ?? undefined);

  const { data: runtimePluginStates = [] } = useInvokeQuery<PluginRuntimeState[]>(
    ["pluginRuntimeState"],
    "list_plugin_runtime_state",
  );
  const { data: pluginScanResult } = useInvokeQuery<PluginScanResult>(
    ["pluginScan"],
    "scan_plugins",
  );
  const { data: llmProfilesState } = useInvokeQuery<LlmProfilesState>(
    ["llmProfilesState"],
    "get_llm_profiles_state",
  );

  const providerProfiles = llmProfilesState?.profiles ?? [];

  const sortedTemplates = useMemo(() => {
    const list = [...templates].sort((a, b) => {
      if (a.is_builtin !== b.is_builtin) return a.is_builtin ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    if (!search.trim()) return list;

    const query = search.toLowerCase();
    return list.filter((tpl) => {
      if (tpl.name.toLowerCase().includes(query)) return true;
      if (tpl.description.toLowerCase().includes(query)) return true;
      return tpl.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  }, [templates, search]);

  const displayName =
    projectName || projectPath.split("/").filter(Boolean).pop() || projectPath;

  const currentDraftSettings = useMemo(() => {
    if (templateApplying && Object.keys(draftSettingsSnapshot).length > 0) {
      return sanitizeLaunchSettings(draftSettingsSnapshot);
    }
    if (draftProjectPath && draftMergedConfig?.effective) {
      return sanitizeLaunchSettings(draftMergedConfig.effective);
    }
    return sanitizeLaunchSettings(draftSettingsSnapshot);
  }, [draftMergedConfig?.effective, draftProjectPath, draftSettingsSnapshot, templateApplying]);

  const currentDraftSignature = useMemo(
    () => JSON.stringify(currentDraftSettings),
    [currentDraftSettings],
  );

  const isDraftDirty = useMemo(
    () => currentDraftSignature !== draftBaseline.settingsSignature,
    [currentDraftSignature, draftBaseline.settingsSignature],
  );

  const canOverwrite = Boolean(
    selectedTemplate
    && selectedTemplateId !== "_none"
    && !selectedTemplate.is_builtin,
  );

  const draftModel = useMemo<ModelType>(() => {
    const value = currentDraftSettings.model;
    if (value === "opus" || value === "sonnet" || value === "haiku") {
      return value;
    }
    return "sonnet";
  }, [currentDraftSettings.model]);

  const draftPermissionMode = useMemo<PermissionMode>(() => {
    const permissions = isRecord(currentDraftSettings.permissions)
      ? currentDraftSettings.permissions
      : {};
    return normalizePermissionMode(permissions.defaultMode ?? permissions.default_mode);
  }, [currentDraftSettings.permissions]);

  const envCount = useMemo(() => {
    const env = normalizeStringMap(currentDraftSettings.env);
    return Object.keys(env).length;
  }, [currentDraftSettings.env]);

  const draftEnabledPluginsMap = useMemo(
    () => normalizeEnabledPluginsMap(currentDraftSettings.enabledPlugins),
    [currentDraftSettings.enabledPlugins],
  );

  const providerLabel = useMemo(
    () => {
      const resolved = resolveProviderNameFromProfiles(currentDraftSettings, providerProfiles);
      if (resolved) return resolved;

      const cci = currentDraftSettings.claudecodeimpact;
      if (
        typeof cci === "object"
        && cci !== null
        && !Array.isArray(cci)
        && typeof (cci as Record<string, unknown>).activeProvider === "string"
      ) {
        const activeProvider = String((cci as Record<string, unknown>).activeProvider).trim();
        if (activeProvider) return activeProvider;
      }

      return t("launcher.provider_default", "Use config default");
    },
    [currentDraftSettings, providerProfiles, t],
  );

  const enabledPluginsCount = useMemo(() => {
    return countEnabledPlugins(draftEnabledPluginsMap);
  }, [draftEnabledPluginsMap]);

  const installedPluginsCount = useMemo(() => {
    const runtimeInstalled = new Set(runtimePluginStates.map((item) => item.id)).size;
    if (runtimeInstalled > 0) {
      return runtimeInstalled;
    }
    if (!pluginScanResult) {
      return 0;
    }
    return pluginScanResult.plugins.filter((item) => item.isInstalled).length;
  }, [pluginScanResult, runtimePluginStates]);

  const handleDraftSettingsMutated = useCallback(async (raw: Record<string, unknown>) => {
    setDraftSettingsSnapshot(sanitizeLaunchSettings(raw));
    await refetchDraftMerged();
  }, [refetchDraftMerged]);

  const handleLauncherPluginToggle = useCallback(async (pluginId: string, enabled: boolean) => {
    const aliasKeys = collectPluginAliasKeys(draftEnabledPluginsMap, pluginId);

    if (draftSettingsPath) {
      for (const key of aliasKeys) {
        await invoke<void>("toggle_plugin", {
          pluginId: key,
          enabled,
          path: draftSettingsPath,
        });
      }

      const refreshed = await invoke<{ raw: Record<string, unknown> | null }>("get_settings", {
        path: draftSettingsPath,
      });

      if (refreshed.raw && isRecord(refreshed.raw)) {
        await handleDraftSettingsMutated(refreshed.raw);
      } else {
        await refetchDraftMerged();
      }
      return;
    }

    setDraftSettingsSnapshot((prev) => {
      const next = sanitizeLaunchSettings(prev);
      const enabledPlugins = normalizeEnabledPluginsMap(next.enabledPlugins);
      for (const key of aliasKeys) {
        enabledPlugins[key] = enabled;
      }
      next.enabledPlugins = enabledPlugins;
      return next;
    });
  }, [draftEnabledPluginsMap, draftSettingsPath, handleDraftSettingsMutated, refetchDraftMerged]);

  const releaseDraftWorkspace = useCallback(async (draftId: string | null | undefined) => {
    if (!draftId) return;
    try {
      await invoke<void>("release_launch_draft", { draft_id: draftId });
    } catch {
      // Avoid blocking UX on best-effort cleanup.
    }
  }, []);

  useEffect(() => {
    draftWorkspaceIdRef.current = draftWorkspaceId;
  }, [draftWorkspaceId]);

  const updateBaselineFromCurrentDraft = useCallback(() => {
    setDraftBaseline({
      settingsSignature: currentDraftSignature,
    });
  }, [currentDraftSignature]);

  const selectTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    setRememberedTemplateId(projectPath, templateId);
    setTemplateActionError(null);
    setTemplateActionNotice(null);
  }, [projectPath]);

  const toggleTemplateDescription = useCallback((templateId: string) => {
    setExpandedTemplateIds((prev) => ({
      ...prev,
      [templateId]: !prev[templateId],
    }));
  }, []);

  useEffect(() => {
    if (open) return;
    if (!preserveDraftOnCloseRef.current) {
      void releaseDraftWorkspace(draftWorkspaceId);
    }
    preserveDraftOnCloseRef.current = false;
    setAdvancedOpen(false);
    setTemplateEditorOpen(false);
    setDraftWorkspaceId(null);
    setDraftProjectPath(null);
    setDraftSettingsPath(null);
    setDraftSettingsSnapshot({});
    setTemplateActionError(null);
    setTemplateActionNotice(null);
    setTemplateApplying(false);
  }, [draftWorkspaceId, open, releaseDraftWorkspace]);

  useEffect(() => {
    setSelectedTemplateId(getRememberedTemplateId(projectPath));
  }, [projectPath]);

  useEffect(() => {
    if (selectedTemplateId === "_none" || templatesLoading) return;
    const exists = templates.some((template) => template.id === selectedTemplateId);
    if (!exists) {
      selectTemplate("_none");
    }
  }, [selectedTemplateId, selectTemplate, templates, templatesLoading]);

  useEffect(() => {
    if (!open) return;
    setPreviewMode("form");
    setSettingsTab("general");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (selectedTemplateId !== "_none" && selectedTemplateLoading) return;

    setTemplateApplying(true);
    setLaunchError(null);
    setSaveError(null);
    setSaveNotice(null);

    const initialName = selectedTemplateId === "_none"
      ? `${displayName} Template`
      : (selectedTemplate?.name ?? "");
    const initialDescription = selectedTemplateId === "_none"
      ? ""
      : (selectedTemplate?.description ?? "");
    const initialTags = selectedTemplateId === "_none"
      ? ""
      : (selectedTemplate?.tags ?? []).join(", ");

    setTemplateName(initialName);
    setTemplateDescription(initialDescription);
    setTemplateTagsInput(initialTags);

    const runId = ++seedRunRef.current;
    const previousDraftWorkspaceId = draftWorkspaceIdRef.current;

    const request: LaunchSettingsRequest = {
      project_path: projectPath,
      template_id: selectedTemplateId === "_none" ? undefined : selectedTemplateId,
      template_merge_mode: mergeMode,
    };

    void prepareLaunchDraft.mutateAsync(request)
      .then((draft) => {
        if (seedRunRef.current !== runId) return;

        const seededSettings = sanitizeLaunchSettings(draft.settings);

        setDraftBaseline({
          settingsSignature: JSON.stringify(seededSettings),
        });

        void releaseDraftWorkspace(previousDraftWorkspaceId);
        setDraftWorkspaceId(null);
        setDraftSettingsSnapshot(seededSettings);
        setDraftProjectPath(null);
        setDraftSettingsPath(null);
        setTemplateApplying(false);
      })
      .catch((error) => {
        if (seedRunRef.current !== runId) return;
        setLaunchError(String(error));
        setTemplateApplying(false);
      });
  }, [
    open,
    selectedTemplateId,
    selectedTemplate,
    selectedTemplateLoading,
    displayName,
    releaseDraftWorkspace,
    projectPath,
    mergeMode,
  ]);

  const ensureDraftWorkspace = useCallback(async () => {
    if (draftWorkspaceId && draftProjectPath && draftSettingsPath) {
      return { draftWorkspaceId, draftProjectPath, draftSettingsPath };
    }

    if (templateApplying || prepareLaunchDraft.isPending || selectedTemplateLoading) {
      return null;
    }

    if (Object.keys(currentDraftSettings).length === 0) {
      return null;
    }

    const materialized = await invoke<MaterializedLaunchDraftResponse>("materialize_launch_draft", {
      request: {
        settings: currentDraftSettings,
        draft_id: draftWorkspaceId ?? undefined,
        retention_secs: launchDraftRetentionSeconds,
      },
    });

    setDraftWorkspaceId(materialized.draft_id);
    setDraftProjectPath(materialized.project_path);
    setDraftSettingsPath(materialized.settings_path);
    await refetchDraftMerged();

    return {
      draftWorkspaceId: materialized.draft_id,
      draftProjectPath: materialized.project_path,
      draftSettingsPath: materialized.settings_path,
    };
  }, [
    currentDraftSettings,
    draftWorkspaceId,
    draftProjectPath,
    draftSettingsPath,
    prepareLaunchDraft.isPending,
    refetchDraftMerged,
    selectedTemplateLoading,
    templateApplying,
    launchDraftRetentionSeconds,
  ]);

  useEffect(() => {
    if (!advancedOpen) return;
    if (draftProjectPath && draftSettingsPath) return;
    void ensureDraftWorkspace().catch((error) => {
      setLaunchError(String(error));
    });
  }, [advancedOpen, draftProjectPath, draftSettingsPath, ensureDraftWorkspace]);

  const handleSaveAsNew = useCallback(async () => {
    setSaveError(null);
    setSaveNotice(null);

    const name = templateName.trim();
    if (!name) {
      setSaveError(t("launcher.template_name_required", "Template name is required"));
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const id = buildTemplateId(name);
      const { config, env, hooks, mcp_servers } = splitTemplateSettings(currentDraftSettings);

      const payload: ConfigTemplate = {
        id,
        name,
        description: templateDescription.trim(),
        author: selectedTemplate?.author || "User",
        tags: parseTagsInput(templateTagsInput),
        created_at: now,
        updated_at: now,
        is_builtin: false,
        config,
        env,
        hooks,
        mcp_servers,
      };

      await templateSave.mutateAsync(payload);
      setSaveNotice(t("launcher.save_success_new", "Template saved"));
      setSearch("");
      selectTemplate(id);
      setTemplateEditorOpen(false);
    } catch (error) {
      setSaveError(
        t("launcher.save_failed", "Failed to save template")
        + ": "
        + String(error),
      );
    }
  }, [
    currentDraftSettings,
    selectedTemplate,
    t,
    templateDescription,
    templateName,
    templateSave,
    templateTagsInput,
    selectTemplate,
  ]);

  const handleUpdateTemplate = useCallback(async () => {
    setTemplateActionError(null);
    setTemplateActionNotice(null);
    setSaveError(null);
    setSaveNotice(null);

    if (!selectedTemplate || selectedTemplateId === "_none" || selectedTemplate.is_builtin) {
      setTemplateActionError(
        t("launcher.update_disabled", "Select a custom template to update"),
      );
      return;
    }

    const confirmed = await confirmDialog({
      title: t("launcher.update_template", "Update Template"),
      description: t("launcher.confirm_update_template", "Update current template with current draft settings?"),
      variant: "destructive",
      confirmText: t("launcher.update_template", "Update Template"),
    });
    if (!confirmed) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const { config, env, hooks, mcp_servers } = splitTemplateSettings(currentDraftSettings);

      const payload: ConfigTemplate = {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        author: selectedTemplate.author || "User",
        tags: [...selectedTemplate.tags],
        created_at: selectedTemplate.created_at,
        updated_at: now,
        is_builtin: false,
        config,
        env,
        hooks,
        mcp_servers,
      };

      await templateSave.mutateAsync(payload);
      setTemplateActionNotice(t("launcher.update_template_success", "Template updated"));
      updateBaselineFromCurrentDraft();
    } catch (error) {
      setTemplateActionError(
        t("launcher.update_template_failed", "Failed to update template")
        + ": "
        + String(error),
      );
    }
  }, [
    confirmDialog,
    currentDraftSettings,
    selectedTemplate,
    selectedTemplateId,
    t,
    templateSave,
    updateBaselineFromCurrentDraft,
  ]);

  const handleDeleteTemplate = useCallback(async () => {
    setTemplateActionError(null);
    setTemplateActionNotice(null);

    if (!selectedTemplate || selectedTemplateId === "_none" || selectedTemplate.is_builtin) {
      setTemplateActionError(
        t("launcher.template_delete_disabled", "Select a custom template to delete"),
      );
      return;
    }

    const confirmed = await confirmDialog({
      title: t("launcher.template_delete", "Delete Template"),
      description: t("templates.confirm_delete", "Delete this template?"),
      variant: "destructive",
      confirmText: t("common.delete", "Delete"),
    });
    if (!confirmed) return;

    try {
      await templateDelete.mutateAsync(selectedTemplate.id);
      selectTemplate("_none");
      setTemplateActionNotice(t("launcher.template_delete_success", "Template deleted"));
    } catch (error) {
      setTemplateActionError(
        t("launcher.template_delete_failed", "Failed to delete template")
        + ": "
        + String(error),
      );
    }
  }, [selectedTemplate, selectedTemplateId, selectTemplate, t, templateDelete, confirmDialog]);

  const handleModelChange = useCallback(async (value: string) => {
    setQuickUpdating("model");
    setLaunchError(null);
    try {
      if (draftSettingsPath) {
        await invoke<void>("update_settings_field", {
          field: "model",
          value,
          path: draftSettingsPath,
        });
        await refetchDraftMerged();
      } else {
        setDraftSettingsSnapshot((prev) => ({
          ...sanitizeLaunchSettings(prev),
          model: value,
        }));
      }
    } catch (error) {
      setLaunchError(String(error));
    } finally {
      setQuickUpdating(null);
    }
  }, [draftSettingsPath, refetchDraftMerged]);

  const handlePermissionModeChange = useCallback(async (value: PermissionMode) => {
    setQuickUpdating("permission");
    setLaunchError(null);
    try {
      if (draftSettingsPath) {
        await invoke<void>("update_settings_permission_field", {
          field: "defaultMode",
          value,
          path: draftSettingsPath,
        });
        await refetchDraftMerged();
      } else {
        setDraftSettingsSnapshot((prev) => {
          const next = sanitizeLaunchSettings(prev);
          const permissions = isRecord(next.permissions)
            ? { ...next.permissions }
            : {};
          permissions.defaultMode = value;
          delete permissions.default_mode;
          next.permissions = permissions;
          return next;
        });
      }
    } catch (error) {
      setLaunchError(String(error));
    } finally {
      setQuickUpdating(null);
    }
  }, [draftSettingsPath, refetchDraftMerged]);

  const handleLaunch = useCallback(async () => {
    setLaunchError(null);

    if (Object.keys(currentDraftSettings).length === 0) {
      setLaunchError(t("launcher.draft_not_ready", "Draft settings are not ready"));
      return;
    }

    try {
      const materialized = await invoke<MaterializedLaunchDraftResponse>("materialize_launch_draft", {
        request: {
          settings: currentDraftSettings,
          draft_id: draftWorkspaceId ?? undefined,
          retention_secs: launchDraftRetentionSeconds,
        },
      });
      setDraftWorkspaceId(materialized.draft_id);
      setDraftProjectPath(materialized.project_path);
      setDraftSettingsPath(materialized.settings_path);
      const command = `claude --settings "${materialized.settings_path}"`;

      await terminalLauncher.mutateAsync({
        cwd: projectPath,
        terminalApp: preferredTerminalApp,
        command,
      });

      preserveDraftOnCloseRef.current = true;
      onOpenChange(false);
    } catch (err) {
      setLaunchError(String(err));
    }
  }, [
    currentDraftSettings,
    draftWorkspaceId,
    onOpenChange,
    preferredTerminalApp,
    projectPath,
    launchDraftRetentionSeconds,
    t,
    terminalLauncher,
  ]);

  const handleImportTemplate = useCallback(async () => {
    setTemplateActionError(null);
    setTemplateActionNotice(null);
    setImportingTemplate(true);

    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected || typeof selected !== "string") return;

      const content = await invoke<string>("read_file", { path: selected });
      const parsed = JSON.parse(content) as unknown;
      const importedItems = extractImportedTemplateItems(parsed)
        .map((item) => normalizeImportedTemplatePayload(item))
        .filter((item): item is ConfigTemplate => item !== null);

      if (importedItems.length === 0) {
        throw new Error(t("launcher.import_template_invalid", "No valid templates found in file"));
      }

      const existingIds = new Set(templates.map((template) => template.id));
      const savedIds: string[] = [];

      for (const item of importedItems) {
        let payload = item;
        if (existingIds.has(payload.id)) {
          payload = {
            ...payload,
            id: buildTemplateId(payload.name),
            updated_at: Math.floor(Date.now() / 1000),
          };
        }
        existingIds.add(payload.id);
        await templateSave.mutateAsync(payload);
        savedIds.push(payload.id);
      }

      if (savedIds.length > 0) {
        setSearch("");
        selectTemplate(savedIds[0]);
      }

      const notice = savedIds.length === 1
        ? t("launcher.import_template_success_one", "Template imported")
        : t("launcher.import_template_success_many", {
          count: savedIds.length,
          defaultValue: `Imported ${savedIds.length} templates`,
        });
      setTemplateActionNotice(notice);
    } catch (error) {
      setTemplateActionError(
        t("launcher.import_template_failed", "Failed to import template")
        + ": "
        + String(error),
      );
    } finally {
      setImportingTemplate(false);
    }
  }, [selectTemplate, t, templateSave, templates]);

  const handleExportTemplate = useCallback(async () => {
    setTemplateActionError(null);
    setTemplateActionNotice(null);

    if (selectedTemplateId === "_none") {
      setTemplateActionError(
        t("launcher.export_template_select_first", "Select a template to export"),
      );
      return;
    }

    setExportingTemplate(true);
    try {
      const template = selectedTemplate && selectedTemplate.id === selectedTemplateId
        ? selectedTemplate
        : await invoke<ConfigTemplate>("template_get", { id: selectedTemplateId });

      const exportPath = await saveDialog({
        defaultPath: `${sanitizeFilename(template.name)}.template.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!exportPath) return;

      await invoke<void>("export_file", {
        path: exportPath,
        content: JSON.stringify(template, null, 2),
      });

      setTemplateActionNotice(t("launcher.export_template_success", "Template exported"));
    } catch (error) {
      setTemplateActionError(
        t("launcher.export_template_failed", "Failed to export template")
        + ": "
        + String(error),
      );
    } finally {
      setExportingTemplate(false);
    }
  }, [selectedTemplate, selectedTemplateId, t]);

  const openAdvancedTab = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setAdvancedOpen(true);
    void ensureDraftWorkspace().catch((error) => {
      setLaunchError(String(error));
    });
  };

  const tabLabel = (tab: SettingsTab) => {
    if (tab === "general") return t("settings.general", "General");
    if (tab === "provider") return t("features.basic-llm", "Provider");
    if (tab === "plugins") return t("features.extensions", "Plugins");
    return t("features.basic-env", "Environment");
  };

  const renderSettingsPanel = () => {
    const hasSnapshot = Object.keys(draftSettingsSnapshot).length > 0;
    const shouldBlockLoading = !hasSnapshot
      && (templateApplying || prepareLaunchDraft.isPending || selectedTemplateLoading || draftConfigLoading);
    if (!draftProjectPath || shouldBlockLoading) {
      return <LoadingState message={t("launcher.draft_loading", "Preparing draft settings...")} />;
    }

    if (settingsTab === "general") {
      return <SettingsView embedded settingsPath={draftProjectPath} />;
    }

    if (settingsTab === "provider") {
      return <LlmProviderView embedded settingsPath={draftProjectPath} />;
    }

    if (settingsTab === "plugins") {
      return (
        <ExtensionsView
          embedded
          settingsPath={draftSettingsPath ?? undefined}
          projectPath={projectPath}
          onSettingsMutated={handleDraftSettingsMutated}
          enabledPluginsOverride={draftEnabledPluginsMap}
          onToggleOverride={handleLauncherPluginToggle}
        />
      );
    }

    return <EnvSettingsView embedded settingsPath={draftProjectPath} />;
  };

  const isLaunching = terminalLauncher.isPending;
  const isPreparingDraft = templateApplying || prepareLaunchDraft.isPending || selectedTemplateLoading;
  const hasDraftSnapshot = Object.keys(draftSettingsSnapshot).length > 0;
  const showBlockingDraftLoading = !hasDraftSnapshot && (isPreparingDraft || draftConfigLoading);
  const showDraftRefreshingOverlay = hasDraftSnapshot && isPreparingDraft;

  const saveDisabled = templateSave.isPending || !hasDraftSnapshot;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[96vw] !max-w-[1320px] h-[88vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border/40">
            <DialogTitle className="font-serif flex items-center gap-2">
              <RocketIcon className="w-4 h-4 text-primary" />
              {t("launcher.title", "Launch Session")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("launcher.subtitle", "Select a template and launch Claude with an ephemeral settings snapshot")}
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
            <section className="p-4 border-b md:border-b-0 md:border-r border-border/30 flex flex-col min-h-0 gap-3">
              <div className="rounded-xl border border-border/50 bg-secondary/30 px-3.5 py-3">
                <p className="text-xs text-muted-foreground mb-1">{t("launcher.project", "Project")}</p>
                <p className="text-sm font-mono text-foreground truncate" title={projectPath}>{displayName}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5" title={projectPath}>{projectPath}</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("launcher.template", "Apply Template")}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-9 w-9 rounded-full p-0 shadow-sm hover:shadow-md"
                    onClick={() => void handleImportTemplate()}
                    disabled={importingTemplate || templateSave.isPending}
                    aria-label={t("common.import", "Import")}
                    title={t("common.import", "Import")}
                  >
                    {importingTemplate
                      ? <ReloadIcon className="w-[18px] h-[18px] animate-spin" />
                      : <UploadIcon className="w-[18px] h-[18px]" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 rounded-full p-0 border-primary/35 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                    onClick={() => void handleExportTemplate()}
                    disabled={exportingTemplate || selectedTemplateId === "_none"}
                    aria-label={t("common.export", "Export")}
                    title={t("common.export", "Export")}
                  >
                    {exportingTemplate
                      ? <ReloadIcon className="w-[18px] h-[18px] animate-spin" />
                      : <DownloadIcon className="w-[18px] h-[18px]" />}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("launcher.template_search_placeholder", "Search templates...")}
                  className="w-full h-9 rounded-xl border border-border/50 bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {templateActionNotice && (
                <p className="text-xs text-emerald-600 px-1">{templateActionNotice}</p>
              )}
              {templateActionError && (
                <p className="text-xs text-destructive px-1">{templateActionError}</p>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                <button
                  onClick={() => selectTemplate("_none")}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selectedTemplateId === "_none"
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border/60 hover:border-border bg-card/70",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    {t("launcher.template_none", "None")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("launcher.template_use_default", "Use current project settings")}
                  </p>
                </button>

                {sortedTemplates.map((template) => {
                  const active = selectedTemplateId === template.id;
                  const descriptionExpanded = Boolean(expandedTemplateIds[template.id]);
                  return (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border/60 hover:border-border bg-card/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                        {template.is_builtin && (
                          <StatusBadge variant="muted">{t("templates.builtin_badge", "Built-in")}</StatusBadge>
                        )}
                      </div>
                      {template.description && (
                        <div className="mt-1">
                          <p
                            className={cn(
                              "text-xs text-muted-foreground",
                              descriptionExpanded
                                ? "whitespace-pre-wrap break-words"
                                : "line-clamp-2",
                            )}
                          >
                            {template.description}
                          </p>
                          <button
                            type="button"
                            className="mt-1 text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleTemplateDescription(template.id);
                            }}
                          >
                            {descriptionExpanded
                              ? t("common.collapse", "Collapse")
                              : t("common.expand", "Expand")}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {template.model && <StatusBadge variant="active">{template.model}</StatusBadge>}
                        {(template.provider_name || (active ? providerLabel : null)) && (
                          <StatusBadge variant="blue">
                            {template.provider_name || providerLabel}
                          </StatusBadge>
                        )}
                        {template.env_count > 0 && (
                          <StatusBadge variant="warning">ENV {template.env_count}</StatusBadge>
                        )}
                        {template.mcp_count > 0 && (
                          <StatusBadge variant="purple">MCP {template.mcp_count}</StatusBadge>
                        )}
                      </div>
                    </button>
                  );
                })}

                {!templatesLoading && sortedTemplates.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-2">
                    {t("launcher.template_empty", "No templates found")}
                  </p>
                )}
              </div>
            </section>

            <section className="p-4 flex flex-col min-h-0 gap-3 bg-background/40 relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t("launcher.preview_current", "Current settings.json")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("launcher.preview_template_desc", "Template merged into project settings for this launch")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={mergeMode}
                    onValueChange={(value: MergeMode) => setMergeMode(value)}
                  >
                    <SelectTrigger className="w-[150px] h-8 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">{t("launcher.merge_merge", "Merge")}</SelectItem>
                      <SelectItem value="fill">{t("launcher.merge_fill", "Fill Missing")}</SelectItem>
                      <SelectItem value="replace">{t("launcher.merge_replace", "Replace")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("form")}
                      className={cn(
                        "h-7 px-2.5 text-xs rounded-md transition-colors",
                        previewMode === "form"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      )}
                    >
                      {t("launcher.preview_form", "Form")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("json")}
                      className={cn(
                        "h-7 px-2.5 text-xs rounded-md transition-colors inline-flex items-center gap-1",
                        previewMode === "json"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      )}
                    >
                      <CodeIcon className="w-3.5 h-3.5" />
                      {t("launcher.preview_json", "Raw JSON")}
                    </button>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg">
                        <DotsHorizontalIcon className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTemplateEditorOpen(true)}>
                        <PlusIcon className="w-3.5 h-3.5 mr-2" />
                        {t("launcher.save_as_template", "Save as Template")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleUpdateTemplate()}
                        disabled={templateSave.isPending || !canOverwrite}
                        title={!canOverwrite ? t("launcher.update_disabled", "Select a custom template to update") : undefined}
                      >
                        <ReloadIcon className="w-3.5 h-3.5 mr-2" />
                        {t("launcher.update_template", "Update Template")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDeleteTemplate()}
                        disabled={
                          templateDelete.isPending
                          || selectedTemplateId === "_none"
                          || !selectedTemplate
                          || selectedTemplate.is_builtin
                        }
                        title={
                          selectedTemplateId === "_none" || !selectedTemplate || selectedTemplate.is_builtin
                            ? t("launcher.template_delete_disabled", "Select a custom template to delete")
                            : undefined
                        }
                      >
                        {templateDelete.isPending
                          ? <ReloadIcon className="w-3.5 h-3.5 mr-2 animate-spin" />
                          : <TrashIcon className="w-3.5 h-3.5 mr-2" />}
                        {t("launcher.template_delete", "Delete Template")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openAdvancedTab("plugins")}
                      >
                        <CodeIcon className="w-3.5 h-3.5 mr-2" />
                        {t("launcher.advanced_settings", "Advanced Settings")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="relative flex-1 min-h-0 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                {showBlockingDraftLoading ? (
                  <LoadingState message={t("launcher.draft_loading", "Preparing draft settings...")} />
                ) : previewMode === "json" ? (
                  <pre className="text-xs leading-5 font-mono bg-secondary/40 border border-border/40 rounded-xl p-3 overflow-auto min-h-full">
                    {JSON.stringify(currentDraftSettings, null, 2)}
                  </pre>
                ) : (
                  <div className="space-y-3 pb-2">
                    <div className="rounded-xl border border-border/50 bg-card/70 overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-border/40">
                        <p className="text-sm font-semibold text-foreground">
                          {t("launcher.quick_general", "General")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("launcher.quick_general_desc", "Core launch settings")}
                        </p>
                      </div>

                      <div className="divide-y divide-border/40">
                        <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("settings.default_model", "Default Model")}</p>
                            <p className="text-xs text-muted-foreground">{t("settings.default_model_desc", "Model used for conversations")}</p>
                          </div>
                          <Select
                            value={draftModel}
                            onValueChange={(value) => void handleModelChange(value)}
                            disabled={quickUpdating === "model"}
                          >
                            <SelectTrigger className="w-[150px] h-8 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MODEL_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("launcher.provider", "LLM Provider")}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[420px]" title={providerLabel}>{providerLabel}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg"
                            onClick={() => openAdvancedTab("provider")}
                          >
                            {t("common.edit", "Edit")}
                          </Button>
                        </div>

                        <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("settings.permission_mode", "Permission Mode")}</p>
                            <p className="text-xs text-muted-foreground">{t("settings.permission_mode_desc", "How Claude handles tool call approvals")}</p>
                          </div>
                          <Select
                            value={draftPermissionMode}
                            onValueChange={(value: PermissionMode) => void handlePermissionModeChange(value)}
                            disabled={quickUpdating === "permission"}
                          >
                            <SelectTrigger className="w-[150px] h-8 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">{t("settings.normal", "Normal")}</SelectItem>
                              <SelectItem value="acceptEdits">{t("settings.allow_edits", "Allow Edits")}</SelectItem>
                              <SelectItem value="bypassPermissions">{t("settings.bypass", "Bypass")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("launcher.env_count", "Environment Variables")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("launcher.env_count_desc", "Configured entries")}: {envCount}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg"
                            onClick={() => openAdvancedTab("env")}
                          >
                            {t("common.edit", "Edit")}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-card/70 px-3.5 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("launcher.plugins", "Plugins")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("launcher.plugins_summary", "Enabled {{enabled}} / Installed {{installed}}", {
                            enabled: enabledPluginsCount,
                            installed: installedPluginsCount,
                          })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => openAdvancedTab("plugins")}
                      >
                        {t("common.edit", "Edit")}
                      </Button>
                    </div>

                    {isDraftDirty && (
                      <p className="text-xs text-amber-600 px-1">
                        {t("launcher.draft_dirty", "Unsaved changes")}
                      </p>
                    )}
                  </div>
                )}
                {showDraftRefreshingOverlay && (
                  <div className="absolute inset-0 z-10 bg-background/45 backdrop-blur-[1px] flex items-start justify-end p-3">
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm">
                      <ReloadIcon className="w-3.5 h-3.5 animate-spin" />
                      {t("launcher.template_applying", "Applying...")}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border/40 sm:justify-end">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
                disabled={isLaunching}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={isLaunching || isPreparingDraft || !hasDraftSnapshot}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                {isLaunching ? (
                  <>
                    <ReloadIcon className="w-3.5 h-3.5 animate-spin" />
                    {t("launcher.launching", "Launching...")}
                  </>
                ) : (
                  <>
                    <RocketIcon className="w-3.5 h-3.5" />
                    {t("launcher.launch", "Launch")}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>

          {launchError && (
            <div className="px-5 pb-4">
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {launchError}
              </p>
            </div>
          )}

          {advancedOpen && (
            <div className="absolute inset-0 z-40">
              <div
                className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
                onClick={() => setAdvancedOpen(false)}
              />
              <aside className="absolute right-0 top-0 h-full w-[min(980px,92vw)] border-l border-border bg-background shadow-2xl flex flex-col">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("launcher.advanced_settings", "Advanced Settings")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("launcher.advanced_settings_desc", "Edit full settings, provider, plugins, and environment")}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setAdvancedOpen(false)}
                  >
                    <Cross2Icon className="w-4 h-4" />
                  </Button>
                </div>

                <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5 overflow-x-auto">
                  {SETTINGS_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSettingsTab(tab)}
                      className={cn(
                        "h-8 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                        settingsTab === tab
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      {tabLabel(tab)}
                    </button>
                  ))}
                </div>

                <div className="flex-1 min-h-0 p-3 overflow-hidden">
                  <div className="h-full rounded-xl border border-border/40 bg-background/60 overflow-hidden">
                    {previewMode === "form" ? (
                      renderSettingsPanel()
                    ) : (
                      <pre className="h-full w-full text-xs leading-5 font-mono bg-secondary/40 p-3 overflow-auto">
                        {JSON.stringify(currentDraftSettings, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("launcher.template_editor", "Template Editor")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("launcher.template_editor_desc", "Save current draft settings as a new template")}
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("launcher.template_name", "Template Name")}</label>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t("launcher.template_name_placeholder", "Template name")}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t("launcher.template_description", "Description")}</label>
              <textarea
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder={t("launcher.template_description_placeholder", "Describe this template")}
                rows={3}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t("launcher.template_tags", "Tags")}</label>
              <input
                value={templateTagsInput}
                onChange={(event) => setTemplateTagsInput(event.target.value)}
                placeholder={t("launcher.template_tags_placeholder", "web, frontend, sonnet")}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
              />
            </div>

            {saveNotice && (
              <p className="text-xs text-green-600">{saveNotice}</p>
            )}
            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setTemplateEditorOpen(false)}
                className="rounded-lg"
                disabled={templateSave.isPending}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-lg gap-1.5"
                onClick={() => void handleSaveAsNew()}
                disabled={saveDisabled}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t("launcher.save_as_new", "Save as New")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
