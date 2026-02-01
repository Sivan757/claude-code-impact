import { useTranslation } from "react-i18next";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type ViewMode = "list" | "card";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/**
 * A toggle button group for switching between list and card view modes.
 * Design follows the LlmProviderView pattern.
 */
export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/60 bg-card/70 p-0.5 shadow-sm",
        className
      )}
    >
      <button
        type="button"
        aria-label={t("common.view_list", "List view")}
        title={t("common.view_list", "List view")}
        onClick={() => onChange("list")}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
          mode === "list"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        )}
      >
        <ListIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("common.view_card", "Card view")}
        title={t("common.view_card", "Card view")}
        onClick={() => onChange("card")}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
          mode === "card"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
