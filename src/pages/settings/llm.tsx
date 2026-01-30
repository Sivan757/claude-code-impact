import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";
import { useSettingsPath } from "../../hooks";

export default function LlmProviderPage() {
  const settingsPath = useSettingsPath();

  return (
    <FeaturesLayout feature="basic-llm">
      <GlobalSettingsView defaultTab="provider" settingsPath={settingsPath} />
    </FeaturesLayout>
  );
}
