import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useTemplateApply } from "../../config/templates/hooks";
import type { MergeMode } from "../../config/templates/types";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

interface TemplateApplyDialogProps {
  templateId: string | null;
  templateName: string;
  open: boolean;
  onClose: () => void;
  projectPath?: string;
}

const MERGE_MODES: { value: MergeMode; label: string; desc: string }[] = [
  { value: "merge", label: "Merge", desc: "Deep merge — new keys added, existing keys overwritten on conflict" },
  { value: "fill", label: "Fill Missing", desc: "Only add keys that don't exist yet (never overwrites)" },
  { value: "replace", label: "Replace", desc: "Completely overwrite target config with template" },
];

export function TemplateApplyDialog({
  templateId,
  templateName,
  open,
  onClose,
  projectPath,
}: TemplateApplyDialogProps) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const [mergeMode, setMergeMode] = useState<MergeMode>("merge");
  const applyMutation = useTemplateApply();

  const handleApply = async () => {
    if (!templateId) return;

    const confirmed = await confirmDialog({
      title: t("templates.apply", "Apply"),
      description: mergeMode === "replace"
        ? t("templates.confirm_apply_replace", "Apply in Replace mode? Existing target config will be overwritten.")
        : t("templates.confirm_apply", "Apply this template now?"),
      variant: mergeMode === "replace" ? "destructive" : "default",
      confirmText: t("templates.apply", "Apply"),
    });
    if (!confirmed) return;

    try {
      await applyMutation.mutateAsync({
        id: templateId,
        projectPath,
        mergeMode,
      });
      onClose();
    } catch { /* error state shown via mutation */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Apply Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-foreground">
              Apply <strong>{templateName}</strong> to{" "}
              {projectPath ? (
                <span className="font-mono text-xs">{projectPath.split("/").pop()}</span>
              ) : (
                "global settings"
              )}
            </p>
          </div>

          {/* Merge Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Merge Mode
            </label>
            <Select value={mergeMode} onValueChange={(v) => setMergeMode(v as MergeMode)}>
              <SelectTrigger className="w-full h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {MERGE_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value} className="rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{mode.label}</span>
                      <span className="text-xs text-muted-foreground">{mode.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {applyMutation.isError && (
            <p className="text-xs text-destructive">
              {t("common.failed_with", { error: applyMutation.error })}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleApply}
              disabled={applyMutation.isPending || !templateId}
            >
              {applyMutation.isPending ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
