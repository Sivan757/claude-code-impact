import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import {
  CheckIcon,
  Cross1Icon,
  Pencil1Icon,
  EyeOpenIcon,
  EyeClosedIcon,
  PlusCircledIcon,
  MinusCircledIcon,
  TrashIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  LoadingState,
  SearchInput,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import type { ClaudeSettings } from "../../types";
import { ENV_VAR_SUGGESTIONS } from "../../constants/env-vars";

export function EnvSettingsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");

  const [search, setSearch] = useState("");
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [envEditValue, setEnvEditValue] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [revealedEnvKeys, setRevealedEnvKeys] = useState<Record<string, boolean>>({});
  const [editingEnvIsDisabled, setEditingEnvIsDisabled] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (isLoading) return <LoadingState message={t('env.loading')} />;

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

  const getCustomEnvKeysFromSettings = (value: ClaudeSettings | null | undefined): string[] => {
    const keys =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>)._lovcode_custom_env_keys
        : null;
    if (!keys || !Array.isArray(keys)) return [];
    return keys.filter((k): k is string => typeof k === "string");
  };

  const getDisabledEnvFromSettings = (value: ClaudeSettings | null | undefined): Record<string, string> => {
    const disabled =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>)._lovcode_disabled_env
        : null;
    if (!disabled || typeof disabled !== "object" || Array.isArray(disabled)) return {};
    return Object.fromEntries(
      Object.entries(disabled as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  const rawEnv = getRawEnvFromSettings(settings);
  const customEnvKeys = getCustomEnvKeysFromSettings(settings);
  const disabledEnv = getDisabledEnvFromSettings(settings);

  const allEnvEntries: Array<[string, string, boolean]> = [
    ...Object.entries(rawEnv).map(([k, v]) => [k, v, false] as [string, string, boolean]),
    ...Object.entries(disabledEnv).map(([k, v]) => [k, v, true] as [string, string, boolean]),
  ].sort((a, b) => a[0].localeCompare(b[0]));

  const filteredEnvEntries = !search
    ? allEnvEntries
    : allEnvEntries.filter(([key]) => key.toLowerCase().includes(search.toLowerCase()));

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleEnvEdit = (key: string, value: string, isDisabled = false) => {
    setEditingEnvKey(key);
    setEnvEditValue(value);
    setEditingEnvIsDisabled(isDisabled);
  };

  const handleEnvSave = async () => {
    if (!editingEnvKey) return;
    if (editingEnvIsDisabled) {
      await invoke("update_disabled_settings_env", { envKey: editingEnvKey, envValue: envEditValue });
    } else {
      await invoke("update_settings_env", { envKey: editingEnvKey, envValue: envEditValue });
    }
    await refreshSettings();
    setEditingEnvKey(null);
    setEditingEnvIsDisabled(false);
  };

  const handleEnvDelete = async (key: string) => {
    await invoke("delete_settings_env", { envKey: key });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvDisable = async (key: string) => {
    await invoke("disable_settings_env", { envKey: key });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvEnable = async (key: string) => {
    await invoke("enable_settings_env", { envKey: key });
    await refreshSettings();
  };

  const handleEnvCreate = async () => {
    const key = newEnvKey.trim();
    if (!key) return;
    await invoke("update_settings_env", { envKey: key, envValue: newEnvValue, isNew: true });
    await refreshSettings();
    setNewEnvKey("");
    setNewEnvValue("");
  };

  const toggleEnvReveal = (key: string) => {
    setRevealedEnvKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredSuggestions = !newEnvKey
    ? ENV_VAR_SUGGESTIONS
    : ENV_VAR_SUGGESTIONS.filter(item => item.key.toLowerCase().includes(newEnvKey.toLowerCase()));

  const handleApplyCorporateProxy = async () => {
    const content = JSON.stringify({ env: { HTTP_PROXY: "http://proxy.example.com:8080", HTTPS_PROXY: "http://proxy.example.com:8080" } }, null, 2);
    try {
      await invoke("install_setting_template", { config: content });
      refreshSettings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ConfigPage>
      <PageHeader title={t('env.title')} subtitle={t('env.subtitle')} />

      <div className="flex-1 flex flex-col space-y-4">
        <SearchInput placeholder={t('env.search_placeholder')} value={search} onChange={setSearch} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center p-3 rounded-lg border border-border bg-card">
          <div className="flex-1 relative group">
            <input
              className="text-xs px-2 py-1 pr-8 rounded bg-canvas border border-border text-ink w-full"
              placeholder={t('env.key')}
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
            />
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger className="p-1 hover:bg-accent rounded text-muted-foreground transition-colors">
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px] p-0 overflow-hidden mt-1 shadow-xl border-border/50">
                  <div className="max-h-[300px] overflow-y-auto">
                    {filteredSuggestions.length > 0 ? (
                      filteredSuggestions.map((item) => (
                        <button
                          key={item.key}
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/40 last:border-0 flex flex-col gap-0.5"
                          onClick={() => {
                            setNewEnvKey(item.key);
                            setPopoverOpen(false);
                          }}
                        >
                          <span className="text-xs font-mono text-primary font-medium">{item.key}</span>
                          <span className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed italic">{item.desc}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {t('env.no_suggestions', '未找到匹配的建议')}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <input
            className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1"
            placeholder={t('env.value')}
            value={newEnvValue}
            onChange={(e) => setNewEnvValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
          />
          <Button size="sm" onClick={handleEnvCreate} disabled={!newEnvKey.trim()}>
            {t('env.add')}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-border bg-card-alt">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink">{t('env.corporate_proxy')}</p>
            <p className="text-[10px] text-muted-foreground">
              {t('env.corporate_proxy_desc')}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleApplyCorporateProxy}>
            {t('env.apply')}
          </Button>
        </div>

        {filteredEnvEntries.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 font-medium">{t('env.key_label')}</th>
                  <th className="py-2 px-3 font-medium">{t('env.value_label')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('env.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnvEntries.map(([key, value, isDisabled]) => {
                  const isRevealed = !!revealedEnvKeys[key];
                  const isCustom = customEnvKeys.includes(key);
                  return (
                    <tr
                      key={key}
                      className={`border-b border-border/60 last:border-0 ${isDisabled ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs px-2 py-1 rounded font-mono ${isDisabled ? "bg-muted/50 text-muted-foreground line-through" : "bg-primary/10 text-primary"}`}
                        >
                          {key}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {editingEnvKey === key ? (
                          <input
                            autoFocus
                            className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink w-64"
                            value={envEditValue}
                            onChange={(e) => setEnvEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEnvSave();
                              if (e.key === "Escape") setEditingEnvKey(null);
                            }}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {isRevealed ? value || t('env.empty') : "••••••"}
                            </span>
                            <button
                              onClick={() => toggleEnvReveal(key)}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              title={isRevealed ? t('env.hide') : t('env.view')}
                            >
                              {isRevealed ? (
                                <EyeClosedIcon className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOpenIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right">
                        {editingEnvKey === key ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={handleEnvSave} title={t('env.save')}>
                              <CheckIcon />
                            </Button>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditingEnvKey(null)} title={t('env.cancel')}>
                              <Cross1Icon />
                            </Button>
                          </div>
                        ) : isDisabled ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleEnvEdit(key, value, true)} title={t('env.edit')}>
                              <Pencil1Icon />
                            </Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleEnvEnable(key)} title={t('env.enable')}>
                              <PlusCircledIcon />
                            </Button>
                            <TooltipProvider delayDuration={1000}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom} title={t('env.delete')}>
                                      <TrashIcon />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!isCustom && <TooltipContent>{t('env.only_custom_delete')}</TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleEnvEdit(key, value, false)} title={t('env.edit')}>
                              <Pencil1Icon />
                            </Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEnvDisable(key)} title={t('env.disable')}>
                              <MinusCircledIcon />
                            </Button>
                            <TooltipProvider delayDuration={1000}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom} title={t('env.delete')}>
                                      <TrashIcon />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!isCustom && <TooltipContent>{t('env.only_custom_delete')}</TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-border bg-card text-center">
            <p className="text-sm text-muted-foreground">{t('env.no_env')}</p>
          </div>
        )}
      </div>
    </ConfigPage>
  );
}
