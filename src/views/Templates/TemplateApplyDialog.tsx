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
import { getPathBaseName } from "@/lib/pathDisplay";
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
  const mergeModes: { value: MergeMode; label: string; desc: string }[] = [
    { value: "merge", label: t("launcher.merge_merge"), desc: t("templates.merge_mode_desc_merge") },
    { value: "fill", label: t("launcher.merge_fill"), desc: t("templates.merge_mode_desc_fill") },
    { value: "replace", label: t("launcher.merge_replace"), desc: t("templates.merge_mode_desc_replace") },
  ];

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
          <DialogTitle className="font-serif">{t("templates.apply_dialog_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-foreground">
              {t("templates.apply_target_prefix")} <strong>{templateName}</strong> {t("templates.apply_target_to")}{" "}
              {projectPath ? (
                <span className="font-mono text-xs">{getPathBaseName(projectPath)}</span>
              ) : (
                t("templates.save_source_global_short")
              )}
            </p>
          </div>

          {/* Merge Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("templates.merge_mode_label")}
            </label>
            <Select value={mergeMode} onValueChange={(v) => setMergeMode(v as MergeMode)}>
              <SelectTrigger className="w-full h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {mergeModes.map((mode) => (
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
              {applyMutation.isPending ? t("templates.applying") : t("templates.apply")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
