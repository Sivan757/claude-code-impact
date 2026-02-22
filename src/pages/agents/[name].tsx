import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import type { LocalAgent, TemplateComponent, TemplatesCatalog } from "../../types";
import { TemplateDetailView } from "../../views/Marketplace";
import { FeaturesLayout } from "../../views/Features";
import { LoadingState } from "../../components/config";
import { useSettingsPath } from "../../hooks";

function agentToTemplate(agent: LocalAgent): TemplateComponent {
  return {
    name: agent.name,
    path: agent.path,
    category: "agents",
    component_type: "agent",
    description: agent.description,
    downloads: null,
    content: agent.content,
    model: agent.model,
  } as TemplateComponent & { model?: string | null };
}

export default function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMarketplace = searchParams.get("source") === "marketplace";
  const settingsPath = useSettingsPath();

  const { data: localAgent, isLoading: localLoading } = useQuery({
    queryKey: ["agent", name, settingsPath ?? "global"],
    queryFn: async () => {
      const agents = await invoke<LocalAgent[]>(
        "list_local_agents",
        settingsPath ? { projectPath: settingsPath } : undefined
      );
      return agents.find(a => a.name === name) ?? null;
    },
    enabled: !!name && !isMarketplace,
  });

  const { data: marketplaceTemplate, isLoading: marketplaceLoading } = useQuery({
    queryKey: ["marketplaceAgent", name],
    queryFn: async () => {
      const catalog = await invoke<TemplatesCatalog>("get_templates_catalog");
      return catalog.agents?.find(t => t.name === name) ?? null;
    },
    enabled: !!name && isMarketplace,
  });

  const isLoading = isMarketplace ? marketplaceLoading : localLoading;

  if (isLoading) {
    return (
      <FeaturesLayout feature="sub-agents">
        <LoadingState message={`Loading ${name}...`} />
      </FeaturesLayout>
    );
  }

  if (isMarketplace) {
    if (!marketplaceTemplate) {
      return (
        <FeaturesLayout feature="sub-agents">
          <div className="p-6">
            <p className="text-destructive">Agent "{name}" not found in marketplace</p>
            <button onClick={() => navigate("/agents")} className="mt-2 text-primary hover:underline">
              ← Back to Agents
            </button>
          </div>
        </FeaturesLayout>
      );
    }
    return (
      <FeaturesLayout feature="sub-agents">
        <TemplateDetailView
          template={marketplaceTemplate}
          category="agents"
          onBack={() => navigate("/agents")}
          settingsPath={settingsPath}
        />
      </FeaturesLayout>
    );
  }

  if (!localAgent) {
    return (
      <FeaturesLayout feature="sub-agents">
        <div className="p-6">
          <p className="text-destructive">Agent "{name}" not found</p>
          <button onClick={() => navigate("/agents")} className="mt-2 text-primary hover:underline">
            ← Back to Agents
          </button>
        </div>
      </FeaturesLayout>
    );
  }

  return (
    <FeaturesLayout feature="sub-agents">
      <TemplateDetailView
        template={agentToTemplate(localAgent)}
        category="agents"
        onBack={() => navigate("/agents")}
        localPath={localAgent.path}
        isInstalled={true}
        settingsPath={settingsPath}
      />
    </FeaturesLayout>
  );
}
