import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";
import { useSettingsPath } from "../../hooks";

export default function SettingsPage() {
  const settingsPath = useSettingsPath();

  return (
    <FeaturesLayout feature="settings">
      <GlobalSettingsView defaultTab="general" settingsPath={settingsPath} />
    </FeaturesLayout>
  );
}
