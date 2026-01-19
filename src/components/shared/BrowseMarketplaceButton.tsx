import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";

interface BrowseMarketplaceButtonProps {
  onClick?: () => void;
}

export function BrowseMarketplaceButton({ onClick }: BrowseMarketplaceButtonProps) {
  const { t } = useTranslation();
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
      title={t('common.browse_marketplace')}
    >
      <Store className="w-4 h-4" />
      <span>{t('common.marketplace')}</span>
    </button>
  );
}
