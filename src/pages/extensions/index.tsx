import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";

export default function ExtensionsPage() {
  return (
    <FeaturesLayout feature="extensions">
      <GlobalSettingsView defaultTab="plugins" />
    </FeaturesLayout>
  );
}
