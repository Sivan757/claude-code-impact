import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
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
  ExternalLinkIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import type { PluginComponent, ScannedPlugin } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { CodePreview } from "../../components/shared";
import { ComponentBadgeRow } from "./ComponentBadgeRow";
import type { PluginScope } from "./usePluginLibrary";

interface PluginDetailModalProps {
  plugin: ScannedPlugin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: (enabled: boolean) => void;
  onUpdate: () => void;
  scope: PluginScope;
  isActionLoading: boolean;
  isToggleLoading: boolean;
  isUpdateLoading: boolean;
}

interface CommandItem {
  label: string;
  value: string;
}

type ComponentSectionKey = "commands" | "skills" | "hooks" | "claudeMd" | "agents" | "mcps" | "lsps";

interface ComponentSection {
  key: ComponentSectionKey;
  label: string;
  items: PluginComponent[];
}

interface ComponentDetailTarget {
  section: ComponentSection;
  item: PluginComponent;
  translationKey?: string;
}

interface PluginTranslationText {
  key: string;
  text: string;
}

interface PluginTranslationResponse {
  model: string | null;
  translations: PluginTranslationText[];
}

function detectLanguage(path: string | null | undefined): string {
  if (!path) return "text";
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".sh")) return "shell";
  return "text";
}

function getSemanticVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const normalized = version.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function PluginDetailModal({
  plugin,
  open,
  onOpenChange,
  onInstall,
  onUninstall,
  onToggle,
  onUpdate,
  scope,
  isActionLoading,
  isToggleLoading,
  isUpdateLoading,
}: PluginDetailModalProps) {
  const { t, i18n } = useTranslation();
  const [activeComponent, setActiveComponent] = useState<ComponentDetailTarget | null>(null);
  const [componentContent, setComponentContent] = useState("");
  const [componentContentLoading, setComponentContentLoading] = useState(false);
  const [componentContentError, setComponentContentError] = useState<string | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [translatedLanguage, setTranslatedLanguage] = useState<string | null>(null);
  const [translationModel, setTranslationModel] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const commands = useMemo<CommandItem[]>(() => {
    if (!plugin) return [];
    const scopeArg = `--scope ${scope}`;
    return [
      { label: t("extensions_view.command_install"), value: `claude plugin install ${plugin.id} ${scopeArg}` },
      { label: t("extensions_view.command_uninstall"), value: `claude plugin uninstall ${plugin.id} ${scopeArg}` },
      { label: t("extensions_view.command_enable"), value: `claude plugin enable ${plugin.id} ${scopeArg}` },
      { label: t("extensions_view.command_disable"), value: `claude plugin disable ${plugin.id} ${scopeArg}` },
      { label: t("extensions_view.command_update"), value: `claude plugin update ${plugin.id} ${scopeArg}` },
    ];
  }, [plugin, scope, t]);

  const handleCopy = (value: string) => {
    invoke("copy_to_clipboard", { text: value }).catch(() => { });
  };

  const handleOpenPath = (path: string) => {
    invoke("open_path", { path }).catch(() => { });
  };

  useEffect(() => {
    if (!open) {
      setActiveComponent(null);
    }
  }, [open]);

  useEffect(() => {
    setTranslatedTexts({});
    setTranslatedLanguage(null);
    setTranslationModel(null);
    setShowTranslated(false);
    setTranslationError(null);
  }, [plugin?.id]);

  useEffect(() => {
    const path = activeComponent?.item.path;
    if (!path) {
      setComponentContent("");
      setComponentContentError(null);
      setComponentContentLoading(false);
      return;
    }

    let canceled = false;
    setComponentContent("");
    setComponentContentError(null);
    setComponentContentLoading(true);

    invoke<string>("read_file", { path })
      .then((content) => {
        if (canceled) return;
        setComponentContent(content ?? "");
      })
      .catch((error) => {
        if (canceled) return;
        setComponentContentError(String(error));
      })
      .finally(() => {
        if (canceled) return;
        setComponentContentLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [activeComponent?.item.path]);

  const sectionConfig: Record<ComponentSectionKey, { icon: ElementType; className: string }> = {
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
    claudeMd: {
      icon: FileTextIcon,
      className: "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
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

  const componentSections: ComponentSection[] = [
    { key: "commands", label: t("features.commands"), items: plugin?.components.commands ?? [] },
    { key: "skills", label: t("features.skills"), items: plugin?.components.skills ?? [] },
    { key: "hooks", label: t("features.hooks"), items: plugin?.components.hooks ?? [] },
    { key: "claudeMd", label: t("extensions_view.claude_md"), items: plugin?.components.claudeMd ?? [] },
    { key: "agents", label: t("features.sub-agents"), items: plugin?.components.agents ?? [] },
    { key: "mcps", label: t("features.mcp"), items: plugin?.components.mcps ?? [] },
    { key: "lsps", label: t("extensions_view.lsps"), items: plugin?.components.lsps ?? [] },
  ];

  const translationEntries = useMemo<PluginTranslationText[]>(() => {
    const entries: PluginTranslationText[] = [];
    if (plugin?.description) {
      entries.push({ key: "plugin.description", text: plugin.description });
    }
    componentSections.forEach((section) => {
      section.items.forEach((item, index) => {
        if (!item.description) return;
        entries.push({
          key: `${section.key}:${index}:description`,
          text: item.description,
        });
      });
    });
    return entries;
  }, [componentSections, plugin?.description]);

  const translationLanguage = useMemo(() => i18n.resolvedLanguage ?? i18n.language ?? "en", [i18n.language, i18n.resolvedLanguage]);

  const translatedPluginDescription =
    showTranslated
      ? translatedTexts["plugin.description"] ?? plugin?.description ?? null
      : plugin?.description ?? null;

  const getTranslatedDescription = useCallback((key: string, fallback?: string | null) => {
    if (!fallback) return fallback;
    if (!showTranslated) return fallback;
    return translatedTexts[key] ?? fallback;
  }, [showTranslated, translatedTexts]);

  const handleTranslateToggle = useCallback(async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translationEntries.length === 0) {
      return;
    }
    if (translatedLanguage === translationLanguage && Object.keys(translatedTexts).length > 0) {
      setShowTranslated(true);
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const response = await invoke<PluginTranslationResponse>("translate_plugin_texts", {
        targetLanguage: translationLanguage,
        texts: translationEntries,
      });
      const nextMap: Record<string, string> = {};
      for (const item of response.translations ?? []) {
        if (!item?.key || !item?.text) continue;
        nextMap[item.key] = item.text;
      }
      setTranslatedTexts(nextMap);
      setTranslatedLanguage(translationLanguage);
      setTranslationModel(response.model);
      setShowTranslated(true);
    } catch (error) {
      setTranslationError(String(error));
    } finally {
      setIsTranslating(false);
    }
  }, [
    showTranslated,
    translatedLanguage,
    translationLanguage,
    translatedTexts,
    translationEntries,
  ]);

  const totalComponents = componentSections.reduce((sum, section) => sum + section.items.length, 0);
  const componentsHint =
    plugin?.componentsSource === "remote"
      ? t("extensions_view.components_remote")
      : t("extensions_view.components_empty");

  const isRepoUrl = Boolean(plugin?.repository && plugin.repository.startsWith("http"));
  const componentLanguage = detectLanguage(activeComponent?.item.path);
  const semanticVersion = getSemanticVersion(plugin?.version);

  if (!plugin) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="text-left space-y-4 pb-2 border-b border-border/50">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <DialogTitle className="text-xl font-bold text-ink flex items-center gap-3">
                    {plugin.name}
                    {plugin.isInstalled && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-normal border ${
                          plugin.isEnabled
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {plugin.isEnabled ? t("extensions_view.enabled") : t("extensions_view.disabled")}
                      </span>
                    )}
                  </DialogTitle>

                  {translatedPluginDescription && (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      {translatedPluginDescription}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!plugin.isInstalled && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {t("extensions_view.not_installed")}
                      </span>
                    )}
                    {semanticVersion && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">
                        v{semanticVersion}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTranslateToggle()}
                  disabled={isTranslating || translationEntries.length === 0}
                >
                  {isTranslating ? (
                    <ReloadIcon className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : null}
                  {showTranslated
                    ? t("extensions_view.show_original", "Show original")
                    : t("extensions_view.translate_current_language", "Translate")}
                </Button>

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
            {(translationError || (showTranslated && translatedLanguage)) && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${translationError
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-secondary/30 text-muted-foreground"
                }`}>
                {translationError
                  ? t("extensions_view.translation_failed", {
                    error: translationError,
                    defaultValue: `Translation failed: ${translationError}`,
                  })
                  : t("extensions_view.translation_applied", {
                    language: translatedLanguage,
                    model: translationModel ? ` · ${translationModel}` : "",
                    defaultValue: `Translated to ${translatedLanguage}${translationModel ? ` · ${translationModel}` : ""}`,
                  })}
              </div>
            )}

            <div className="bg-card rounded-lg border border-border p-4 text-sm">
              <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-x-4 gap-y-3">
                <div className="text-muted-foreground self-center">{t("extensions_view.marketplace_label")}</div>
                <div className="font-medium text-ink">{plugin.marketplace}</div>

                <div className="text-muted-foreground self-center">{t("extensions_view.scope_label", "Scope")}</div>
                <div className="font-medium text-ink">{t(`extensions_view.scope_${scope}`, scope)}</div>

                {plugin.author && (
                  <>
                    <div className="text-muted-foreground self-center">{t("extensions_view.author_label")}</div>
                    <div className="font-medium text-ink flex items-center gap-2">{plugin.author}</div>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                    {t("extensions_view.components_title")}
                    <span className="px-1.5 py-0.5 rounded-full bg-muted text-xs font-normal text-muted-foreground">
                      {totalComponents}
                    </span>
                  </h4>
                  {totalComponents > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{t("extensions_view.component_click_hint")}</p>
                  )}
                </div>
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
                      const config = sectionConfig[section.key];
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
                            {section.items.map((item, index) => {
                              const descriptionKey = `${section.key}:${index}:description`;
                              const description = getTranslatedDescription(descriptionKey, item.description);
                              return (
                              <li key={`${section.key}-${item.name}-${item.path ?? "none"}-${index}`}>
                                <button
                                  type="button"
                                  className="group w-full text-left rounded-md px-2 py-1.5 hover:bg-background/70 transition-colors"
                                  onClick={() => setActiveComponent({ section, item, translationKey: descriptionKey })}
                                >
                                  <div className="flex items-center gap-2 text-xs font-mono text-ink/90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-1 pl-3.5 truncate">
                                    {description ?? item.path ?? t("extensions_view.component_detail_empty")}
                                  </p>
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

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

      <Dialog
        open={Boolean(activeComponent)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setActiveComponent(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle>{activeComponent?.item.name ?? t("extensions_view.component_detail_title")}</DialogTitle>
            {activeComponent && (
              <p className="text-sm text-muted-foreground">
                {t("extensions_view.component_detail_type_hint", { type: activeComponent.section.label })}
              </p>
            )}
          </DialogHeader>

          {activeComponent && (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 gap-x-3 text-sm">
                  <div className="text-muted-foreground">{t("extensions_view.component_name_label")}</div>
                  <div className="font-medium">{activeComponent.item.name}</div>

                  <div className="text-muted-foreground">{t("extensions_view.component_type_label")}</div>
                  <div>{activeComponent.section.label}</div>

                  <div className="text-muted-foreground">{t("extensions_view.component_description_label")}</div>
                  <div className="text-muted-foreground">
                    {getTranslatedDescription(
                      activeComponent.translationKey ?? "",
                      activeComponent.item.description
                    ) ?? t("extensions_view.component_detail_empty")}
                  </div>

                  <div className="text-muted-foreground">{t("extensions_view.component_path_label")}</div>
                  <div className="font-mono text-xs break-all">
                    {activeComponent.item.path ?? t("extensions_view.component_path_unavailable")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-medium text-ink flex items-center gap-2">
                    <InfoCircledIcon className="w-4 h-4 text-muted-foreground" />
                    {t("extensions_view.component_content_label")}
                  </h5>
                  {activeComponent.item.path && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(activeComponent.item.path!)}
                      >
                        <CopyIcon className="w-3.5 h-3.5 mr-1.5" />
                        {t("common.copy")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPath(activeComponent.item.path!)}
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5 mr-1.5" />
                        {t("template_detail.open_file")}
                      </Button>
                    </div>
                  )}
                </div>

                {componentContentLoading ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    {t("extensions_view.component_content_loading")}
                  </div>
                ) : componentContentError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-4 text-sm text-destructive">
                    {t("extensions_view.component_content_failed", {
                      error: componentContentError,
                      defaultValue: `Failed to load file: ${componentContentError}`,
                    })}
                  </div>
                ) : componentContent ? (
                  <CodePreview value={componentContent} language={componentLanguage} height={320} />
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    {t("extensions_view.component_content_unavailable")}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
