import { Button } from "../../components/ui/button";
import { Cross2Icon } from "@radix-ui/react-icons";

interface BatchOperationsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onApplyTemplate: () => void;
  onExportAll: () => void;
  onCompare: () => void;
}

export function BatchOperationsToolbar({
  selectedCount,
  onClearSelection,
  onApplyTemplate,
  onExportAll,
  onCompare,
}: BatchOperationsToolbarProps) {

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
      <span className="text-sm font-medium text-primary">
        {selectedCount} selected
      </span>
      <div className="flex-1" />
      <Button
        size="sm"
        variant="outline"
        className="h-7 rounded-lg text-xs"
        onClick={onApplyTemplate}
      >
        Apply Template
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 rounded-lg text-xs"
        onClick={onExportAll}
      >
        Export All
      </Button>
      {selectedCount === 2 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-lg text-xs"
          onClick={onCompare}
        >
          Compare
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 rounded-lg"
        onClick={onClearSelection}
      >
        <Cross2Icon className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
