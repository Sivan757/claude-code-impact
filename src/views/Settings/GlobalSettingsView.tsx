import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ConfigPage } from "../../components/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { SettingsView } from "./SettingsView";
import { LlmProviderView } from "./LlmProviderView";
import { EnvSettingsView } from "./EnvSettingsView";
import { ExtensionsView } from "../Extensions/ExtensionsView";
import { HooksSettingsView } from "./HooksSettingsView";
import { useQueryClient } from "../../hooks";
import { Button } from "../../components/ui/button";
import {
    GearIcon,
    LightningBoltIcon,
    CubeIcon,
    MixIcon,
    Link2Icon,
    ReloadIcon
} from "@radix-ui/react-icons";

interface GlobalSettingsViewProps {
    defaultTab?: "general" | "provider" | "plugins" | "env" | "hooks";
    settingsPath?: string;
}

const TAB_CONFIG = [
    { value: "general", icon: GearIcon, labelKey: "features.common_settings" },
    { value: "provider", icon: LightningBoltIcon, labelKey: "features.basic-llm" },
    { value: "plugins", icon: CubeIcon, labelKey: "features.extensions", fallbackKey: "features.plugins" },
    { value: "env", icon: MixIcon, labelKey: "features.basic-env" },
    { value: "hooks", icon: Link2Icon, labelKey: "features.hooks", fallback: "Hooks" },
] as const;

export function GlobalSettingsView({ defaultTab = "general", settingsPath }: GlobalSettingsViewProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const settingsKey = ["settings", settingsPath ?? "default"];

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: settingsKey });
        queryClient.invalidateQueries({ queryKey: ["installedPlugins"] });
        queryClient.invalidateQueries({ queryKey: ["hooks"] });
    };

    const getTabLabel = (tab: typeof TAB_CONFIG[number]) => {
        const label = t(tab.labelKey);
        if (label && label !== tab.labelKey) return label;
        if ('fallbackKey' in tab) return t(tab.fallbackKey as string);
        if ('fallback' in tab) return tab.fallback;
        return tab.labelKey;
    };

    return (
        <ConfigPage>
            {/* Header Section */}
            <header className="mb-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">
                            {t('settings_dialog.title') || "Settings"}
                        </h1>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                            {t('settings.global_subtitle', 'Manage all your configurations in one place')}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={refresh}
                        title={t('common.refresh')}
                        className="rounded-xl hover:bg-secondary/80"
                    >
                        <ReloadIcon className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* Tabs Container */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                    className="flex-1 flex flex-col h-full"
                >
                    {/* Tab Navigation */}
                    <div className="pb-0">
                        <TabsList className="h-10 bg-secondary/40 p-0.5 gap-1 w-auto inline-flex justify-start rounded-lg border border-border/30 backdrop-blur-sm">
                            {TAB_CONFIG.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <TabsTrigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="px-3 h-full rounded-md gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-border/50"
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{getTabLabel(tab)}</span>
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="general" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto">
                            <SettingsView embedded={true} settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="provider" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto">
                            <LlmProviderView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="plugins" className="h-full m-0 data-[state=active]:flex flex-col overflow-hidden">
                            <ExtensionsView embedded />
                        </TabsContent>
                        <TabsContent value="env" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto">
                            <EnvSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="hooks" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto">
                            <HooksSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ConfigPage>
    );
}
