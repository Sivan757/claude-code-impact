import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { LocalAgent } from "../../types";
import { DetailHeader, DetailCard, ContentCard, ConfigPage } from "../../components/config";

interface SubAgentDetailViewProps {
  agent: LocalAgent;
  onBack: () => void;
}

export function SubAgentDetailView({ agent, onBack }: SubAgentDetailViewProps) {
  const { t } = useTranslation();
  return (
    <ConfigPage>
      <DetailHeader
        title={agent.name}
        description={agent.description}
        backLabel={t('sub_agents.title')}
        onBack={onBack}
        path={agent.path}
        onOpenPath={(p) => invoke("open_in_editor", { path: p })}
      />
      <div className="space-y-4">
        {agent.model && (
          <DetailCard label={t('sub_agents.model')}>
            <p className="font-mono text-accent">{agent.model}</p>
          </DetailCard>
        )}
        {agent.tools && (
          <DetailCard label={t('sub_agents.tools')}>
            <p className="font-mono text-sm text-ink">{agent.tools}</p>
          </DetailCard>
        )}
        <ContentCard label={t('sub_agents.content')} content={agent.content} />
      </div>
    </ConfigPage>
  );
}
