import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmVariant = "default" | "destructive";

export interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmDialogRequest {
  options: ConfirmDialogOptions;
  resolve: (result: boolean) => void;
}

type ConfirmDialogFn = (options: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmDialogFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [activeRequest, setActiveRequest] = useState<ConfirmDialogRequest | null>(null);
  const queueRef = useRef<ConfirmDialogRequest[]>([]);

  const popNext = useCallback(() => {
    setActiveRequest((current) => current ?? queueRef.current.shift() ?? null);
  }, []);

  const confirm = useCallback<ConfirmDialogFn>((options) => {
    return new Promise<boolean>((resolve) => {
      queueRef.current.push({ options, resolve });
      popNext();
    });
  }, [popNext]);

  const resolveRequest = useCallback((result: boolean) => {
    setActiveRequest((current) => {
      if (!current) return null;
      current.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!activeRequest && queueRef.current.length > 0) {
      popNext();
    }
  }, [activeRequest, popNext]);

  useEffect(() => {
    return () => {
      if (activeRequest) {
        activeRequest.resolve(false);
      }
      for (const item of queueRef.current) {
        item.resolve(false);
      }
      queueRef.current = [];
    };
  }, [activeRequest]);

  const options = activeRequest?.options;
  const title = options?.title ?? t("common.confirm_title", "Please confirm");
  const description = options?.description ?? "";
  const cancelText = options?.cancelText ?? t("common.cancel", "Cancel");
  const confirmText = options?.confirmText ?? t("common.confirm", "Confirm");
  const confirmVariant = options?.variant === "destructive" ? "destructive" : "default";

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}

      <Dialog
        open={Boolean(activeRequest)}
        onOpenChange={(open) => {
          if (!open) {
            resolveRequest(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => resolveRequest(false)}>
              {cancelText}
            </Button>
            <Button variant={confirmVariant} onClick={() => resolveRequest(true)}>
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogFn {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return context;
}
