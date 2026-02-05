import { useState, useEffect } from "react";
import { ConfigPage } from "../../components/config";
import { Tabs, TabsContent } from "../../components/ui/tabs";
import { SettingsView } from "./SettingsView";
import { LlmProviderView } from "./LlmProviderView";
import { EnvSettingsView } from "./EnvSettingsView";
import { ExtensionsView } from "../Extensions/ExtensionsView";
import { HooksSettingsView } from "./HooksSettingsView";
import { ConfigEditor } from "../../config";

interface GlobalSettingsViewProps {
    defaultTab?: "general" | "provider" | "plugins" | "env" | "hooks" | "advanced";
    settingsPath?: string;
}

export function GlobalSettingsView({ defaultTab = "general", settingsPath }: GlobalSettingsViewProps) {
    const [activeTab, setActiveTab] = useState(defaultTab);

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
                        <TabsContent value="general" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin px-6 py-6">
                            <SettingsView embedded={true} settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="provider" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin px-6 py-6">
                            <LlmProviderView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="plugins" className="h-full m-0 data-[state=active]:flex flex-col overflow-hidden outline-none scrollbar-thin px-6 py-6">
                            <ExtensionsView embedded />
                        </TabsContent>
                        <TabsContent value="env" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin px-6 py-6">
                            <EnvSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="hooks" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin px-6 py-6">
                            <HooksSettingsView embedded settingsPath={settingsPath} />
                        </TabsContent>
                        <TabsContent value="advanced" className="h-full m-0 data-[state=active]:flex flex-col overflow-y-auto outline-none scrollbar-thin px-6 py-6">
                            <ConfigEditor projectPath={undefined} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ConfigPage>
    );
}
