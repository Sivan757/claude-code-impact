import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import type { DistillDocument } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ItemCard,
  ConfigPage,
  useSearch,
} from "../../components/config";
import { DistillMenu } from "./DistillMenu";
import { useInvokeQuery, useQueryClient } from "../../hooks";

interface DistillViewProps {
  onSelect: (doc: DistillDocument) => void;
  watchEnabled: boolean;
  onWatchToggle: (enabled: boolean) => void;
}

export function DistillView({ onSelect, watchEnabled, onWatchToggle }: DistillViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useInvokeQuery<DistillDocument[]>(["distillDocuments"], "list_distill_documents");
  const { search, setSearch, filtered } = useSearch(documents, ["title", "tags"]);

  const refreshDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ["distillDocuments"] });
  };

  useEffect(() => {
    // Listen for distill directory changes
    const unlisten = listen("distill-changed", () => {
      refreshDocuments();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (isLoading) return <LoadingState message={t('distill.loading')} />;

  return (
    <ConfigPage>
      <PageHeader
        title={t('distill.title')}
        subtitle={t('distill.summaries_count', { count: documents.length })}
        action={
          <DistillMenu
            watchEnabled={watchEnabled}
            onWatchToggle={onWatchToggle}
            onRefresh={refreshDocuments}
          />
        }
      />

      <div className="flex items-center justify-between gap-3">
        <SearchInput placeholder={t('distill.search_placeholder')} value={search} onChange={setSearch} />
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <ItemCard
              key={doc.file}
              name={doc.title}
              description={doc.tags.map((t) => `#${t}`).join(" ")}
              timestamp={doc.date}
              onClick={() => onSelect(doc)}
            />
          ))}
        </div>
      ) : !search ? (
        <EmptyState
          icon={LightningBoltIcon}
          message={t('distill.no_documents')}
          hint={t('distill.hint')}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t('distill.no_match', { search })}</p>
      )}
    </ConfigPage>
  );
}
