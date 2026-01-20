import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2Icon } from "@radix-ui/react-icons";
import type { ClaudeSettings } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
} from "../../components/config";
import { useInvokeQuery } from "../../hooks";

export function HooksView() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");
  const [search, setSearch] = useState("");

  if (isLoading) return <LoadingState message={t('hooks.loading')} />;

  const hooks = settings?.hooks as Record<string, unknown[]> | null;
  const hookEntries = hooks ? Object.entries(hooks) : [];
  const filtered = hookEntries.filter(([eventType]) =>
    eventType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ConfigPage>
      <PageHeader
        title={t('hooks.title')}
        subtitle={t('hooks.subtitle')}
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <SearchInput
          placeholder={t('hooks.search_placeholder')}
          value={search}
          onChange={setSearch}
        />

        {filtered.length > 0 && (
          <div className="space-y-4 overflow-y-auto min-h-0">
            {filtered.map(([eventType, handlers]) => (
              <div key={eventType} className="bg-card rounded-xl p-4 border border-border">
                <p className="text-sm font-medium text-primary mb-3">{eventType}</p>
                <div className="space-y-2">
                  {Array.isArray(handlers) &&
                    handlers.map((handler, i) => (
                      <pre
                        key={i}
                        className="bg-card-alt rounded-lg p-3 text-xs font-mono text-ink overflow-x-auto"
                      >
                        {JSON.stringify(handler, null, 2)}
                      </pre>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && !search && (
          <EmptyState
            icon={Link2Icon}
            message={t('hooks.no_hooks')}
          />
        )}

        {filtered.length === 0 && search && (
          <p className="text-muted-foreground text-sm">{t('commands.no_match', { search })}</p>
        )}
      </div>
    </ConfigPage>
  );
}
