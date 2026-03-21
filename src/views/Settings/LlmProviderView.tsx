import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import {
  EyeOpenIcon,
  EyeNoneIcon,
  PlusIcon,
  Pencil1Icon,
  TrashIcon,
  ReloadIcon,
  PlayIcon,
  DownloadIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { type MergedConfigView } from "../../config/types";
import { useConfigMerged, useConfigWrite, useConfigDeleteKey } from "../../config/hooks/useConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../../components/ui/collapsible";
import {
  LoadingState,
  ConfigPage,
} from "../../components/config";
import {
  ListItemCard,
  StatusBadge,
  ActionToolbar,
  SettingsEmptyState,
} from "../../components/Settings";
import { cn } from "../../lib/utils";
import { getSettingsFileKindForScope } from "../../config/utils";
import { useSettingsScope } from "../../hooks";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  normalizeProviderBaseUrl,
  type LlmProfilesState,
  type ProviderProfile,
} from "../../lib/llmProfiles";
import { getUiPreference, setUiPreference } from "@/lib/uiPreferences";

type ProviderViewMode = "list" | "card";
const LEGACY_PROFILE_KEYS = ["claudecodeimpact_llm_profiles", "lovcode_llm_providers"] as const;
const ANTHROPIC_MODEL_ENV_FIELDS = [
  { envKey: "ANTHROPIC_DEFAULT_OPUS_MODEL", profileKey: "defaultOpusModel" },
  { envKey: "ANTHROPIC_DEFAULT_SONNET_MODEL", profileKey: "defaultSonnetModel" },
  { envKey: "ANTHROPIC_DEFAULT_HAIKU_MODEL", profileKey: "defaultHaikuModel" },
  { envKey: "ANTHROPIC_MODEL", profileKey: "model" },
  { envKey: "ANTHROPIC_SMALL_FAST_MODEL", profileKey: "smallFastModel" },
] as const;

type AnthropicModelEnvField = (typeof ANTHROPIC_MODEL_ENV_FIELDS)[number];
type AnthropicModelProfileKey = AnthropicModelEnvField["profileKey"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return Date.now();
}

function getLegacyModelValue(raw: Record<string, unknown>, key: AnthropicModelProfileKey): string {
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

function getModelValuesFromEnv(env: Record<string, unknown>): Record<AnthropicModelProfileKey, string> {
  return {
    defaultOpusModel:
      typeof env.ANTHROPIC_DEFAULT_OPUS_MODEL === "string" ? env.ANTHROPIC_DEFAULT_OPUS_MODEL : "",
    defaultSonnetModel:
      typeof env.ANTHROPIC_DEFAULT_SONNET_MODEL === "string" ? env.ANTHROPIC_DEFAULT_SONNET_MODEL : "",
    defaultHaikuModel:
      typeof env.ANTHROPIC_DEFAULT_HAIKU_MODEL === "string" ? env.ANTHROPIC_DEFAULT_HAIKU_MODEL : "",
    model:
      typeof env.ANTHROPIC_MODEL === "string" ? env.ANTHROPIC_MODEL : "",
    smallFastModel:
      typeof env.ANTHROPIC_SMALL_FAST_MODEL === "string" ? env.ANTHROPIC_SMALL_FAST_MODEL : "",
  };
}

function hasAnyModelValue(values: Record<AnthropicModelProfileKey, string>): boolean {
  return ANTHROPIC_MODEL_ENV_FIELDS.some(({ profileKey }) => Boolean(values[profileKey].trim()));
}

function isSameAnthropicConfig(
  profile: ProviderProfile,
  token: string,
  baseUrl: string,
  modelValues: Record<AnthropicModelProfileKey, string>,
): boolean {
  if (profile.authToken.trim() !== token.trim()) return false;
  if (normalizeProviderBaseUrl(profile.baseUrl) !== normalizeProviderBaseUrl(baseUrl)) return false;
  return ANTHROPIC_MODEL_ENV_FIELDS.every(({ profileKey }) => {
    const existingValue = (profile[profileKey] ?? "").trim();
    const incomingValue = (modelValues[profileKey] ?? "").trim();
    return existingValue === incomingValue;
  });
}

function inferLegacyProviderName(baseUrl: string, fallback?: string): string {
  const explicit = (fallback ?? "").trim();
  if (explicit) return explicit;

  const normalized = normalizeProviderBaseUrl(baseUrl);
  try {
    const host = new URL(normalized).hostname.replace(/^api\./, "");
    return host || "Anthropic API";
  } catch {
    return "Anthropic API";
  }
}

function parseLegacyProfile(raw: unknown): ProviderProfile | null {
  if (!isRecord(raw)) return null;
  const token = typeof raw.authToken === "string" ? raw.authToken : "";
  const base = typeof raw.baseUrl === "string" ? raw.baseUrl : "";
  const modelValues: Record<AnthropicModelProfileKey, string> = {
    defaultOpusModel: getLegacyModelValue(raw, "defaultOpusModel"),
    defaultSonnetModel: getLegacyModelValue(raw, "defaultSonnetModel"),
    defaultHaikuModel: getLegacyModelValue(raw, "defaultHaikuModel"),
    model: getLegacyModelValue(raw, "model"),
    smallFastModel: getLegacyModelValue(raw, "smallFastModel"),
  };
  if (!token.trim() && !base.trim() && !hasAnyModelValue(modelValues)) return null;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: inferLegacyProviderName(base, typeof raw.name === "string" ? raw.name : undefined),
    authToken: token,
    baseUrl: base,
    ...modelValues,
    updatedAt: toSafeTimestamp(raw.updatedAt),
  };
}

function parseLegacyStoredProvider(raw: unknown): ProviderProfile | null {
  if (!isRecord(raw)) return null;
  const env = isRecord(raw.env) ? raw.env : {};
  const tokenValue = env.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_API_KEY;
  const baseValue = env.ANTHROPIC_BASE_URL;
  const token = typeof tokenValue === "string" ? tokenValue : "";
  const base = typeof baseValue === "string" ? baseValue : "";
  const modelValues = getModelValuesFromEnv(env);
  if (!token.trim() && !base.trim() && !hasAnyModelValue(modelValues)) return null;

  const rawName = typeof raw.name === "string" ? raw.name : "";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: inferLegacyProviderName(base, rawName),
    authToken: token,
    baseUrl: base,
    ...modelValues,
    updatedAt: toSafeTimestamp(raw.updatedAt),
  };
}

function readLegacyProfilesFromLocalStorage(): { profiles: ProviderProfile[]; consumedKeys: string[] } {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { profiles: [], consumedKeys: [] };
  }

  const profiles: ProviderProfile[] = [];
  const consumedKeys: string[] = [];

  for (const key of LEGACY_PROFILE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    const converted = key === "lovcode_llm_providers"
      ? parsed.map(parseLegacyStoredProvider).filter((item): item is ProviderProfile => Boolean(item))
      : parsed.map(parseLegacyProfile).filter((item): item is ProviderProfile => Boolean(item));

    if (converted.length > 0) {
      profiles.push(...converted);
      consumedKeys.push(key);
    }
  }

  return { profiles, consumedKeys };
}

function mergeProviderProfiles(
  baseProfiles: ProviderProfile[],
  legacyProfiles: ProviderProfile[],
): ProviderProfile[] {
  const mergedByFingerprint = new Map<string, ProviderProfile>();

  const fingerprint = (profile: ProviderProfile) =>
    [
      profile.authToken.trim(),
      normalizeProviderBaseUrl(profile.baseUrl),
      profile.name.trim().toLowerCase(),
      ...ANTHROPIC_MODEL_ENV_FIELDS.map(({ profileKey }) => (profile[profileKey] ?? "").trim()),
    ].join("@@");

  const insert = (profile: ProviderProfile, preferNewer: boolean) => {
    const key = fingerprint(profile);
    const existing = mergedByFingerprint.get(key);
    if (!existing) {
      mergedByFingerprint.set(key, profile);
      return;
    }

    if (preferNewer && (profile.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      // Keep insertion order stable; only replace value.
      mergedByFingerprint.set(key, profile);
    }
  };

  // Preserve persisted order from backend as the source of truth.
  for (const profile of baseProfiles) insert(profile, false);
  // Legacy entries are only for one-time补齐; do not reorder existing items.
  for (const profile of legacyProfiles) insert(profile, true);

  return Array.from(mergedByFingerprint.values());
}

interface SortableProviderItemRenderProps {
  dragHandleProps: HTMLAttributes<HTMLDivElement>;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
}

function SortableProviderItem({
  profile,
  children,
}: {
  profile: ProviderProfile;
  children: (props: SortableProviderItemRenderProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-70")}
    >
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        setActivatorNodeRef,
        isDragging,
      })}
    </div>
  );
}

const getEnvFromMerged = (value: MergedConfigView | null | undefined): Record<string, string> => {
  const raw = value?.effective;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const envValue = (raw as Record<string, unknown>).env;
  if (!envValue || typeof envValue !== "object" || Array.isArray(envValue)) return {};
  return Object.fromEntries(
    Object.entries(envValue as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
  );
};

export function LlmProviderView({
  embedded = false,
  settingsPath,
}: {
  embedded?: boolean;
  settingsPath?: string;
}) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);
  const { configScope: selectedScope } = useSettingsScope(settingsPath);
  const settingsKind = getSettingsFileKindForScope(selectedScope);

  // Config mutations
  const writeMutation = useConfigWrite();
  const deleteMutation = useConfigDeleteKey();
  const queryClient = useQueryClient();

  const env = useMemo(() => getEnvFromMerged(mergedConfig), [mergedConfig]);
  const currentToken = (env.ANTHROPIC_AUTH_TOKEN ?? "").trim();
  const currentBaseUrl = normalizeProviderBaseUrl(env.ANTHROPIC_BASE_URL);
  const currentModelValues = useMemo<Record<AnthropicModelProfileKey, string>>(
    () => getModelValuesFromEnv(env),
    [env]
  );

  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [viewMode, setViewMode] = useState<ProviderViewMode>(() => {
    const stored = getUiPreference<ProviderViewMode>("llm_provider_view_mode");
    return stored === "list" || stored === "card" ? stored : "list";
  });
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const didBootstrapFromConfig = useRef(false);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorToken, setEditorToken] = useState("");
  const [editorBaseUrl, setEditorBaseUrl] = useState("");
  const [editorDefaultOpusModel, setEditorDefaultOpusModel] = useState("");
  const [editorDefaultSonnetModel, setEditorDefaultSonnetModel] = useState("");
  const [editorDefaultHaikuModel, setEditorDefaultHaikuModel] = useState("");
  const [editorModel, setEditorModel] = useState("");
  const [editorSmallFastModel, setEditorSmallFastModel] = useState("");
  const [editorAdvancedOpen, setEditorAdvancedOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const persistProfilesState = useCallback(
    async (nextProfiles: ProviderProfile[], nextViewMode = viewMode) => {
      const nextState: LlmProfilesState = {
        profiles: nextProfiles,
        viewMode: nextViewMode,
      };
      await invoke("save_llm_profiles_state", {
        state: nextState,
      });
      queryClient.setQueryData(["llmProfilesState"], nextState);
    },
    [queryClient, viewMode]
  );

  useEffect(() => {
    let active = true;
    const loadProfilesState = async () => {
      try {
        const state = await invoke<LlmProfilesState>("get_llm_profiles_state");
        if (!active) return;

        // If UI preference is absent, use backend value
        const localView = getUiPreference<ProviderViewMode>("llm_provider_view_mode");
        if ((localView !== "list" && localView !== "card") && state?.viewMode) {
          setViewMode(state.viewMode as ProviderViewMode);
          setUiPreference("llm_provider_view_mode", state.viewMode as ProviderViewMode);
        }

        const backendProfiles = state?.profiles ?? [];
        const legacy = readLegacyProfilesFromLocalStorage();
        const mergedProfiles = mergeProviderProfiles(backendProfiles, legacy.profiles);

        setProfiles(mergedProfiles);

        // One-time migration from legacy localStorage to data.db (or merge fix when backend already had 1 profile)
        if (
          legacy.consumedKeys.length > 0 &&
          mergedProfiles.length >= backendProfiles.length &&
          mergedProfiles.length > 0
        ) {
          await invoke("save_llm_profiles_state", {
            state: {
              profiles: mergedProfiles,
              viewMode: state?.viewMode ?? viewMode,
            } satisfies LlmProfilesState,
          });
          queryClient.setQueryData(["llmProfilesState"], {
            profiles: mergedProfiles,
            viewMode: state?.viewMode ?? viewMode,
          } satisfies LlmProfilesState);
          for (const key of legacy.consumedKeys) {
            window.localStorage.removeItem(key);
          }
        }
      } finally {
        if (active) setProfilesLoaded(true);
      }
    };

    loadProfilesState();
    return () => {
      active = false;
    };
  }, [queryClient, viewMode]);

  const hasCurrentConfig = Boolean(
    env.ANTHROPIC_AUTH_TOKEN ||
    env.ANTHROPIC_BASE_URL ||
    env.ANTHROPIC_DEFAULT_OPUS_MODEL ||
    env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
    env.ANTHROPIC_MODEL ||
    env.ANTHROPIC_SMALL_FAST_MODEL
  );

  useEffect(() => {
    if (!profilesLoaded) return;
    if (profiles.length > 0) return;
    if (!hasCurrentConfig) return;
    if (didBootstrapFromConfig.current) return;

    const bootstrapProfile: ProviderProfile = {
      id: Date.now().toString(),
      name: t("llm.default_profile_name", "Anthropic API"),
      authToken: env.ANTHROPIC_AUTH_TOKEN ?? "",
      baseUrl: env.ANTHROPIC_BASE_URL ?? "",
      defaultOpusModel: env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "",
      defaultSonnetModel: env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "",
      defaultHaikuModel: env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "",
      model: env.ANTHROPIC_MODEL ?? "",
      smallFastModel: env.ANTHROPIC_SMALL_FAST_MODEL ?? "",
      updatedAt: Date.now(),
    };

    didBootstrapFromConfig.current = true;
    setProfiles([bootstrapProfile]);
    persistProfilesState([bootstrapProfile]).catch(() => { });
  }, [
    env.ANTHROPIC_AUTH_TOKEN,
    env.ANTHROPIC_BASE_URL,
    env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    env.ANTHROPIC_MODEL,
    env.ANTHROPIC_SMALL_FAST_MODEL,
    hasCurrentConfig,
    persistProfilesState,
    profiles.length,
    profilesLoaded,
    t,
  ]);

  const displayBaseUrl = (baseUrl: string) => baseUrl.trim() || DEFAULT_ANTHROPIC_BASE_URL;

  const isProfileActive = (profile: ProviderProfile) => {
    return (
      profile.authToken.trim() === currentToken &&
      normalizeProviderBaseUrl(profile.baseUrl) === currentBaseUrl &&
      ANTHROPIC_MODEL_ENV_FIELDS.every(({ profileKey }) => {
        const profileValue = (profile[profileKey] ?? "").trim();
        const currentValue = currentModelValues[profileKey].trim();
        return profileValue === currentValue;
      })
    );
  };

  const updateProfilesState = useCallback(
    async (nextProfiles: ProviderProfile[]) => {
      const previousProfiles = profiles;
      setProfiles(nextProfiles);
      setPersistError(null);
      try {
        await persistProfilesState(nextProfiles);
        return true;
      } catch (err) {
        setProfiles(previousProfiles);
        setPersistError(String(err));
        return false;
      }
    },
    [persistProfilesState, profiles]
  );

  const handleImportFromConfig = useCallback(async () => {
    const token = (env.ANTHROPIC_AUTH_TOKEN ?? "").trim();
    const baseUrl = (env.ANTHROPIC_BASE_URL ?? "").trim();
    const rawModelValues = getModelValuesFromEnv(env);
    const modelValues: Record<AnthropicModelProfileKey, string> = {
      defaultOpusModel: rawModelValues.defaultOpusModel.trim(),
      defaultSonnetModel: rawModelValues.defaultSonnetModel.trim(),
      defaultHaikuModel: rawModelValues.defaultHaikuModel.trim(),
      model: rawModelValues.model.trim(),
      smallFastModel: rawModelValues.smallFastModel.trim(),
    };

    if (!token && !baseUrl && !hasAnyModelValue(modelValues)) {
      alert(t("llm.import_no_config", "No supplier config found in the current configuration file."));
      return;
    }

    const duplicate = profiles.some((profile) => isSameAnthropicConfig(profile, token, baseUrl, modelValues));
    if (duplicate) {
      alert(t("llm.import_exists", "This supplier configuration has already been imported."));
      return;
    }

    let importedName = "";
    const effective = mergedConfig?.effective;
    if (isRecord(effective)) {
      const cci = effective.claudecodeimpact;
      if (isRecord(cci) && typeof cci.activeProvider === "string") {
        importedName = cci.activeProvider.trim();
      }
    }
    if (!importedName) {
      importedName = inferLegacyProviderName(baseUrl, t("llm.default_profile_name", "Anthropic API"));
    }

    const importedProfile: ProviderProfile = {
      id: Date.now().toString(),
      name: importedName,
      authToken: token,
      baseUrl,
      ...modelValues,
      updatedAt: Date.now(),
    };

    await updateProfilesState([...profiles, importedProfile]);
  }, [env, mergedConfig?.effective, profiles, t, updateProfilesState]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      displayBaseUrl(p.baseUrl).toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const isDragEnabled = !search.trim();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over) return;
      if (event.active.id === event.over.id) return;
      const oldIndex = profiles.findIndex((p) => p.id === event.active.id);
      const newIndex = profiles.findIndex((p) => p.id === event.over?.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const nextProfiles = arrayMove(profiles, oldIndex, newIndex);
      void updateProfilesState(nextProfiles);
    },
    [profiles, updateProfilesState]
  );

  const openCreate = () => {
    setEditorId(null);
    setEditorName("");
    setEditorToken("");
    setEditorBaseUrl("");
    setEditorDefaultOpusModel("");
    setEditorDefaultSonnetModel("");
    setEditorDefaultHaikuModel("");
    setEditorModel("");
    setEditorSmallFastModel("");
    setEditorAdvancedOpen(false);
    setShowToken(false);
    setIsEditorOpen(true);
  };

  const openEdit = (profile: ProviderProfile) => {
    setEditorId(profile.id);
    setEditorName(profile.name);
    setEditorToken(profile.authToken);
    setEditorBaseUrl(profile.baseUrl);
    setEditorDefaultOpusModel(profile.defaultOpusModel ?? "");
    setEditorDefaultSonnetModel(profile.defaultSonnetModel ?? "");
    setEditorDefaultHaikuModel(profile.defaultHaikuModel ?? "");
    setEditorModel(profile.model ?? "");
    setEditorSmallFastModel(profile.smallFastModel ?? "");
    setEditorAdvancedOpen(false);
    setShowToken(false);
    setIsEditorOpen(true);
  };

  const handleViewModeChange = useCallback(
    (mode: ProviderViewMode) => {
      setViewMode(mode);
      setUiPreference("llm_provider_view_mode", mode);
      persistProfilesState(profiles, mode).catch(() => { });
    },
    [persistProfilesState, profiles]
  );

  const viewModeToggle = (
    <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm">
      <button
        type="button"
        aria-label={t("llm.view_list")}
        title={t("llm.view_list")}
        onClick={() => handleViewModeChange("list")}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
          viewMode === "list"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        )}
      >
        <ListIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("llm.view_card")}
        title={t("llm.view_card")}
        onClick={() => handleViewModeChange("card")}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
          viewMode === "card"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const createButton = (
    <Button
      size="icon"
      className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={openCreate}
      title={t("llm.new_provider")}
    >
      <PlusIcon className="w-3.5 h-3.5" />
    </Button>
  );

  const importButton = (
    <Button
      variant="outline"
      size="sm"
      className="h-7 rounded-lg px-2 text-xs"
      onClick={handleImportFromConfig}
      title={t("llm.import_from_config", "Import from config")}
    >
      <DownloadIcon className="w-3.5 h-3.5 mr-1" />
      {t("common.import")}
    </Button>
  );

  const handleSaveProfile = async () => {
    if (!editorName.trim()) {
      alert(t("llm.name_required"));
      return;
    }

    const profile: ProviderProfile = {
      id: editorId ?? Date.now().toString(),
      name: editorName.trim(),
      authToken: editorToken,
      baseUrl: editorBaseUrl,
      defaultOpusModel: editorDefaultOpusModel,
      defaultSonnetModel: editorDefaultSonnetModel,
      defaultHaikuModel: editorDefaultHaikuModel,
      model: editorModel,
      smallFastModel: editorSmallFastModel,
      updatedAt: Date.now(),
    };

    const nextProfiles = editorId
      ? profiles.map((p) => (p.id === editorId ? profile : p))
      : [...profiles, profile];
    const ok = await updateProfilesState(nextProfiles);
    if (ok) {
      setIsEditorOpen(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    const confirmed = await confirmDialog({
      title: t("llm.delete", "Delete"),
      description: t("llm.confirm_delete"),
      variant: "destructive",
      confirmText: t("llm.delete", "Delete"),
    });
    if (!confirmed) return;
    await updateProfilesState(profiles.filter((p) => p.id !== profileId));
  };

  const applyProfile = async (profile: ProviderProfile) => {
    setApplyingId(profile.id);
    setApplyError(null);

    try {
      const token = profile.authToken.trim();
      const baseUrl = profile.baseUrl.trim();
      const syncEnvKey = async (key: string, value: string, currentValue?: string) => {
        if (value) {
          await writeMutation.mutateAsync({
            kind: settingsKind,
            scope: selectedScope,
            projectPath: settingsPath,
            key: `env.${key}`,
            value,
          });
          return;
        }

        if (!(currentValue ?? "").trim()) {
          return;
        }

        await deleteMutation.mutateAsync({
          kind: settingsKind,
          scope: selectedScope,
          projectPath: settingsPath,
          key: `env.${key}`,
        });
      };

      await syncEnvKey("ANTHROPIC_AUTH_TOKEN", token, env.ANTHROPIC_AUTH_TOKEN);
      await syncEnvKey("ANTHROPIC_BASE_URL", baseUrl, env.ANTHROPIC_BASE_URL);

      for (const { envKey, profileKey } of ANTHROPIC_MODEL_ENV_FIELDS) {
        const value = (profile[profileKey] ?? "").trim();
        await syncEnvKey(envKey, value, env[envKey]);
      }

      await writeMutation.mutateAsync({
        kind: settingsKind,
        scope: selectedScope,
        projectPath: settingsPath,
        key: "claudecodeimpact.activeProvider",
        value: profile.name,
      });

      // Mutations auto-invalidate queries, no manual refresh needed
    } catch (err) {
      setApplyError(String(err));
    } finally {
      setApplyingId(null);
    }
  };

  if (isLoading) return <LoadingState message={t("llm.loading")} />;

  const listContent = (
    <div className="flex-1 flex flex-col space-y-3">
      {/* Toolbar */}
      <ActionToolbar
        searchPlaceholder={t("llm.search_placeholder")}
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={
          <div className="flex items-center gap-1.5">
            {importButton}
            {createButton}
            {viewModeToggle}
          </div>
        }
      />

      {applyError && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {applyError}
        </p>
      )}
      {persistError && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {persistError}
        </p>
      )}

      {/* Provider List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-3 pr-3 [scrollbar-gutter:stable]">
        {!profilesLoaded ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : filteredProfiles.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={filteredProfiles.map((profile) => profile.id)}
              strategy={viewMode === "card" ? rectSortingStrategy : verticalListSortingStrategy}
            >
              <div
                className={cn(
                  viewMode === "card"
                    ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                    : "flex flex-col gap-2"
                )}
              >
                {filteredProfiles.map((profile) => {
                  const active = isProfileActive(profile);
                  return (
                    <SortableProviderItem key={profile.id} profile={profile}>
                      {({ dragHandleProps, setActivatorNodeRef }) => {
                        const dragActivatorProps = isDragEnabled
                          ? {
                            ...dragHandleProps,
                            title: t("llm.reorder"),
                            "aria-label": t("llm.reorder"),
                            className:
                              "cursor-grab active:cursor-grabbing touch-none",
                          }
                          : {
                            "aria-disabled": true,
                            title: t("llm.drag_disabled"),
                            "aria-label": t("llm.drag_disabled"),
                            className: "cursor-not-allowed opacity-40",
                          };

                        const applyButton = !active && (
                          <Button
                            size="icon"
                            className="rounded-lg h-7 w-7 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => applyProfile(profile)}
                            disabled={applyingId === profile.id}
                            title={t("llm.apply")}
                            aria-label={t("llm.apply")}
                          >
                            {applyingId === profile.id ? (
                              <ReloadIcon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlayIcon className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        );

                        const editButton = (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                            onClick={() => openEdit(profile)}
                            title={t("llm.edit")}
                          >
                            <Pencil1Icon className="w-3.5 h-3.5" />
                          </Button>
                        );

                        const deleteButton = (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDeleteProfile(profile.id)}
                            title={t("llm.delete")}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </Button>
                        );

                        return (
                          <ListItemCard
                            avatarFallback={profile.name}
                            title={profile.name}
                            subtitle={displayBaseUrl(profile.baseUrl)}
                            isActive={active}
                            dragHandleRef={setActivatorNodeRef}
                            dragHandleProps={dragActivatorProps}
                            className={viewMode === "list" ? "p-2" : undefined}
                            badges={
                              active && (
                                <StatusBadge variant="active">
                                  {t("llm.active_status")}
                                </StatusBadge>
                              )
                            }
                            actions={
                              <>
                                {applyButton}
                                {editButton}
                                {deleteButton}
                              </>
                            }
                          />
                        );
                      }}
                    </SortableProviderItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <SettingsEmptyState
            icon={PlayIcon}
            title={t("llm.no_providers")}
            description={t("llm.no_providers_hint", "Add a provider to get started")}
            action={
              <Button onClick={openCreate} className="rounded-xl">
                <PlusIcon className="w-4 h-4 mr-2" />
                {t("llm.new_provider")}
              </Button>
            }
          />
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-hidden grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editorId ? t("llm.edit_provider") : t("llm.new_provider")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3 overflow-y-auto pr-1 min-h-0">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t("llm.provider_name")}</label>
              <input
                className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder={t("llm.placeholder_name")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_AUTH_TOKEN</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all pr-9 font-mono placeholder:text-muted-foreground/40"
                  value={editorToken}
                  onChange={(e) => setEditorToken(e.target.value)}
                  placeholder={t("llm.anthropic_token_hint")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  onClick={() => setShowToken((prev) => !prev)}
                  tabIndex={-1}
                  title={showToken ? t("llm.hide_token", "Hide token") : t("llm.show_token", "Show token")}
                >
                  {showToken ? <EyeNoneIcon className="w-4 h-4" /> : <EyeOpenIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_BASE_URL</label>
              <input
                type="text"
                className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                value={editorBaseUrl}
                onChange={(e) => setEditorBaseUrl(e.target.value)}
                placeholder={t("llm.anthropic_base_url_hint")}
              />
            </div>

            <Collapsible open={editorAdvancedOpen} onOpenChange={setEditorAdvancedOpen}>
              <CollapsibleTrigger className="w-full rounded-xl border border-border/50 bg-secondary/25 hover:bg-secondary/40 px-3 py-2.5 flex items-center justify-between transition-colors">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("llm.advanced_options", "Advanced Options")}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-3 space-y-3 rounded-xl border border-border/40 bg-secondary/10 p-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_DEFAULT_OPUS_MODEL</label>
                  <input
                    type="text"
                    className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                    value={editorDefaultOpusModel}
                    onChange={(e) => setEditorDefaultOpusModel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_DEFAULT_SONNET_MODEL</label>
                  <input
                    type="text"
                    className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                    value={editorDefaultSonnetModel}
                    onChange={(e) => setEditorDefaultSonnetModel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_DEFAULT_HAIKU_MODEL</label>
                  <input
                    type="text"
                    className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                    value={editorDefaultHaikuModel}
                    onChange={(e) => setEditorDefaultHaikuModel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_MODEL</label>
                  <input
                    type="text"
                    className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                    value={editorModel}
                    onChange={(e) => setEditorModel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">ANTHROPIC_SMALL_FAST_MODEL</label>
                  <input
                    type="text"
                    className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                    value={editorSmallFastModel}
                    onChange={(e) => setEditorSmallFastModel(e.target.value)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter className="sm:justify-end pt-1">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)} className="rounded-xl">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveProfile} className="rounded-xl">{t("common.save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) {
    return <div className="h-full flex flex-col w-full overflow-hidden">{listContent}</div>;
  }

  return (
    <ConfigPage>

      {listContent}
    </ConfigPage>
  );
}
