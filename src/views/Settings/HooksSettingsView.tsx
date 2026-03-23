import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Link2Icon,
    TrashIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from "@radix-ui/react-icons";
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
        return hook.command || hook.url || hook.prompt || hook.type;
    };

    const getHookSearchText = (hook: HookEntry) => {
        return [
            hook.type,
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

    if (isLoading) return <LoadingState message={t('settings.loading')} />;

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
            title: t("common.delete", "Delete"),
            description: t('settings.delete_hook_confirm'),
            variant: "destructive",
            confirmText: t("common.delete", "Delete"),
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
        if (eventType.toLowerCase().includes(search.toLowerCase())) return true;

        // Advanced: check if any hook command matches
        const matchers = hooks[eventType] || [];

        const hasMatchingActive = matchers.some(m =>
            (m.matcher || "").toLowerCase().includes(search.toLowerCase()) ||
            m.hooks.some(h => getHookSearchText(h).includes(search.toLowerCase()))
        );

        return hasMatchingActive;
    });

    const mainContent = (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <ActionToolbar
                searchPlaceholder={t('settings.hooks_search_placeholder', 'Search hooks...')}
                searchValue={search}
                onSearchChange={setSearch}
                primaryAction={
                    <ViewModeToggle mode={mode} onChange={setMode} />
                }
                secondaryAction={
                    <>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 rounded-xl">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{t('settings.disable_all')}</span>
                            <Switch
                                checked={disableAllHooks}
                                onCheckedChange={toggleGlobalHooks}
                                className="scale-75"
                            />
                        </div>
                    </>
                }
            />

            <section className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-3">
                <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border border-border/40 bg-background/70 p-3">
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

                    <div className="rounded-lg border border-border/40 bg-background/70 p-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                {t("settings.session_end_timeout")}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                {t("settings.session_end_timeout_desc")}
                            </p>
                        </div>
                        <input
                            className="mt-3 h-8 w-32 rounded-lg border border-input bg-background px-2.5 font-mono text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
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

                <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border border-border/40 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                        {t("settings.allowed_http_hook_urls")}
                                    </p>
                                    <StatusBadge variant="blue">{allowedHttpHookUrls.length}</StatusBadge>
                                </div>
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                    {t("settings.allowed_http_hook_urls_desc")}
                                </p>
                            </div>
                        </div>

                        {allowedHttpHookUrls.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                                {allowedHttpHookUrls.map((value) => (
                                    <div key={value} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                            onClick={() => { void removeAllowedHttpHookUrl(value); }}
                                            title={t("common.remove")}
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-xs italic text-muted-foreground/70">
                                {t("settings.no_allowed_http_hook_urls")}
                            </p>
                        )}

                        <AddFormRow className="mt-3 items-stretch sm:items-center">
                            <input
                                className="flex-1 rounded-xl border border-border/50 bg-secondary/40 px-3.5 py-2 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
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
                                className="h-9 rounded-xl px-4"
                            >
                                {t("common.add")}
                            </Button>
                        </AddFormRow>
                    </div>

                    <div className="rounded-lg border border-border/40 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                        {t("settings.http_hook_allowed_env_vars")}
                                    </p>
                                    <StatusBadge variant="purple">{httpHookAllowedEnvVars.length}</StatusBadge>
                                </div>
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                                    {t("settings.http_hook_allowed_env_vars_desc")}
                                </p>
                            </div>
                        </div>

                        {httpHookAllowedEnvVars.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                                {httpHookAllowedEnvVars.map((value) => (
                                    <div key={value} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
                                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                            onClick={() => { void removeHttpHookAllowedEnvVar(value); }}
                                            title={t("common.remove")}
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-xs italic text-muted-foreground/70">
                                {t("settings.no_http_hook_allowed_env_vars")}
                            </p>
                        )}

                        <AddFormRow className="mt-3 items-stretch sm:items-center">
                            <input
                                className="flex-1 rounded-xl border border-border/50 bg-secondary/40 px-3.5 py-2 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
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
                                className="h-9 rounded-xl px-4"
                            >
                                {t("common.add")}
                            </Button>
                        </AddFormRow>
                    </div>
                </div>
            </section>

            <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-3 pr-3 [scrollbar-gutter:stable] ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
                {eventTypes.length === 0 ? (
                    <SettingsEmptyState
                        icon={Link2Icon}
                        title={t('settings.no_hooks', "No hooks defined")}
                        description={t('settings.no_hooks_hint', "Hooks allow you to run commands in response to events")}
                    />
                ) : (
                    <>
                        {filteredEvents.length > 0 ? (
                            <div className="space-y-3">
                                {filteredEvents.map((eventType) => {
                                    const isExpanded = expandedHookEvents.has(eventType) || search.length > 0;
                                    const matchers = hooks[eventType] || [];
                                    const totalCount = matchers.reduce((acc, m) => acc + m.hooks.length, 0);

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
                                                    <span className="text-sm font-medium text-foreground">{eventType}</span>
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
                                                                    <span>matcher:</span>
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
                                                                        subtitle={hook.timeout ? `${t('settings.timeout', 'Timeout')}: ${hook.timeout}s` : undefined}
                                                                        actions={
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                                                                onClick={() => deleteHookItem(eventType, matcherIndex, hookIndex)}
                                                                                title={t('common.delete')}
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
                                title={t('settings.no_hooks', "No hooks defined")}
                                description={search
                                    ? t('settings.no_match', { search })
                                    : t('settings.no_hooks_hint', "Hooks allow you to run commands in response to events")}
                            />
                        )}
                    </>
                )}
            </div>
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
