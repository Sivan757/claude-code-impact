import { useTranslation } from "react-i18next";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import type { TemplateComponent } from "../../types";
import { ConfigPage, PageHeader, EmptyState } from "../../components/config";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { MarketplaceContent } from "../Marketplace";

interface OutputStylesViewProps {
  onMarketplaceSelect: (template: TemplateComponent) => void;
}

export function OutputStylesView({ onMarketplaceSelect }: OutputStylesViewProps) {
  const { t } = useTranslation();
  return (
    <ConfigPage>
      <PageHeader title={t('output_styles.title')} subtitle={t('output_styles.subtitle')} />

      <Tabs defaultValue="installed" className="flex-1 flex flex-col">
        <TabsList className="bg-card-alt border border-border">
          <TabsTrigger value="installed">{t('commands.installed')}</TabsTrigger>
          <TabsTrigger value="marketplace">{t('commands.marketplace')}</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="mt-4 space-y-4">
          <EmptyState
            icon={MixerHorizontalIcon}
            message={t('output_styles.coming_soon')}
            hint={t('output_styles.coming_soon_desc')}
          />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-4">
          <MarketplaceContent category="output-styles" onSelectTemplate={onMarketplaceSelect} />
        </TabsContent>
      </Tabs>
    </ConfigPage>
  );
}
