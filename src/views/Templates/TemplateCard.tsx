import { useTranslation } from "react-i18next";
import {
  DotsHorizontalIcon,
  TrashIcon,
  EyeOpenIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import type { TemplateListEntry } from "../../config/templates/types";

interface TemplateCardProps {
  template: TemplateListEntry;
  onPreview: () => void;
  onApply: () => void;
  onDelete?: () => void;
}

export function TemplateCard({
  template,
  onPreview,
  onApply,
  onDelete,
}: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all group">
      {/* Header: Name + Built-in badge + Dropdown */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-medium text-foreground truncate">
              {template.name}
            </p>
            {template.is_builtin && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {t("templates.builtin_badge", "Built-in")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {template.description}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <DotsHorizontalIcon className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <EyeOpenIcon className="w-3.5 h-3.5 mr-2" />
              {t("templates.preview", "Preview")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onApply}>
              <RocketIcon className="w-3.5 h-3.5 mr-2" />
              {t("templates.apply", "Apply")}
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
              >
                <TrashIcon className="w-3.5 h-3.5 mr-2" />
                {t("templates.delete", "Delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Config badges */}
      <ConfigBadges template={template} />

      {/* Tags + Apply button footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
        <div className="flex items-center flex-1 min-w-0 text-xs text-muted-foreground truncate">
          {template.tags.slice(0, 3).join(" · ")}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-lg text-xs gap-1 shrink-0 ml-2"
          onClick={onApply}
        >
          <RocketIcon className="w-3 h-3" />
          {t("templates.apply", "Apply")}
        </Button>
      </div>
    </div>
  );
}

function ConfigBadges({ template }: { template: TemplateListEntry }) {
  const badges: { label: string; className: string }[] = [];

  if (template.model) {
    badges.push({
      label: template.model,
      className: "bg-primary/10 text-primary",
    });
  }

  if (template.mcp_count > 0) {
    badges.push({
      label: `${template.mcp_count} MCPs`,
      className: "bg-purple-500/10 text-purple-600",
    });
  }

  if (template.permission_mode) {
    badges.push({
      label: template.permission_mode,
      className: "bg-blue-500/10 text-blue-600",
    });
  }

  if (template.env_count > 0) {
    badges.push({
      label: `${template.env_count} env`,
      className: "bg-green-500/10 text-green-600",
    });
  }

  if (template.has_hooks) {
    badges.push({
      label: "hooks",
      className: "bg-amber-500/10 text-amber-600",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
