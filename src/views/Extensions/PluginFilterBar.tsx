import { useTranslation } from "react-i18next";
import { CheckCircle2, Layers, List as ListIcon, LayoutGrid, XCircle } from "lucide-react";

import type { PluginStatusFilter } from "./usePluginLibrary";

type PluginViewMode = "card" | "list";

interface PluginFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: PluginStatusFilter;
  onStatusFilterChange: (value: PluginStatusFilter) => void;
  stats: { total: number; installed: number; notInstalled: number };
  viewMode: PluginViewMode;
  onViewModeChange: (value: PluginViewMode) => void;
}

export function PluginFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stats,
  viewMode,
  onViewModeChange,
}: PluginFilterBarProps) {
  const { t } = useTranslation();

  const filterOptions: {
    value: PluginStatusFilter;
    label: string;
    count: number;
    icon: typeof Layers;
  }[] = [
    { value: "all", label: t("extensions_view.filter_all"), count: stats.total, icon: Layers },
    { value: "installed", label: t("extensions_view.filter_installed"), count: stats.installed, icon: CheckCircle2 },
    { value: "not_installed", label: t("extensions_view.filter_not_installed"), count: stats.notInstalled, icon: XCircle },
  ];

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Search input - occupies half width */}
      <input
        type="text"
        placeholder={t("extensions_view.search_placeholder")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-1/2 px-3.5 py-2 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
      />

      {/* Filter tabs - right side */}
      <div className="flex items-center gap-1.5 shrink-0">
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const label = `${option.label} (${option.count})`;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              aria-label={label}
              title={label}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${statusFilter === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
        <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm">
          <button
            type="button"
            aria-label={t("llm.view_list")}
            title={t("llm.view_list")}
            onClick={() => onViewModeChange("list")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${viewMode === "list"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={t("llm.view_card")}
            title={t("llm.view_card")}
            onClick={() => onViewModeChange("card")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${viewMode === "card"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
