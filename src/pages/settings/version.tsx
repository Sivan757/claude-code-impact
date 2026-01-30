import { useTranslation } from "react-i18next";
import { ConfigPage, PageHeader } from "../../components/config";
import { FeaturesLayout } from "../../views/Features";
import { ClaudeCodeVersionSection } from "../../views/Settings/ClaudeCodeVersionSection";

export default function VersionSettingsPage() {
  const { t } = useTranslation();

  return (
    <FeaturesLayout feature="basic-version">
      <ConfigPage>
        <PageHeader
          title={t("features.basic-version")}
          subtitle={t("features_desc.basic-version")}
        />
        <ClaudeCodeVersionSection />
      </ConfigPage>
    </FeaturesLayout>
  );
}
