import type { ReactElement } from "react";

interface LoadingOverlayMaskProps {
  label: string;
  visible: boolean;
}

export function LoadingOverlayMask(props: LoadingOverlayMaskProps): ReactElement {
  const { label, visible } = props;

  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px] transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className={`flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-all duration-200 ease-out ${
          visible ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.98]"
        }`}
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
