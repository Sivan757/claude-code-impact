import { useNavigate } from "react-router-dom";
import { FeaturesView } from "../views/Features";
import type { FeatureType } from "../types";

export default function FeaturesPage() {
  const navigate = useNavigate();

  const handleFeatureClick = (feature: FeatureType) => {
    const routes: Partial<Record<FeatureType, string>> = {
      "chat": "/chat",
      "basic-env": "/settings/env",
      "basic-llm": "/settings/llm",
      "basic-version": "/settings/version",
      "context": "/settings/context",
      "settings": "/settings",
      "commands": "/commands",
      "mcp": "/mcp",
      "skills": "/skills",
      "hooks": "/hooks",
      "sub-agents": "/agents",
      "output-styles": "/output-styles",
      "statusline": "/statusline",
      "workspace": "/workspace",
      "features": "/features",
      "marketplace": "/marketplace",
      "extensions": "/extensions",
    };
    const path = routes[feature];
    if (path) navigate(path);
  };

  return <FeaturesView onFeatureClick={handleFeatureClick} currentFeature="features" />;
}
