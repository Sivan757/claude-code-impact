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
    PageHeader,
    ConfigPage,
} from "../../components/config";
import {
    SettingSection,
    SettingsEmptyState,
    StatusBadge,
} from "../../components/Settings";
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

    const mainContent = (
        <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto pb-3">
            {!settings?.raw ? (
                <SettingsEmptyState
                    icon={Link2Icon}
                    title={t('settings.no_settings')}
                    description={t('settings.create_hint')}
                />
            ) : (
                <>
                    {(Object.keys(hooks).length > 0 || Object.keys(disabledHooks).length > 0) ? (
                        <SettingSection
                            title={t('settings.hooks')}
                            density="dense"
                            action={
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">{t('settings.disable_all')}</span>
                                    <Switch
                                        checked={disableAllHooks}
                                        onCheckedChange={(checked) => updateField("disableAllHooks", checked)}
                                    />
                                </div>
                            }
                        >
                            <div className={`space-y-1.5 ${disableAllHooks ? "opacity-50 pointer-events-none" : ""}`}>
                                {[...new Set([...Object.keys(hooks), ...Object.keys(disabledHooks)])].map((eventType) => {
                                    const isExpanded = expandedHookEvents.has(eventType);
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
                                                <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-1.5">
                                                    {/* Active hooks */}
                                                    {matchers.map((matcher, matcherIndex) => (
                                                        <div key={matcherIndex} className="space-y-1.5">
                                                            {matcher.matcher && (
                                                                <p className="text-xs text-muted-foreground pl-6">
                                                                    matcher: <code className="bg-secondary/60 px-1.5 py-0.5 rounded text-foreground">{matcher.matcher}</code>
                                                                </p>
                                                            )}
                                                            {matcher.hooks.map((hook, hookIndex) => (
                                                                <div
                                                                    key={hookIndex}
                                                                    className="flex items-center justify-between pl-6 pr-2 py-1.5 bg-card/80 rounded-lg group hover:bg-card transition-colors"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-mono text-foreground truncate">
                                                                            {hook.command || hook.type}
                                                                        </p>
                                                                        {hook.timeout && (
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                timeout: {hook.timeout}s
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => deleteHookItem(eventType, matcherIndex, hookIndex)}
                                                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all"
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
                                                        <div className="space-y-1.5 pt-2 border-t border-border/30">
                                                            <p className="text-xs text-muted-foreground pl-6 italic">Disabled</p>
                                                            {disabledForEvent.map((item, disabledIndex) => (
                                                                <div
                                                                    key={`disabled-${disabledIndex}`}
                                                                    className="flex items-center justify-between pl-6 pr-2 py-1.5 bg-card/40 rounded-lg opacity-60 group hover:opacity-80 transition-opacity"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-mono text-foreground truncate">
                                                                            {item.hook.command || item.hook.type}
                                                                        </p>
                                                                        {item.hook.timeout && (
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                timeout: {item.hook.timeout}s
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => deleteDisabledHook(eventType, disabledIndex)}
                                                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all"
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
                        </SettingSection>
                    ) : (
                        <SettingsEmptyState
                            icon={Link2Icon}
                            title={t('settings.no_hooks', "No hooks defined")}
                            description={t('settings.no_hooks_hint', "Hooks allow you to run commands in response to events")}
                        />
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
