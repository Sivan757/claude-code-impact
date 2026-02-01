import { StarFilledIcon, HeartFilledIcon, GlobeIcon } from "@radix-ui/react-icons";
import { StatusBadge } from "./index";
import { cn } from "../../lib/utils";

interface SourceBadgeProps {
  sourceId: "anthropic" | "claudecodeimpact" | "community" | string | null;
  sourceName?: string | null;
  className?: string;
}

/**
 * A specialized badge that displays source information with appropriate icons.
 * - anthropic: Star icon with amber color
 * - claudecodeimpact: Heart icon with primary color
 * - community/other: Globe icon with muted color
 */
export function SourceBadge({ sourceId, sourceName, className }: SourceBadgeProps) {
  if (!sourceId || sourceId === "personal") return null;

  const getConfig = () => {
    switch (sourceId) {
      case "anthropic":
        return {
          icon: StarFilledIcon,
          variant: "warning" as const,
          iconClassName: "text-amber-600",
        };
      case "claudecodeimpact":
        return {
          icon: HeartFilledIcon,
          variant: "active" as const,
          iconClassName: "text-primary",
        };
      default:
        return {
          icon: GlobeIcon,
          variant: "muted" as const,
          iconClassName: "text-muted-foreground",
        };
    }
  };

  const { icon: Icon, variant, iconClassName } = getConfig();

  return (
    <StatusBadge variant={variant} className={cn("gap-1", className)}>
      <Icon className={cn("w-3 h-3", iconClassName)} />
      {sourceName}
    </StatusBadge>
  );
}
