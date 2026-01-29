import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";

export default function SettingsPage() {
  return (
    <FeaturesLayout feature="settings">
      <GlobalSettingsView defaultTab="general" />
    </FeaturesLayout>
  );
}
