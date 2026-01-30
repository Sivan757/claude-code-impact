import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Markdown from "react-markdown";
import { Pencil1Icon, TrashIcon, ExternalLinkIcon, DotsHorizontalIcon, FileIcon, CopyIcon } from "@radix-ui/react-icons";
import type { TemplateComponent, TemplateCategory } from "../../types";
import { DetailCard, ConfigPage } from "../../components/config";
import { CodePreview } from "../../components/shared";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";

function getLanguageForCategory(category: TemplateCategory): string {
  switch (category) {
    case "mcps":
    case "hooks":
    case "settings":
      return "json";
    case "statuslines":
      return "shell";
    default:
      return "markdown";
  }
}

/** Parse YAML frontmatter from markdown content */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\s*([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  match[1].split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && val) meta[key] = val;
    }
  });
  return { meta, body: match[2] };
}

interface TemplateDetailViewProps {
  template: TemplateComponent;
  category: TemplateCategory;
  onBack: () => void;
  onNavigateToInstalled?: () => void;
  localPath?: string;
  isInstalled?: boolean;
  settingsPath?: string;
}

import { useQueryClient } from "../../hooks";

export function TemplateDetailView({
  template,
  category,
  onBack,
  onNavigateToInstalled,
  localPath,
  isInstalled: initiallyInstalled,
  settingsPath,
}: TemplateDetailViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installed, setInstalled] = useState(initiallyInstalled ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip check if we already know it's installed
    if (initiallyInstalled !== undefined) return;

    if (category === "mcps") {
      invoke<boolean>("check_mcp_installed", { name: template.name }).then(setInstalled);
    } else if (category === "skills") {
      invoke<boolean>("check_skill_installed", { name: template.name }).then(setInstalled);
    }
  }, [category, template.name, initiallyInstalled]);

  const handleUninstall = async () => {
    setUninstalling(true);
    setError(null);

    try {
      if (category === "mcps") {
        await invoke("uninstall_mcp_template", { name: template.name });
        queryClient.invalidateQueries({ queryKey: ["settings", "default"] });
      } else if (category === "skills") {
        await invoke("uninstall_skill", { name: template.name });
        queryClient.invalidateQueries({ queryKey: ["skills"] });
      } else if (category === "agents") {
        await invoke("uninstall_agent", { name: template.name });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
      }
      setInstalled(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setUninstalling(false);
    }
  };

  const handleInstall = async () => {
    if (!template.content) {
      setError(t('template_detail.no_content_error'));
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      switch (category) {
        case "commands":
        case "agents":
          await invoke("install_command_template", {
            name: template.name,
            content: template.content,
          });
          break;
        case "skills":
          await invoke("install_skill_template", {
            name: template.name,
            content: template.content,
            source_id: template.source_id,
            source_name: template.source_name,
            author: template.author,
            downloads: template.downloads,
            template_path: template.path,
          });
          break;
        case "mcps":
          await invoke("install_mcp_template", { name: template.name, config: template.content });
          queryClient.invalidateQueries({ queryKey: ["settings", "default"] });
          break;
        case "hooks":
          await invoke("install_hook_template", {
            name: template.name,
            config: template.content,
            path: settingsPath || undefined,
          });
          queryClient.invalidateQueries({ queryKey: ["settings", settingsPath ?? "default"] });
          break;
        case "settings":
        case "output-styles":
          await invoke("install_setting_template", {
            config: template.content,
            path: settingsPath || undefined,
          });
          queryClient.invalidateQueries({ queryKey: ["settings", settingsPath ?? "default"] });
          break;
        case "statuslines":
          // Install to ~/.claudecodeimpact/claudecodeimpact/statusline/{name}.sh
          await invoke("install_statusline_template", { name: template.name, content: template.content });
          break;
      }
      setInstalled(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const categoryLabel = t(`features.${category === 'mcps' ? 'mcp' : category === 'agents' ? 'sub-agents' : category === 'statuslines' ? 'statusline' : category}`);
  const filePath = localPath || template.path;

  const handleReveal = () => invoke("reveal_path", { path: filePath });
  const handleOpenFile = () => invoke("open_path", { path: filePath });
  const handleCopyPath = () => invoke("copy_to_clipboard", { text: filePath });

  return (
    <ConfigPage>
      <div className="flex-1 overflow-y-auto min-h-0">
        <header className="mb-6">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-ink mb-2 flex items-center gap-1 text-sm"
          >
            <span>←</span> {categoryLabel}
          </button>
          {/* Title row: title + badges + actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="font-serif text-2xl font-semibold text-ink truncate">{template.name}</h1>
              {installed && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-primary/30 text-primary shrink-0">
                  {t('template_detail.installed_badge')}
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Primary Install button when not installed */}
              {!installed && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {installing ? t('template_detail.installing_btn') : t('template_detail.install_btn')}
                </button>
              )}
              {/* Three-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-xl hover:bg-card-alt text-muted-foreground hover:text-ink">
                    <DotsHorizontalIcon className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {localPath && (
                    <DropdownMenuItem onClick={() => invoke("open_in_editor", { path: localPath })}>
                      <Pencil1Icon className="w-4 h-4 mr-2" />
                      {t('template_detail.open_in_editor')}
                    </DropdownMenuItem>
                  )}
                  {installed && onNavigateToInstalled && (
                    <DropdownMenuItem onClick={onNavigateToInstalled}>
                      <ExternalLinkIcon className="w-4 h-4 mr-2" />
                      {t('template_detail.view_installed')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleReveal}>
                    <ExternalLinkIcon className="w-4 h-4 mr-2" />
                    {t('template_detail.reveal_finder')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenFile}>
                    <FileIcon className="w-4 h-4 mr-2" />
                    {t('template_detail.open_file')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyPath}>
                    <CopyIcon className="w-4 h-4 mr-2" />
                    {t('template_detail.copy_path')}
                  </DropdownMenuItem>
                  {installed && (category === "mcps" || category === "skills" || category === "agents") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleUninstall}
                        disabled={uninstalling}
                        className="text-red-600 focus:text-red-600"
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        {uninstalling ? t('template_detail.uninstalling_btn') : t('template_detail.uninstall_btn')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Description */}
          {template.description && (
            <p className="text-muted-foreground mt-3">{template.description}</p>
          )}
          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              {categoryLabel}
            </span>
            {template.author && (
              <>
                <span>•</span>
                <span>{t('template_detail.by_author', { author: template.author })}</span>
              </>
            )}
            {template.downloads != null && (
              <>
                <span>•</span>
                <span>↓ {template.downloads}</span>
              </>
            )}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-primary/10 text-primary rounded-xl text-sm">{error}</div>
          )}
        </header>

        {template.content && (
          <DetailCard label={t('marketplace.content_preview')}>
            {category === "mcps" || category === "hooks" || category === "settings" || category === "statuslines" ? (
              <CodePreview value={template.content} language={getLanguageForCategory(category)} height={400} />
            ) : (() => {
              const { meta, body } = parseFrontmatter(template.content);
              const metaKeys = Object.keys(meta);
              return (
                <>
                  {metaKeys.length > 0 && (
                    <div className="mb-4 p-3 bg-card-alt rounded-lg border border-border">
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        {metaKeys.map(key => (
                          <div key={key} className="contents">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="text-ink">{meta[key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none prose-neutral prose-pre:bg-card-alt prose-pre:text-ink prose-code:text-ink">
                    <Markdown>{body}</Markdown>
                  </div>
                </>
              );
            })()}
          </DetailCard>
        )}
      </div>
    </ConfigPage>
  );
}
