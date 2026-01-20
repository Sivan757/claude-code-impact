import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cross2Icon, DownloadIcon } from "@radix-ui/react-icons";
import { ConfigPage, EmptyState, LoadingState, PageHeader } from "../../components/config";
import type { ScannedPlugin } from "../../types";
import { Button } from "../../components/ui/button";
import { MarketplaceSidebar } from "./MarketplaceSidebar";
import { PluginCard } from "./PluginCard";
import { PluginDetailModal } from "./PluginDetailModal";
import { PluginFilterBar } from "./PluginFilterBar";
import { usePluginLibrary } from "./usePluginLibrary";

export function ExtensionsView() {
  const { t } = useTranslation();
  const {
    scanResult,
    plugins,
    filteredPlugins,
    stats,
    activeMarketplace,
    setActiveMarketplace,
    statusFilter,
    setStatusFilter,

    search,
    setSearch,
    actionError,
    setActionError,
    isScanning,
    scanError,
    isOperating,
    actionPluginId,
    togglingPluginId,
    updatingPluginId,
    updatingMarketplaceId,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePlugin,
    updateMarketplace,
    addMarketplace,
    removeMarketplace,
  } = usePluginLibrary();

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selectedPluginId) ?? null,
    [plugins, selectedPluginId]
  );

  const activeMarketplaceLabel = useMemo(() => {
    if (activeMarketplace === "all") {
      return t("extensions_view.marketplace_all");
    }
    const matched = scanResult.marketplaces.find((marketplace) => marketplace.id === activeMarketplace);
    return matched?.name ?? activeMarketplace;
  }, [activeMarketplace, scanResult.marketplaces, t]);

  useEffect(() => {
    if (selectedPluginId && !selectedPlugin) {
      setSelectedPluginId(null);
    }
  }, [selectedPlugin, selectedPluginId]);

  const errorMessages = [scanError, ...scanResult.errors].filter(Boolean) as string[];

  const handleSelectPlugin = (plugin: ScannedPlugin) => {
    setSelectedPluginId(plugin.id);
  };

  const showEmpty =
    !isScanning &&
    filteredPlugins.length === 0 &&
    (!search || search.trim().length === 0) &&
    statusFilter === "all" &&
    activeMarketplace === "all";

  const showFilteredEmpty = !isScanning && filteredPlugins.length === 0 && !showEmpty;

  return (
    <ConfigPage>
      <PageHeader title={t("extensions_view.title")} subtitle={t("extensions_view.subtitle")} />

      <div className="flex gap-6 h-full min-h-0">
        <MarketplaceSidebar
          marketplaces={scanResult.marketplaces}
          activeMarketplace={activeMarketplace}
          activeMarketplaceLabel={activeMarketplaceLabel}
          onSelect={setActiveMarketplace}
          onAdd={addMarketplace}
          onRemove={removeMarketplace}
          onUpdate={updateMarketplace}
          isOperating={isOperating}
          totalCount={plugins.length}
          collapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          updatingMarketplaceId={updatingMarketplaceId}
        />

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="shrink-0">
            <PluginFilterBar
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              stats={stats}
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {(actionError || errorMessages.length > 0) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-2 mb-4">
                {actionError && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t("extensions_view.action_error_title")}</p>
                      <p className="mt-1 break-words">{actionError}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActionError(null)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title={t("extensions_view.dismiss_error")}
                    >
                      <Cross2Icon className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {errorMessages.length > 0 && (
                  <div>
                    <p className="font-medium">{t("extensions_view.scan_error_title")}</p>
                    <ul className="mt-2 space-y-1">
                      {errorMessages.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isScanning ? (
              <LoadingState message={t("extensions_view.loading_plugins")} />
            ) : (
              <>
                {filteredPlugins.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 pb-4">
                    {filteredPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onSelect={() => handleSelectPlugin(plugin)}
                        onInstall={() => installPlugin(plugin.id)}
                        onUninstall={() => uninstallPlugin(plugin.id)}
                        onToggle={(enabled) => togglePlugin(plugin.id, enabled)}
                        onUpdate={() => updatePlugin(plugin.id)}
                        isActionLoading={actionPluginId === plugin.id}
                        isToggleLoading={togglingPluginId === plugin.id}
                        isUpdateLoading={updatingPluginId === plugin.id}
                      />
                    ))}
                  </div>
                )}

                {showEmpty && (
                  <EmptyState
                    icon={DownloadIcon}
                    message={t("extensions_view.empty_state")}
                    hint={t("extensions_view.empty_state_hint")}
                  />
                )}

                {showFilteredEmpty && (
                  <EmptyState
                    icon={DownloadIcon}
                    message={t("extensions_view.empty_filtered")}
                    hint={t("extensions_view.empty_filtered_hint")}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <PluginDetailModal
        plugin={selectedPlugin}
        open={Boolean(selectedPlugin)}
        onOpenChange={(open) => {
          if (!open) setSelectedPluginId(null);
        }}
        onInstall={() => selectedPlugin && installPlugin(selectedPlugin.id)}
        onUninstall={() => selectedPlugin && uninstallPlugin(selectedPlugin.id)}
        onToggle={(enabled) => selectedPlugin && togglePlugin(selectedPlugin.id, enabled)}
        onUpdate={() => selectedPlugin && updatePlugin(selectedPlugin.id)}
        isActionLoading={Boolean(selectedPlugin && actionPluginId === selectedPlugin.id)}
        isToggleLoading={Boolean(selectedPlugin && togglingPluginId === selectedPlugin.id)}
        isUpdateLoading={Boolean(selectedPlugin && updatingPluginId === selectedPlugin.id)}
      />
    </ConfigPage>
  );
}
