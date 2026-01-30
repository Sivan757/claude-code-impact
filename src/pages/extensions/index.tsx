import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";
import { useSettingsPath } from "../../hooks";

export default function ExtensionsPage() {
  const settingsPath = useSettingsPath();

  return (
    <FeaturesLayout feature="extensions">
      <GlobalSettingsView defaultTab="plugins" settingsPath={settingsPath} />
    </FeaturesLayout>
  );
}
