import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MergedConfigView } from "../types";
import { ScopeIndicator } from "./ScopeIndicator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface MergeViewerProps {
  mergedConfig: MergedConfigView;
}

export function MergeViewer({ mergedConfig }: MergeViewerProps) {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const provenanceEntries = Object.entries(mergedConfig.provenance);
  const hasErrors = mergedConfig.parse_errors && mergedConfig.parse_errors.length > 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="effective" className="w-full">
        <TabsList className={`grid w-full ${hasErrors ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="effective">{t("merge_viewer.effective")}</TabsTrigger>
          <TabsTrigger value="provenance">{t("merge_viewer.provenance")}</TabsTrigger>
          <TabsTrigger value="claude-md">CLAUDE.md</TabsTrigger>
          {hasErrors && (
            <TabsTrigger value="errors" className="text-destructive">
              {t("merge_viewer.errors")} ({mergedConfig.parse_errors.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="effective" className="space-y-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(mergedConfig.effective, null, 2)}
              </pre>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="provenance" className="space-y-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {provenanceEntries.map(([key, entry]) => (
                <div
                  key={key}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedKey === key ? "bg-muted/50" : ""
                  }`}
                  onClick={() => setSelectedKey(key === selectedKey ? null : key)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{key}</span>
                    <ScopeIndicator scope={entry.scope} />
                  </div>
                  {selectedKey === key && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {t("merge_viewer.source")}: {entry.file_path}
                      </div>
                      <div className="rounded bg-secondary/40 p-2">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(entry.value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="claude-md" className="space-y-3">
          <div className="space-y-4">
            {mergedConfig.claude_md.sources.map((source, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card"
              >
                <div className="border-b border-border p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{source.file_path}</span>
                  <ScopeIndicator scope={source.scope} />
                </div>
                <div className="p-4">
                  <pre className="text-sm whitespace-pre-wrap">
                    {source.content}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {hasErrors && (
          <TabsContent value="errors" className="space-y-3">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-medium">{t("merge_viewer.parse_errors_title")}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("merge_viewer.parse_errors_desc")}
                </p>
                <div className="divide-y divide-border">
                  {mergedConfig.parse_errors.map((error, index) => (
                    <div key={index} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <ScopeIndicator scope={error.scope} />
                            <span className="font-mono text-sm text-foreground">
                              {error.file_path}
                            </span>
                          </div>
                          <div className="rounded bg-secondary/40 p-2">
                            <pre className="text-xs text-destructive whitespace-pre-wrap">
                              {error.error}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
