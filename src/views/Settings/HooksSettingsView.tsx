import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Link2Icon,
    TrashIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from "@radix-ui/react-icons";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import {
    LoadingState,
    ConfigPage,
} from "../../components/config";
import {
    ActionToolbar,
    AddFormRow,
    ListItemCard,
    SettingsEmptyState,
    StatusBadge,
    ViewModeToggle,
} from "../../components/Settings";
import { useViewMode, useSettingsScope } from "../../hooks";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { useConfigMerged, useConfigWrite, useConfigDeleteKey } from "../../config/hooks/useConfig";
import { getSettingsFileKindForScope } from "../../config/utils";
import { ConfigScope, type HookEntry, type HookMatcher } from "../../config/types";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

export function HooksSettingsView(props: { embedded?: boolean; settingsPath?: string }) {
    const { embedded = false, settingsPath } = props;
    const { t } = useTranslation();
    const confirmDialog = useConfirmDialog();

    const { configScope: selectedScope } = useSettingsScope(settingsPath);

    // Fetch merged config
    const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);

    // Mutations
    const writeMutation = useConfigWrite();
    const deleteMutation = useConfigDeleteKey();

    const [search, setSearch] = useState("");
    const [allowedUrlInput, setAllowedUrlInput] = useState("");
    const [allowedEnvVarInput, setAllowedEnvVarInput] = useState("");
    const [sessionEndTimeoutInput, setSessionEndTimeoutInput] = useState("");
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const { mode, setMode } = useViewMode("hooks");
    const [expandedHookEvents, setExpandedHookEvents] = useState<Set<string>>(new Set());
    const settingsKind = getSettingsFileKindForScope(selectedScope);

    const raw = (mergedConfig?.effective || {}) as Record<string, unknown>;
    const rawEnv = raw.env && typeof raw.env === "object"
        ? (raw.env as Record<string, unknown>)
        : {};

    const normalizeStringList = (value: unknown): string[] => {
        if (!Array.isArray(value)) {
            return [];
        }

        const seen = new Set<string>();
        const next: string[] = [];

        for (const item of value) {
            if (typeof item !== "string") continue;
            const trimmed = item.trim();
            if (!trimmed || seen.has(trimmed)) continue;
            seen.add(trimmed);
            next.push(trimmed);
        }

        return next;
    };

    const getHookLabel = (hook: HookEntry) => {
        return hook.command
            || hook.url
            || hook.prompt
            || t(`settings.hook_types.${hook.type}`, { defaultValue: hook.type });
    };

    const getHookTypeLabel = (type: string) => {
        return t(`settings.hook_types.${type}`, { defaultValue: type });
    };

    const getHookEventLabel = (eventType: string) => {
        return t(`settings.hook_events.${eventType}`, { defaultValue: eventType });
    };

    const getHookSearchText = (hook: HookEntry) => {
        return [
            hook.type,
            getHookTypeLabel(hook.type),
            hook.command,
            hook.url,
            hook.prompt,
        ]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .join(" ")
            .toLowerCase();
    };

    // Extract hooks from merged config
    const hooks = (raw.hooks as Record<string, HookMatcher[]>) || {};
    const disableAllHooks = raw.disableAllHooks === true || raw.disable_all_hooks === true;
    const allowManagedHooksOnly = raw.allowManagedHooksOnly === true;
    const allowedHttpHookUrls = normalizeStringList(raw.allowedHttpHookUrls);
    const httpHookAllowedEnvVars = normalizeStringList(raw.httpHookAllowedEnvVars);
    const sessionEndTimeout = typeof rawEnv.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS === "string"
        ? rawEnv.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS
        : "";
    const isManagedScope = selectedScope === ConfigScope.Managed;

    useEffect(() => {
        setSessionEndTimeoutInput(sessionEndTimeout);
    }, [sessionEndTimeout]);

    if (isLoading) return <LoadingState message={t("settings.loading")} />;

    const writeSettingValue = async (key: string, value: unknown) => {
        await writeMutation.mutateAsync({
            kind: settingsKind,
            scope: selectedScope,
            projectPath: settingsPath,
            key,
            value,
        });
    };

    const deleteSettingValue = async (key: string) => {
        await deleteMutation.mutateAsync({
            kind: settingsKind,
            scope: selectedScope,
            projectPath: settingsPath,
            key,
        });
    };

    const toggleGlobalHooks = async (disabled: boolean) => {
        await writeSettingValue("disableAllHooks", disabled);
    };

    const saveStringListField = async (key: string, values: string[]) => {
        if (values.length === 0) {
            await deleteSettingValue(key);
            return;
        }

        await writeSettingValue(key, values);
    };

    const addAllowedHttpHookUrl = async () => {
        const nextValue = allowedUrlInput.trim();
        if (!nextValue) return;
        if (allowedHttpHookUrls.includes(nextValue)) {
            setAllowedUrlInput("");
            return;
        }

        await saveStringListField("allowedHttpHookUrls", [...allowedHttpHookUrls, nextValue]);
        setAllowedUrlInput("");
    };

    const removeAllowedHttpHookUrl = async (value: string) => {
        await saveStringListField(
            "allowedHttpHookUrls",
            allowedHttpHookUrls.filter((entry) => entry !== value),
        );
    };

    const addHttpHookAllowedEnvVar = async () => {
        const nextValue = allowedEnvVarInput.trim();
        if (!nextValue) return;
        if (httpHookAllowedEnvVars.includes(nextValue)) {
            setAllowedEnvVarInput("");
            return;
        }

        await saveStringListField(
            "httpHookAllowedEnvVars",
            [...httpHookAllowedEnvVars, nextValue],
        );
        setAllowedEnvVarInput("");
    };

    const removeHttpHookAllowedEnvVar = async (value: string) => {
        await saveStringListField(
            "httpHookAllowedEnvVars",
            httpHookAllowedEnvVars.filter((entry) => entry !== value),
        );
    };

    const saveSessionEndTimeout = async () => {
        const trimmed = sessionEndTimeoutInput.trim();
        if (!trimmed) {
            await deleteSettingValue("env.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS");
            setSessionEndTimeoutInput("");
            return;
        }

        await writeSettingValue("env.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS", trimmed);
        setSessionEndTimeoutInput(trimmed);
    };

    const deleteHookItem = async (eventType: string, matcherIndex: number, hookIndex: number) => {
        const confirmed = await confirmDialog({
            title: t("common.delete"),
            description: t("settings.delete_hook_confirm"),
            variant: "destructive",
            confirmText: t("common.delete"),
        });
        if (!confirmed) return;

        const eventMatchers = hooks[eventType];
        if (!eventMatchers || !eventMatchers[matcherIndex]) return;

        const matcher = eventMatchers[matcherIndex];
        const updatedHooks = matcher.hooks.filter((_, idx) => idx !== hookIndex);

        // If no hooks left in this matcher, remove the entire matcher
        if (updatedHooks.length === 0) {
            const updatedMatchers = eventMatchers.filter((_, idx) => idx !== matcherIndex);

            if (updatedMatchers.length === 0) {
                // Remove the entire event type
                await deleteMutation.mutateAsync({
                    kind: settingsKind,
                    scope: selectedScope,
                    projectPath: settingsPath,
                    key: `hooks.${eventType}`,
                });
            } else {
                // Update the event type with remaining matchers
                await writeMutation.mutateAsync({
                    kind: settingsKind,
                    scope: selectedScope,
                    projectPath: settingsPath,
                    key: `hooks.${eventType}`,
                    value: updatedMatchers,
                });
            }
        } else {
            // Update the matcher with remaining hooks
            const updatedMatchers = [...eventMatchers];
            updatedMatchers[matcherIndex] = { ...matcher, hooks: updatedHooks };

            await writeMutation.mutateAsync({
                kind: settingsKind,
                scope: selectedScope,
                projectPath: settingsPath,
                key: `hooks.${eventType}`,
                value: updatedMatchers,
            });
        }
    };

    const toggleHookEvent = (eventType: string) => {
        setExpandedHookEvents((prev) => {
            const next = new Set(prev);
            if (next.has(eventType)) {
                next.delete(eventType);
            } else {
                next.add(eventType);
            }
            return next;
        });
    };

    // Filter logic
    const eventTypes = Object.keys(hooks);
    const filteredEvents = eventTypes.filter(eventType => {
        if (!search) return true;
        // Basic filter: check if event type matches
        const normalizedSearch = search.toLowerCase();
        if (
            eventType.toLowerCase().includes(normalizedSearch)
            || getHookEventLabel(eventType).toLowerCase().includes(normalizedSearch)
        ) {
            return true;
        }

        // Advanced: check if any hook command matches
        const matchers = hooks[eventType] || [];

        const hasMatchingActive = matchers.some(m =>
            (m.matcher || "").toLowerCase().includes(normalizedSearch) ||
            m.hooks.some(h => getHookSearchText(h).includes(normalizedSearch))
        );

        return hasMatchingActive;
    });

    const advancedControls = (
        <section className="rounded-xl border border-border/50 bg-card/30 p-3 space-y-2">
            <div className="grid gap-2 xl:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-background/70 p-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                {t("settings.disable_all")}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                {t("settings.disable_all_hooks_desc")}
                            </p>
                        </div>
                        <Switch
                            checked={disableAllHooks}
                            onCheckedChange={toggleGlobalHooks}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/70 p-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                {t("settings.allow_managed_hooks_only")}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                {isManagedScope
                                    ? t("settings.allow_managed_hooks_only_desc")
                                    : t("settings.managed_scope_only_desc")}
                            </p>
                        </div>
                        <Switch
                            checked={allowManagedHooksOnly}
                            disabled={!isManagedScope}
                            onCheckedChange={(checked) => { void writeSettingValue("allowManagedHooksOnly", checked); }}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/70 p-2.5 xl:col-span-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                {t("settings.session_end_timeout")}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                {t("settings.session_end_timeout_desc")}
                            </p>
                        </div>
                        <input
                            className="h-8 w-28 rounded-lg border border-input bg-background px-2.5 font-mono text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                            placeholder="1500"
                            value={sessionEndTimeoutInput}
                            onChange={(event) => setSessionEndTimeoutInput(event.target.value)}
                            onBlur={() => { void saveSessionEndTimeout(); }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void saveSessionEndTimeout();
                                    event.currentTarget.blur();
                                }
                                if (event.key === "Escape") {
                                    setSessionEndTimeoutInput(sessionEndTimeout);
                                    event.currentTarget.blur();
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-2 xl:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-background/70 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                            {t("settings.allowed_http_hook_urls")}
                        </p>
                        <StatusBadge variant="blue">{allowedHttpHookUrls.length}</StatusBadge>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">
                        {t("settings.allowed_http_hook_urls_desc")}
                    </p>

                    {allowedHttpHookUrls.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {allowedHttpHookUrls.map((value) => (
                                <div
                                    key={value}
                                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/40 bg-secondary/40 pl-2.5 pr-1.5 py-1"
                                >
                                    <span className="truncate font-mono text-[11px] text-foreground">{value}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 rounded-full hover:text-red-500 hover:bg-red-500/10"
                                        onClick={() => { void removeAllowedHttpHookUrl(value); }}
                                        title={t("common.remove")}
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[11px] italic text-muted-foreground/70">
                            {t("settings.no_allowed_http_hook_urls")}
                        </p>
                    )}

                    <AddFormRow className="gap-2 items-stretch sm:items-center">
                        <input
                            className="flex-1 rounded-lg border border-border/50 bg-secondary/40 px-3 py-1.5 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                            placeholder={t("settings.allowed_http_hook_urls_placeholder")}
                            value={allowedUrlInput}
                            onChange={(event) => setAllowedUrlInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void addAllowedHttpHookUrl();
                                }
                            }}
                        />
                        <Button
                            onClick={() => { void addAllowedHttpHookUrl(); }}
                            disabled={!allowedUrlInput.trim()}
                            className="h-8 rounded-lg px-3.5"
                        >
                            {t("common.add")}
                        </Button>
                    </AddFormRow>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/70 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                            {t("settings.http_hook_allowed_env_vars")}
                        </p>
                        <StatusBadge variant="purple">{httpHookAllowedEnvVars.length}</StatusBadge>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">
                        {t("settings.http_hook_allowed_env_vars_desc")}
                    </p>

                    {httpHookAllowedEnvVars.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {httpHookAllowedEnvVars.map((value) => (
                                <div
                                    key={value}
                                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/40 bg-secondary/40 pl-2.5 pr-1.5 py-1"
                                >
                                    <span className="truncate font-mono text-[11px] text-foreground">{value}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 rounded-full hover:text-red-500 hover:bg-red-500/10"
                                        onClick={() => { void removeHttpHookAllowedEnvVar(value); }}
                                        title={t("common.remove")}
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[11px] italic text-muted-foreground/70">
                            {t("settings.no_http_hook_allowed_env_vars")}
                        </p>
                    )}

                    <AddFormRow className="gap-2 items-stretch sm:items-center">
                        <input
                            className="flex-1 rounded-lg border border-border/50 bg-secondary/40 px-3 py-1.5 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                            placeholder={t("settings.http_hook_allowed_env_vars_placeholder")}
                            value={allowedEnvVarInput}
                            onChange={(event) => setAllowedEnvVarInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void addHttpHookAllowedEnvVar();
                                }
                            }}
                        />
                        <Button
                            onClick={() => { void addHttpHookAllowedEnvVar(); }}
                            disabled={!allowedEnvVarInput.trim()}
                            className="h-8 rounded-lg px-3.5"
                        >
                            {t("common.add")}
                        </Button>
                    </AddFormRow>
                </div>
            </div>
        </section>
    );

    const mainContent = (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <ActionToolbar
                searchPlaceholder={t("settings.hooks_search_placeholder")}
                searchValue={search}
                onSearchChange={setSearch}
                primaryAction={
                    <ViewModeToggle mode={mode} onChange={setMode} />
                }
            />

            <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-3 pr-3 [scrollbar-gutter:stable] ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
                {eventTypes.length === 0 ? (
                    <SettingsEmptyState
                        icon={Link2Icon}
                        title={t("settings.no_hooks")}
                        description={t("settings.no_hooks_hint")}
                    />
                ) : (
                    <>
                        {filteredEvents.length > 0 ? (
                            <div className="space-y-3">
                                {filteredEvents.map((eventType) => {
                                    const isExpanded = expandedHookEvents.has(eventType) || search.length > 0;
                                    const matchers = hooks[eventType] || [];
                                    const totalCount = matchers.reduce((acc, m) => acc + m.hooks.length, 0);
                                    const eventLabel = getHookEventLabel(eventType);

                                    return (
                                        <div key={eventType} className="rounded-xl border border-border/50 bg-card/40 overflow-hidden transition-all duration-200">
                                            <button
                                                onClick={() => toggleHookEvent(eventType)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isExpanded ? (
                                                        <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="truncate text-sm font-medium text-foreground">{eventLabel}</span>
                                                        {eventLabel !== eventType && (
                                                            <code className="shrink-0 rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                                {eventType}
                                                            </code>
                                                        )}
                                                    </div>
                                                </div>
                                                <StatusBadge variant="muted">
                                                    {totalCount}
                                                </StatusBadge>
                                            </button>

                                            {isExpanded && (
                                                <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-2">
                                                    {/* Active hooks */}
                                                    {matchers.map((matcher, matcherIndex) => (
                                                        <div key={matcherIndex} className="space-y-2">
                                                            {matcher.matcher && (
                                                                <p className="text-xs text-muted-foreground pl-2 flex items-center gap-2">
                                                                    <span>{t("settings.matcher_label")}:</span>
                                                                    <code className="bg-secondary/60 px-1.5 py-0.5 rounded text-foreground font-mono">{matcher.matcher}</code>
                                                                </p>
                                                            )}
                                                            <div className={cn(
                                                                mode === "card"
                                                                    ? "grid gap-2 sm:grid-cols-2"
                                                                    : "flex flex-col gap-2"
                                                            )}>
                                                                {matcher.hooks.map((hook, hookIndex) => (
                                                                    <ListItemCard
                                                                        key={hookIndex}
                                                                        avatar={<Link2Icon className="w-4 h-4" />}
                                                                        title={getHookLabel(hook)}
                                                                        subtitle={hook.timeout ? `${t("settings.timeout")}: ${hook.timeout}s` : undefined}
                                                                        actions={
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                                                                onClick={() => deleteHookItem(eventType, matcherIndex, hookIndex)}
                                                                                title={t("common.delete")}
                                                                            >
                                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        }
                                                                        className="bg-card"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <SettingsEmptyState
                                icon={Link2Icon}
                                title={t("settings.no_hooks")}
                                description={search
                                    ? t("settings.no_match", { search })
                                    : t("settings.no_hooks_hint")}
                            />
                        )}
                    </>
                )}
            </div>

            <div className="border-t border-border/50 pt-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen(true)}
                        className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                    >
                        {t("settings.advanced_settings")}
                    </button>
                    {disableAllHooks && (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                            {t("settings.hooks_disabled_status")}
                        </span>
                    )}
                </div>
            </div>

            <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <DialogContent className="sm:max-w-[760px] rounded-2xl border-border/60 bg-background p-0 overflow-hidden shadow-xl">
                    <DialogHeader className="border-b border-border/40 px-6 py-5 pr-12">
                        <DialogTitle>{t("settings.advanced_settings")}</DialogTitle>
                        <DialogDescription>
                            {t("settings.hooks_advanced_settings_desc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                        {advancedControls}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );

    if (embedded) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden">
                {mainContent}
            </div>
        );
    }

    return (
        <ConfigPage>
            {mainContent}
        </ConfigPage>
    );
}
