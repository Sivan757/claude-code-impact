import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import {
  CheckIcon,
  Cross1Icon,
  Pencil1Icon,
  PlusCircledIcon,
  MinusCircledIcon,
  TrashIcon,
  ChevronDownIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  LoadingState,
  ConfigPage,
} from "../../components/config";
import {
  ActionToolbar,
  SettingsEmptyState,
  StatusBadge,
  AddFormRow,
} from "../../components/Settings";
import type { ClaudeSettings } from "../../types";
import { ENV_VAR_SUGGESTIONS } from "../../constants/env-vars";

export function EnvSettingsView({
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

  const [search, setSearch] = useState("");
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [envEditValue, setEnvEditValue] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

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



  const getDisabledEnvFromSettings = (value: ClaudeSettings | null | undefined): Record<string, string> => {
    const disabled =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>)._claudecodeimpact_disabled_env
        : null;
    if (!disabled || typeof disabled !== "object" || Array.isArray(disabled)) return {};
    return Object.fromEntries(
      Object.entries(disabled as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  const rawEnv = getRawEnvFromSettings(settings);
  const disabledEnv = getDisabledEnvFromSettings(settings);

  const allEnvEntries: Array<[string, string, boolean]> = [
    ...Object.entries(rawEnv).map(([k, v]) => [k, v, false] as [string, string, boolean]),
    ...Object.entries(disabledEnv).map(([k, v]) => [k, v, true] as [string, string, boolean]),
  ].sort((a, b) => a[0].localeCompare(b[0]));

  const filteredEnvEntries = !search
    ? allEnvEntries
    : allEnvEntries.filter(([key]) => key.toLowerCase().includes(search.toLowerCase()));

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: settingsKey });
  };

  const handleEnvEdit = (key: string, value: string, isDisabled = false) => {
    setEditingEnvKey(key);
    setEnvEditValue(value);
    setEditingEnvIsDisabled(isDisabled);
  };

  const handleEnvSave = async () => {
    if (!editingEnvKey) return;
    if (editingEnvIsDisabled) {
      await invoke("update_disabled_settings_env", {
        envKey: editingEnvKey,
        envValue: envEditValue,
        path: settingsPath || undefined,
      });
    } else {
      await invoke("update_settings_env", {
        envKey: editingEnvKey,
        envValue: envEditValue,
        path: settingsPath || undefined,
      });
    }
    await refreshSettings();
    setEditingEnvKey(null);
    setEditingEnvIsDisabled(false);
  };

  const handleEnvDelete = async (key: string) => {
    await invoke("delete_settings_env", { envKey: key, path: settingsPath || undefined });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvDisable = async (key: string) => {
    await invoke("disable_settings_env", { envKey: key, path: settingsPath || undefined });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvEnable = async (key: string) => {
    await invoke("enable_settings_env", { envKey: key, path: settingsPath || undefined });
    await refreshSettings();
  };

  const handleEnvCreate = async () => {
    const key = newEnvKey.trim();
    if (!key) return;
    await invoke("update_settings_env", {
      envKey: key,
      envValue: newEnvValue,
      isNew: true,
      path: settingsPath || undefined,
    });
    await refreshSettings();
    setNewEnvKey("");
    setNewEnvValue("");
  };



  const filteredSuggestions = !newEnvKey
    ? ENV_VAR_SUGGESTIONS
    : ENV_VAR_SUGGESTIONS.filter(item => item.key.toLowerCase().includes(newEnvKey.toLowerCase()));



  const content = (
    <div className="flex-1 flex flex-col space-y-3">
      {/* Toolbar */}
      <ActionToolbar
        searchPlaceholder={t('env.search_placeholder')}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* Add New Row */}
      <AddFormRow>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <div className="flex-1 relative">
            <input
              className="text-sm px-3.5 py-2 pr-8 rounded-xl bg-secondary/40 border border-border/50 text-foreground w-full focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
              placeholder={t('env.key')}
              value={newEnvKey}
              onChange={(e) => {
                setNewEnvKey(e.target.value);
                setPopoverOpen(true);
              }}
              onFocus={() => setPopoverOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
            />
            <PopoverTrigger asChild>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors">
                <ChevronDownIcon className="w-4 h-4" />
              </button>
            </PopoverTrigger>
          </div>
          <PopoverContent align="start" className="w-[320px] p-0 overflow-hidden shadow-xl border-border/50 rounded-xl">
            <div className="max-h-[280px] overflow-y-auto">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((item) => (
                  <button
                    key={item.key}
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0 flex flex-col gap-0.5"
                    onClick={() => {
                      setNewEnvKey(item.key);
                      setPopoverOpen(false);
                    }}
                  >
                    <span className="text-sm font-mono text-primary font-medium">{item.key}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.desc}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('env.no_suggestions', 'No matching suggestions')}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <input
          className="text-sm px-3.5 py-2 rounded-xl bg-secondary/40 border border-border/50 text-foreground flex-1 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none transition-all font-mono"
          placeholder={t('env.value')}
          value={newEnvValue}
          onChange={(e) => setNewEnvValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
        />
        <Button onClick={handleEnvCreate} disabled={!newEnvKey.trim()} className="rounded-xl h-9 px-4">
          {t('env.add')}
        </Button>
      </AddFormRow>

      {/* Environment Variables Table */}
      {filteredEnvEntries.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(180px,1fr)_2fr_auto] gap-3 px-3 py-2 border-b border-border/40 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('env.key_label')}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('env.value_label')}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">{t('env.actions')}</span>
          </div>
          {/* Table Body */}
          <div className="divide-y divide-border/30">
            {filteredEnvEntries.map(([key, value, isDisabled]) => (
              <div
                key={key}
                className={`grid grid-cols-[minmax(180px,1fr)_2fr_auto] gap-3 px-3 py-2 items-center hover:bg-muted/20 transition-colors group ${isDisabled ? "opacity-60" : ""}`}
              >
                {/* Key */}
                <div>
                  <StatusBadge variant={isDisabled ? "muted" : "active"} className={isDisabled ? "line-through" : ""}>
                    {key}
                  </StatusBadge>
                </div>

                {/* Value */}
                <div className="min-w-0">
                  {editingEnvKey === key ? (
                    <input
                      autoFocus
                      className="text-sm px-2.5 py-1 rounded-lg bg-secondary/40 border border-primary/50 text-foreground w-full max-w-md font-mono outline-none"
                      value={envEditValue}
                      onChange={(e) => setEnvEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEnvSave();
                        if (e.key === "Escape") setEditingEnvKey(null);
                      }}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground font-mono truncate block">
                      {value || <em className="text-muted-foreground/50">{t('env.empty')}</em>}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  {editingEnvKey === key ? (
                    <>
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={handleEnvSave} title={t('env.save')}>
                        <CheckIcon className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => setEditingEnvKey(null)} title={t('env.cancel')}>
                        <Cross1Icon className="w-4 h-4" />
                      </Button>
                    </>
                  ) : isDisabled ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEnvEdit(key, value, true)} title={t('env.edit')}>
                        <Pencil1Icon className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-green-600 hover:bg-green-500/10" onClick={() => handleEnvEnable(key)} title={t('env.enable')}>
                        <PlusCircledIcon className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-500/10" onClick={() => handleEnvDelete(key)} title={t('env.delete')}>
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEnvEdit(key, value, false)} title={t('env.edit')}>
                        <Pencil1Icon className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-600 hover:bg-amber-500/10" onClick={() => handleEnvDisable(key)} title={t('env.disable')}>
                        <MinusCircledIcon className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-500/10" onClick={() => handleEnvDelete(key)} title={t('env.delete')}>
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SettingsEmptyState
          icon={MixIcon}
          title={t('env.no_env')}
          description={t('env.no_env_hint', 'Add environment variables to configure Claude Code')}
        />
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col w-full overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <ConfigPage>

      {content}
    </ConfigPage >
  );
}
