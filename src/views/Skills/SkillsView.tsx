import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { TargetIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import type { LocalSkill, TemplateComponent } from "../../types";
import {
  LoadingState,
  ConfigPage,
  useSearch,
} from "../../components/config";
import {
  ActionToolbar,
  ListItemCard,
  SettingsEmptyState,
  SourceBadge,
  ViewModeToggle,
} from "../../components/Settings";
import { useInvokeQuery, useQueryClient, useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";

interface SkillsViewProps {
  onSelectTemplate: (template: TemplateComponent, localPath: string) => void;
}

export function SkillsView({ onSelectTemplate }: SkillsViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: skills = [], isLoading } = useInvokeQuery<LocalSkill[]>(["skills"], "list_local_skills");
  const { search, setSearch, filtered } = useSearch(skills, ["name", "description"]);
  const { mode, setMode } = useViewMode("skills");
  const [uninstallingSkill, setUninstallingSkill] = useState<string | null>(null);



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
    setUninstallingSkill(name);
    try {
      await invoke("uninstall_skill", { name });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    } finally {
      setUninstallingSkill(null);
    }
  };

  const handleSelectSkill = (skill: LocalSkill) => {
    onSelectTemplate({
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
    }, skill.path);
  };

  if (isLoading) return <LoadingState message={t('skills.loading')} />;

  return (
    <ConfigPage>


      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <ActionToolbar
          searchPlaceholder={t('skills.search_placeholder')}
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
              {filtered.map((skill) => {
                const meta = skill.marketplace;
                const hasMarketplaceInfo = meta?.source_id && meta.source_id !== "personal";

                return (
                  <ListItemCard
                    key={skill.name}
                    avatarFallback={skill.name}
                    title={skill.name}
                    subtitle={skill.description ?? undefined}
                    badges={
                      hasMarketplaceInfo && (
                        <SourceBadge
                          sourceId={meta?.source_id ?? null}
                          sourceName={meta?.source_name ?? undefined}
                        />
                      )
                    }
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                          onClick={(e) => handleOpenInEditor(e, skill.path)}
                          title={t('common.open_in_editor', 'Open in editor')}
                        >
                          <Pencil1Icon className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                          onClick={(e) => handleUninstall(e, skill.name)}
                          disabled={uninstallingSkill === skill.name}
                          title={t('common.delete')}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    }
                    onClick={() => handleSelectSkill(skill)}
                    className={mode === "list" ? "p-2" : undefined}
                  />
                );
              })}
            </div>
          ) : search ? (
            <p className="text-muted-foreground text-sm py-4">
              {t('commands.no_match', { search })}
            </p>
          ) : (
            <SettingsEmptyState
              icon={TargetIcon}
              title={t('skills.no_skills')}
              description={t('skills.browse_marketplace')}
            />
          )}
        </div>
      </div>
    </ConfigPage>
  );
}
