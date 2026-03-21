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
  mode?: "manage" | "select";
  isSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
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
  mode = "manage",
  isSelected = false,
  onSelectedChange,
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
  const isSelectionMode = mode === "select";
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

  const handleCardActivate = () => {
    if (isSelectionMode) {
      onSelectedChange?.(!isSelected);
      return;
    }
    onSelect();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardActivate();
    }
  };

  const statusChips = (
    <div className="flex flex-wrap items-center gap-2">
      {semanticVersion && (
        <span
          className={`rounded-full bg-card-alt text-muted-foreground ${
            isSelectionMode ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
          }`}
        >
          v{semanticVersion}
        </span>
      )}
    </div>
  );
  const hasStatusChips = Boolean(semanticVersion);

  const toggleControlList = (plugin.isInstalled || isSelectionMode) && (
    <div
      className="flex items-center shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      {isToggleLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Switch
          checked={isSelectionMode ? isSelected : plugin.isEnabled}
          onCheckedChange={(checked) =>
            isSelectionMode ? onSelectedChange?.(checked) : onToggle(checked)
          }
          disabled={isToggleLoading}
          aria-label={t("extensions_view.enabled")}
        />
      )}
    </div>
  );

  const toggleControlCard = (plugin.isInstalled || isSelectionMode) && (
    <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
      {isToggleLoading ? (
        <ReloadIcon className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Switch
          checked={isSelectionMode ? isSelected : plugin.isEnabled}
          onCheckedChange={(checked) =>
            isSelectionMode ? onSelectedChange?.(checked) : onToggle(checked)
          }
          disabled={isToggleLoading}
        />
      )}
    </div>
  );

  const listActions = isSelectionMode ? null : plugin.isInstalled ? (
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

  const cardActions = isSelectionMode ? null : plugin.isInstalled ? (
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
        onClick={handleCardActivate}
        onKeyDown={handleKeyDown}
        className={`w-full text-left transition hover:shadow-sm ${
          isSelectionMode
            ? "rounded-[18px] border border-border/60 bg-card px-3 py-2.5 hover:bg-card"
            : "rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted/50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-semibold text-ink leading-snug ${
                  isSelectionMode ? "text-[14px] sm:text-[15px]" : "text-sm truncate"
                }`}
              >
                {plugin.name}
              </h3>
              {hasStatusChips ? statusChips : null}
            </div>
            {plugin.description && (
              <p
                className={`mt-1 text-muted-foreground ${
                  isSelectionMode ? "text-[12px] line-clamp-2" : "text-sm line-clamp-1"
                }`}
              >
                {plugin.description}
              </p>
            )}
            <div className={isSelectionMode ? "mt-2.5" : "mt-1.5"}>
              {componentCount > 0 ? (
                <ComponentBadgeRow
                  components={plugin.components}
                  size={isSelectionMode ? "sm" : "md"}
                />
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
      onClick={handleCardActivate}
      onKeyDown={handleKeyDown}
      className={`h-full w-full text-left transition hover:shadow-sm ${
        isSelectionMode
          ? "min-h-[152px] rounded-[18px] border border-border/60 bg-card px-3 py-2.5 hover:bg-card"
          : "rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted/50"
      }`}
    >
      <div className="flex h-full flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className={`font-semibold text-ink leading-snug ${
                isSelectionMode ? "text-[14px] sm:text-[15px] line-clamp-2" : "text-sm line-clamp-2"
              }`}
            >
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
          <p
            className={`text-muted-foreground ${
              isSelectionMode ? "text-[12px] line-clamp-2" : "text-sm line-clamp-2"
            }`}
          >
            {plugin.description}
          </p>
        )}
        {componentCount > 0 ? (
          <ComponentBadgeRow
            components={plugin.components}
            size={isSelectionMode ? "sm" : "md"}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{componentsHint}</p>
        )}

        <div className="mt-auto" />
      </div>
    </div>
  );
}
