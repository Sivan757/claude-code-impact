import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { LoadingState, EmptyState, SearchInput } from "../../components/config";
import { useTemplateList, useTemplateDelete } from "../../config/templates/hooks";
import type { TemplateListEntry } from "../../config/templates/types";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { TemplateApplyDialog } from "./TemplateApplyDialog";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

interface TemplatesViewProps {
  projectPath?: string;
  embedded?: boolean;
}

export function TemplatesView({ projectPath }: TemplatesViewProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { data: templates, isLoading } = useTemplateList();
  const deleteMutation = useTemplateDelete();

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<TemplateListEntry | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Separate built-in and custom
  const { builtin, custom, allTags } = useMemo(() => {
    if (!templates) return { builtin: [], custom: [], allTags: [] };

    const b: TemplateListEntry[] = [];
    const c: TemplateListEntry[] = [];
    const tagSet = new Set<string>();

    for (const t of templates) {
      (t.is_builtin ? b : c).push(t);
      t.tags.forEach((tag) => tagSet.add(tag));
    }

    return { builtin: b, custom: c, allTags: Array.from(tagSet).sort() };
  }, [templates]);

  // Filter
  const filterTemplates = (list: TemplateListEntry[]) => {
    return list.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchTag = !tagFilter || t.tags.includes(tagFilter);
      return matchSearch && matchTag;
    });
  };

  const filteredBuiltin = filterTemplates(builtin);
  const filteredCustom = filterTemplates(custom);

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: t("templates.delete", "Delete"),
      description: t("templates.confirm_delete", "Delete this template?"),
      variant: "destructive",
      confirmText: t("templates.delete", "Delete"),
    });
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
  };

  if (isLoading) return <LoadingState message={t("templates.loading") || "Loading templates..."} />;

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <SearchInput
          placeholder={t("templates.search_placeholder") || "Search templates..."}
          value={search}
          onChange={setSearch}
          className="flex-1 max-w-xs px-3.5 py-2 text-sm bg-secondary/40 border border-border/50 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
        />

        {/* Tag filter chips */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {tagFilter} ×
            </button>
          )}
          {allTags.slice(0, 6).map((tag) =>
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

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-xl gap-1.5"
          onClick={() => setShowSaveDialog(true)}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {t("templates.save_current") || "Save Current"}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Built-in Templates */}
        {filteredBuiltin.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {t("templates.builtin") || "Built-in Presets"} ({filteredBuiltin.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBuiltin.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  onPreview={() => setPreviewId(tpl.id)}
                  onApply={() => setApplyTemplate(tpl)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Custom Templates */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {t("templates.custom") || "Custom Templates"} ({filteredCustom.length})
          </h3>
          {filteredCustom.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              message={t("templates.no_custom") || "No custom templates yet"}
              hint={t("templates.save_hint") || "Save your current config as a template to get started"}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCustom.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  onPreview={() => setPreviewId(tpl.id)}
                  onApply={() => setApplyTemplate(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Dialogs */}
      <TemplatePreviewDialog
        templateId={previewId}
        open={!!previewId}
        onClose={() => setPreviewId(null)}
      />
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
    </div>
  );
}
