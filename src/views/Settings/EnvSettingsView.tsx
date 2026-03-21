import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  MixIcon,
  Pencil1Icon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
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
} from "../../components/Settings";
import {
  ENV_VAR_GROUPS,
  ENV_VAR_SUGGESTIONS,
  getEnvVarSuggestion,
  type EnvVarGroupId,
  type EnvVarSuggestion,
} from "../../constants/env-vars";
import {
  useConfigMerged,
  useConfigWrite,
  useConfigDeleteKey,
} from "../../config/hooks/useConfig";
import { getSettingsFileKindForScope } from "../../config/utils";
import { useSettingsScope } from "../../hooks";
import { cn } from "../../lib/utils";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

type GroupFilter = Exclude<EnvVarGroupId, "custom"> | "custom" | "all";
type EditorMode = "selected" | "custom";

type EnvVarItem = {
  key: string;
  desc: string;
  group: EnvVarGroupId;
  value: string;
  isConfigured: boolean;
  isCustom: boolean;
  featured: boolean;
  placeholder?: string;
  quickValues?: readonly string[];
};

type GroupSection = {
  id: GroupFilter;
  labelKey: string;
  descriptionKey: string;
  configuredCount: number;
  totalCount: number;
  matchedCount: number;
  items: EnvVarItem[];
  hasAnyItems: boolean;
};

const CUSTOM_GROUP = {
  id: "custom" as const,
  labelKey: "env.groups.custom.title",
  descriptionKey: "env.groups.custom.desc",
};

const ALL_GROUP = {
  id: "all" as const,
  labelKey: "env.groups.all.title",
  descriptionKey: "env.groups.all.desc",
};

function sortEnvItems(a: EnvVarItem, b: EnvVarItem) {
  return (
    Number(b.isConfigured) - Number(a.isConfigured) ||
    Number(b.featured) - Number(a.featured) ||
    a.key.localeCompare(b.key)
  );
}

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
  const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);

  const writeMutation = useConfigWrite();
  const deleteMutation = useConfigDeleteKey();

  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("all");
  const [selectedEnvKey, setSelectedEnvKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("selected");
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const settingsKind = getSettingsFileKindForScope(selectedScope);

  const envEntries = useMemo((): Record<string, string> => {
    if (!mergedConfig?.effective.env || typeof mergedConfig.effective.env !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(mergedConfig.effective.env as Record<string, unknown>).map(
        ([key, value]) => [key, String(value)],
      ),
    );
  }, [mergedConfig]);

  const configuredEntries = useMemo(
    () =>
      Object.entries(envEntries)
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    [envEntries],
  );

  const normalizedSearch = search.trim().toLowerCase();

  const matchesSearch = (item: Pick<EnvVarItem, "key" | "desc" | "value" | "group">) => {
    if (!normalizedSearch) return true;

    return [
      item.key,
      item.desc,
      item.value,
      t(
        item.group === "custom"
          ? CUSTOM_GROUP.labelKey
          : ENV_VAR_GROUPS.find((group) => group.id === item.group)?.labelKey ?? "",
      ),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  };

  const knownItems = useMemo<EnvVarItem[]>(
    () =>
      ENV_VAR_SUGGESTIONS.map((item) => {
        const value = envEntries[item.key] ?? "";
        return {
          ...item,
          value,
          isConfigured: Object.prototype.hasOwnProperty.call(envEntries, item.key),
          isCustom: false,
          featured: item.featured ?? false,
        };
      }),
    [envEntries],
  );

  const customItems = useMemo<EnvVarItem[]>(
    () =>
      configuredEntries
        .filter(({ key }) => !getEnvVarSuggestion(key))
        .map(({ key, value }) => ({
          key,
          value,
          desc: t("env.custom_item_desc", {
            defaultValue: "Custom variable not in the built-in catalog",
          }),
          group: "custom",
          isConfigured: true,
          isCustom: true,
          featured: false,
        })),
    [configuredEntries, t],
  );

  const groupDefinitions = useMemo(
    () => [...ENV_VAR_GROUPS, CUSTOM_GROUP],
    [],
  );

  const groupSections = useMemo<GroupSection[]>(() => {
    return groupDefinitions
      .map((group) => {
        const sourceItems =
          group.id === "custom"
            ? customItems
            : knownItems.filter((item) => item.group === group.id);

        const filteredItems = sourceItems
          .filter((item) => matchesSearch(item))
          .sort(sortEnvItems);

        return {
          ...group,
          configuredCount: sourceItems.filter((item) => item.isConfigured).length,
          totalCount: sourceItems.length,
          matchedCount: filteredItems.length,
          items: filteredItems,
          hasAnyItems: sourceItems.length > 0,
        };
      })
      .filter((group) => group.id !== "custom" || group.hasAnyItems || activeGroup === "custom");
  }, [activeGroup, customItems, groupDefinitions, knownItems, normalizedSearch, t]);

  const allFilteredItems = useMemo(
    () => [...knownItems, ...customItems].filter(matchesSearch).sort(sortEnvItems),
    [customItems, knownItems, normalizedSearch, t],
  );

  const allSection = useMemo<GroupSection>(() => ({
    ...ALL_GROUP,
    configuredCount: configuredEntries.length,
    totalCount: knownItems.length + customItems.length,
    matchedCount: allFilteredItems.length,
    items: allFilteredItems,
    hasAnyItems: knownItems.length + customItems.length > 0,
  }), [allFilteredItems, configuredEntries.length, customItems.length, knownItems.length]);

  const availableGroups = useMemo(
    () => [allSection, ...groupSections],
    [allSection, groupSections],
  );

  const activeSection = useMemo(
    () => availableGroups.find((group) => group.id === activeGroup) ?? allSection,
    [activeGroup, allSection, availableGroups],
  );

  const selectedItem = useMemo(
    () => activeSection.items.find((item) => item.key === selectedEnvKey) ?? null,
    [activeSection.items, selectedEnvKey],
  );

  const composerSuggestion = useMemo(
    () => getEnvVarSuggestion(draftKey.trim()),
    [draftKey],
  );

  const detailItem = editorMode === "selected" ? selectedItem : null;
  const detailSuggestion = editorMode === "custom" ? composerSuggestion : detailItem;
  const detailGroupMeta =
    detailSuggestion?.group === "custom"
      ? CUSTOM_GROUP
      : groupDefinitions.find((group) => group.id === detailSuggestion?.group) ?? CUSTOM_GROUP;

  const filteredSuggestions = useMemo(() => {
    const query = draftKey.trim().toLowerCase();

    return ENV_VAR_SUGGESTIONS.filter((item) => {
      if (activeGroup !== "all" && item.group !== activeGroup) {
        return false;
      }

      if (!query) return true;

      return [item.key, item.desc]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).sort(
      (a, b) =>
        Number(b.featured ?? false) - Number(a.featured ?? false) ||
        a.key.localeCompare(b.key),
    );
  }, [activeGroup, draftKey]);

  useEffect(() => {
    if (editorMode === "custom") return;
    if (activeSection.items.length === 0) {
      setSelectedEnvKey(null);
      return;
    }
    if (!selectedEnvKey || !activeSection.items.some((item) => item.key === selectedEnvKey)) {
      setSelectedEnvKey(activeSection.items[0].key);
    }
  }, [activeSection.items, editorMode, selectedEnvKey]);

  useEffect(() => {
    if (editorMode !== "selected" || !selectedItem) return;
    setDraftKey(selectedItem.key);
    setDraftValue(selectedItem.isConfigured ? selectedItem.value : "");
  }, [editorMode, selectedItem]);

  const upsertEnvValue = async (key: string, value: string) => {
    await writeMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `env.${key}`,
      value,
    });
  };

  const handleSelectItem = (key: string) => {
    setEditorMode("selected");
    setSelectedEnvKey(key);
    setPopoverOpen(false);
  };

  const startCustomComposer = () => {
    setEditorMode("custom");
    setSelectedEnvKey(null);
    setDraftKey("");
    setDraftValue("");
    setPopoverOpen(false);
  };

  const primeComposer = (item: Pick<EnvVarSuggestion, "key" | "placeholder">, preset?: string) => {
    setEditorMode("custom");
    setSelectedEnvKey(null);
    setDraftKey(item.key);
    setDraftValue(preset ?? item.placeholder ?? "");
    setPopoverOpen(false);
  };

  const handleSaveDraft = async () => {
    const targetKey = editorMode === "custom" ? draftKey.trim() : detailItem?.key;
    if (!targetKey) return;

    await upsertEnvValue(targetKey, draftValue);

    if (editorMode === "custom") {
      setEditorMode("selected");
      setSelectedEnvKey(targetKey);
    }
  };

  const handleDelete = async (key: string) => {
    const confirmed = await confirmDialog({
      title: t("common.delete", { defaultValue: "Delete" }),
      description: t("env.confirm_delete", {
        key,
        defaultValue: `Delete environment variable "${key}"?`,
      }),
      confirmText: t("common.delete", { defaultValue: "Delete" }),
    });
    if (!confirmed) return;

    await deleteMutation.mutateAsync({
      kind: settingsKind,
      scope: selectedScope,
      projectPath: settingsPath,
      key: `env.${key}`,
    });

    if (selectedEnvKey === key) {
      setSelectedEnvKey(null);
    }

    if (editorMode === "selected" && detailItem?.key === key) {
      setDraftValue("");
    }
  };

  const handleResetDraft = () => {
    if (editorMode === "custom") {
      startCustomComposer();
      return;
    }
    if (!detailItem) return;
    setDraftValue(detailItem.isConfigured ? detailItem.value : "");
  };

  const isSavingDisabled =
    writeMutation.isPending ||
    (editorMode === "custom" ? !draftKey.trim() : !detailItem);
  const hasDraftChanges =
    editorMode === "custom"
      ? Boolean(draftKey.trim()) || draftValue.length > 0
      : detailItem
        ? draftValue !== detailItem.value
        : false;
  const denseBadgeClassName = "px-1.5 py-0 text-[10px] leading-4";
  const denseIconButtonClassName = "h-8 w-8 rounded-lg";
  const applyDefaultValue = (value?: string) => {
    setDraftValue(value ?? "");
  };

  const renderPresetButtons = (item: Pick<EnvVarItem, "key" | "quickValues"> | Pick<EnvVarSuggestion, "key" | "quickValues">) => {
    if (!item.quickValues?.length) return null;

    return (
      <div className="flex flex-wrap gap-1.5">
        {item.quickValues.map((preset) => (
          <Button
            key={`${item.key}-${preset}`}
            size="sm"
            variant="outline"
            className="h-7 rounded-md px-2 font-mono text-[10px]"
            onClick={() => setDraftValue(preset)}
            disabled={writeMutation.isPending}
          >
            {preset}
          </Button>
        ))}
      </div>
    );
  };

  if (isLoading) return <LoadingState message={t("env.loading")} />;

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ActionToolbar
        searchPlaceholder={t("env.search_placeholder")}
        searchValue={search}
        onSearchChange={setSearch}
        className="[&_input]:h-9 [&_input]:rounded-lg [&_input]:px-3 [&_input]:py-1.5 [&_input]:text-xs [&_button]:rounded-lg [&_button]:text-xs [&_svg]:h-3.5 [&_svg]:w-3.5"
        secondaryAction={
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1">
            <span className="text-[11px] text-muted-foreground">
              {t("env.group_summary", {
                configured: activeSection.configuredCount,
                total: activeSection.totalCount,
                defaultValue: "{{configured}} configured / {{total}} tracked",
              })}
            </span>
          </div>
        }
        primaryAction={
          <Button className="h-8 gap-1 px-3" onClick={startCustomComposer}>
            <PlusIcon className="h-3.5 w-3.5" />
            {t("env.new_variable", { defaultValue: "New variable" })}
          </Button>
        }
      />

      <div className="flex flex-1 min-h-0 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {availableGroups.map((group) => {
            const isActive = group.id === activeGroup;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveGroup(group.id);
                  setEditorMode("selected");
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  isActive
                    ? "border-primary/60 bg-primary/5 text-primary"
                    : "border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span>{t(group.labelKey)}</span>
                  <StatusBadge variant={isActive ? "active" : "muted"} className={denseBadgeClassName}>
                    {group.configuredCount}/{group.totalCount}
                  </StatusBadge>
                </span>
              </button>
            );
          })}
        </div>

        {editorMode === "custom" && (
          <section className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <div className="border-b border-border/40 px-3 py-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("env.key_label")}
                    </p>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen} className="w-full">
                      <div className="relative">
                        <input
                          className="h-9 w-full rounded-xl border border-border/50 bg-background px-3 pr-9 font-mono text-xs text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                          value={draftKey}
                          placeholder={t("env.key")}
                          onChange={(event) => {
                            setDraftKey(event.target.value);
                            setPopoverOpen(true);
                          }}
                          onFocus={() => setPopoverOpen(true)}
                        />
                        <PopoverTrigger className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary">
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        </PopoverTrigger>
                      </div>
                      <PopoverContent
                        align="start"
                        className="w-[420px] max-w-[calc(100vw-4rem)] overflow-hidden rounded-xl border-border/50 p-0 shadow-xl"
                      >
                        <div className="max-h-[320px] overflow-y-auto overflow-x-hidden">
                          {filteredSuggestions.length > 0 ? (
                            filteredSuggestions.map((item) => {
                              const groupMeta =
                                groupDefinitions.find((group) => group.id === item.group) ?? CUSTOM_GROUP;
                              return (
                                <button
                                  key={item.key}
                                  className="flex w-full min-w-0 flex-col gap-0.5 border-b border-border/30 px-2.5 py-2 text-left transition-colors last:border-0 hover:bg-muted/60"
                                  onClick={() => primeComposer(item)}
                                  title={item.key}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-primary">
                                      {item.key}
                                    </span>
                                    {item.featured && (
                                      <StatusBadge variant="purple" className={denseBadgeClassName}>
                                        {t("env.featured_label", { defaultValue: "Featured" })}
                                      </StatusBadge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{t(groupMeta.labelKey)}</span>
                                  <span className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                                    {item.desc}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                              {t("env.no_suggestions", {
                                defaultValue: "No matching suggestions",
                              })}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {detailSuggestion ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge variant="blue" className={denseBadgeClassName}>{t(detailGroupMeta.labelKey)}</StatusBadge>
                        {detailSuggestion.featured && (
                          <StatusBadge variant="purple" className={denseBadgeClassName}>
                            {t("env.featured_label", { defaultValue: "Featured" })}
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-foreground">{detailSuggestion.desc}</p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {t("env.value_label")}
                      </p>
                      {detailSuggestion?.placeholder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 rounded-md px-2 text-[10px]"
                          onClick={() => applyDefaultValue(detailSuggestion.placeholder)}
                        >
                          {t("env.fill_suggested", { defaultValue: "Fill default" })}
                        </Button>
                      )}
                    </div>
                    <input
                      type="text"
                      spellCheck={false}
                      className="h-9 w-full rounded-xl border border-border/50 bg-background px-3 font-mono text-xs text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      value={draftValue}
                      placeholder={detailSuggestion?.placeholder ?? t("env.value")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSaveDraft();
                        }
                      }}
                      onChange={(event) => setDraftValue(event.target.value)}
                    />
                  </div>

                  {detailSuggestion && renderPresetButtons(detailSuggestion)}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="h-8 gap-1 rounded-lg px-3 text-xs"
                      onClick={() => void handleSaveDraft()}
                      disabled={isSavingDisabled}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      {t("env.save")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 rounded-lg px-3 text-xs"
                      onClick={handleResetDraft}
                      disabled={!hasDraftChanges}
                    >
                      {t("common.reset", { defaultValue: "Reset" })}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 md:hidden">
            <p className="truncate text-xs font-semibold text-foreground">{t(activeSection.labelKey)}</p>
            <StatusBadge variant="blue" className={denseBadgeClassName}>{activeSection.matchedCount}</StatusBadge>
          </div>

          <div className="hidden shrink-0 border-b border-border/40 px-3 py-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_96px] md:items-center md:gap-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("env.table_key", { defaultValue: "Key" })}
            </p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("env.table_value", { defaultValue: "Value" })}
            </p>
            <p className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("env.actions", { defaultValue: "Actions" })}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            {activeSection.items.length > 0 ? (
              <div className="divide-y divide-border/30">
                {activeSection.items.map((item) => {
                  const isActive = editorMode === "selected" && selectedEnvKey === item.key;
                  const groupLabel =
                    item.group === "custom"
                      ? CUSTOM_GROUP.labelKey
                      : groupDefinitions.find((group) => group.id === item.group)?.labelKey ?? CUSTOM_GROUP.labelKey;

                  return (
                    <div key={item.key} className={cn(isActive && "bg-primary/5")}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectItem(item.key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectItem(item.key);
                          }
                        }}
                        className="cursor-pointer px-3 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_96px] md:gap-4">
                          <div className="min-w-0 space-y-2">
                            <code className="inline-flex max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-secondary/60 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                              {item.key}
                            </code>
                            <p className="break-words whitespace-normal text-xs leading-5 text-muted-foreground">
                              {item.desc}
                            </p>
                            {(activeGroup === "all" || item.isCustom || item.featured) && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <StatusBadge variant="blue" className={denseBadgeClassName}>{t(groupLabel)}</StatusBadge>
                                {item.featured && (
                                  <StatusBadge variant="purple" className={denseBadgeClassName}>
                                    {t("env.featured_label", { defaultValue: "Featured" })}
                                  </StatusBadge>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 space-y-2">
                            {isActive ? (
                              <>
                                <input
                                  type="text"
                                  spellCheck={false}
                                  className="h-9 w-full rounded-xl border border-primary/20 bg-background px-3 font-mono text-xs text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  value={draftValue}
                                  placeholder={item.placeholder ?? t("env.value")}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    event.stopPropagation();
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleSaveDraft();
                                    }
                                  }}
                                  onChange={(event) => setDraftValue(event.target.value)}
                                />
                              </>
                            ) : (
                              <p className="break-words font-mono text-sm leading-6 text-foreground">
                                {item.isConfigured
                                  ? item.value || t("env.empty")
                                  : t("env.not_configured", { defaultValue: "Not configured" })}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge variant={item.isConfigured ? "active" : "muted"} className={denseBadgeClassName}>
                              {item.isConfigured
                                ? t("env.configured_label", { defaultValue: "Configured" })
                                : t("env.suggested_label", { defaultValue: "Suggested" })}
                            </StatusBadge>
                            {!isActive ? (
                              <Button
                                size="icon"
                                className={denseIconButtonClassName}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSelectItem(item.key);
                                }}
                                title={t("env.edit", { defaultValue: "Edit" })}
                                aria-label={t("env.edit", { defaultValue: "Edit" })}
                              >
                                <Pencil1Icon className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}

                            {isActive && (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {item.placeholder && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className={denseIconButtonClassName}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      applyDefaultValue(item.placeholder);
                                    }}
                                    title={t("env.fill_suggested", { defaultValue: "Fill default" })}
                                    aria-label={t("env.fill_suggested", { defaultValue: "Fill default" })}
                                  >
                                    <DownloadIcon className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  className={denseIconButtonClassName}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleSaveDraft();
                                  }}
                                  disabled={isSavingDisabled || !hasDraftChanges}
                                  title={t("env.save")}
                                  aria-label={t("env.save")}
                                >
                                  <CheckIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={denseIconButtonClassName}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleResetDraft();
                                  }}
                                  disabled={!hasDraftChanges}
                                  title={t("common.reset", { defaultValue: "Reset" })}
                                  aria-label={t("common.reset", { defaultValue: "Reset" })}
                                >
                                  <ResetIcon className="h-3.5 w-3.5" />
                                </Button>
                                {item.isConfigured && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(denseIconButtonClassName, "text-red-500 hover:bg-red-500/10 hover:text-red-500")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDelete(item.key);
                                    }}
                                    title={t("env.delete")}
                                    aria-label={t("env.delete")}
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 md:hidden">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <code className="inline-flex max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-secondary/60 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                              {item.key}
                            </code>
                            <StatusBadge variant={item.isConfigured ? "active" : "muted"} className={denseBadgeClassName}>
                              {item.isConfigured
                                ? t("env.configured_label", { defaultValue: "Configured" })
                                : t("env.suggested_label", { defaultValue: "Suggested" })}
                            </StatusBadge>
                          </div>
                          <p className="break-words whitespace-normal text-xs leading-5 text-muted-foreground">{item.desc}</p>
                          {isActive ? (
                            <>
                              <input
                                type="text"
                                spellCheck={false}
                                className="h-9 w-full rounded-xl border border-primary/20 bg-background px-3 font-mono text-xs text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                value={draftValue}
                                placeholder={item.placeholder ?? t("env.value")}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleSaveDraft();
                                  }
                                }}
                                onChange={(event) => setDraftValue(event.target.value)}
                              />
                            </>
                          ) : (
                            <p className="break-words font-mono text-xs leading-5 text-foreground">
                              {item.isConfigured
                                ? item.value || t("env.empty")
                                : t("env.not_configured", { defaultValue: "Not configured" })}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge variant="blue" className={denseBadgeClassName}>{t(groupLabel)}</StatusBadge>
                            {item.featured && (
                              <StatusBadge variant="purple" className={denseBadgeClassName}>
                                {t("env.featured_label", { defaultValue: "Featured" })}
                              </StatusBadge>
                            )}
                          </div>
                          {isActive && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.placeholder && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={denseIconButtonClassName}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    applyDefaultValue(item.placeholder);
                                  }}
                                  title={t("env.fill_suggested", { defaultValue: "Fill default" })}
                                  aria-label={t("env.fill_suggested", { defaultValue: "Fill default" })}
                                >
                                  <DownloadIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                className={denseIconButtonClassName}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleSaveDraft();
                                }}
                                disabled={isSavingDisabled || !hasDraftChanges}
                                title={t("env.save")}
                                aria-label={t("env.save")}
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className={denseIconButtonClassName}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleResetDraft();
                                }}
                                disabled={!hasDraftChanges}
                                title={t("common.reset", { defaultValue: "Reset" })}
                                aria-label={t("common.reset", { defaultValue: "Reset" })}
                              >
                                <ResetIcon className="h-3.5 w-3.5" />
                              </Button>
                              {item.isConfigured && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(denseIconButtonClassName, "text-red-500 hover:bg-red-500/10 hover:text-red-500")}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDelete(item.key);
                                  }}
                                  title={t("env.delete")}
                                  aria-label={t("env.delete")}
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10">
                <SettingsEmptyState
                  icon={MixIcon}
                  title={t("env.empty_group_title", { defaultValue: "No variables in this view" })}
                  description={t("env.empty_group_hint", {
                    defaultValue: normalizedSearch
                      ? "Try another keyword or switch to a different group."
                      : "This group has no visible variables yet.",
                  })}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">{content}</div>;
  }

  return <ConfigPage>{content}</ConfigPage>;
}
