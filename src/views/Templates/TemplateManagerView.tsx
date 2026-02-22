import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArchiveIcon, PlusIcon, TrashIcon, RocketIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
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
import { useViewMode } from "../../hooks";
import { cn } from "../../lib/utils";
import { useTemplateList, useTemplateDelete } from "../../config/templates/hooks";
import type { TemplateListEntry } from "../../config/templates/types";
import { TemplateDetailPanel } from "./TemplateDetailPanel";
import { TemplateApplyDialog } from "./TemplateApplyDialog";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

interface TemplateManagerViewProps {
  projectPath?: string;
}

export function TemplateManagerView({ projectPath }: TemplateManagerViewProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { data: templates = [], isLoading } = useTemplateList();
  const deleteMutation = useTemplateDelete();
  const { mode, setMode } = useViewMode("templates");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<TemplateListEntry | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Separate built-in and custom, collect tags
  const { builtin, custom, allTags } = useMemo(() => {
    const b: TemplateListEntry[] = [];
    const c: TemplateListEntry[] = [];
    const tagSet = new Set<string>();

    for (const tpl of templates) {
      (tpl.is_builtin ? b : c).push(tpl);
      tpl.tags.forEach((tag) => tagSet.add(tag));
    }

    return { builtin: b, custom: c, allTags: Array.from(tagSet).sort() };
  }, [templates]);

  // Search across all templates
  const allTemplates = useMemo(() => [...builtin, ...custom], [builtin, custom]);
  const { search, setSearch, filtered: searchFiltered } = useSearch(allTemplates, [
    "name",
    "description",
    "author",
  ]);

  // Apply tag filter on top of search
  const filtered = useMemo(() => {
    if (!tagFilter) return searchFiltered;
    return searchFiltered.filter((tpl) => tpl.tags.includes(tagFilter));
  }, [searchFiltered, tagFilter]);

  const filteredBuiltin = filtered.filter((t) => t.is_builtin);
  const filteredCustom = filtered.filter((t) => !t.is_builtin);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({
      title: t("templates.delete", "Delete"),
      description: t("templates.confirm_delete"),
      variant: "destructive",
      confirmText: t("templates.delete", "Delete"),
    });
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleApply = (e: React.MouseEvent, tpl: TemplateListEntry) => {
    e.stopPropagation();
    setApplyTemplate(tpl);
  };

  if (isLoading) return <LoadingState message={t("templates.loading")} />;

  // If a template is selected, show the detail panel
  if (selectedId) {
    return (
      <TemplateDetailPanel
        templateId={selectedId}
        onBack={() => setSelectedId(null)}
        onApply={(tpl) => setApplyTemplate({
          id: tpl.id,
          name: tpl.name,
          description: tpl.description,
          author: tpl.author,
          tags: tpl.tags,
          is_builtin: tpl.is_builtin,
          created_at: tpl.created_at,
          updated_at: tpl.updated_at,
          model: (tpl.config as Record<string, unknown>)?.model as string | undefined ?? null,
          mcp_count: tpl.mcp_servers ? Object.keys(tpl.mcp_servers).length : 0,
          env_count: tpl.env ? Object.keys(tpl.env).length : 0,
          permission_mode: ((tpl.config as Record<string, unknown>)?.permissions as Record<string, unknown>)?.default_mode as string | undefined ?? null,
          has_hooks: !!tpl.hooks && Object.keys(tpl.hooks).length > 0,
        })}
        onDelete={(id) => {
          deleteMutation.mutate(id);
          setSelectedId(null);
        }}
      />
    );
  }

  const renderTemplateList = (items: TemplateListEntry[], sectionLabel?: string) => {
    if (items.length === 0) return null;

    return (
      <div>
        {sectionLabel && (
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {sectionLabel} ({items.length})
          </h3>
        )}
        <div
          className={cn(
            mode === "card"
              ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-2"
          )}
        >
          {items.map((tpl) => (
            <ListItemCard
              key={tpl.id}
              avatarFallback={tpl.name}
              title={tpl.name}
              subtitle={tpl.description || undefined}
              badges={
                <div className="flex items-center gap-1.5">
                  {tpl.is_builtin && (
                    <StatusBadge variant="active">
                      {t("templates.builtin_badge", "Built-in")}
                    </StatusBadge>
                  )}
                  {tpl.tags.slice(0, 2).map((tag) => (
                    <StatusBadge key={tag} variant="muted">
                      {tag}
                    </StatusBadge>
                  ))}
                </div>
              }
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:text-foreground hover:bg-secondary/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(tpl.id);
                    }}
                    title={t("templates.preview", "Preview")}
                  >
                    <EyeOpenIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:text-primary hover:bg-primary/10"
                    onClick={(e) => handleApply(e, tpl)}
                    title={t("templates.apply", "Apply")}
                  >
                    <RocketIcon className="w-3.5 h-3.5" />
                  </Button>
                  {!tpl.is_builtin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:text-red-500 hover:bg-red-500/10"
                      onClick={(e) => handleDelete(e, tpl.id)}
                      disabled={deleteMutation.isPending}
                      title={t("common.delete")}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              }
              onClick={() => setSelectedId(tpl.id)}
              className={mode === "list" ? "p-2" : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <ConfigPage>
      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <ActionToolbar
          searchPlaceholder={t("templates.search_placeholder")}
          searchValue={search}
          onSearchChange={setSearch}
          secondaryAction={
            <div className="flex items-center gap-1 overflow-x-auto">
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {tagFilter} x
                </button>
              )}
              {allTags.slice(0, 5).map((tag) =>
                tag === tagFilter ? null : (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {tag}
                  </button>
                )
              )}
            </div>
          }
          primaryAction={
            <div className="flex items-center gap-2">
              <ViewModeToggle mode={mode} onChange={setMode} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl gap-1.5"
                onClick={() => setShowSaveDialog(true)}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t("templates.save_current")}
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto min-h-0 pb-3 space-y-4">
          {filtered.length > 0 ? (
            <>
              {renderTemplateList(filteredBuiltin, t("templates.builtin"))}
              {renderTemplateList(filteredCustom, t("templates.custom"))}
            </>
          ) : search || tagFilter ? (
            <p className="text-muted-foreground text-sm py-4">
              {t("templates.no_match", "No templates match your search")}
            </p>
          ) : (
            <SettingsEmptyState
              icon={ArchiveIcon}
              title={t("templates.no_templates", "No templates available")}
              description={t("templates.save_hint")}
              action={
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  {t("templates.save_current")}
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TemplateApplyDialog
        templateId={applyTemplate?.id ?? null}
        templateName={applyTemplate?.name ?? ""}
        open={!!applyTemplate}
        onClose={() => setApplyTemplate(null)}
        projectPath={projectPath}
      />
      <SaveTemplateDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        projectPath={projectPath}
      />
    </ConfigPage>
  );
}
