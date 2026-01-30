
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ConfigPage, PageHeader } from "../../components/config";
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

export function GlobalSettingsView({ defaultTab = "general", settingsPath }: GlobalSettingsViewProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const settingsKey = ["settings", settingsPath ?? "default"];

    // Sync activeTab if defaultTab changes (e.g. navigation via sidebar)
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: settingsKey });
        queryClient.invalidateQueries({ queryKey: ["installedPlugins"] });
        queryClient.invalidateQueries({ queryKey: ["hooks"] });
    };

    return (
        <ConfigPage>
            <PageHeader
                title={t('settings_dialog.title') || "Unified Settings"}
                subtitle={
                    settingsPath
                        ? `${t('settings.global_subtitle', 'Manage all your configurations in one place')} · ${settingsPath}`
                        : t('settings.global_subtitle', 'Manage all your configurations in one place')
                }
                action={
                    <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh')}>
                        <ReloadIcon className="w-4 h-4" />
                    </Button>
                }
            />

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col h-full">
                    <div className="px-1 pb-1 bg-canvas">
                        <TabsList className="h-12 bg-secondary/50 p-1.5 gap-2 w-auto inline-flex justify-start rounded-xl border border-border/40 backdrop-blur-sm">
                            <TabsTrigger value="general" className="px-5 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 transition-all duration-200 ease-in-out font-medium text-muted-foreground hover:text-foreground">
                                <GearIcon className="w-4 h-4 mr-2" />
                                {t('features.common_settings')}
                            </TabsTrigger>
                            <TabsTrigger value="provider" className="px-5 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 transition-all duration-200 ease-in-out font-medium text-muted-foreground hover:text-foreground">
                                <LightningBoltIcon className="w-4 h-4 mr-2" />
                                {t('features.basic-llm')}
                            </TabsTrigger>
                            <TabsTrigger value="plugins" className="px-5 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 transition-all duration-200 ease-in-out font-medium text-muted-foreground hover:text-foreground">
                                <CubeIcon className="w-4 h-4 mr-2" />
                                {t('features.extensions') || t('features.plugins')}
                            </TabsTrigger>
                            <TabsTrigger value="env" className="px-5 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 transition-all duration-200 ease-in-out font-medium text-muted-foreground hover:text-foreground">
                                <MixIcon className="w-4 h-4 mr-2" />
                                {t('features.basic-env')}
                            </TabsTrigger>
                            <TabsTrigger value="hooks" className="px-5 h-full rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 transition-all duration-200 ease-in-out font-medium text-muted-foreground hover:text-foreground">
                                <Link2Icon className="w-4 h-4 mr-2" />
                                {t('features.hooks') || "Hooks"}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden bg-canvas">
                        <TabsContent value="general" className="h-full m-0 data-[state=active]:flex flex-col">
                            <SettingsView embedded={true} settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="provider" className="h-full m-0 data-[state=active]:flex flex-col">
                            <LlmProviderView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="plugins" className="h-full m-0 data-[state=active]:flex flex-col">
                            <ExtensionsView embedded />
                        </TabsContent>
                        <TabsContent value="env" className="h-full m-0 data-[state=active]:flex flex-col">
                            <EnvSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="hooks" className="h-full m-0 data-[state=active]:flex flex-col">
                            <HooksSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ConfigPage>
    );
}
