import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  EyeOpenIcon,
  EyeNoneIcon,
  PlusIcon,
  Pencil1Icon,
  TrashIcon,
  ReloadIcon,
  PlayIcon,
} from "@radix-ui/react-icons";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  LoadingState,
  PageHeader,
  ConfigPage,
  SearchInput,
} from "../../components/config";
import type { ClaudeSettings } from "../../types";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const STORAGE_KEY = "claudecodeimpact_llm_profiles";

interface ProviderProfile {
  id: string;
  name: string;
  authToken: string;
  baseUrl: string;
  updatedAt: number;
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
  const queryClient = useQueryClient();
  const settingsKey = ["settings", settingsPath ?? "default"];

  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(
    settingsKey,
    "get_settings",
    settingsPath ? { path: settingsPath } : undefined
  );

  const env = useMemo(() => getEnvFromSettings(settings), [settings]);
  const currentToken = (env.ANTHROPIC_AUTH_TOKEN ?? "").trim();
  const currentBaseUrl = normalizeBaseUrl(env.ANTHROPIC_BASE_URL);

  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProviderProfile[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorToken, setEditorToken] = useState("");
  const [editorBaseUrl, setEditorBaseUrl] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  const refreshSettings = () => queryClient.invalidateQueries({ queryKey: settingsKey });

  const displayBaseUrl = (baseUrl: string) => baseUrl.trim() || DEFAULT_ANTHROPIC_BASE_URL;

  const isProfileActive = (profile: ProviderProfile) => {
    return (
      profile.authToken.trim() === currentToken &&
      normalizeBaseUrl(profile.baseUrl) === currentBaseUrl
    );
  };

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      displayBaseUrl(p.baseUrl).toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const openCreate = () => {
    setEditorId(null);
    setEditorName("");
    setEditorToken("");
    setEditorBaseUrl("");
    setShowToken(false);
    setIsEditorOpen(true);
  };

  const openFromCurrent = () => {
    setEditorId(null);
    setEditorName(t("llm.default_profile_name", "Anthropic API"));
    setEditorToken(env.ANTHROPIC_AUTH_TOKEN ?? "");
    setEditorBaseUrl(env.ANTHROPIC_BASE_URL ?? "");
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

    setProfiles((prev) => {
      if (editorId) {
        return prev.map((p) => (p.id === editorId ? profile : p));
      }
      return [...prev, profile];
    });
    setIsEditorOpen(false);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (!confirm(t("llm.confirm_delete"))) return;
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
  };

  const applyProfile = async (profile: ProviderProfile) => {
    setApplyingId(profile.id);
    setApplyError(null);

    try {
      const token = profile.authToken.trim();
      const baseUrl = profile.baseUrl.trim();

      if (token) {
        await invoke("update_settings_env", {
          envKey: "ANTHROPIC_AUTH_TOKEN",
          envValue: token,
          path: settingsPath || undefined,
        });
      } else {
        await invoke("delete_settings_env", {
          envKey: "ANTHROPIC_AUTH_TOKEN",
          path: settingsPath || undefined,
        });
      }

      if (baseUrl) {
        await invoke("update_settings_env", {
          envKey: "ANTHROPIC_BASE_URL",
          envValue: baseUrl,
          path: settingsPath || undefined,
        });
      } else {
        await invoke("delete_settings_env", {
          envKey: "ANTHROPIC_BASE_URL",
          path: settingsPath || undefined,
        });
      }

      refreshSettings();
    } catch (err) {
      setApplyError(String(err));
    } finally {
      setApplyingId(null);
    }
  };

  if (isLoading) return <LoadingState message={t("llm.loading")} />;

  const listContent = (
    <div className="flex-1 flex flex-col space-y-4">
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder={t("llm.search_placeholder")}
          value={search}
          onChange={setSearch}
          className="flex-1 max-w-md px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <Button variant="outline" onClick={openFromCurrent} disabled={!env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_BASE_URL}>
          {t("llm.use_current", "Use current")}
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full"
          onClick={openCreate}
          title={t("llm.new_provider")}
        >
          <PlusIcon className="w-5 h-5" />
        </Button>
      </div>

      {applyError && <p className="text-xs text-destructive">{applyError}</p>}

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
        {filteredProfiles.length > 0 ? (
          filteredProfiles.map((profile) => {
            const active = isProfileActive(profile);
            return (
              <div
                key={profile.id}
                className={`group rounded-xl border p-3 flex items-center justify-between transition-colors duration-200
                  ${active
                    ? "border-primary bg-primary/5"
                    : "border-border/40 bg-card/40 hover:bg-card hover:border-primary/40 hover:shadow-sm"}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-secondary/80 flex items-center justify-center font-bold text-muted-foreground/80 border border-white/5 select-none">
                    {profile.name[0]?.toUpperCase() || "A"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate text-foreground/90">
                        {profile.name}
                      </h3>
                      {active && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-primary/30 text-primary">
                          {t("llm.active_status")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-500/80 truncate font-mono mt-0.5" title={displayBaseUrl(profile.baseUrl)}>
                      {displayBaseUrl(profile.baseUrl)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!active && (
                    <Button
                      size="sm"
                      className="rounded-lg h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => applyProfile(profile)}
                      disabled={applyingId === profile.id}
                    >
                      {applyingId === profile.id ? (
                        t("llm.applying")
                      ) : (
                        <>
                          <PlayIcon className="w-3.5 h-3.5 mr-1" />
                          {t("llm.apply")}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50"
                    onClick={() => openEdit(profile)}
                    title={t("llm.edit")}
                  >
                    <Pencil1Icon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => handleDeleteProfile(profile.id)}
                    title={t("llm.delete")}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-muted-foreground p-8">
            {t("llm.no_providers")}
          </p>
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editorId ? t("llm.edit_provider") : t("llm.new_provider")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t("llm.provider_name")}</label>
              <input
                className="w-full bg-secondary/30 border border-transparent focus:border-primary rounded-md px-3 py-2 text-sm outline-none transition-all"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder={t("llm.placeholder_name")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">ANTHROPIC_AUTH_TOKEN</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  className="w-full bg-secondary/30 border border-transparent focus:border-primary rounded-md px-3 py-2 text-sm outline-none transition-all pr-10 font-mono placeholder:text-muted-foreground/40"
                  value={editorToken}
                  onChange={(e) => setEditorToken(e.target.value)}
                  placeholder={t("llm.anthropic_token_hint")}
                />
                <button
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
              <label className="text-xs text-muted-foreground">ANTHROPIC_BASE_URL</label>
              <input
                type="text"
                className="w-full bg-secondary/30 border border-transparent focus:border-primary rounded-md px-3 py-2 text-sm outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                value={editorBaseUrl}
                onChange={(e) => setEditorBaseUrl(e.target.value)}
                placeholder={t("llm.anthropic_base_url_hint")}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveProfile}>{t("common.save")}</Button>
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
      <PageHeader
        title={t("llm.title")}
        subtitle={t("llm.subtitle")}
        action={
          <Button variant="ghost" size="icon" onClick={refreshSettings} title={t("common.refresh")}>
            <ReloadIcon className="w-4 h-4" />
          </Button>
        }
      />
      {listContent}
    </ConfigPage>
  );
}
