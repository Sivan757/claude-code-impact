import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Component1Icon, ExternalLinkIcon, TrashIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { McpServer, ClaudeSettings } from "../../types";
import {
  LoadingState,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import {
  ActionToolbar,
  ListItemCard,
  SettingsEmptyState,
  StatusBadge,
  ViewModeToggle,
} from "../../components/Settings";
import { FilePath } from "../../components/shared/FilePath";
import { useInvokeQuery, useQueryClient, useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";

export function McpView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsKey = ["settings", "default"];
  const { data: settings, isLoading: settingsLoading } = useInvokeQuery<ClaudeSettings>(settingsKey, "get_settings");
  const { data: mcpConfigPath = "" } = useInvokeQuery<string>(["mcpConfigPath"], "get_mcp_config_path");
  const servers = settings?.mcp_servers ?? [];
  const [search, setSearch] = useState("");
  const { mode, setMode } = useViewMode("mcp");
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [editingEnv, setEditingEnv] = useState<{ server: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [uninstallingServer, setUninstallingServer] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: settingsKey });
  };

  const handleUninstall = async (serverName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUninstallingServer(serverName);
    try {
      await invoke("uninstall_mcp_template", { name: serverName });
      queryClient.invalidateQueries({ queryKey: settingsKey });
    } finally {
      setUninstallingServer(null);
    }
  };

  const handleEnvClick = (serverName: string, key: string, currentValue: string) => {
    setEditingEnv({ server: serverName, key });
    setEditValue(currentValue);
  };

  const handleEnvSave = async () => {
    if (!editingEnv) return;
    await invoke("update_mcp_env", {
      serverName: editingEnv.server,
      envKey: editingEnv.key,
      envValue: editValue,
    });
    queryClient.invalidateQueries({ queryKey: settingsKey });
    setEditingEnv(null);
  };

  const getMcpUrl = (server: McpServer): string | null => {
    if (server.command === "npx" && server.args?.length > 0) {
      const pkg = server.args.find((a) => a.startsWith("@") || a.startsWith("mcp-"));
      if (pkg) return `https://www.npmjs.com/package/${pkg}`;
    }
    return null;
  };

  const getServerSubtitle = (server: McpServer): string => {
    if (server.url) return server.url;
    if (server.command) {
      return server.args?.length > 0
        ? `${server.command} ${server.args.join(" ")}`
        : server.command;
    }
    return t('mcp.no_command');
  };

  if (settingsLoading) return <LoadingState message={t('mcp.loading')} />;

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (serverName: string) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  return (
    <ConfigPage>
      <PageHeader
        title={t('mcp.title')}
        subtitle={t('mcp.servers_count', { count: servers.length })}
        action={
          <div className="flex items-center gap-2">
            {mcpConfigPath && <FilePath path={mcpConfigPath} showIcon filenameOnly />}
            <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh')}>
              <ReloadIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <ActionToolbar
          searchPlaceholder={t('mcp.search_placeholder')}
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={
            <ViewModeToggle mode={mode} onChange={setMode} />
          }
        />

        <div className="flex-1 overflow-y-auto min-h-0 pb-3">
          {filtered.length > 0 ? (
            <div
              className={cn(
                mode === "card"
                  ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                  : "flex flex-col gap-2"
              )}
            >
              {filtered.map((server) => {
                const mcpUrl = getMcpUrl(server);
                const envCount = Object.keys(server.env).length;
                const isExpanded = expandedServer === server.name;

                return (
                  <div key={server.name} className="flex flex-col">
                    <ListItemCard
                      avatarFallback={server.name}
                      title={server.name}
                      subtitle={getServerSubtitle(server)}
                      badges={
                        <>
                          <StatusBadge variant="muted">
                            {server.type || (server.url ? "http" : "stdio")}
                          </StatusBadge>
                          {envCount > 0 && (
                            <StatusBadge variant="purple">
                              {envCount} env
                            </StatusBadge>
                          )}
                        </>
                      }
                      actions={
                        <>
                          {mcpUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                openUrl(mcpUrl);
                              }}
                              title={t('mcp.open_npm')}
                            >
                              <ExternalLinkIcon className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                            onClick={(e) => handleUninstall(server.name, e)}
                            disabled={uninstallingServer === server.name}
                            title={t('common.delete')}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      }
                      onClick={envCount > 0 ? () => toggleExpand(server.name) : undefined}
                      className={mode === "list" ? "p-2" : undefined}
                    />

                    {/* Expandable env section */}
                    {envCount > 0 && isExpanded && (
                      <div className="mt-1 ml-12 p-3 bg-card/60 rounded-xl border border-border/40">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {t('mcp.environment_variables', 'Environment Variables')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(server.env).map(([key, value]) =>
                            editingEnv?.server === server.name && editingEnv?.key === key ? (
                              <div key={key} className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">{key}=</span>
                                <input
                                  autoFocus
                                  className="text-xs px-2 py-1 rounded-lg bg-secondary/40 border border-border/50 text-ink w-40 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEnvSave();
                                    if (e.key === "Escape") setEditingEnv(null);
                                  }}
                                  onBlur={handleEnvSave}
                                />
                              </div>
                            ) : (
                              <button
                                key={key}
                                onClick={() => handleEnvClick(server.name, key, value)}
                                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
                                title={`${t('common.edit')} ${key}`}
                              >
                                {key}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : search ? (
            <p className="text-muted-foreground text-sm py-4">
              {t('commands.no_match', { search })}
            </p>
          ) : (
            <SettingsEmptyState
              icon={Component1Icon}
              title={t('mcp.no_servers')}
              description={t('mcp.browse_marketplace')}
            />
          )}
        </div>
      </div>
    </ConfigPage>
  );
}
