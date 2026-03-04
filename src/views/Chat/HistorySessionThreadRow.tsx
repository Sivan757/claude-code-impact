import { memo, type ReactNode } from "react";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";

import { SessionDropdownMenuItems } from "@/components/shared/SessionMenuItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface HistorySessionThreadRowProps {
  projectId: string;
  sessionId: string;
  title: string;
  timeLabel: string;
  selected: boolean;
  onOpenSession: (projectId: string, sessionId: string) => void;
}

function HistorySessionThreadRowInner(props: HistorySessionThreadRowProps): ReactNode {
  const {
    projectId,
    sessionId,
    title,
    timeLabel,
    selected,
    onOpenSession,
  } = props;

  return (
    <div
      className={cn(
        "group rounded-lg px-1.5 py-1 transition-all duration-200 ease-out",
        selected ? "bg-primary/12" : "hover:bg-background/70",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpenSession(projectId, sessionId)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="line-clamp-1 text-[13px] font-medium leading-tight text-ink">{title}</p>
            {timeLabel ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
            ) : null}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-card-alt hover:text-ink"
              onClick={(event) => event.stopPropagation()}
            >
              <DotsHorizontalIcon className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <SessionDropdownMenuItems
              projectId={projectId}
              sessionId={sessionId}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function areHistorySessionThreadRowPropsEqual(
  prev: HistorySessionThreadRowProps,
  next: HistorySessionThreadRowProps,
): boolean {
  return prev.projectId === next.projectId
    && prev.sessionId === next.sessionId
    && prev.title === next.title
    && prev.timeLabel === next.timeLabel
    && prev.selected === next.selected
    && prev.onOpenSession === next.onOpenSession;
}

export const HistorySessionThreadRow = memo(
  HistorySessionThreadRowInner,
  areHistorySessionThreadRowPropsEqual,
);

HistorySessionThreadRow.displayName = "HistorySessionThreadRow";
