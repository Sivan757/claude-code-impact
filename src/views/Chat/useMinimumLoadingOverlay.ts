import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

interface UseMinimumLoadingOverlayOptions {
  minimumDurationMs?: number;
}

function clearTimer(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function useMinimumLoadingOverlay(
  isLoading: boolean,
  options: UseMinimumLoadingOverlayOptions = {},
) {
  const minimumDurationMs = options.minimumDurationMs ?? 180;
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const show = useCallback(() => {
    startedAtRef.current = Date.now();
    setVisible(true);
    clearTimer(timerRef);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    clearTimer(timerRef);
  }, []);

  useEffect(() => {
    if (!visible || isLoading) return;

    const elapsedMs = Date.now() - startedAtRef.current;
    const remainingMs = Math.max(0, minimumDurationMs - elapsedMs);
    clearTimer(timerRef);
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, remainingMs);

    return () => {
      clearTimer(timerRef);
    };
  }, [isLoading, minimumDurationMs, visible]);

  useEffect(
    () => () => {
      clearTimer(timerRef);
    },
    [],
  );

  return {
    visible,
    show,
    hide,
  };
}
