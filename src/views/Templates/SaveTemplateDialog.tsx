import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { useTemplateSaveFromProject } from "../../config/templates/hooks";

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  projectPath?: string;
}

export function SaveTemplateDialog({
  open,
  onClose,
  projectPath,
}: SaveTemplateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const saveMutation = useTemplateSaveFromProject();

  const handleSave = async () => {
    if (!name.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await saveMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        tags,
        projectPath,
      });
      setName("");
      setDescription("");
      setTagsInput("");
      onClose();
    } catch { /* error shown via mutation */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{t("templates.save_dialog_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("templates.save_name_label")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("templates.save_name_placeholder")}
              className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("common.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("templates.save_description_placeholder")}
              rows={3}
              className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("templates.save_tags_label")}
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t("templates.save_tags_placeholder")}
              className="w-full bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm"
            />
          </div>

          {/* Source indicator */}
          <p className="text-xs text-muted-foreground">
            {projectPath
              ? t("templates.save_source_project", { name: projectPath.split("/").pop() ?? projectPath })
              : t("templates.save_source_global")}
          </p>

          {/* Error */}
          {saveMutation.isError && (
            <p className="text-xs text-destructive">
              {t("common.failed_with", { error: saveMutation.error })}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSave}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? t("templates.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
