import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";
import { useSettingsPath } from "../../hooks";

export default function HooksSettingsPage() {
  const settingsPath = useSettingsPath();

  return (
    <FeaturesLayout feature="hooks">
      <GlobalSettingsView defaultTab="hooks" settingsPath={settingsPath} />
    </FeaturesLayout>
  );
}
