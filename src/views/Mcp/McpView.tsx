import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Component1Icon, ExternalLinkIcon, TrashIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { McpServer, ClaudeSettings } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import { FilePath } from "../../components/shared/FilePath";
import { useInvokeQuery, useQueryClient } from "../../hooks";

export function McpView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");
  const { data: mcpConfigPath = "" } = useInvokeQuery<string>(["mcpConfigPath"], "get_mcp_config_path");
  const servers = settings?.mcp_servers ?? [];
  const [search, setSearch] = useState("");
  const [editingEnv, setEditingEnv] = useState<{ server: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [uninstallingServer, setUninstallingServer] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleUninstall = async (serverName: string) => {
    setUninstallingServer(serverName);
    try {
      await invoke("uninstall_mcp_template", { name: serverName });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
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
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    setEditingEnv(null);
  };

  const getMcpUrl = (server: McpServer): string | null => {
    if (server.command === "npx" && server.args?.length > 0) {
      const pkg = server.args.find((a) => a.startsWith("@") || a.startsWith("mcp-"));
      if (pkg) return `https://www.npmjs.com/package/${pkg}`;
    }
    return null;
  };

  if (settingsLoading) return <LoadingState message={t('mcp.loading')} />;

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <SearchInput
          placeholder={t('mcp.search_placeholder')}
          value={search}
          onChange={setSearch}
        />

        {filtered.length > 0 && (
          <div className="space-y-3 overflow-y-auto min-h-0">
            {filtered.map((server) => (
              <div key={server.name} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium text-ink flex items-center gap-2">
                      {server.name}
                      {getMcpUrl(server) && (
                        <button
                          onClick={() => openUrl(getMcpUrl(server)!)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title={t('mcp.open_npm')}
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </p>
                    {server.description && (
                      <p className="text-sm text-muted-foreground mt-1">{server.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUninstall(server.name)}
                    disabled={uninstallingServer === server.name}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-card-alt rounded-lg p-3 font-mono text-xs">
                  {server.url ? (
                    <p className="text-muted-foreground">
                      <span className="text-primary/60">{server.type || "http"}</span>
                      <span className="text-ink ml-2">{server.url}</span>
                    </p>
                  ) : server.command ? (
                    <p className="text-muted-foreground">
                      <span className="text-ink">{server.command}</span>
                      {server.args.length > 0 && (
                        <span className="text-muted-foreground"> {server.args.join(" ")}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">{t('mcp.no_command')}</p>
                  )}
                </div>
                {Object.keys(server.env).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(server.env).map(([key, value]) =>
                      editingEnv?.server === server.name && editingEnv?.key === key ? (
                        <div key={key} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{key}=</span>
                          <input
                            autoFocus
                            className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink w-40"
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
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors cursor-pointer"
                          title={t('common.edit') + ' ' + key}
                        >
                          {key}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && !search && (
          <EmptyState
            icon={Component1Icon}
            message={t('mcp.no_servers')}
            hint={t('mcp.browse_marketplace')}
          />
        )}

        {filtered.length === 0 && search && (
          <p className="text-muted-foreground text-sm">{t('commands.no_match', { search })}</p>
        )}
      </div>
    </ConfigPage>
  );
}
