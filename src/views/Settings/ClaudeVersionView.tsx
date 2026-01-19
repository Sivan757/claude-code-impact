import { useTranslation } from "react-i18next";
import { PageHeader, ConfigPage } from "../../components/config";
import { ClaudeCodeVersionSection } from "./ClaudeCodeVersionSection";

export function ClaudeVersionView() {
  const { t } = useTranslation();
  return (
    <ConfigPage>
      <PageHeader title={t('features.basic-version')} subtitle={t('features_desc.basic-version')} />
      <div className="flex-1 flex flex-col">
        <ClaudeCodeVersionSection />
      </div>
    </ConfigPage>
  );
}
