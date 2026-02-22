import { useTranslation } from "react-i18next";
import {
  GearIcon,
  ExternalLinkIcon,
  DotsHorizontalIcon,
  CopyIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import type { MergedConfigView } from "../../config/types";
import { cn } from "../../lib/utils";
import {
  resolveProviderNameFromProfiles,
  type ProviderProfile,
} from "../../lib/llmProfiles";

interface ProjectCardProps {
  path: string;
  config?: MergedConfigView;
  providerProfiles?: ProviderProfile[];
  onOpenLauncher?: () => void;
  onSettings?: () => void;
  onTerminal?: () => void;
  onExport?: () => void;
}

function normalizePermissionMode(value: unknown): string {
  if (value === "normal") return "default";
  if (value === "allowEdits") return "acceptEdits";
  if (
    value === "acceptEdits"
    || value === "bypassPermissions"
    || value === "default"
    || value === "delegate"
    || value === "dontAsk"
    || value === "plan"
  ) {
    return value;
  }
  return "default";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ProjectCard({
  path,
  config,
  providerProfiles = [],
  onOpenLauncher,
  onSettings,
  onTerminal,
  onExport,
}: ProjectCardProps) {
  const { t } = useTranslation();

  const effective = (config?.effective ?? {}) as Record<string, unknown>;
  const model = (effective.model as string) ?? null;
  const permissions = effective.permissions as Record<string, unknown> | undefined;
  const permMode = normalizePermissionMode(permissions?.defaultMode ?? permissions?.default_mode);
  const errorCount = config?.parse_errors?.length ?? 0;
  const permModeLabel = permMode === "default"
    ? t("settings.normal", "Normal")
    : permMode === "acceptEdits"
      ? t("settings.allow_edits", "Allow Edits")
      : permMode === "bypassPermissions"
        ? t("settings.bypass", "Bypass")
        : permMode;

  const providerName = (() => {
    const resolved = resolveProviderNameFromProfiles(effective, providerProfiles);
    if (resolved) return resolved;

    const cci = effective.claudecodeimpact;
    if (isRecord(cci) && typeof cci.activeProvider === "string") {
      const activeProvider = cci.activeProvider.trim();
      if (activeProvider) return activeProvider;
    }

    return null;
  })();

  // Count MCP servers (plugins)
  const mcpServers = config?.mcp_servers?.servers;
  const pluginCount = mcpServers ? Object.keys(mcpServers).length : 0;

  // Check for local project overrides via provenance
  const hasLocalOverrides = config?.provenance
    ? Object.values(config.provenance).some(
        (p) => (p as { scope?: string }).scope === "project"
      )
    : false;

  const shortPath = path.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer group",
        "border-border hover:border-border/80"
      )}
      onClick={onOpenLauncher}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-medium text-foreground truncate" title={path}>
            {path.split("/").pop()}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5" title={path}>
            {shortPath}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <DotsHorizontalIcon className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onSettings && (
                <DropdownMenuItem onClick={onSettings}>
                  <GearIcon className="w-3.5 h-3.5 mr-2" />
                  {t("common.edit")} Settings
                </DropdownMenuItem>
              )}
              {onTerminal && (
                <DropdownMenuItem onClick={onTerminal}>
                  <ExternalLinkIcon className="w-3.5 h-3.5 mr-2" />
                  {t("common.terminal")}
                </DropdownMenuItem>
              )}
              {onExport && (
                <DropdownMenuItem onClick={onExport}>
                  <CopyIcon className="w-3.5 h-3.5 mr-2" />
                  {t("projects.export_config", "Export Config")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(path)}>
                <CopyIcon className="w-3.5 h-3.5 mr-2" />
                {t("settings.copy_path")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Quick terminal launch */}
          {onTerminal && (
            <Button
              variant="default"
              size="icon"
              className="h-7 w-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                onTerminal();
              }}
              title={t("projects.launch_terminal", "Launch Terminal")}
            >
              <RocketIcon className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Config badges */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {model && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {model}
          </span>
        )}
        {providerName && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
            {providerName}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {permModeLabel}
        </span>
        {pluginCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
            {pluginCount} MCP{pluginCount !== 1 ? "s" : ""}
          </span>
        )}
        {hasLocalOverrides && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
            {t("projects.local_overrides", "Local")}
          </span>
        )}
        {errorCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
            {t("projects.errors_count", { count: errorCount })}
          </span>
        )}
      </div>
    </div>
  );
}
