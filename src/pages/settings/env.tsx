import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";

export default function EnvSettingsPage() {
  return (
    <FeaturesLayout feature="basic-env">
      <GlobalSettingsView defaultTab="env" />
    </FeaturesLayout>
  );
}
