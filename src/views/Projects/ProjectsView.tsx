import { FileIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";

export function ProjectsView() {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-ink mb-2">{t('projects.title')}</h1>
          <p className="text-muted-foreground">{t('projects.subtitle')}</p>
        </header>

        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <FileIcon className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-serif text-xl font-semibold text-ink mb-2">{t('projects.coming_soon')}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('projects.description')}
          </p>
        </div>
      </div>
    </div>
  );
}
