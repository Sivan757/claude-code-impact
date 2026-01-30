import { useNavigate } from "react-router-dom";
import { ReferenceView, KnowledgeLayout } from "../../views/Knowledge";
import type { FeatureType } from "../../types";
import { featureToPath } from "@/navigation/featureRoutes";

export default function KnowledgeReferencePage() {
  const navigate = useNavigate();

  const handleFeatureClick = (feature: FeatureType) => {
    const path = featureToPath(feature);
    if (path) navigate(path);
  };

  return (
    <KnowledgeLayout currentFeature="kb-reference" onFeatureClick={handleFeatureClick}>
      <ReferenceView
        onDocOpen={(source) => navigate(`/knowledge/reference/${encodeURIComponent(source)}`)}
        onDocClose={() => navigate("/knowledge/reference")}
      />
    </KnowledgeLayout>
  );
}
