import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ReloadIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { useInvokeQuery, useQueryClient } from "../../hooks";
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
  const queryClient = useQueryClient();
  const { data: allContextFiles = [], isLoading } = useInvokeQuery<ContextFile[]>(["contextFiles"], "get_context_files");
  const contextFiles = useMemo(() => allContextFiles.filter((f) => f.scope === "global"), [allContextFiles]);

  const [search, setSearch] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contextFiles"] });
  };

  if (isLoading) return <LoadingState message={t('context_files.loading')} />;

  const filteredContextFiles = contextFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>
      <PageHeader
        title={t('context_files.title')}
        subtitle={t('context_files.subtitle')}
        action={
          <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh')}>
            <ReloadIcon className="w-4 h-4" />
          </Button>
        }
      />

      <div className="flex-1 flex flex-col space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SearchInput
            placeholder={t('context_files.search_placeholder')}
            value={search}
            onChange={setSearch}
            className="w-1/2 px-3.5 py-2 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {contextFiles.length === 0 && !search && (
          <EmptyState
            icon={FileTextIcon}
            message={t('context_files.no_files')}
            hint={t('context_files.create_hint')}
          />
        )}

        {filteredContextFiles.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-border">
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
