import { StatuslineView } from "../../views/Statusline/StatuslineView";
import { FeaturesLayout } from "../../views/Features";

export default function StatuslinePage() {
  return (
    <FeaturesLayout feature="statusline">
      <StatuslineView />
    </FeaturesLayout>
  );
}
