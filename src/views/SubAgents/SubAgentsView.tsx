import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { PersonIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { LocalAgent } from "../../types";
import {
  LoadingState,
  ConfigPage,
  useSearch,
} from "../../components/config";
import {
  ActionToolbar,
  ListItemCard,
  SettingsEmptyState,
  StatusBadge,
  ViewModeToggle,
} from "../../components/Settings";
import { useInvokeQuery, useQueryClient, useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";

interface SubAgentsViewProps {
  onSelect: (agent: LocalAgent) => void;
}

export function SubAgentsView({ onSelect }: SubAgentsViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: agents = [], isLoading } = useInvokeQuery<LocalAgent[]>(["agents"], "list_local_agents");
  const { search, setSearch, filtered } = useSearch(agents, ["name", "description", "model"]);
  const { mode, setMode } = useViewMode("subagents");
  const [uninstallingAgent, setUninstallingAgent] = useState<string | null>(null);



  const handleOpenInEditor = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await invoke("open_in_editor", { path });
    } catch {
      // Editor might not be available
    }
  };

  const handleUninstall = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setUninstallingAgent(name);
    try {
      await invoke("uninstall_agent", { name });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } finally {
      setUninstallingAgent(null);
    }
  };

  if (isLoading) return <LoadingState message={t('sub_agents.loading')} />;

  return (
    <ConfigPage>


      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <ActionToolbar
          searchPlaceholder={t('sub_agents.search_placeholder')}
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
              {filtered.map((agent) => (
                <ListItemCard
                  key={agent.name}
                  avatarFallback={agent.name}
                  title={agent.name}
                  subtitle={agent.description ?? undefined}
                  badges={
                    agent.model ? (
                      <StatusBadge variant="blue">{agent.model}</StatusBadge>
                    ) : undefined
                  }
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                        onClick={(e) => handleOpenInEditor(e, agent.path)}
                        title={t('common.open_in_editor', 'Open in editor')}
                      >
                        <Pencil1Icon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => handleUninstall(e, agent.name)}
                        disabled={uninstallingAgent === agent.name}
                        title={t('common.delete')}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  }
                  onClick={() => onSelect(agent)}
                  className={mode === "list" ? "p-2" : undefined}
                />
              ))}
            </div>
          ) : search ? (
            <p className="text-muted-foreground text-sm py-4">
              {t('commands.no_match', { search })}
            </p>
          ) : (
            <SettingsEmptyState
              icon={PersonIcon}
              title={t('sub_agents.no_agents')}
              description={t('sub_agents.no_agents_hint', 'Configure agents in your project settings')}
            />
          )}
        </div>
      </div>
    </ConfigPage>
  );
}
