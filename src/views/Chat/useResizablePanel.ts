import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

type ResizeDirection = "right" | "left";

interface UseResizablePanelOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  direction?: ResizeDirection;
}

interface UseResizablePanelResult {
  width: number;
  isResizing: boolean;
  onResizeStart: (event: ReactMouseEvent<HTMLElement>) => void;
}

export function useResizablePanel({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  direction = "right",
}: UseResizablePanelOptions): UseResizablePanelResult {
  const [width, setWidth] = useState<number>(() => {
    const persisted = window.localStorage.getItem(storageKey);
    if (!persisted) return defaultWidth;
    const parsed = Number.parseInt(persisted, 10);
    if (Number.isNaN(parsed)) return defaultWidth;
    return Math.min(maxWidth, Math.max(minWidth, parsed));
  });
  const [isResizing, setIsResizing] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const widthRef = useRef(width);
  const pendingWidthRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  widthRef.current = width;

  const onResizeStart = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = widthRef.current;
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - startXRef.current;
      const effectiveDelta = direction === "left" ? -delta : delta;
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidthRef.current + effectiveDelta),
      );
      pendingWidthRef.current = nextWidth;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        if (pendingWidthRef.current !== null) {
          setWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        }
      });
    };

    const onMouseUp = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (pendingWidthRef.current !== null) {
        setWidth(pendingWidthRef.current);
        pendingWidthRef.current = null;
      }
      setIsResizing(false);
      window.localStorage.setItem(storageKey, `${widthRef.current}`);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingWidthRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [direction, isResizing, maxWidth, minWidth, storageKey]);

  useEffect(() => {
    if (isResizing) return;
    window.localStorage.setItem(storageKey, `${width}`);
  }, [isResizing, storageKey, width]);

  return {
    width,
    isResizing,
    onResizeStart,
  };
}
