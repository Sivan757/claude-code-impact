import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { getPathBaseName } from "@/lib/pathDisplay";
import type { MergedConfigView } from "../../config/types";

interface ProjectCompareDialogProps {
  open: boolean;
  onClose: () => void;
  projectA?: { path: string; config: MergedConfigView };
  projectB?: { path: string; config: MergedConfigView };
}

export function ProjectCompareDialog({
  open,
  onClose,
  projectA,
  projectB,
}: ProjectCompareDialogProps) {
  if (!projectA || !projectB) return null;

  const shortName = (path: string) => getPathBaseName(path);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Compare: {shortName(projectA.path)} vs {shortName(projectB.path)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 overflow-auto max-h-[60vh]">
          {/* Project A */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 truncate" title={projectA.path}>
              {shortName(projectA.path)}
            </p>
            <pre className="bg-secondary/40 rounded-lg p-3 text-xs font-mono overflow-auto max-h-[50vh]">
              {JSON.stringify(projectA.config.effective, null, 2)}
            </pre>
          </div>
          {/* Project B */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 truncate" title={projectB.path}>
              {shortName(projectB.path)}
            </p>
            <pre className="bg-secondary/40 rounded-lg p-3 text-xs font-mono overflow-auto max-h-[50vh]">
              {JSON.stringify(projectB.config.effective, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
