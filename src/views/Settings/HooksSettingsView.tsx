import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
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
    ListItemCard,
    SettingsEmptyState,
    StatusBadge,
    ViewModeToggle,
} from "../../components/Settings";
import { useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import type { ClaudeSettings } from "../../types";

interface HookItem {
    type: string;
    command?: string;
    timeout?: number;
    disabled?: boolean;
}

interface HookMatcher {
    matcher: string;
    hooks: HookItem[];
}

export function HooksSettingsView(props: { embedded?: boolean; settingsPath?: string }) {
    const { embedded = false, settingsPath } = props;
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const settingsKey = ["settings", settingsPath ?? "default"];
    const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(
        settingsKey,
        "get_settings",
        settingsPath ? { path: settingsPath } : undefined
    );
    // Load disabled hooks from claudecodeimpact storage
    const { data: disabledHooksData } = useInvokeQuery<Record<string, Array<{ matcher: string; hook: HookItem; key: string }>>>(
        ["disabledHooks"],
        "get_disabled_hooks"
    );

    const [search, setSearch] = useState("");
    const { mode, setMode } = useViewMode("hooks");
    const [expandedHookEvents, setExpandedHookEvents] = useState<Set<string>>(new Set());

    const raw = (settings?.raw as Record<string, unknown>) || {};
    const hooks = (raw.hooks as Record<string, HookMatcher[]>) || {};
    const disableAllHooks = raw.disableAllHooks === true;
    const disabledHooks = disabledHooksData || {};

    const refreshSettings = () => {
        queryClient.invalidateQueries({ queryKey: settingsKey });
        queryClient.invalidateQueries({ queryKey: ["disabledHooks"] });
    };

    const updateField = async (field: string, value: unknown) => {
        await invoke("update_settings_field", { field, value, path: settingsPath || undefined });
        refreshSettings();
    };

    const toggleHookItem = async (eventType: string, matcherIndex: number, hookIndex: number, disabled: boolean) => {
        await invoke("toggle_hook_item", { eventType, matcherIndex, hookIndex, disabled, path: settingsPath || undefined });
        refreshSettings();
    };

    const deleteHookItem = async (eventType: string, matcherIndex: number, hookIndex: number) => {
        if (!confirm(t('settings.delete_hook_confirm'))) return;
        await invoke("delete_hook_item", { eventType, matcherIndex, hookIndex, path: settingsPath || undefined });
        refreshSettings();
    };

    const deleteDisabledHook = async (eventType: string, index: number) => {
        if (!confirm(t('settings.delete_disabled_hook_confirm'))) return;
        await invoke("delete_disabled_hook", { eventType, index });
        refreshSettings();
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

    if (isLoading) return <LoadingState message={t('settings.loading')} />;

    // Filter logic
    const filteredEvents = [...new Set([...Object.keys(hooks), ...Object.keys(disabledHooks)])].filter(eventType => {
        if (!search) return true;
        // Basic filter: check if event type matches
        if (eventType.toLowerCase().includes(search.toLowerCase())) return true;

        // Advanced: check if any hook command matches
        const matchers = hooks[eventType] || [];
        const disabledForEvent = disabledHooks[eventType] || [];

        const hasMatchingActive = matchers.some(m =>
            m.matcher.toLowerCase().includes(search.toLowerCase()) ||
            m.hooks.some(h => (h.command || h.type).toLowerCase().includes(search.toLowerCase()))
        );

        const hasMatchingDisabled = disabledForEvent.some(item =>
            item.matcher.toLowerCase().includes(search.toLowerCase()) ||
            (item.hook.command || item.hook.type).toLowerCase().includes(search.toLowerCase())
        );

        return hasMatchingActive || hasMatchingDisabled;
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 rounded-xl">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{t('settings.disable_all')}</span>
                        <Switch
                            checked={disableAllHooks}
                            onCheckedChange={(checked) => updateField("disableAllHooks", checked)}
                            className="scale-75"
                        />
                    </div>
                }
            />

            <div className={`flex-1 overflow-y-auto min-h-0 pb-3 ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
                {!settings?.raw ? (
                    <SettingsEmptyState
                        icon={Link2Icon}
                        title={t('settings.no_settings')}
                        description={t('settings.create_hint')}
                    />
                ) : (
                    <>
                        {filteredEvents.length > 0 ? (
                            <div className="space-y-3">
                                {filteredEvents.map((eventType) => {
                                    const isExpanded = expandedHookEvents.has(eventType) || search.length > 0;
                                    const matchers = hooks[eventType] || [];
                                    const disabledForEvent = disabledHooks[eventType] || [];
                                    const activeCount = matchers.reduce((acc, m) => acc + m.hooks.length, 0);
                                    const totalCount = activeCount + disabledForEvent.length;

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
                                                <StatusBadge variant={disabledForEvent.length > 0 ? "warning" : "muted"}>
                                                    {disabledForEvent.length > 0 ? `${activeCount}/${totalCount}` : totalCount}
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
                                                                        title={hook.command || hook.type}
                                                                        subtitle={hook.timeout ? `${t('settings.timeout', 'Timeout')}: ${hook.timeout}s` : undefined}
                                                                        actions={
                                                                            <>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                                                                    onClick={() => deleteHookItem(eventType, matcherIndex, hookIndex)}
                                                                                    title={t('common.delete')}
                                                                                >
                                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                                <Switch
                                                                                    checked={true}
                                                                                    onCheckedChange={() =>
                                                                                        toggleHookItem(eventType, matcherIndex, hookIndex, true)
                                                                                    }
                                                                                    className="scale-75"
                                                                                />
                                                                            </>
                                                                        }
                                                                        className="bg-card"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Disabled hooks */}
                                                    {disabledForEvent.length > 0 && (
                                                        <div className="space-y-2 pt-2 border-t border-border/30">
                                                            <p className="text-xs text-muted-foreground pl-2 italic">Disabled</p>
                                                            <div className={cn(
                                                                mode === "card"
                                                                    ? "grid gap-2 sm:grid-cols-2"
                                                                    : "flex flex-col gap-2"
                                                            )}>
                                                                {disabledForEvent.map((item, disabledIndex) => (
                                                                    <ListItemCard
                                                                        key={`disabled-${disabledIndex}`}
                                                                        avatar={<Link2Icon className="w-4 h-4" />}
                                                                        title={item.hook.command || item.hook.type}
                                                                        subtitle={item.hook.timeout ? `${t('settings.timeout', 'Timeout')}: ${item.hook.timeout}s` : undefined}
                                                                        isDisabled={true} // Visual opacity
                                                                        badges={<StatusBadge variant="warning">Disabled</StatusBadge>}
                                                                        actions={
                                                                            <>
                                                                                <div className="pointer-events-auto">
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                                                                                        onClick={() => deleteDisabledHook(eventType, disabledIndex)}
                                                                                        title={t('common.delete')}
                                                                                    >
                                                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                                <div className="pointer-events-auto">
                                                                                    <Switch
                                                                                        checked={false}
                                                                                        onCheckedChange={() =>
                                                                                            toggleHookItem(eventType, 0, disabledIndex, false)
                                                                                        }
                                                                                        className="scale-75"
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        }
                                                                        className="bg-card/40"
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
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
