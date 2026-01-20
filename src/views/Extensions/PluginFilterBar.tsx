import { useTranslation } from "react-i18next";
import { Input } from "../../components/ui/input";

import type { PluginStatusFilter } from "./usePluginLibrary";

interface PluginFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: PluginStatusFilter;
  onStatusFilterChange: (value: PluginStatusFilter) => void;
  stats: { total: number; installed: number; notInstalled: number };
}

export function PluginFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stats,
}: PluginFilterBarProps) {
  const { t } = useTranslation();

  const filterOptions: { value: PluginStatusFilter; label: string; count: number }[] = [
    { value: "all", label: t("extensions_view.filter_all"), count: stats.total },
    { value: "installed", label: t("extensions_view.filter_installed"), count: stats.installed },
    { value: "not_installed", label: t("extensions_view.filter_not_installed"), count: stats.notInstalled },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-card-alt text-muted-foreground hover:text-ink"
                }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {/* Sort dropdown removed */}
      </div>

      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("extensions_view.search_placeholder")}
      />
    </div>
  );
}
