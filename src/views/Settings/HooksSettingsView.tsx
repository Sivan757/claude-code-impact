import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import {
    GearIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from "@radix-ui/react-icons";
import { Switch } from "../../components/ui/switch";
import {
    LoadingState,
    EmptyState,
    PageHeader,
    ConfigPage,
} from "../../components/config";
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

export function HooksSettingsView(props: { embedded?: boolean }) {
    const { embedded = false } = props;
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");
    // Load disabled hooks from claudecodeimpact storage
    const { data: disabledHooksData } = useInvokeQuery<Record<string, Array<{ matcher: string; hook: HookItem; key: string }>>>(
        ["disabledHooks"],
        "get_disabled_hooks"
    );

    const [expandedHookEvents, setExpandedHookEvents] = useState<Set<string>>(new Set());

    const raw = (settings?.raw as Record<string, unknown>) || {};
    const hooks = (raw.hooks as Record<string, HookMatcher[]>) || {};
    const disableAllHooks = raw.disableAllHooks === true;
    const disabledHooks = disabledHooksData || {};

    const refreshSettings = () => {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        queryClient.invalidateQueries({ queryKey: ["disabledHooks"] });
    };

    const updateField = async (field: string, value: unknown) => {
        await invoke("update_settings_field", { field, value });
        refreshSettings();
    };

    const toggleHookItem = async (eventType: string, matcherIndex: number, hookIndex: number, disabled: boolean) => {
        await invoke("toggle_hook_item", { eventType, matcherIndex, hookIndex, disabled });
        refreshSettings();
    };

    const deleteHookItem = async (eventType: string, matcherIndex: number, hookIndex: number) => {
        if (!confirm(t('settings.delete_hook_confirm'))) return;
        await invoke("delete_hook_item", { eventType, matcherIndex, hookIndex });
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

    const mainContent = (
        <div className="flex-1 flex flex-col min-h-0 space-y-6 overflow-y-auto">
            {!settings?.raw ? (
                <EmptyState icon={GearIcon} message={t('settings.no_settings')} hint={t('settings.create_hint')} />
            ) : (
                <>
                    {(Object.keys(hooks).length > 0 || Object.keys(disabledHooks).length > 0) ? (
                        <section className="bg-card rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-ink">{t('settings.hooks')}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('settings.disable_all')}</span>
                                    <Switch
                                        checked={disableAllHooks}
                                        onCheckedChange={(checked) => updateField("disableAllHooks", checked)}
                                    />
                                </div>
                            </div>
                            <div className={`space-y-2 ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
                                {/* Get all event types from both active and disabled hooks */}
                                {[...new Set([...Object.keys(hooks), ...Object.keys(disabledHooks)])].map((eventType) => {
                                    const isExpanded = expandedHookEvents.has(eventType);
                                    const matchers = hooks[eventType] || [];
                                    const disabledForEvent = disabledHooks[eventType] || [];
                                    const activeCount = matchers.reduce((acc, m) => acc + m.hooks.length, 0);
                                    const totalCount = activeCount + disabledForEvent.length;

                                    return (
                                        <div key={eventType} className="bg-card-alt rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => toggleHookEvent(eventType)}
                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-card-alt/80"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? (
                                                        <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                    <span className="text-sm text-ink font-medium">{eventType}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {disabledForEvent.length > 0 ? `${activeCount}/${totalCount}` : totalCount}
                                                </span>
                                            </button>

                                            {isExpanded && (
                                                <div className="px-3 pb-3 space-y-2">
                                                    {/* Active hooks */}
                                                    {matchers.map((matcher, matcherIndex) => (
                                                        <div key={matcherIndex} className="space-y-1">
                                                            {matcher.matcher && (
                                                                <p className="text-xs text-muted-foreground pl-6">
                                                                    matcher: <code className="bg-card px-1 rounded">{matcher.matcher}</code>
                                                                </p>
                                                            )}
                                                            {matcher.hooks.map((hook, hookIndex) => (
                                                                <div
                                                                    key={hookIndex}
                                                                    className="flex items-center justify-between pl-6 pr-2 py-1.5 bg-card rounded group"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-mono text-ink truncate">
                                                                            {hook.command || hook.type}
                                                                        </p>
                                                                        {hook.timeout && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                timeout: {hook.timeout}s
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => deleteHookItem(eventType, matcherIndex, hookIndex)}
                                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                                                                        >
                                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <Switch
                                                                            checked={true}
                                                                            onCheckedChange={() =>
                                                                                toggleHookItem(eventType, matcherIndex, hookIndex, true)
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}

                                                    {/* Disabled hooks */}
                                                    {disabledForEvent.length > 0 && (
                                                        <div className="space-y-1 pt-2 border-t border-border/50">
                                                            <p className="text-xs text-muted-foreground pl-6 italic">Disabled</p>
                                                            {disabledForEvent.map((item, disabledIndex) => (
                                                                <div
                                                                    key={`disabled-${disabledIndex}`}
                                                                    className="flex items-center justify-between pl-6 pr-2 py-1.5 bg-card rounded opacity-50 group"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-mono text-ink truncate">
                                                                            {item.hook.command || item.hook.type}
                                                                        </p>
                                                                        {item.hook.timeout && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                timeout: {item.hook.timeout}s
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => deleteDisabledHook(eventType, disabledIndex)}
                                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                                                                        >
                                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <Switch
                                                                            checked={false}
                                                                            onCheckedChange={() =>
                                                                                toggleHookItem(eventType, 0, disabledIndex, false)
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ) : (
                        <EmptyState icon={GearIcon} message={t('settings.no_hooks', "No hooks defined")} />
                    )}
                </>
            )}
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
            <PageHeader title={t('settings.hooks')} subtitle={t('settings.hooks_subtitle', 'Manage command hooks')} />
            {mainContent}
        </ConfigPage>
    );
}
