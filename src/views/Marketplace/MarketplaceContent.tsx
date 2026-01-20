import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CubeIcon } from "@radix-ui/react-icons";
import type { TemplatesCatalog, TemplateComponent, TemplateCategory } from "../../types";
import { SOURCE_FILTERS, type SourceFilterId } from "../../constants";
import { LoadingState, EmptyState, SearchInput } from "../../components/config";
import { useInvokeQuery } from "../../hooks";

interface MarketplaceContentProps {
  category: TemplateCategory;
  onSelectTemplate: (template: TemplateComponent) => void;
  externalSearch?: string;
}

export function MarketplaceContent({ category, onSelectTemplate, externalSearch }: MarketplaceContentProps) {
  const { t } = useTranslation();
  const { data: catalog, isLoading, error } = useInvokeQuery<TemplatesCatalog>(["templatesCatalog"], "get_templates_catalog");
  const [internalSearch, setInternalSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilterId>("all");

  const search = externalSearch ?? internalSearch;
  const showSearchInput = externalSearch === undefined;

  if (isLoading) return <LoadingState message={t('marketplace.loading')} />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="text-4xl mb-4">❌</span>
        <p className="text-ink font-medium mb-2">{t('marketplace.failed')}</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error.message}</p>
      </div>
    );
  }

  if (!catalog) return null;

  const components = catalog[category] || [];

  const sourceFiltered =
    sourceFilter === "all"
      ? components
      : components.filter((c: TemplateComponent) => c.source_id === sourceFilter);

  const filtered = sourceFiltered.filter(
    (c: TemplateComponent) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const priorityMap: Record<string, number> = { anthropic: 1, lovstudio: 2, community: 3 };
    const aPriority = priorityMap[a.source_id || "community"] || 3;
    const bPriority = priorityMap[b.source_id || "community"] || 3;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.downloads || 0) - (a.downloads || 0);
  });

  const getSourceLabel = (id: string) => {
    switch (id) {
      case "all": return t('marketplace.all');
      case "anthropic": return t('marketplace.anthropic');
      case "lovstudio": return t('marketplace.lovstudio');
      case "community": return t('marketplace.community');
      default: return id;
    }
  };

  const getSourceTooltip = (id: string) => {
    switch (id) {
      case "all": return t('marketplace.all_tooltip');
      case "anthropic": return t('marketplace.official_tooltip');
      case "lovstudio": return t('marketplace.lovstudio_tooltip');
      case "community": return t('marketplace.community_tooltip');
      default: return "";
    }
  };

  const sourceCounts = SOURCE_FILTERS.map((sf) => ({
    ...sf,
    count:
      sf.id === "all"
        ? components.length
        : components.filter((c: TemplateComponent) => c.source_id === sf.id).length,
  }));

  return (
    <div className="space-y-4">
      {/* Source filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {sourceCounts.map((sf) => (
          <button
            key={sf.id}
            onClick={() => setSourceFilter(sf.id as SourceFilterId)}
            title={getSourceTooltip(sf.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${sourceFilter === sf.id
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-ink hover:border-primary/50"
              }`}
          >
            <span>{getSourceLabel(sf.id)}</span>
            {sf.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${sourceFilter === sf.id ? "bg-primary-foreground/20" : "bg-card-alt"
                  }`}
              >
                {sf.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {showSearchInput && (
        <SearchInput
          placeholder={t('marketplace.search_placeholder')}
          value={internalSearch}
          onChange={setInternalSearch}
        />
      )}

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((template) => (
          <button
            key={`${template.source_id}-${template.path}`}
            onClick={() => onSelectTemplate(template)}
            className="text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-medium text-ink truncate">{template.name}</p>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${template.source_id === "anthropic"
                    ? "bg-amber-500/10 text-amber-600"
                    : template.source_id === "lovstudio"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                    }`}
                  title={getSourceTooltip(template.source_id || "community")}
                >
                  {getSourceLabel(template.source_id || "community")}
                </span>
              </div>
              {template.downloads != null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  ↓{template.downloads}
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground/60">{template.category}</p>
              {template.plugin_name && template.plugin_name !== template.category && (
                <p className="text-xs text-muted-foreground/60">{t('marketplace.from', { name: template.plugin_name })}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {sorted.length === 0 && <EmptyState icon={CubeIcon} message={t('marketplace.no_templates')} />}
    </div>
  );
}
