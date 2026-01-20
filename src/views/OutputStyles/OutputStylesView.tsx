import { useTranslation } from "react-i18next";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { ConfigPage, PageHeader, EmptyState } from "../../components/config";

export function OutputStylesView() {
  const { t } = useTranslation();
  return (
    <ConfigPage>
      <PageHeader title={t('output_styles.title')} subtitle={t('output_styles.subtitle')} />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <EmptyState
          icon={MixerHorizontalIcon}
          message={t('output_styles.coming_soon')}
          hint={t('output_styles.coming_soon_desc')}
        />
      </div>
    </ConfigPage>
  );
}
