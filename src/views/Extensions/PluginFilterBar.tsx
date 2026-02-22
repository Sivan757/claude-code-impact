import { useTranslation } from "react-i18next";
import { List as ListIcon, LayoutGrid } from "lucide-react";

import type { PluginScope, PluginStatusFilter } from "./usePluginLibrary";

type PluginViewMode = "card" | "list";

interface PluginFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: PluginStatusFilter;
  onStatusFilterChange: (value: PluginStatusFilter) => void;
  stats: {
    total: number;
    installed: number;
    notInstalled: number;
  };
  viewMode: PluginViewMode;
  onViewModeChange: (value: PluginViewMode) => void;
  scope: PluginScope;
  onScopeChange: (value: PluginScope) => void;
  allowScope?: boolean;
  projectScopeEnabled?: boolean;
}

export function PluginFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stats,
  viewMode,
  onViewModeChange,
  scope,
  onScopeChange,
  allowScope = true,
  projectScopeEnabled = false,
}: PluginFilterBarProps) {
  const { t } = useTranslation();

  const scopeOptions: Array<{ value: PluginScope; label: string; disabled?: boolean }> = [
    { value: "user", label: t("extensions_view.scope_user", "User") },
    { value: "project", label: t("extensions_view.scope_project", "Project"), disabled: !projectScopeEnabled },
    { value: "local", label: t("extensions_view.scope_local", "Local"), disabled: !projectScopeEnabled },
  ];
  const filterOptions: Array<{ value: PluginStatusFilter; label: string; count: number }> = [
    { value: "all", label: t("extensions_view.filter_all"), count: stats.total },
    { value: "installed", label: t("extensions_view.filter_installed"), count: stats.installed },
    { value: "not_installed", label: t("extensions_view.filter_not_installed"), count: stats.notInstalled },
  ];

  return (
    <div className="flex items-center justify-between gap-2">
      <input
        type="text"
        placeholder={t("extensions_view.search_placeholder")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 min-w-[280px] max-w-2xl px-3 py-2 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
      />

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="inline-flex items-center rounded-xl border border-border/60 bg-card/70 p-0.5 shadow-sm mr-1">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              className={`h-7 px-2 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1 ${
                statusFilter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`text-[11px] rounded-full px-1.5 py-0.5 ${
                  statusFilter === option.value
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-secondary text-foreground/80"
                }`}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>

        {allowScope && projectScopeEnabled && (
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm mr-1">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onScopeChange(option.value)}
                disabled={option.disabled}
                title={option.disabled ? t("extensions_view.scope_requires_project", "Project scope requires project context") : undefined}
                className={`h-7 px-2 text-xs font-medium rounded-md transition-colors ${
                  scope === option.value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm">
          <button
            type="button"
            aria-label={t("llm.view_list")}
            title={t("llm.view_list")}
            onClick={() => onViewModeChange("list")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              viewMode === "list"
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
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              viewMode === "card"
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
