import { ContextFilesView } from "../views/Settings";
import { FeaturesLayout } from "../views/Features";

export default function ContextFilesPage() {
  return (
    <FeaturesLayout feature="context">
      <ContextFilesView />
    </FeaturesLayout>
  );
}
