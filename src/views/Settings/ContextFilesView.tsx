import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useInvokeQuery } from "../../hooks";
import { FileTextIcon } from "@radix-ui/react-icons";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import { ContextFileItem } from "../../components/ContextFileItem";
import type { ContextFile } from "../../types";

export function ContextFilesView() {
  const { t } = useTranslation();
  const { data: allContextFiles = [], isLoading } = useInvokeQuery<ContextFile[]>(["contextFiles"], "get_context_files");
  const contextFiles = useMemo(() => allContextFiles.filter((f) => f.scope === "global"), [allContextFiles]);

  const [search, setSearch] = useState("");

  if (isLoading) return <LoadingState message={t('context_files.loading')} />;

  const filteredContextFiles = contextFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>
      <PageHeader title={t('context_files.title')} subtitle={t('context_files.subtitle')} />

      <div className="flex-1 flex flex-col space-y-4">
        <SearchInput placeholder={t('context_files.search_placeholder')} value={search} onChange={setSearch} />

        {contextFiles.length === 0 && !search && (
          <EmptyState
            icon={FileTextIcon}
            message={t('context_files.no_files')}
            hint={t('context_files.create_hint')}
          />
        )}

        {filteredContextFiles.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2 border-b border-border">
              <span className="text-sm font-medium text-ink">
                {t('context_files.files_count', { count: filteredContextFiles.length })}
              </span>
            </div>
            <div className="p-3 space-y-1">
              {filteredContextFiles.map((file) => (
                <ContextFileItem key={file.path} file={file} />
              ))}
            </div>
          </div>
        )}

        {search && filteredContextFiles.length === 0 && contextFiles.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('context_files.no_match', { search })}
          </p>
        )}
      </div>
    </ConfigPage>
  );
}
