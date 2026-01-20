import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DoubleArrowLeftIcon, DoubleArrowRightIcon, PlusIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { ScannedMarketplace } from "../../types";

interface MarketplaceSidebarProps {
  marketplaces: ScannedMarketplace[];
  activeMarketplace: string;
  activeMarketplaceLabel: string;
  onSelect: (id: string) => void;
  onAdd: (source: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdate: (id?: string) => Promise<void>;
  isOperating: boolean;
  totalCount: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  updatingMarketplaceId: string | null;
}

export function MarketplaceSidebar({
  marketplaces,
  activeMarketplace,
  activeMarketplaceLabel,
  onSelect,
  onAdd,
  onRemove,
  onUpdate,
  isOperating,
  totalCount,
  collapsed,
  onCollapsedChange,
  updatingMarketplaceId,
}: MarketplaceSidebarProps) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [source, setSource] = useState("");

  const sortedMarketplaces = useMemo(
    () => [...marketplaces].sort((a, b) => {
      // Prioritize official plugins
      const isOfficialA = a.id.includes("claude-plugins-official");
      const isOfficialB = b.id.includes("claude-plugins-official");

      if (isOfficialA && !isOfficialB) return -1;
      if (!isOfficialA && isOfficialB) return 1;

      return a.name.localeCompare(b.name);
    }),
    [marketplaces]
  );

  const handleAdd = async () => {
    if (!source.trim()) return;
    await onAdd(source);
    setSource("");
    setShowAdd(false);
  };

  return (
    <aside
      className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${collapsed ? "w-16" : "w-64"}`}
    >
      <div className="relative h-full">
        <div
          className={`h-full flex flex-col gap-4 transition-all duration-200 ${collapsed ? "opacity-0 pointer-events-none -translate-x-2" : "opacity-100 translate-x-0"}`}
        >
          <div className="shrink-0 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{t("extensions_view.marketplaces")}</h3>
            <div className="flex items-center gap-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-ink"
                onClick={() => setShowAdd((prev) => !prev)}
                disabled={isOperating}
              >
                <PlusIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-ink"
                onClick={() => onUpdate()}
                disabled={isOperating}
                title={t("extensions_view.marketplace_update_all")}
              >
                <ReloadIcon
                  className={`w-3.5 h-3.5 ${updatingMarketplaceId === "all" ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-ink"
                onClick={() => onCollapsedChange(true)}
                title={t("extensions_view.collapse_sidebar")}
              >
                <DoubleArrowLeftIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {showAdd && (
            <div className="shrink-0 rounded-lg border border-border bg-card p-3 space-y-2">
              <Input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={t("extensions_view.marketplace_source_placeholder")}
                disabled={isOperating}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAdd} disabled={isOperating || !source.trim()}>
                  {t("extensions_view.marketplace_add")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAdd(false)}
                  disabled={isOperating}
                >
                  {t("extensions_view.cancel")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("extensions_view.marketplace_source_hint")}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-2 -mr-2">
            <button
              type="button"
              onClick={() => onSelect("all")}
              className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors ${activeMarketplace === "all"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-ink hover:bg-card"
                }`}
            >
              <span className="font-medium mr-2">{t("extensions_view.marketplace_all")}</span>
              <span className="text-[10px] w-5 text-center">{totalCount}</span>
            </button>

            {sortedMarketplaces.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-2">
                {t("extensions_view.marketplace_empty")}
              </p>
            )}

            {sortedMarketplaces.map((marketplace) => {
              const isActive = activeMarketplace === marketplace.id;
              const canRemove = !marketplace.id.includes("claude-plugins-official");
              const isUpdating = updatingMarketplaceId === marketplace.id;
              return (
                <div
                  key={marketplace.id}
                  onClick={() => onSelect(marketplace.id)}
                  className={`group flex items-center justify-between w-full rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer ${isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-ink hover:bg-card"
                    }`}
                >
                  <span className="truncate font-medium flex-1 mr-2 select-none">{marketplace.name}</span>

                  <div className="flex items-center shrink-0">
                    <span className={`text-[10px] w-5 text-center select-none ${isActive ? "text-primary/70" : "text-muted-foreground"}`}>
                      {marketplace.pluginCount}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isOperating}
                      className={`h-5 w-5 ${isActive ? "text-primary hover:text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-ink"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdate(marketplace.id);
                      }}
                      title={t("extensions_view.marketplace_update")}
                    >
                      <ReloadIcon className={`w-3 h-3 ${isUpdating ? "animate-spin" : ""}`} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canRemove || isOperating}
                      className={`h-5 w-5 ${isActive ? "text-primary hover:text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-destructive"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(marketplace.id);
                      }}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`absolute inset-0 flex flex-col items-center gap-4 transition-all duration-200 ${collapsed ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none translate-x-2"}`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(false)}
            title={t("extensions_view.expand_sidebar")}
            className="h-8 w-8"
          >
            <DoubleArrowRightIcon className="w-3.5 h-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="rounded-lg border border-border bg-card px-2 py-3 text-xs text-muted-foreground text-center hover:text-ink"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            title={activeMarketplaceLabel}
          >
            <span className="max-h-[280px] overflow-hidden">{activeMarketplaceLabel}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
