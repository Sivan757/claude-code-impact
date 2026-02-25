import { ConfigScope } from "../../config/types";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ScopeSelectorProps {
  value: ConfigScope;
  onChange: (scope: ConfigScope) => void;
  className?: string;
  /** If true, only show User scope (simplest mode) */
  userOnly?: boolean;
  /** Optional override for which scopes are available */
  scopes?: ConfigScope[];
  /** Optional project path to enable project scopes */
  projectPath?: string;
}

const scopeInfo: Record<
  ConfigScope,
  { labelKey: string; descriptionKey: string; color: string }
> = {
  [ConfigScope.User]: {
    labelKey: "scope_selector.user",
    descriptionKey: "scope_selector.user_desc",
    color: "text-blue-600 dark:text-blue-400",
  },
  [ConfigScope.UserLocal]: {
    labelKey: "scope_selector.user_local",
    descriptionKey: "scope_selector.user_local_desc",
    color: "text-purple-600 dark:text-purple-400",
  },
  [ConfigScope.Project]: {
    labelKey: "scope_selector.project",
    descriptionKey: "scope_selector.project_desc",
    color: "text-green-600 dark:text-green-400",
  },
  [ConfigScope.ProjectLocal]: {
    labelKey: "scope_selector.project_local",
    descriptionKey: "scope_selector.project_local_desc",
    color: "text-amber-600 dark:text-amber-400",
  },
  [ConfigScope.Managed]: {
    labelKey: "scope_selector.managed",
    descriptionKey: "scope_selector.managed_desc",
    color: "text-red-600 dark:text-red-400",
  },
  [ConfigScope.Default]: {
    labelKey: "scope_selector.default",
    descriptionKey: "scope_selector.default_desc",
    color: "text-muted-foreground",
  },
};

// Editable scopes (user can make changes)
const editableScopes = [
  ConfigScope.User,
  ConfigScope.UserLocal,
  ConfigScope.Project,
  ConfigScope.ProjectLocal,
];

/**
 * Scope selector component for multi-scope config editing
 */
export function ScopeSelector({
  value,
  onChange,
  className,
  userOnly = false,
  scopes: scopesOverride,
  projectPath,
}: ScopeSelectorProps) {
  const { t } = useTranslation();
  const scopes = userOnly ? [ConfigScope.User] : (scopesOverride ?? editableScopes);
  const info = scopeInfo[value];

  if (userOnly) {
    // In user-only mode, just show a simple badge
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 rounded-xl", className)}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{t("scope_selector.editing")}</span>
        <span className={cn("text-xs font-medium", info.color)}>
          {t(info.labelKey)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      <Select value={value} onValueChange={(val) => onChange(val as ConfigScope)}>
        <SelectTrigger className="w-[280px] h-9 rounded-xl border-border/60 bg-card focus:ring-2 focus:ring-primary/10">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("scope_selector.editing")}</span>
              <span className={cn("text-xs font-medium", info.color)}>
                {t(info.labelKey)}
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {scopes.map((scope) => {
            const scopeData = scopeInfo[scope];
            const isProjectScope =
              scope === ConfigScope.Project || scope === ConfigScope.ProjectLocal;
            return (
              <SelectItem
                key={scope}
                value={scope}
                className="rounded-lg focus:bg-muted/50 cursor-pointer"
                disabled={isProjectScope && !projectPath}
              >
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className={cn("text-sm font-medium", scopeData.color)}>
                    {t(scopeData.labelKey)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(scopeData.descriptionKey)}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
