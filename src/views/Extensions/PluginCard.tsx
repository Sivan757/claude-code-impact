import type { KeyboardEvent } from "react";
import { DownloadIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import type { ScannedPlugin } from "../../types";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { ComponentBadgeRow } from "./ComponentBadgeRow";

interface PluginCardProps {
  plugin: ScannedPlugin;
  onSelect: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: (enabled: boolean) => void;
  onUpdate: () => void;
  isActionLoading: boolean;
  isToggleLoading: boolean;
  isUpdateLoading: boolean;
}

export function PluginCard({
  plugin,
  onSelect,
  onInstall,
  onUninstall,
  onToggle,
  onUpdate,
  isActionLoading,
  isToggleLoading,
  isUpdateLoading,
}: PluginCardProps) {
  const { t } = useTranslation();
  const componentCount =
    plugin.components.commands.length +
    plugin.components.skills.length +
    plugin.components.hooks.length +
    plugin.components.agents.length +
    plugin.components.mcps.length +
    plugin.components.lsps.length;
  const componentsHint =
    plugin.componentsSource === "remote"
      ? t("extensions_view.components_remote")
      : t("extensions_view.components_empty");

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="h-full w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink leading-snug line-clamp-2">
              {plugin.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${plugin.isInstalled ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                  }`}
              >
                {plugin.isInstalled ? t("extensions_view.installed") : t("extensions_view.not_installed")}
              </span>
              {plugin.isInstalled && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${plugin.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
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

          {plugin.isInstalled && (
            <div
              className="flex items-center gap-2 text-xs text-muted-foreground shrink-0"
              onClick={(event) => event.stopPropagation()}
            >
              {isToggleLoading ? (
                <ReloadIcon className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Switch
                  checked={plugin.isEnabled}
                  onCheckedChange={(checked) => onToggle(checked)}
                  disabled={isToggleLoading}
                />
              )}
              <span>{plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}</span>
            </div>
          )}
        </div>

        {plugin.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
        )}
        {componentCount > 0 ? (
          <ComponentBadgeRow components={plugin.components} />
        ) : (
          <p className="text-xs text-muted-foreground">{componentsHint}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          {plugin.isInstalled ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate();
                }}
                disabled={isUpdateLoading}
              >
                <ReloadIcon className={`w-4 h-4 mr-1 ${isUpdateLoading ? "animate-spin" : ""}`} />
                {t("extensions_view.update")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onUninstall();
                }}
                disabled={isActionLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isActionLoading ? (
                  <ReloadIcon className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <TrashIcon className="w-4 h-4 mr-1" />
                )}
                {t("extensions_view.uninstall")}
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onInstall();
                }}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <ReloadIcon className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <DownloadIcon className="w-4 h-4 mr-1" />
                )}
                {t("extensions_view.install")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
