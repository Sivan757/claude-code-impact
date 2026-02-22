import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  Cross1Icon,
  Pencil1Icon,
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
import { ENV_VAR_SUGGESTIONS } from "../../constants/env-vars";
import { useConfigMerged, useConfigWrite, useConfigDeleteKey } from "../../config/hooks/useConfig";
import { getSettingsFileKindForScope } from "../../config/utils";
import { useSettingsScope } from "../../hooks";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

export function EnvSettingsView({
  embedded = false,
  settingsPath,
}: {
  embedded?: boolean;
  settingsPath?: string;
}) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();

  const { configScope: selectedScope } = useSettingsScope(settingsPath);

  // Fetch merged config to see effective values with provenance
  const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);

  // Mutations
  const writeMutation = useConfigWrite();
  const deleteMutation = useConfigDeleteKey();

  const [search, setSearch] = useState("");
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [envEditValue, setEnvEditValue] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const settingsKind = getSettingsFileKindForScope(selectedScope);

  if (isLoading) return <LoadingState message={t('env.loading')} />;

  // Extract env from merged config
  const getEnvFromMerged = (): Record<string, string> => {
    if (!mergedConfig?.effective.env || typeof mergedConfig.effective.env !== "object") {
      return {};
    }

    const envObj = mergedConfig.effective.env as Record<string, string>;
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(envObj)) {
      result[key] = String(value);
    }

    return result;
  };

  const envEntries = getEnvFromMerged();
  const allEnvArray = Object.entries(envEntries)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const filteredEnvArray = !search
    ? allEnvArray
    : allEnvArray.filter(({ key }) => key.toLowerCase().includes(search.toLowerCase()));

  const handleEnvEdit = (key: string, value: string) => {
    setEditingEnvKey(key);
    setEnvEditValue(value);
  };

  const handleEnvSave = async () => {
    if (!editingEnvKey) return;

    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `env.${editingEnvKey}`,
      value: envEditValue,
    });

    setEditingEnvKey(null);
  };

  const handleEnvDelete = async (key: string) => {
    const confirmed = await confirmDialog({
      title: t("common.delete", "Delete"),
      description: t("env.confirm_delete", {
        key,
        defaultValue: `Delete environment variable "${key}"?`,
      }),
      confirmText: t("common.delete", "Delete"),
    });
    if (!confirmed) return;

    await deleteMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `env.${key}`,
    });

    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvCreate = async () => {
    const key = newEnvKey.trim();
    if (!key) return;

    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `env.${key}`,
      value: newEnvValue,
    });

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
          <PopoverContent
            align="start"
            className="w-[320px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden shadow-xl border-border/50 rounded-xl"
          >
            <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((item) => (
                  <button
                    key={item.key}
                    className="w-full min-w-0 text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0 flex flex-col gap-0.5"
                    onClick={() => {
                      setNewEnvKey(item.key);
                      setPopoverOpen(false);
                    }}
                    title={item.key}
                  >
                    <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-mono text-primary font-medium">
                      {item.key}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed break-words">
                      {item.desc}
                    </span>
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
      {filteredEnvArray.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2.2fr)_auto] gap-3 px-3 py-2 border-b border-border/40 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('env.key_label')}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('env.value_label')}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">{t('env.actions')}</span>
          </div>
          {/* Table Body */}
          <div className="divide-y divide-border/30">
            {filteredEnvArray.map(({ key, value }) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2.2fr)_auto] gap-3 px-3 py-2 items-center hover:bg-muted/20 transition-colors group"
              >
                {/* Key */}
                <div className="min-w-0" title={key}>
                  <StatusBadge
                    variant="active"
                    className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                  >
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
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEnvEdit(key, value)} title={t('env.edit')}>
                        <Pencil1Icon className="w-4 h-4" />
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
    </ConfigPage>
  );
}
