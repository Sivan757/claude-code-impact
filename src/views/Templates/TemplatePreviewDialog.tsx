import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { LoadingState } from "../../components/config";
import { useTemplateGet } from "../../config/templates/hooks";

interface TemplatePreviewDialogProps {
  templateId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TemplatePreviewDialog({
  templateId,
  open,
  onClose,
}: TemplatePreviewDialogProps) {
  const { data: template, isLoading } = useTemplateGet(templateId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {template?.name ?? "Template Preview"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Loading template..." />
        ) : template ? (
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Description */}
            <div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {template.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Settings */}
            <Section title="Settings" data={template.config} />

            {/* Environment */}
            {template.env && Object.keys(template.env).length > 0 && (
              <Section title="Environment Variables" data={template.env} />
            )}

            {/* Hooks */}
            {template.hooks && Object.keys(template.hooks).length > 0 && (
              <Section title="Hooks" data={template.hooks} />
            )}

            {/* MCP Servers */}
            {template.mcp_servers && Object.keys(template.mcp_servers).length > 0 && (
              <Section title="MCP Servers" data={template.mcp_servers} />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </p>
      <pre className="bg-secondary/40 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
