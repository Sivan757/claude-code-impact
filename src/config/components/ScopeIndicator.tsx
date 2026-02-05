import { ConfigScope } from "../types";

interface ScopeIndicatorProps {
  scope: ConfigScope;
  className?: string;
}

const scopeColors: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  [ConfigScope.ProjectLocal]: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  [ConfigScope.Project]: "bg-primary/10 text-primary border-primary/20",
  [ConfigScope.UserLocal]: "bg-green-500/10 text-green-600 border-green-500/20",
  [ConfigScope.User]: "bg-muted-foreground/10 text-muted-foreground border-border/60",
  [ConfigScope.Default]: "bg-secondary/40 text-muted-foreground border-border/40",
};

const scopeLabels: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: "Managed",
  [ConfigScope.ProjectLocal]: "Project Local",
  [ConfigScope.Project]: "Project",
  [ConfigScope.UserLocal]: "User Local",
  [ConfigScope.User]: "User",
  [ConfigScope.Default]: "Default",
};

export function ScopeIndicator({ scope, className = "" }: ScopeIndicatorProps) {
  const colorClass = scopeColors[scope];
  const label = scopeLabels[scope];

  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
