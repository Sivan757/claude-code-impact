import { GlobalSettingsView } from "../../views/Settings";
import { FeaturesLayout } from "../../views/Features";

export default function LlmProviderPage() {
  return (
    <FeaturesLayout feature="basic-llm">
      <GlobalSettingsView defaultTab="provider" />
    </FeaturesLayout>
  );
}
