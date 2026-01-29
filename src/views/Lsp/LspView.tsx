import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { CodeIcon, TrashIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { LspServer } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import { FilePath } from "../../components/shared/FilePath";
import { useInvokeQuery, useQueryClient } from "../../hooks";

export function LspView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: servers = [], isLoading } = useInvokeQuery<LspServer[]>(
    ["lspServers"],
    "list_lsp_servers"
  );
  const { data: lspConfigPath = "" } = useInvokeQuery<string>(
    ["lspConfigPath"],
    "get_lsp_config_path_cmd"
  );
  const [search, setSearch] = useState("");
  const [editingEnv, setEditingEnv] = useState<{ server: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingServer, setDeletingServer] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["lspServers"] });
  };

  const handleDelete = async (serverName: string) => {
    setDeletingServer(serverName);
    try {
      await invoke("remove_lsp_server", { name: serverName });
      queryClient.invalidateQueries({ queryKey: ["lspServers"] });
    } finally {
      setDeletingServer(null);
    }
  };

  const handleEnvClick = (serverName: string, key: string, currentValue: string) => {
    setEditingEnv({ server: serverName, key });
    setEditValue(currentValue);
  };

  const handleEnvSave = async () => {
    if (!editingEnv) return;
    await invoke("update_lsp_server_env", {
      serverName: editingEnv.server,
      envKey: editingEnv.key,
      envValue: editValue,
    });
    queryClient.invalidateQueries({ queryKey: ["lspServers"] });
    setEditingEnv(null);
  };

  // 获取语言对应的颜色
  const getLanguageColor = (language: string | null): string => {
    const colors: Record<string, string> = {
      typescript: "bg-blue-500/20 text-blue-600",
      javascript: "bg-yellow-500/20 text-yellow-600",
      python: "bg-green-500/20 text-green-600",
      rust: "bg-orange-500/20 text-orange-600",
      go: "bg-cyan-500/20 text-cyan-600",
      java: "bg-red-500/20 text-red-600",
      c: "bg-gray-500/20 text-gray-600",
      cpp: "bg-purple-500/20 text-purple-600",
    };
    return colors[language?.toLowerCase() || ""] || "bg-primary/10 text-primary";
  };

  if (isLoading) return <LoadingState message={t('lsp.loading')} />;

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.language?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>
      <PageHeader
        title={t('lsp.title')}
        subtitle={t('lsp.servers_count', { count: servers.length })}
        action={
          <div className="flex items-center gap-2">
            {lspConfigPath && <FilePath path={lspConfigPath} showIcon filenameOnly />}
            <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh')}>
              <ReloadIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <SearchInput
          placeholder={t('lsp.search_placeholder')}
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
                      {server.language && (
                        <span className={`text-xs px-2 py-0.5 rounded ${getLanguageColor(server.language)}`}>
                          {server.language}
                        </span>
                      )}
                    </p>
                    {server.description && (
                      <p className="text-sm text-muted-foreground mt-1">{server.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(server.name)}
                    disabled={deletingServer === server.name}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Command */}
                <div className="bg-card-alt rounded-lg p-3 font-mono text-xs">
                  {server.command ? (
                    <p className="text-muted-foreground">
                      <span className="text-ink">{server.command}</span>
                      {server.args.length > 0 && (
                        <span className="text-muted-foreground"> {server.args.join(" ")}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">{t('lsp.no_command')}</p>
                  )}
                </div>

                {/* File Extensions & Root Markers */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {server.file_extensions.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{t('lsp.extensions')}:</span>
                      {server.file_extensions.map((ext) => (
                        <span
                          key={ext}
                          className="text-xs bg-card-alt px-2 py-0.5 rounded text-muted-foreground"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {server.root_markers.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">{t('lsp.root_markers')}:</span>
                    {server.root_markers.map((marker) => (
                      <span
                        key={marker}
                        className="text-xs bg-card-alt px-2 py-0.5 rounded text-muted-foreground font-mono"
                      >
                        {marker}
                      </span>
                    ))}
                  </div>
                )}

                {/* Environment Variables */}
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
            icon={CodeIcon}
            message={t('lsp.no_servers')}
            hint={t('lsp.add_hint')}
          />
        )}

        {filtered.length === 0 && search && (
          <p className="text-muted-foreground text-sm">{t('commands.no_match', { search })}</p>
        )}
      </div>
    </ConfigPage>
  );
}
