import { useNavigate } from "react-router-dom";
import { FeaturesView } from "../views/Features";
import type { FeatureType } from "../types";
import { featureToPath } from "@/navigation/featureRoutes";

export default function FeaturesPage() {
  const navigate = useNavigate();

  const handleFeatureClick = (feature: FeatureType) => {
    const path = featureToPath(feature);
    if (path) navigate(path);
  };

  return <FeaturesView onFeatureClick={handleFeatureClick} currentFeature="features" />;
}
