/**
 * Unified Settings Components Library
 *
 * Design System: Warm Academic Style (暖学术风格)
 * - Primary: Terracotta (#CC785C)
 * - Background: Warm Beige (#F9F9F7)
 * - Text: Charcoal (#181818)
 */

import { ReactNode, ComponentType, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// Re-export shared components
export { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
export { SourceBadge } from "./SourceBadge";
export { ScopeSelector } from "./ScopeSelector";

// =============================================================================
// Section Components (Pattern A: Form Sections)
// =============================================================================

interface SettingSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact" | "dense";
}

/**
 * A card-based section container for grouping related settings
 */
export function SettingSection({
  title,
  description,
  action,
  children,
  className,
  density = "comfortable",
}: SettingSectionProps) {
  const densityClasses = {
    comfortable: {
      header: "px-4 py-3",
      body: "px-4 py-3",
      bodyGap: "space-y-1",
    },
    compact: {
      header: "px-4 py-2.5",
      body: "px-4 py-2.5",
      bodyGap: "space-y-1",
    },
    dense: {
      header: "px-3 py-2",
      body: "px-3 py-2",
      bodyGap: "space-y-0.5",
    },
  } as const;
  const spacing = densityClasses[density];

  return (
    <section
      className={cn(
        "mb-8", // Add spacing between sections instead of card containment
        className
      )}
    >
      {/* Section Header */}
      <div className={cn("flex items-center justify-between mb-2", spacing.header, "px-0")}>
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      {/* Section Content - styled as a simple grouping now */}
      <div className={cn("", spacing.bodyGap)}>{children}</div>
    </section>
  );
}

// =============================================================================
// Setting Row Component
// =============================================================================

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  labelId?: string;
}

/**
 * A single setting row with label, description, and control
 */
export function SettingRow({
  label,
  description,
  children,
  className,
  compact = false,
  labelId,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        compact ? "py-2.5" : "py-3.5",
        "border-b border-border/30 last:border-0",
        "group",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <p id={labelId} className="text-sm text-foreground font-medium">
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// =============================================================================
// List Item Card (Pattern B: List with Actions)
// =============================================================================

interface ListItemCardProps {
  avatar?: ReactNode;
  avatarFallback?: string;
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  dragHandleRef?: (element: HTMLElement | null) => void;
  className?: string;
}

/**
 * A unified list item card for providers, env vars, etc.
 */
export function ListItemCard({
  avatar,
  avatarFallback,
  title,
  subtitle,
  badges,
  actions,
  isActive = false,
  isDisabled = false,
  onClick,
  dragHandleProps,
  dragHandleRef,
  className,
}: ListItemCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const { className: dragHandleClassName, ...restDragHandleProps } =
    dragHandleProps ?? {};

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 flex items-center justify-between gap-3",
        "transition-all duration-200",
        isActive
          ? "border-primary/60 bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border/50 bg-card/60 hover:bg-muted/40 hover:border-border hover:shadow-sm",
        isDisabled && "opacity-50 pointer-events-none",
        onClick && "cursor-pointer text-left",
        className
      )}
    >
      {/* Left: Avatar + Content */}
      <div
        ref={dragHandleRef}
        {...restDragHandleProps}
        className={cn("flex items-center gap-3 min-w-0 flex-1", dragHandleClassName)}
      >
        {/* Avatar */}
        {(avatar || avatarFallback) && (
          <div
            className={cn(
              "w-9 h-9 shrink-0 rounded-xl flex items-center justify-center",
              "text-sm font-semibold select-none",
              "border border-border/40",
              isActive
                ? "bg-primary/10 text-primary"
                : "bg-secondary/60 text-muted-foreground"
            )}
          >
            {avatar || avatarFallback?.[0]?.toUpperCase() || "?"}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm text-foreground truncate">
              {title}
            </h3>
            {badges}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      )}
    </Wrapper>
  );
}

// =============================================================================
// Status Badges
// =============================================================================

type BadgeVariant =
  | "default"
  | "active"
  | "success"
  | "warning"
  | "error"
  | "muted"
  | "purple"
  | "blue";

interface StatusBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-secondary/80 text-secondary-foreground",
  active: "bg-primary/15 text-primary border border-primary/30",
  success: "bg-green-500/15 text-green-700 dark:text-green-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  error: "bg-red-500/15 text-red-700 dark:text-red-400",
  muted: "bg-muted/80 text-muted-foreground",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

/**
 * Unified status badge component
 */
export function StatusBadge({
  children,
  variant = "default",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// =============================================================================
// Action Toolbar
// =============================================================================

interface ActionToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  secondaryAction?: ReactNode;
  primaryAction?: ReactNode;
  className?: string;
}

/**
 * Unified toolbar with search and action buttons
 * Pattern: [Search Input (w-1/2)] ... [Secondary Action] [Primary Action]
 */
export function ActionToolbar({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  secondaryAction,
  primaryAction,
  className,
}: ActionToolbarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {onSearchChange && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-1/2 px-3.5 py-2 text-sm",
            "bg-card border border-border/60 rounded-xl",
            "text-foreground placeholder:text-muted-foreground/60",
            "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
            "transition-all duration-200"
          )}
        />
      )}
      <div className="flex items-center gap-3">
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Unified empty state component
 */
export function SettingsEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6",
        "text-center",
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// =============================================================================
// Table Components
// =============================================================================

interface TableHeaderProps {
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "center" | "right";
    width?: string;
  }>;
  className?: string;
}

export function TableHeader({ columns, className }: TableHeaderProps) {
  return (
    <div
      className={cn(
        "grid gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30",
        className
      )}
      style={{
        gridTemplateColumns: columns
          .map((c) => c.width || "1fr")
          .join(" "),
      }}
    >
      {columns.map((col) => (
        <span
          key={col.key}
          className={cn(
            "text-xs font-medium text-muted-foreground uppercase tracking-wide",
            col.align === "right" && "text-right",
            col.align === "center" && "text-center"
          )}
        >
          {col.label}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Icon Button
// =============================================================================

interface IconButtonProps {
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  variant?: "default" | "danger" | "warning" | "success";
  disabled?: boolean;
  title?: string;
  className?: string;
}

const iconButtonVariants = {
  default: "hover:bg-secondary/80 hover:text-foreground",
  danger: "hover:bg-red-500/10 hover:text-red-600",
  warning: "hover:bg-amber-500/10 hover:text-amber-600",
  success: "hover:bg-green-500/10 hover:text-green-600",
};

export function IconButton({
  icon: Icon,
  onClick,
  variant = "default",
  disabled = false,
  title,
  className,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center",
        "text-muted-foreground transition-all duration-150",
        iconButtonVariants[variant],
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// =============================================================================
// Expandable Section
// =============================================================================

interface ExpandableSectionProps {
  title: string;
  badge?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function ExpandableSection({
  title,
  badge,
  isExpanded,
  onToggle,
  children,
  className,
}: ExpandableSectionProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/40 overflow-hidden",
        "transition-all duration-200",
        isExpanded && "bg-card/80",
        className
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-muted/30 transition-colors"
        )}
      >
        <div className="flex items-center gap-3">
          <svg
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {badge}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Add Form Row
// =============================================================================

interface AddFormRowProps {
  children: ReactNode;
  className?: string;
}

export function AddFormRow({ children, className }: AddFormRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-2 p-3",
        "rounded-xl border border-dashed border-border/60 bg-card/40",
        "hover:border-primary/40 hover:bg-card/60 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}
