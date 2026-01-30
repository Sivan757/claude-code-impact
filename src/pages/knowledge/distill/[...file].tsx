import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { DistillDetailView, KnowledgeLayout } from "../../../views/Knowledge";
import { LoadingState } from "../../../components/config";
import type { DistillDocument, FeatureType } from "../../../types";
import { featureToPath } from "@/navigation/featureRoutes";

export default function DistillDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const file = params["*"] ? decodeURIComponent(params["*"]) : "";

  const [document, setDocument] = useState<DistillDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!file) {
      navigate("/knowledge/distill");
      return;
    }

    invoke<DistillDocument[]>("list_distill_documents")
      .then((docs) => {
        const doc = docs.find((d) => d.file === file);
        if (doc) {
          setDocument(doc);
        } else {
          navigate("/knowledge/distill");
        }
      })
      .catch(() => navigate("/knowledge/distill"))
      .finally(() => setLoading(false));
  }, [file, navigate]);

  const handleFeatureClick = (feature: FeatureType) => {
    const path = featureToPath(feature);
    if (path) navigate(path);
  };

  const handleNavigateSession = (projectId: string, projectPath: string, sessionId: string, summary: string | null) => {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    params.set("projectPath", projectPath);
    params.set("sessionId", sessionId);
    if (summary) params.set("summary", summary);
    navigate(`/sessions?${params.toString()}`);
  };

  if (loading) {
    return (
      <KnowledgeLayout currentFeature="kb-distill" onFeatureClick={handleFeatureClick}>
        <LoadingState message={t('distill.loading_doc')} />
      </KnowledgeLayout>
    );
  }

  if (!document) return null;

  return (
    <KnowledgeLayout currentFeature="kb-distill" onFeatureClick={handleFeatureClick}>
      <DistillDetailView
        document={document}
        onBack={() => navigate("/knowledge/distill")}
        onNavigateSession={handleNavigateSession}
      />
    </KnowledgeLayout>
  );
}
