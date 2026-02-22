import type { KeyboardEvent } from "react";
import { DownloadIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import type { ScannedPlugin } from "../../types";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { ComponentBadgeRow } from "./ComponentBadgeRow";

interface PluginCardProps {
  plugin: ScannedPlugin;
  variant?: "card" | "list";
  onSelect: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: (enabled: boolean) => void;
  onUpdate: () => void;
  isActionLoading: boolean;
  isToggleLoading: boolean;
  isUpdateLoading: boolean;
}

function getSemanticVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const normalized = version.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function PluginCard({
  plugin,
  variant = "card",
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
  const semanticVersion = getSemanticVersion(plugin.version);
  const componentCount =
    plugin.components.commands.length +
    plugin.components.skills.length +
    plugin.components.hooks.length +
    plugin.components.claudeMd.length +
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

  const statusChips = (
    <div className="flex flex-wrap items-center gap-2">
      {semanticVersion && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-card-alt text-muted-foreground">
          v{semanticVersion}
        </span>
      )}
    </div>
  );
  const hasStatusChips = Boolean(semanticVersion);

  const toggleControlList = plugin.isInstalled && (
    <div
      className="flex items-center shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      {isToggleLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Switch
          checked={plugin.isEnabled}
          onCheckedChange={(checked) => onToggle(checked)}
          disabled={isToggleLoading}
          aria-label={t("extensions_view.enabled")}
        />
      )}
    </div>
  );

  const toggleControlCard = plugin.isInstalled && (
    <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
      {isToggleLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Switch
          checked={plugin.isEnabled}
          onCheckedChange={(checked) => onToggle(checked)}
          disabled={isToggleLoading}
        />
      )}
    </div>
  );

  const listActions = plugin.isInstalled ? (
    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onUpdate}
        disabled={isUpdateLoading}
        title={t("extensions_view.update")}
        aria-label={t("extensions_view.update")}
        className="h-6 w-6"
      >
        <ReloadIcon className={`w-4 h-4 ${isUpdateLoading ? "animate-spin" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onUninstall}
        disabled={isActionLoading}
        title={t("extensions_view.uninstall")}
        aria-label={t("extensions_view.uninstall")}
        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {isActionLoading ? (
          <ReloadIcon className="w-4 h-4 animate-spin" />
        ) : (
          <TrashIcon className="w-4 h-4" />
        )}
      </Button>
    </div>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      onClick={(event) => {
        event.stopPropagation();
        onInstall();
      }}
      disabled={isActionLoading}
      title={t("extensions_view.install")}
      aria-label={t("extensions_view.install")}
      className="h-6 w-6"
    >
      {isActionLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin" />
      ) : (
        <DownloadIcon className="w-4 h-4" />
      )}
    </Button>
  );

  const cardActions = plugin.isInstalled ? (
    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onUpdate}
        disabled={isUpdateLoading}
        title={t("extensions_view.update")}
        aria-label={t("extensions_view.update")}
        className="h-6 w-6"
      >
        <ReloadIcon className={`w-4 h-4 ${isUpdateLoading ? "animate-spin" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onUninstall}
        disabled={isActionLoading}
        title={t("extensions_view.uninstall")}
        aria-label={t("extensions_view.uninstall")}
        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {isActionLoading ? (
          <ReloadIcon className="w-4 h-4 animate-spin" />
        ) : (
          <TrashIcon className="w-4 h-4" />
        )}
      </Button>
    </div>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      onClick={(event) => {
        event.stopPropagation();
        onInstall();
      }}
      disabled={isActionLoading}
      title={t("extensions_view.install")}
      aria-label={t("extensions_view.install")}
      className="h-6 w-6"
    >
      {isActionLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin" />
      ) : (
        <DownloadIcon className="w-4 h-4" />
      )}
    </Button>
  );

  if (variant === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-left transition hover:bg-muted/50 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink leading-snug truncate">
                {plugin.name}
              </h3>
              {hasStatusChips ? statusChips : null}
            </div>
            {plugin.description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                {plugin.description}
              </p>
            )}
            <div className="mt-1.5">
              {componentCount > 0 ? (
                <ComponentBadgeRow components={plugin.components} />
              ) : (
                <p className="text-xs text-muted-foreground">{componentsHint}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {toggleControlList}
            {listActions}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="h-full w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-left transition hover:bg-muted/50 hover:shadow-sm"
    >
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">
              {plugin.name}
            </h3>
            {hasStatusChips ? <div className="mt-1">{statusChips}</div> : null}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {toggleControlCard}
            {cardActions}
          </div>
        </div>

        {plugin.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
        )}
        {componentCount > 0 ? (
          <ComponentBadgeRow components={plugin.components} />
        ) : (
          <p className="text-xs text-muted-foreground">{componentsHint}</p>
        )}

        <div className="mt-auto" />
      </div>
    </div>
  );
}
