import { ContextFilesView } from "../views/Settings";
import { FeaturesLayout } from "../views/Features";
import { useSettingsPath } from "../hooks";

export default function ContextFilesPage() {
  const settingsPath = useSettingsPath();

  return (
    <FeaturesLayout feature="context">
      <ContextFilesView projectPath={settingsPath} />
    </FeaturesLayout>
  );
}
