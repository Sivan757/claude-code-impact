import { useTranslation } from "react-i18next";
import { TargetIcon, StarFilledIcon, HeartFilledIcon, GlobeIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { LocalSkill, TemplateComponent } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
  useSearch,
} from "../../components/config";
import { useInvokeQuery, useQueryClient } from "../../hooks";

interface SkillsViewProps {
  onSelectTemplate: (template: TemplateComponent, localPath: string) => void;
}

export function SkillsView({ onSelectTemplate }: SkillsViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: skills = [], isLoading } = useInvokeQuery<LocalSkill[]>(["skills"], "list_local_skills");
  const { search, setSearch, filtered } = useSearch(skills, ["name", "description"]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["skills"] });
  };

  return (
    <ConfigPage>
      <PageHeader
        title={t('skills.title')}
        subtitle={t('skills.skills_count', { count: skills.length })}
        action={
          <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh')}>
            <ReloadIcon className="w-4 h-4" />
          </Button>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {isLoading ? (
          <LoadingState message={t('skills.loading')} />
        ) : (
          <>
            <SearchInput
              placeholder={t('skills.search_placeholder')}
              value={search}
              onChange={setSearch}
            />

            {filtered.length > 0 && (
              <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
                {filtered.map((skill) => {
                  const meta = skill.marketplace;
                  const hasMarketplaceInfo = meta?.source_id && meta.source_id !== "personal";
                  return (
                    <button
                      key={skill.name}
                      onClick={() => onSelectTemplate({
                        name: skill.name,
                        path: skill.path,
                        category: "skill",
                        component_type: "skill",
                        description: skill.description,
                        downloads: skill.marketplace?.downloads ?? null,
                        content: skill.content,
                        source_id: skill.marketplace?.source_id ?? null,
                        source_name: skill.marketplace?.source_name ?? null,
                        author: skill.marketplace?.author ?? null,
                      }, skill.path)}
                      className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-ink truncate">{skill.name}</p>
                            {hasMarketplaceInfo && (
                              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${meta?.source_id === "anthropic"
                                ? "bg-amber-500/10 text-amber-600"
                                : meta?.source_id === "claudecodeimpact"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                                }`}>
                                {meta?.source_id === "anthropic" ? (
                                  <StarFilledIcon className="w-3 h-3 inline mr-1" />
                                ) : meta?.source_id === "claudecodeimpact" ? (
                                  <HeartFilledIcon className="w-3 h-3 inline mr-1" />
                                ) : (
                                  <GlobeIcon className="w-3 h-3 inline mr-1" />
                                )}
                                {meta?.source_name}
                              </span>
                            )}
                          </div>
                          {skill.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{skill.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filtered.length === 0 && !search && (
              <EmptyState
                icon={TargetIcon}
                message={t('skills.no_skills')}
                hint={t('skills.browse_marketplace')}
              />
            )}

            {filtered.length === 0 && search && (
              <p className="text-muted-foreground text-sm">{t('commands.no_match', { search })}</p>
            )}
          </>
        )}
      </div>
    </ConfigPage>
  );
}
