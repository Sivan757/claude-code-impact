import { ConfigScope } from "../../config/types";
import { cn } from "../../lib/utils";
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
}

const scopeInfo: Record<
  ConfigScope,
  { label: string; description: string; color: string }
> = {
  [ConfigScope.User]: {
    label: "User",
    description: "Personal defaults (~/.claude/settings.json)",
    color: "text-blue-600 dark:text-blue-400",
  },
  [ConfigScope.UserLocal]: {
    label: "User Local",
    description: "Machine-specific overrides (~/.claude/settings.local.json)",
    color: "text-purple-600 dark:text-purple-400",
  },
  [ConfigScope.Project]: {
    label: "Project",
    description: "Team-shared settings (.claude/settings.json, version controlled)",
    color: "text-green-600 dark:text-green-400",
  },
  [ConfigScope.ProjectLocal]: {
    label: "Project Local",
    description: "Personal project overrides (.claude/settings.local.json, gitignored)",
    color: "text-amber-600 dark:text-amber-400",
  },
  [ConfigScope.Managed]: {
    label: "Managed",
    description: "IT/enterprise controlled (read-only)",
    color: "text-red-600 dark:text-red-400",
  },
  [ConfigScope.Default]: {
    label: "Default",
    description: "Hardcoded fallbacks",
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
}: ScopeSelectorProps) {
  const scopes = userOnly ? [ConfigScope.User] : editableScopes;
  const info = scopeInfo[value];

  if (userOnly) {
    // In user-only mode, just show a simple badge
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 rounded-xl", className)}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">Editing:</span>
        <span className={cn("text-xs font-medium", info.color)}>
          {info.label}
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
              <span className="text-xs text-muted-foreground">Editing:</span>
              <span className={cn("text-xs font-medium", info.color)}>
                {info.label}
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {scopes.map((scope) => {
            const scopeData = scopeInfo[scope];
            return (
              <SelectItem
                key={scope}
                value={scope}
                className="rounded-lg focus:bg-muted/50 cursor-pointer"
              >
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className={cn("text-sm font-medium", scopeData.color)}>
                    {scopeData.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {scopeData.description}
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
