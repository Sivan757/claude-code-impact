import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon, RocketIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { LoadingState, ConfigPage, DetailCard } from "../../components/config";
import { StatusBadge } from "../../components/Settings";
import { useTemplateGet } from "../../config/templates/hooks";
import type { ConfigTemplate, MergeMode } from "../../config/templates/types";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

interface TemplateDetailPanelProps {
  templateId: string;
  onBack: () => void;
  onApply: (template: ConfigTemplate) => void;
  onDelete: (id: string) => void;
}

const MERGE_MODE_INFO: Record<MergeMode, { labelKey: string; descKey: string }> = {
  merge: { labelKey: "launcher.merge_merge", descKey: "templates.merge_mode_desc_merge" },
  fill: { labelKey: "launcher.merge_fill", descKey: "templates.merge_mode_desc_fill" },
  replace: { labelKey: "launcher.merge_replace", descKey: "templates.merge_mode_desc_replace" },
};

function ConfigSection({ title, data }: { title: string; data: unknown }) {
  if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) {
    return null;
  }

  return (
    <DetailCard label={title}>
      <pre className="bg-secondary/40 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    </DetailCard>
  );
}

export function TemplateDetailPanel({
  templateId,
  onBack,
  onApply,
  onDelete,
}: TemplateDetailPanelProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { data: template, isLoading } = useTemplateGet(templateId);
  const [selectedMode, setSelectedMode] = useState<MergeMode>("merge");

  if (isLoading) {
    return (
      <ConfigPage>
        <LoadingState message={t("templates.loading")} />
      </ConfigPage>
    );
  }

  if (!template) {
    return (
      <ConfigPage>
        <div className="p-6">
          <p className="text-muted-foreground">{t("templates.not_found", "Template not found")}</p>
          <button onClick={onBack} className="mt-2 text-primary hover:underline text-sm">
            {t("templates.back", "Back to templates")}
          </button>
        </div>
      </ConfigPage>
    );
  }

  const createdDate = new Date(template.created_at * 1000).toLocaleDateString();

  return (
    <ConfigPage>
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-ink mb-2 flex items-center gap-1 text-sm"
          >
            <span>&#8592;</span> {t("templates.title")}
          </button>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="font-serif text-2xl font-semibold text-ink truncate">
                {template.name}
              </h1>
              {template.is_builtin && (
                <StatusBadge variant="active">
                  {t("templates.builtin_badge", "Built-in")}
                </StatusBadge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                onClick={() => onApply(template)}
              >
                <RocketIcon className="w-3.5 h-3.5" />
                {t("templates.apply", "Apply")}
              </Button>
              {!template.is_builtin && (
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={async () => {
                    const confirmed = await confirmDialog({
                      title: t("templates.delete", "Delete"),
                      description: t("templates.confirm_delete"),
                      variant: "destructive",
                      confirmText: t("templates.delete", "Delete"),
                    });
                    if (confirmed) {
                      onDelete(template.id);
                    }
                  }}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          {template.description && (
            <p className="text-muted-foreground mt-3">{template.description}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
            {template.author && (
              <span>{t("template_detail.by_author", { author: template.author })}</span>
            )}
            <span>{createdDate}</span>
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Config Preview Sections */}
        <div className="space-y-4">
          <ConfigSection title={t("templates.section_settings", "Settings")} data={template.config} />
          <ConfigSection title={t("templates.section_env", "Environment Variables")} data={template.env} />
          <ConfigSection title={t("templates.section_hooks", "Hooks")} data={template.hooks} />
          <ConfigSection title={t("templates.section_mcp", "MCP Servers")} data={template.mcp_servers} />
        </div>

        {/* Merge Mode Info */}
        <div className="mt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {t("templates.merge_modes", "Merge Modes")}
          </p>
          <div className="space-y-2">
            {(Object.entries(MERGE_MODE_INFO) as [MergeMode, { labelKey: string; descKey: string }][]).map(
              ([mode, info]) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedMode === mode
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/50 bg-card/60 hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{t(info.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(info.descKey)}</p>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </ConfigPage>
  );
}
