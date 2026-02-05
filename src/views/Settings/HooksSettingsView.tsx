import { useState } from "react";
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
    ListItemCard,
    SettingsEmptyState,
    StatusBadge,
    ViewModeToggle,
    ScopeSelector,
} from "../../components/Settings";
import { useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { ConfigScope, ConfigFileKind } from "../../config/types";
import { useConfigMerged, useConfigWrite, useConfigDeleteKey } from "../../config/hooks/useConfig";

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

    // Multi-scope editing state
    const [selectedScope, setSelectedScope] = useState<ConfigScope>(ConfigScope.User);

    // Fetch merged config
    const { data: mergedConfig, isLoading } = useConfigMerged(settingsPath);

    // Mutations
    const writeMutation = useConfigWrite();
    const deleteMutation = useConfigDeleteKey();

    const [search, setSearch] = useState("");
    const { mode, setMode } = useViewMode("hooks");
    const [expandedHookEvents, setExpandedHookEvents] = useState<Set<string>>(new Set());

    if (isLoading) return <LoadingState message={t('settings.loading')} />;

    // Extract hooks from merged config
    const hooks = (mergedConfig?.effective?.hooks as Record<string, HookMatcher[]>) || {};
    const disableAllHooks = mergedConfig?.effective?.disable_all_hooks === true;

    const toggleGlobalHooks = async (disabled: boolean) => {
        await writeMutation.mutateAsync({
            kind: ConfigFileKind.Settings,
            scope: selectedScope,
            projectPath: settingsPath,
            key: "disable_all_hooks",
            value: disabled,
        });
    };

    const deleteHookItem = async (eventType: string, matcherIndex: number, hookIndex: number) => {
        if (!confirm(t('settings.delete_hook_confirm'))) return;

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
                    kind: ConfigFileKind.Settings,
                    scope: selectedScope,
                    projectPath: settingsPath,
                    key: `hooks.${eventType}`,
                });
            } else {
                // Update the event type with remaining matchers
                await writeMutation.mutateAsync({
                    kind: ConfigFileKind.Settings,
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
                kind: ConfigFileKind.Settings,
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
            m.matcher.toLowerCase().includes(search.toLowerCase()) ||
            m.hooks.some(h => (h.command || h.type).toLowerCase().includes(search.toLowerCase()))
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
                        <ScopeSelector
                            value={selectedScope}
                            onChange={setSelectedScope}
                        />
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

            <div className={`flex-1 overflow-y-auto min-h-0 pb-3 ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
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
                                                                        title={hook.command || hook.type}
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
