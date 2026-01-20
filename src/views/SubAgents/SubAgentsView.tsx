import { useTranslation } from "react-i18next";
import { PersonIcon } from "@radix-ui/react-icons";
import type { LocalAgent } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ItemCard,
  ConfigPage,
  useSearch,
} from "../../components/config";
import { useInvokeQuery } from "../../hooks";

interface SubAgentsViewProps {
  onSelect: (agent: LocalAgent) => void;
}

export function SubAgentsView({ onSelect }: SubAgentsViewProps) {
  const { t } = useTranslation();
  const { data: agents = [], isLoading } = useInvokeQuery<LocalAgent[]>(["agents"], "list_local_agents");
  const { search, setSearch, filtered } = useSearch(agents, ["name", "description", "model"]);

  if (isLoading) return <LoadingState message={t('sub_agents.loading')} />;

  return (
    <ConfigPage>
      <PageHeader
        title={t('sub_agents.title')}
        subtitle={t('sub_agents.subtitle', { count: agents.length })}
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <SearchInput
          placeholder={t('sub_agents.search_placeholder')}
          value={search}
          onChange={setSearch}
        />

        {filtered.length > 0 && (
          <div className="space-y-2 overflow-y-auto min-h-0">
            {filtered.map((agent) => (
              <ItemCard
                key={agent.name}
                name={agent.name}
                description={agent.description}
                badge={agent.model}
                onClick={() => onSelect(agent)}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && !search && (
          <EmptyState
            icon={PersonIcon}
            message={t('sub_agents.no_agents')}
          />
        )}

        {filtered.length === 0 && search && (
          <p className="text-muted-foreground text-sm">{t('commands.no_match', { search })}</p>
        )}
      </div>
    </ConfigPage>
  );
}
