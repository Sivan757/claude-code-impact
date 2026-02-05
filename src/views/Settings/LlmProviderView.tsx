import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
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
} from "@radix-ui/react-icons";
import { useInvokeQuery } from "../../hooks";
import { Button } from "../../components/ui/button";
import { ConfigScope, ConfigFileKind } from "../../config/types";
import { useConfigWrite, useConfigDeleteKey } from "../../config/hooks/useConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
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
import type { ClaudeSettings } from "../../types";
import { cn } from "../../lib/utils";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const STORAGE_KEY = "claudecodeimpact_llm_profiles";

interface ProviderProfile {
  id: string;
  name: string;
  authToken: string;
  baseUrl: string;
  updatedAt: number;
}

type ProviderViewMode = "list" | "card";

interface LlmProfilesState {
  profiles: ProviderProfile[];
  viewMode: ProviderViewMode;
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

const getEnvFromSettings = (value: ClaudeSettings | null | undefined): Record<string, string> => {
  const raw = value?.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const envValue = (raw as Record<string, unknown>).env;
  if (!envValue || typeof envValue !== "object" || Array.isArray(envValue)) return {};
  return Object.fromEntries(
    Object.entries(envValue as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
  );
};

const normalizeBaseUrl = (value?: string) => {
  const trimmed = (value ?? "").trim();
  const resolved = trimmed || DEFAULT_ANTHROPIC_BASE_URL;
  return resolved.replace(/\/+$/, "");
};

export function LlmProviderView({
  embedded = false,
  settingsPath,
}: {
  embedded?: boolean;
  settingsPath?: string;
}) {
  const { t } = useTranslation();
  const settingsKey = ["settings", settingsPath ?? "default"];

  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(
    settingsKey,
    "get_settings",
    settingsPath ? { path: settingsPath } : undefined
  );

  // Config mutations
  const writeMutation = useConfigWrite();
  const deleteMutation = useConfigDeleteKey();

  const env = useMemo(() => getEnvFromSettings(settings), [settings]);
  const currentToken = (env.ANTHROPIC_AUTH_TOKEN ?? "").trim();
  const currentBaseUrl = normalizeBaseUrl(env.ANTHROPIC_BASE_URL);

  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [viewMode, setViewMode] = useState<ProviderViewMode>(() => {
    return (localStorage.getItem("llm_provider_view_mode") as ProviderViewMode) || "list";
  });
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const didBootstrapFromConfig = useRef(false);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorToken, setEditorToken] = useState("");
  const [editorBaseUrl, setEditorBaseUrl] = useState("");
  const [showToken, setShowToken] = useState(false);

  const persistProfilesState = useCallback(
    async (nextProfiles: ProviderProfile[], nextViewMode = viewMode) => {
      await invoke("save_llm_profiles_state", {
        state: { profiles: nextProfiles, viewMode: nextViewMode },
      });
    },
    [viewMode]
  );

  useEffect(() => {
    let active = true;
    const loadProfilesState = async () => {
      try {
        const state = await invoke<LlmProfilesState>("get_llm_profiles_state");
        if (!active) return;

        // If we don't have a local preference, use the one from backend
        if (!localStorage.getItem("llm_provider_view_mode") && state?.viewMode) {
          setViewMode(state.viewMode as ProviderViewMode);
        }

        if (state?.profiles?.length) {
          setProfiles(state.profiles);
          return;
        }

        let migratedProfiles: ProviderProfile[] = [];
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              migratedProfiles = parsed;
            }
          }
        } catch {
          migratedProfiles = [];
        }

        if (migratedProfiles.length > 0) {
          setProfiles(migratedProfiles);
          // Don't overwrite viewMode here, keep current (from local or backend)
          await invoke("save_llm_profiles_state", {
            state: { profiles: migratedProfiles, viewMode: viewMode },
          });
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setProfiles([]);
          // No need to setViewMode here, it's already initialized
        }
      } finally {
        if (active) setProfilesLoaded(true);
      }
    };

    loadProfilesState();
    return () => {
      active = false;
    };
  }, []);

  const hasCurrentConfig = Boolean(
    env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_BASE_URL
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
      updatedAt: Date.now(),
    };

    didBootstrapFromConfig.current = true;
    setProfiles([bootstrapProfile]);
    persistProfilesState([bootstrapProfile]).catch(() => { });
  }, [
    env.ANTHROPIC_AUTH_TOKEN,
    env.ANTHROPIC_BASE_URL,
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
      normalizeBaseUrl(profile.baseUrl) === currentBaseUrl
    );
  };

  const updateProfilesState = useCallback(
    (nextProfiles: ProviderProfile[]) => {
      setProfiles(nextProfiles);
      persistProfilesState(nextProfiles).catch(() => { });
    },
    [persistProfilesState]
  );

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
      updateProfilesState(nextProfiles);
    },
    [profiles, updateProfilesState]
  );

  const openCreate = () => {
    setEditorId(null);
    setEditorName("");
    setEditorToken("");
    setEditorBaseUrl("");
    setShowToken(false);
    setIsEditorOpen(true);
  };

  const openEdit = (profile: ProviderProfile) => {
    setEditorId(profile.id);
    setEditorName(profile.name);
    setEditorToken(profile.authToken);
    setEditorBaseUrl(profile.baseUrl);
    setShowToken(false);
    setIsEditorOpen(true);
  };

  const handleViewModeChange = useCallback(
    (mode: ProviderViewMode) => {
      setViewMode(mode);
      localStorage.setItem("llm_provider_view_mode", mode);
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

  const handleSaveProfile = () => {
    if (!editorName.trim()) {
      alert(t("llm.name_required"));
      return;
    }

    const profile: ProviderProfile = {
      id: editorId ?? Date.now().toString(),
      name: editorName.trim(),
      authToken: editorToken,
      baseUrl: editorBaseUrl,
      updatedAt: Date.now(),
    };

    const nextProfiles = editorId
      ? profiles.map((p) => (p.id === editorId ? profile : p))
      : [...profiles, profile];
    updateProfilesState(nextProfiles);
    setIsEditorOpen(false);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (!confirm(t("llm.confirm_delete"))) return;
    updateProfilesState(profiles.filter((p) => p.id !== profileId));
  };

  const applyProfile = async (profile: ProviderProfile) => {
    setApplyingId(profile.id);
    setApplyError(null);

    try {
      const token = profile.authToken.trim();
      const baseUrl = profile.baseUrl.trim();

      // Use config system with User scope for provider settings
      if (token) {
        await writeMutation.mutateAsync({
          kind: ConfigFileKind.Settings,
          scope: ConfigScope.User,
          projectPath: settingsPath,
          key: "env.ANTHROPIC_AUTH_TOKEN",
          value: token,
        });
      } else {
        await deleteMutation.mutateAsync({
          kind: ConfigFileKind.Settings,
          scope: ConfigScope.User,
          projectPath: settingsPath,
          key: "env.ANTHROPIC_AUTH_TOKEN",
        });
      }

      if (baseUrl) {
        await writeMutation.mutateAsync({
          kind: ConfigFileKind.Settings,
          scope: ConfigScope.User,
          projectPath: settingsPath,
          key: "env.ANTHROPIC_BASE_URL",
          value: baseUrl,
        });
      } else {
        await deleteMutation.mutateAsync({
          kind: ConfigFileKind.Settings,
          scope: ConfigScope.User,
          projectPath: settingsPath,
          key: "env.ANTHROPIC_BASE_URL",
        });
      }

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

      {/* Provider List */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-3">
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
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editorId ? t("llm.edit_provider") : t("llm.new_provider")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3">
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
          </div>
          <DialogFooter className="sm:justify-end">
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
