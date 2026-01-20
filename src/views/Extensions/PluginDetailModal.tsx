import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CopyIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import type { ScannedPlugin } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { ComponentBadgeRow } from "./ComponentBadgeRow";

interface PluginDetailModalProps {
  plugin: ScannedPlugin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: (enabled: boolean) => void;
  onUpdate: () => void;
  isActionLoading: boolean;
  isToggleLoading: boolean;
  isUpdateLoading: boolean;
}

interface CommandItem {
  label: string;
  value: string;
}

export function PluginDetailModal({
  plugin,
  open,
  onOpenChange,
  onInstall,
  onUninstall,
  onToggle,
  onUpdate,
  isActionLoading,
  isToggleLoading,
  isUpdateLoading,
}: PluginDetailModalProps) {
  const { t } = useTranslation();

  const commands = useMemo<CommandItem[]>(() => {
    if (!plugin) return [];
    return [
      { label: t("extensions_view.command_install"), value: `claude plugin install ${plugin.id}` },
      { label: t("extensions_view.command_uninstall"), value: `claude plugin uninstall ${plugin.id}` },
      { label: t("extensions_view.command_enable"), value: `claude plugin enable ${plugin.id}` },
      { label: t("extensions_view.command_disable"), value: `claude plugin disable ${plugin.id}` },
      { label: t("extensions_view.command_update"), value: `claude plugin update ${plugin.id}` },
    ];
  }, [plugin, t]);

  const handleCopy = (value: string) => {
    invoke("copy_to_clipboard", { text: value }).catch(() => {});
  };

  if (!plugin) {
    return null;
  }

  const componentSections = [
    { key: "commands", label: t("features.commands"), items: plugin.components.commands },
    { key: "skills", label: t("features.skills"), items: plugin.components.skills },
    { key: "hooks", label: t("features.hooks"), items: plugin.components.hooks },
    { key: "agents", label: t("features.sub-agents"), items: plugin.components.agents },
    { key: "mcps", label: t("features.mcp"), items: plugin.components.mcps },
    { key: "lsps", label: t("extensions_view.lsps"), items: plugin.components.lsps },
  ];
  const totalComponents = componentSections.reduce((sum, section) => sum + section.items.length, 0);
  const componentsHint =
    plugin.componentsSource === "remote"
      ? t("extensions_view.components_remote")
      : t("extensions_view.components_empty");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-ink">{plugin.name}</DialogTitle>
              {plugin.description && (
                <p className="text-sm text-muted-foreground">{plugin.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    plugin.isInstalled ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {plugin.isInstalled ? t("extensions_view.installed") : t("extensions_view.not_installed")}
                </span>
                {plugin.isInstalled && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      plugin.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}
                  </span>
                )}
                {plugin.version && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-card-alt text-muted-foreground">
                    v{plugin.version}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!plugin.isInstalled ? (
                <Button onClick={onInstall} disabled={isActionLoading}>
                  {t("extensions_view.install")}
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={plugin.isEnabled}
                      onCheckedChange={(checked) => onToggle(checked)}
                      disabled={isToggleLoading}
                    />
                    <span>{plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}</span>
                  </div>
                  <Button variant="outline" onClick={onUpdate} disabled={isUpdateLoading}>
                    <ReloadIcon className={`w-4 h-4 mr-1 ${isUpdateLoading ? "animate-spin" : ""}`} />
                    {t("extensions_view.update")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={onUninstall}
                    disabled={isActionLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    {t("extensions_view.uninstall")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("extensions_view.marketplace_label")}</span>
              <span className="font-medium text-ink">{plugin.marketplace}</span>
            </div>
            {plugin.author && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("extensions_view.author_label")}</span>
                <span className="font-medium text-ink">{plugin.author}</span>
              </div>
            )}
            {plugin.repository && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("extensions_view.repository_label")}</span>
                <span className="font-medium text-ink truncate">{plugin.repository}</span>
              </div>
            )}
            {plugin.localPath && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("extensions_view.local_path_label")}</span>
                <span className="font-mono text-xs text-ink truncate">{plugin.localPath}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">{t("extensions_view.components_title")}</h4>
              <span className="text-xs text-muted-foreground">{totalComponents}</span>
            </div>
            <ComponentBadgeRow components={plugin.components} />
            {totalComponents === 0 ? (
              <p className="text-sm text-muted-foreground">{componentsHint}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {componentSections
                  .filter((section) => section.items.length > 0)
                  .map((section) => (
                    <div key={section.key} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between text-sm font-medium text-ink">
                        <span>{section.label}</span>
                        <span className="text-xs text-muted-foreground">{section.items.length}</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={`${section.key}-${item.name}`} className="truncate">
                            {item.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-ink">{t("extensions_view.commands_title")}</h4>
            <div className="space-y-2">
              {commands.map((command) => (
                <div
                  key={command.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{command.label}</p>
                    <p className="font-mono text-xs text-ink truncate">{command.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(command.value)}
                    className="h-8 w-8"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
