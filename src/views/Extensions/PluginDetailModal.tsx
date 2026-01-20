import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CopyIcon,
  ReloadIcon,
  TrashIcon,
  CodeIcon,
  LightningBoltIcon,
  Link2Icon,
  PersonIcon,
  CubeIcon,
  FileTextIcon,
  GitHubLogoIcon,
  LaptopIcon,
  ExternalLinkIcon
} from "@radix-ui/react-icons";
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
    invoke("copy_to_clipboard", { text: value }).catch(() => { });
  };

  if (!plugin) {
    return null;
  }

  const sectionConfig: Record<string, { icon: React.ElementType, className: string }> = {
    commands: {
      icon: CodeIcon,
      className: "text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800"
    },
    skills: {
      icon: LightningBoltIcon,
      className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
    },
    hooks: {
      icon: Link2Icon,
      className: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
    },
    agents: {
      icon: PersonIcon,
      className: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
    },
    mcps: {
      icon: CubeIcon,
      className: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800"
    },
    lsps: {
      icon: FileTextIcon,
      className: "text-slate-600 bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800"
    },
  };

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

  const isRepoUrl = plugin.repository && plugin.repository.startsWith("http");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left space-y-4 pb-2 border-b border-border/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <DialogTitle className="text-xl font-bold text-ink flex items-center gap-3">
                  {plugin.name}
                  {plugin.isInstalled && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-normal border ${plugin.isEnabled
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                      : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}
                    </span>
                  )}
                </DialogTitle>

                {plugin.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    {plugin.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!plugin.isInstalled && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {t("extensions_view.not_installed")}
                    </span>
                  )}
                  {plugin.version && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">
                      v{plugin.version}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!plugin.isInstalled ? (
                <Button onClick={onInstall} disabled={isActionLoading} className="w-full sm:w-auto">
                  {t("extensions_view.install")}
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-border bg-background/50">
                    <Switch
                      id="plugin-toggle"
                      checked={plugin.isEnabled}
                      onCheckedChange={(checked) => onToggle(checked)}
                      disabled={isToggleLoading}
                    />
                    <label htmlFor="plugin-toggle" className="text-sm font-medium cursor-pointer select-none">
                      {plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}
                    </label>
                  </div>

                  <div className="h-4 w-px bg-border mx-1" />

                  <Button variant="outline" size="sm" onClick={onUpdate} disabled={isUpdateLoading}>
                    <ReloadIcon className={`w-3.5 h-3.5 mr-2 ${isUpdateLoading ? "animate-spin" : ""}`} />
                    {t("extensions_view.update")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onUninstall}
                    disabled={isActionLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <TrashIcon className="w-3.5 h-3.5 mr-2" />
                    {t("extensions_view.uninstall")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Metadata Grid */}
          <div className="bg-card rounded-lg border border-border p-4 text-sm">
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-x-4 gap-y-3">
              <div className="text-muted-foreground self-center">{t("extensions_view.marketplace_label")}</div>
              <div className="font-medium text-ink">{plugin.marketplace}</div>

              {plugin.author && (
                <>
                  <div className="text-muted-foreground self-center">{t("extensions_view.author_label")}</div>
                  <div className="font-medium text-ink flex items-center gap-2">
                    {plugin.author}
                  </div>
                </>
              )}

              {plugin.repository && (
                <>
                  <div className="text-muted-foreground self-center">{t("extensions_view.repository_label")}</div>
                  <div className="font-medium text-ink font-mono text-xs truncate" title={plugin.repository}>
                    {isRepoUrl ? (
                      <a
                        href={plugin.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:underline decoration-primary/50 text-primary"
                      >
                        <GitHubLogoIcon className="w-3.5 h-3.5" />
                        {plugin.repository}
                        <ExternalLinkIcon className="w-3 h-3 opacity-50" />
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <GitHubLogoIcon className="w-3.5 h-3.5 opacity-70" />
                        {plugin.repository}
                      </span>
                    )}
                  </div>
                </>
              )}

              {plugin.localPath && (
                <>
                  <div className="text-muted-foreground self-center">{t("extensions_view.local_path_label")}</div>
                  <div className="font-medium text-ink font-mono text-xs truncate" title={plugin.localPath}>
                    <span className="flex items-center gap-1.5">
                      <LaptopIcon className="w-3.5 h-3.5 opacity-70" />
                      {plugin.localPath}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Components Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                {t("extensions_view.components_title")}
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-xs font-normal text-muted-foreground">
                  {totalComponents}
                </span>
              </h4>
              <ComponentBadgeRow components={plugin.components} />
            </div>

            {totalComponents === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/30 rounded-lg border border-dashed border-border">
                <CubeIcon className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{componentsHint}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {componentSections
                  .filter((section) => section.items.length > 0)
                  .map((section) => {
                    const config = sectionConfig[section.key] || { icon: CubeIcon, className: "bg-muted border-border" };
                    const Icon = config.icon;
                    return (
                      <div
                        key={section.key}
                        className={`rounded-lg border p-3 bg-card transition-colors ${config.className} bg-opacity-30 border-opacity-60`}
                      >
                        <div className="flex items-center justify-between text-sm font-medium mb-2">
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {section.label}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-background/50 backdrop-blur-sm border border-border/50 font-mono shadow-sm">
                            {section.items.length}
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {section.items.map((item) => (
                            <li key={`${section.key}-${item.name}`} className="text-xs font-mono text-ink/80 truncate pl-6 relative">
                              <span className="absolute left-1 top-2 w-1 h-1 rounded-full bg-current opacity-50"></span>
                              {item.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* CLI Commands Section */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <h4 className="text-sm font-semibold text-ink">{t("extensions_view.commands_title")}</h4>
            <div className="space-y-2">
              {commands.map((command) => (
                <div
                  key={command.label}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/70"
                >
                  <div className="min-w-0 flex-1 grid gap-1">
                    <p className="text-xs font-medium text-muted-foreground">{command.label}</p>
                    <p className="font-mono text-xs text-ink truncate select-all">{command.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(command.value)}
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t("common.copy")}
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
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
