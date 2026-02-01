import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { DistillDocument, Session } from "../../types";
import {
  LoadingState,
  DetailHeader,
  DetailCard,
  ContentCard,
  ConfigPage,
} from "../../components/config";

interface DistillDetailViewProps {
  document: DistillDocument;
  onBack: () => void;
  onNavigateSession: (projectId: string, projectPath: string, sessionId: string, summary: string | null) => void;
}

export function DistillDetailView({
  document,
  onBack,
  onNavigateSession,
}: DistillDetailViewProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const path = await invoke<string>("get_docs_distill_file_path", { file: document.file });
        const fileContent = await invoke<string>("read_file", { path });
        setContent(fileContent);
      } finally {
        setLoading(false);
      }
    })();
  }, [document.file]);

  const handleNavigateSession = async () => {
    if (!document.session) return;
    const session = await invoke<Session | null>("find_session_project", {
      sessionId: document.session,
    });
    if (session) {
      onNavigateSession(session.project_id, session.project_path || '', session.id, session.summary);
    }
  };

  if (loading) return <LoadingState message={t('distill.loading_doc')} />;

  const distillPath = `~/.claudecodeimpact/docs/distill/${document.file}`;

  return (
    <ConfigPage>
      <DetailHeader
        title={document.title}
        description={document.tags.map((t) => `#${t}`).join(" · ")}
        backLabel={t('knowledge_sidebar.distill')}
        onBack={onBack}
        path={distillPath}
        onOpenPath={(p) => invoke("open_in_editor", { path: p })}
        onNavigateSession={handleNavigateSession}
      />
      <div className="space-y-4">
        <DetailCard label={t('distill.metadata')}>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {t('distill.date')}: <span className="text-ink">{document.date}</span>
            </p>
            {document.session ? (
              <p className="text-muted-foreground">
                {t('distill.session')}:{" "}
                <button
                  onClick={handleNavigateSession}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {document.session.slice(0, 8)}...
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t('distill.session')}: <span className="text-xs text-muted-foreground italic">{t('distill.not_available')}</span>
              </p>
            )}
          </div>
        </DetailCard>
        <ContentCard label={t('sub_agents.content')} content={content} />
      </div>
    </ConfigPage>
  );
}
