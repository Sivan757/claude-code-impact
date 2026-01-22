import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import { PlusIcon, EyeOpenIcon, EyeNoneIcon, Pencil1Icon, TrashIcon, CopyIcon, PlayIcon, DragHandleDots2Icon } from "@radix-ui/react-icons";
import { Reorder, useDragControls } from "framer-motion";
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
  LoadingState,
  SearchInput,
  PageHeader,
  ConfigPage,
  type MarketplaceItem,
} from "../../components/config";


import type { ClaudeSettings } from "../../types";
import { trackProviderEvent } from "../../lib/analytics";



interface SavedProvider {
  id: string;
  type: string;
  name: string;
  env: Record<string, string>;
  updatedAt: number;
}

interface ProviderItemProps {
  provider: SavedProvider;
  isActive: boolean;
  applyState: "idle" | "loading" | "success" | "error";
  preset: { label: string; description: string };
  onApply: (p: SavedProvider, e?: React.MouseEvent) => void;
  onEdit: (p: SavedProvider) => void;
  onDuplicate: (p: SavedProvider, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  t: any;
  isDraggable: boolean;
}

const ProviderItem = ({ provider, isActive, applyState, preset, onApply, onEdit, onDuplicate, onDelete, t, isDraggable }: ProviderItemProps) => {
  const controls = useDragControls();
  const displayUrl = Object.entries(provider.env).find(([k, v]) => k.includes("URL") && v.startsWith("http"))?.[1] || preset.description;

  return (
    <Reorder.Item
      value={provider}
      dragListener={false}
      dragControls={controls}
      className={`group relative rounded-xl border p-3 flex items-center justify-between transition-colors duration-200 select-none
            ${isActive
          ? "border-primary bg-primary/5"
          : "border-transparent bg-card/40 hover:bg-card hover:border-primary hover:shadow-sm"}`}
    >
      <div className="flex items-center gap-4 overflow-hidden">
        {/* Reorder Handle */}
        <div
          className={`text-muted-foreground/30 ${isDraggable ? "cursor-grab hover:text-muted-foreground active:cursor-grabbing touch-none" : "opacity-0 pointer-events-none"}`}
          onPointerDown={(e) => isDraggable && controls.start(e)}
        >
          <DragHandleDots2Icon className="w-5 h-5" />
        </div>

        {/* Avatar / Icon */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-secondary/80 flex items-center justify-center font-bold text-muted-foreground/80 border border-white/5 select-none">
          {provider.name[0]?.toUpperCase() || "P"}
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0 pr-4">
          <h3 className="font-medium text-sm truncate text-foreground/90">{provider.name}</h3>
          <p className="text-xs text-blue-500/80 truncate font-mono mt-0.5" title={displayUrl}>
            {displayUrl || preset.label}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isActive ? (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-md select-none flex items-center gap-1.5 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              {t('llm.active_status') || "Active"}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50" onClick={(e) => { e.stopPropagation(); onEdit(provider); }} title={t('llm.edit')}>
                <Pencil1Icon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50" onClick={(e) => onDuplicate(provider, e)} title="Duplicate">
                <CopyIcon className="w-4 h-4" />
              </Button>

              <div className="w-px h-4 bg-border/50 mx-1"></div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-red-500 hover:bg-red-500/10" onClick={(e) => onDelete(provider.id, e)} title={t('llm.delete')}>
                <TrashIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              className="rounded-lg h-8 px-3 mr-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={(e) => onApply(provider, e)}
              disabled={applyState === 'loading'}
            >
              {applyState === 'loading' ? <span className="animate-spin mr-1">⟳</span> : <PlayIcon className="w-3.5 h-3.5 mr-1" />}
              {t('llm.apply') || "Apply"}
            </Button>
            <div className="flex items-center gap-1 text-muted-foreground/60">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50" onClick={(e) => { e.stopPropagation(); onEdit(provider); }} title={t('llm.edit')}>
                <Pencil1Icon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50" onClick={(e) => onDuplicate(provider, e)} title="Duplicate">
                <CopyIcon className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-border/50 mx-1"></div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-red-500 hover:bg-red-500/10" onClick={(e) => onDelete(provider.id, e)} title={t('llm.delete')}>
                <TrashIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
};


export function LlmProviderView() {
  const { t } = useTranslation();



  const queryClient = useQueryClient();
  const refreshSettings = () => queryClient.invalidateQueries({ queryKey: ["settings"] });
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");

  const [search, setSearch] = useState("");
  const [applyStatus, setApplyStatus] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [applyError, setApplyError] = useState<string | null>(null);





  // Local Storage State
  const [savedProviders, setSavedProviders] = useState<SavedProvider[]>(() => {
    try {
      const stored = localStorage.getItem("lovcode_llm_providers");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Track active provider by ID to handle duplicates correctly
  const [activeProviderId, setActiveProviderId] = useState<string | null>(() => {
    return localStorage.getItem("lovcode_active_provider_id");
  });

  useEffect(() => {
    localStorage.setItem("lovcode_llm_providers", JSON.stringify(savedProviders));
  }, [savedProviders]);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState("native"); // Provider Type (preset key)
  const [editorId, setEditorId] = useState<string | null>(null); // null = create
  const [editorName, setEditorName] = useState("");
  const [editorEnv, setEditorEnv] = useState<Record<string, string>>({});
  const [editorLoading, setEditorLoading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});




  const getActiveProvider = (value: ClaudeSettings | null | undefined): string | null => {
    const claudecodeimpact =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>).claudecodeimpact
        : null;
    if (!claudecodeimpact || typeof claudecodeimpact !== "object") return null;
    const activeProvider = (claudecodeimpact as Record<string, unknown>).activeProvider;
    return typeof activeProvider === "string" ? activeProvider : null;
  };

  const activeProvider = getActiveProvider(settings);

  const getRawEnvFromSettings = (value: ClaudeSettings | null | undefined) => {
    const envValue =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>).env
        : null;
    if (!envValue || typeof envValue !== "object" || Array.isArray(envValue)) return {};
    return Object.fromEntries(
      Object.entries(envValue as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  const rawEnv = getRawEnvFromSettings(settings);



  const proxyPresets = useMemo(() => [
    {
      key: "native",
      label: t('llm.providers.native'),
      description: t('llm.providers.native_desc'),
      templateName: "anthropic-native-endpoint",
    }
  ], [t]);

  const presetFallbacks: Record<string, MarketplaceItem> = {
    "anthropic-subscription": {
      name: "anthropic-subscription",
      path: "fallback/anthropic-subscription.json",
      description: t('llm.providers.anthropic-subscription_desc'),
      downloads: null,
      content: JSON.stringify({ env: { CLAUDE_CODE_USE_OAUTH: "1" } }, null, 2),
    },
    native: {
      name: "anthropic-native-endpoint",
      path: "fallback/anthropic-native-endpoint.json",
      description: t('llm.providers.native_desc'),
      downloads: null,
      content: JSON.stringify(
        {
          env: {
            ANTHROPIC_API_KEY: "your_anthropic_api_key_here",
            ANTHROPIC_BASE_URL: "https://api.anthropic.com",
          },
        },
        null,
        2
      ),
    },
    zenmux: {
      name: "zenmux-anthropic-proxy",
      path: "fallback/zenmux-anthropic-proxy.json",
      description: t('llm.providers.zenmux_desc'),
      downloads: null,
      content: JSON.stringify({ env: { ZENMUX_API_KEY: "sk-ai-v1-xxxxx" } }, null, 2),
    },
    qiniu: {
      name: "qiniu-anthropic-proxy",
      path: "fallback/qiniu-anthropic-proxy.json",
      description: t('llm.providers.qiniu_desc'),
      downloads: null,
      content: JSON.stringify({ env: { QINIU_API_KEY: "your_qiniu_api_key_here" } }, null, 2),
    },
    univibe: {
      name: "univibe-anthropic-proxy",
      path: "fallback/univibe-anthropic-proxy.json",
      description: t('llm.providers.univibe_desc'),
      downloads: null,
      content: JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "cr_xxxxxxxxxxxxxxxxxx" } }, null, 2),
    },
    modelgate: {
      name: "modelgate-anthropic-proxy",
      path: "fallback/modelgate-anthropic-proxy.json",
      description: t('llm.providers.modelgate_desc'),
      downloads: null,
      content: JSON.stringify({ env: { MODELGATE_API_KEY: "your_modelgate_api_key" } }, null, 2),
    },
    siliconflow: {
      name: "siliconflow-anthropic-proxy",
      path: "fallback/siliconflow-anthropic-proxy.json",
      description: t('llm.providers.siliconflow_desc'),
      downloads: null,
      content: JSON.stringify({ env: { SILICONFLOW_API_KEY: "sk-xxxxx" } }, null, 2),
    },
  };



  const getPresetTemplate = (presetKey: string) => {
    const preset = proxyPresets.find((p) => p.key === presetKey);
    if (!preset) return null;
    const fallbackTemplate = presetFallbacks[presetKey] ?? null;
    return { preset, template: fallbackTemplate };
  };



  const getMissingEnvPlaceholder = (key: string) => {
    if (key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET")) return "sk-..."
    if (key.includes("URL")) return "https://api..."
    return ""
  };

  const getPresetPreviewConfig = (presetKey: string) => {
    const resolved = getPresetTemplate(presetKey);
    const templateContent = resolved?.template?.content;
    if (!templateContent) {
      return { env: {}, note: t('llm.template_not_available') };
    }

    try {
      const parsed = JSON.parse(templateContent) as Record<string, unknown>;
      const templateEnv =
        parsed.env && typeof parsed.env === "object" && !Array.isArray(parsed.env)
          ? (parsed.env as Record<string, unknown>)
          : {};
      const previewEnv = Object.fromEntries(
        Object.keys(templateEnv).map((key) => {
          const rawValue = rawEnv[key] || "";
          if (!rawValue && key === "ANTHROPIC_BASE_URL") {
            return [key, String((templateEnv as Record<string, unknown>)[key] ?? "")];
          }
          return [key, rawValue];
        })
      );
      return { env: previewEnv, note: null };
    } catch {
      return { env: {}, note: t('llm.template_invalid') };
    }
  };





  const presetEnvKeyMappings: Record<string, Record<string, string>> = {
    zenmux: { ZENMUX_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    qiniu: { QINIU_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    modelgate: { MODELGATE_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    siliconflow: { SILICONFLOW_API_KEY: "ANTHROPIC_API_KEY" },
  };

  const presetExtraEnv: Record<string, Record<string, string>> = {
    zenmux: {
      ANTHROPIC_BASE_URL: "https://zenmux.ai/api/anthropic",
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
    qiniu: { ANTHROPIC_BASE_URL: "https://api.qnaigc.com" },
    univibe: {
      ANTHROPIC_BASE_URL: "https://api.univibe.cc/anthropic",
      ANTHROPIC_API_KEY: "",
    },
    modelgate: {
      ANTHROPIC_BASE_URL: "https://mg.aid.pub/claude-proxy",
      ANTHROPIC_API_KEY: "",
    },
    siliconflow: {
      ANTHROPIC_BASE_URL: "https://api.siliconflow.com/v1",
    },
  };



  const handleOpenCreate = () => {
    setEditorId(null);
    setEditorType("native");
    setEditorName("");
    setEditorEnv({});
    setVisibleKeys({});
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (provider: SavedProvider) => {
    setEditorId(provider.id);
    setEditorType(provider.type);
    setEditorName(provider.name);
    setEditorEnv({ ...provider.env });
    setVisibleKeys({});
    setIsEditorOpen(true);
  };

  const handleEditorTypeChange = (type: string) => {
    setEditorType(type);
    setVisibleKeys({});
    // Optional: Load template default keys if env is empty?
    if (Object.keys(editorEnv).length === 0) {
      const template = getPresetTemplate(type);
      if (template?.template?.content) {
        try {
          const parsed = JSON.parse(template.template.content);
          if (parsed.env) setEditorEnv(parsed.env);
        } catch { }
      }
    }
  };

  const handleSaveProvider = () => {
    if (!editorName.trim()) {
      alert(t('llm.name_required') || "Name is required");
      return;
    }

    const newProvider: SavedProvider = {
      id: editorId || Date.now().toString(),
      type: editorType,
      name: editorName,
      env: editorEnv,
      updatedAt: Date.now(),
    };

    setSavedProviders(prev => {
      if (editorId) {
        return prev.map(p => p.id === editorId ? newProvider : p);
      }
      return [...prev, newProvider];
    });

    setIsEditorOpen(false);
  };

  const handleDeleteProvider = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('llm.confirm_delete') || "Are you sure?")) {
      setSavedProviders(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDuplicateProvider = (provider: SavedProvider, e: React.MouseEvent) => {
    e.stopPropagation();
    const newProvider: SavedProvider = {
      ...provider,
      id: Date.now().toString(),
      name: `${provider.name} (Copy)`,
      updatedAt: Date.now(),
    };
    setSavedProviders(prev => [...prev, newProvider]);
  };

  const handleApplyProvider = async (provider: SavedProvider, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setApplyStatus((prev) => ({ ...prev, [provider.id]: "loading" }));

    try {
      const resolved = getPresetTemplate(provider.type);
      const parsed = resolved?.template?.content ? JSON.parse(resolved.template.content) : {};

      // Merge saved env into template env structure
      parsed.env = parsed.env || {};

      const keyMapping = presetEnvKeyMappings[provider.type] || {};
      const extraEnv = presetExtraEnv[provider.type] || {};

      const userEnv = { ...provider.env };

      // Apply Key Mappings (e.g. Zenmux API Key -> Auth Token)
      for (const [fromKey, toKey] of Object.entries(keyMapping)) {
        if (userEnv[fromKey]) {
          userEnv[toKey] = userEnv[fromKey];
          delete userEnv[fromKey];
        }
      }

      Object.assign(parsed.env, rawEnv);
      Object.assign(parsed.env, userEnv);
      Object.assign(parsed.env, extraEnv);

      // Handle special mappings (like subscription oauth)
      if (provider.type === "anthropic-subscription") {
        parsed.env.CLAUDE_CODE_USE_OAUTH = "1";
      }

      parsed.claudecodeimpact = { activeProvider: provider.type };

      await invoke("install_setting_template", { config: JSON.stringify(parsed, null, 2) });
      refreshSettings();
      setApplyStatus((prev) => ({ ...prev, [provider.id]: "success" }));
      trackProviderEvent({ action: "apply", provider: provider.type, success: true });
      setActiveProviderId(provider.id);
      localStorage.setItem("lovcode_active_provider_id", provider.id);

      setTimeout(() => {
        setApplyStatus((prev) => ({ ...prev, [provider.id]: "idle" }));
      }, 1500);
    } catch (e) {
      setApplyStatus((prev) => ({ ...prev, [provider.id]: "error" }));
      setApplyError(String(e));
    }
  };

  const isProviderActive = (provider: SavedProvider) => {
    // If we have an explicit active ID tracked locally, prefer that
    if (activeProviderId && activeProviderId === provider.id) return true;

    // Fallback: Check if env matches (only if no active ID logic or initially)
    // But this causes duplicates to look active.
    // Let's rely strictly on activeProviderId if it exists and matches rawEnv generally.
    if (activeProviderId) return false;

    if (activeProvider !== provider.type) return false;
    return Object.entries(provider.env).every(([k, v]) => rawEnv[k] === v);
  };

  const renderEditorForm = () => {
    const preset = proxyPresets.find(p => p.key === editorType);
    if (!preset) return null;

    const preview = getPresetPreviewConfig(editorType);
    const allKeys = Array.from(new Set([...Object.keys(preview.env), ...Object.keys(editorEnv)]));
    const isSecret = (key: string) => /KEY|TOKEN|SECRET|PASSWORD/i.test(key);


    return (
      <div className="flex flex-col gap-6 px-1">
        {/* Icon Header */}
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 bg-secondary/30 rounded-2xl flex items-center justify-center text-3xl font-bold text-muted-foreground select-none">
            {editorName ? editorName[0].toUpperCase() : (preset.label[0] || "P")}
          </div>
        </div>

        {/* Name and Type Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t('llm.provider_name') || "Name"}</label>
            <input
              className="w-full bg-secondary/30 border border-transparent focus:border-primary rounded-md px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/50"
              value={editorName}
              onChange={e => setEditorName(e.target.value)}
              placeholder={t('llm.placeholder_name') || "e.g. My Provider"}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t('llm.type') || "Type"}</label>
            <Select value={editorType} onValueChange={handleEditorTypeChange}>
              <SelectTrigger className="w-full bg-secondary/30 border-transparent focus:ring-1 focus:ring-primary rounded-md h-[40px] px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {proxyPresets.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Env Vars */}
        <div className="space-y-4">
          {allKeys.map(key => {
            const isKeySecret = isSecret(key);
            const isVisible = visibleKeys[key];


            return (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-xs text-muted-foreground">{key}</label>
                </div>

                <div className="relative group">
                  <input
                    type={isKeySecret && !isVisible ? "password" : "text"}
                    className="w-full bg-secondary/30 border border-transparent focus:border-primary rounded-md px-3 py-2 text-sm outline-none transition-all pr-10 font-mono placeholder:text-muted-foreground/30"
                    value={editorEnv[key] || ""}
                    onChange={e => setEditorEnv(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={getMissingEnvPlaceholder(key)}
                  />
                  {isKeySecret && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                      onClick={() => setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                      tabIndex={-1}
                    >
                      {isVisible ? <EyeNoneIcon className="w-4 h-4" /> : <EyeOpenIcon className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };



  const filteredProviders = useMemo(() => {
    return savedProviders.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase()));
  }, [savedProviders, search]);

  if (isLoading) return <LoadingState message={t('llm.loading')} />;

  return (
    <ConfigPage>
      <PageHeader
        title={t('llm.title')}
        subtitle={t('llm.subtitle')}
        action={applyError && <p className="text-xs text-red-600">{applyError}</p>}
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchInput
              placeholder={t('llm.search_placeholder')}
              value={search}
              onChange={setSearch}
              className="w-full max-w-md px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <Button
            size="icon"
            className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full"
            onClick={handleOpenCreate}
            title={t('llm.apply')}
          >
            <PlusIcon className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 mt-3 flex flex-col gap-3 overflow-y-auto min-h-0">
          {savedProviders.length > 0 ? (
            search ? (
              <div className="flex flex-col gap-3">
                {filteredProviders.map(provider => (
                  <ProviderItem
                    key={provider.id}
                    provider={provider}
                    isActive={isProviderActive(provider)}
                    applyState={applyStatus[provider.id]}
                    preset={proxyPresets.find(p => p.key === provider.type) || { label: provider.type, description: "" }}
                    onApply={handleApplyProvider}
                    onEdit={handleOpenEdit}
                    onDuplicate={handleDuplicateProvider}
                    onDelete={handleDeleteProvider}
                    t={t}
                    isDraggable={false}
                  />
                ))}
              </div>
            ) : (
              <Reorder.Group axis="y" values={savedProviders} onReorder={setSavedProviders} className="flex flex-col gap-3">
                {savedProviders.map(provider => (
                  <ProviderItem
                    key={provider.id}
                    provider={provider}
                    isActive={isProviderActive(provider)}
                    applyState={applyStatus[provider.id]}
                    preset={proxyPresets.find(p => p.key === provider.type) || { label: provider.type, description: "" }}
                    onApply={handleApplyProvider}
                    onEdit={handleOpenEdit}
                    onDuplicate={handleDuplicateProvider}
                    onDelete={handleDeleteProvider}
                    t={t}
                    isDraggable={true}
                  />
                ))}
              </Reorder.Group>
            )
          ) : (
            <p className="text-center text-muted-foreground p-8">{t('llm.no_providers') || "No providers saved. Click + to add one."}</p>
          )}
        </div>


      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{editorId ? t('llm.edit_provider') || "Edit Provider" : t('llm.new_provider') || "New Provider"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">


            {renderEditorForm()}
          </div>
          <DialogFooter className="sm:justify-end">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveProvider} disabled={editorLoading}>
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfigPage>
  );
}
