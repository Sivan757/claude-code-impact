import { useState, useEffect } from "react";
import { ConfigPage } from "../../components/config";
import { Tabs, TabsContent } from "../../components/ui/tabs";
import { SettingsView } from "./SettingsView";
import { LlmProviderView } from "./LlmProviderView";
import { EnvSettingsView } from "./EnvSettingsView";
import { ExtensionsView } from "../Extensions/ExtensionsView";
import { HooksSettingsView } from "./HooksSettingsView";
import { ConfigEditor } from "../../config";
import { BackupRestoreSection } from "./BackupRestoreSection";

interface GlobalSettingsViewProps {
    defaultTab?: "general" | "provider" | "plugins" | "env" | "hooks" | "advanced";
    settingsPath?: string;
}

export function GlobalSettingsView({ defaultTab = "general", settingsPath }: GlobalSettingsViewProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const scrollableTabClass =
        "h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin pl-6 pr-8 py-6 [scrollbar-gutter:stable]";

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    return (
        <ConfigPage className="p-0">
            {/* Tabs Container */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                    className="flex-1 flex flex-col h-full"
                >


                    {/* Tab Content Area */}
                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="general" className={scrollableTabClass}>
                            <SettingsView embedded={true} settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="provider" className={scrollableTabClass}>
                            <LlmProviderView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="plugins" className="h-full m-0 data-[state=active]:flex flex-col overflow-hidden outline-none scrollbar-thin px-6 py-6">
                            <ExtensionsView embedded allowScope={false} />
                        </TabsContent>
                        <TabsContent value="env" className={scrollableTabClass}>
                            <EnvSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="hooks" className={scrollableTabClass}>
                            <HooksSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="advanced" className={scrollableTabClass}>
                            <div className="space-y-8">
                                <ConfigEditor projectPath={settingsPath} />
                                <div className="border-t border-border/30 pt-6">
                                    <BackupRestoreSection settingsPath={settingsPath} />
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ConfigPage>
    );
}
