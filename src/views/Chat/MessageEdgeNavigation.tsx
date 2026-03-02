import type { ReactElement } from "react";
import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";

interface MessageEdgeNavigationProps {
  topLabel: string;
  bottomLabel: string;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}

const edgeButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-md backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/50 hover:text-ink active:translate-y-0";

export function MessageEdgeNavigation(props: MessageEdgeNavigationProps): ReactElement {
  const { topLabel, bottomLabel, onScrollTop, onScrollBottom } = props;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-200">
      <button
        type="button"
        onClick={onScrollTop}
        aria-label={topLabel}
        title={topLabel}
        className={`${edgeButtonClassName} pointer-events-auto`}
      >
        <ArrowUpToLine className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onScrollBottom}
        aria-label={bottomLabel}
        title={bottomLabel}
        className={`${edgeButtonClassName} pointer-events-auto`}
      >
        <ArrowDownToLine className="h-4 w-4" />
      </button>
    </div>
  );
}
