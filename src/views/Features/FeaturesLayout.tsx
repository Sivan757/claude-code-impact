import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarLayout, NavSidebar } from "@/components/shared";
import type { FeatureType, TemplateCategory } from "@/types";
import { useTranslation } from "react-i18next";

type SidebarKey = TemplateCategory | "basic-env" | "basic-llm" | "basic-settings" | "extensions";

// Map sidebar key to route path
const KEY_TO_ROUTE: Record<SidebarKey, string> = {
  "basic-env": "/settings/env",
  "basic-llm": "/settings/llm",
  "basic-settings": "/settings",
  context: "/context",
  settings: "/settings",
  mcps: "/mcp",
  skills: "/skills",
  hooks: "/settings/hooks",
  agents: "/agents",
  extensions: "/extensions",
};

// Map feature type to sidebar key
const FEATURE_TO_KEY: Partial<Record<FeatureType, SidebarKey>> = {
  "basic-env": "settings",
  "basic-llm": "settings",
  "basic-version": "settings",
  settings: "settings",
  context: "context",
  mcp: "mcps",
  skills: "skills",
  hooks: "settings",
  "sub-agents": "agents",
  extensions: "settings",
};

interface FeaturesLayoutProps {
  children: ReactNode;
  feature?: FeatureType;
  // Legacy props for gradual migration
  currentFeature?: FeatureType | null;
  onFeatureClick?: (feature: FeatureType) => void;
}

export function FeaturesLayout({ children, feature, currentFeature, onFeatureClick }: FeaturesLayoutProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const groups = useMemo(() => [
    {
      items: [
        { key: "settings", label: t('settings_dialog.title') },
        { key: "context", label: t('features.context') },
        { key: "mcps", label: t('features.mcp') },
        { key: "skills", label: t('features.skills') },
        { key: "agents", label: t('features.sub-agents') },
      ],
    },
  ], [t]);

  const activeFeature = feature ?? currentFeature;
  const activeKey = activeFeature ? FEATURE_TO_KEY[activeFeature] ?? null : null;

  const handleItemClick = (key: string) => {
    if (onFeatureClick) {
      // Legacy mode
      const keyToFeature: Record<SidebarKey, FeatureType> = {
        "basic-env": "basic-env",
        "basic-llm": "basic-llm",
        "context": "context",
        "basic-settings": "settings",
        settings: "settings",
        mcps: "mcp",
        skills: "skills",
        hooks: "hooks",
        agents: "sub-agents",
        extensions: "extensions",
      };
      onFeatureClick(keyToFeature[key as SidebarKey]);
    } else {
      // Router mode
      navigate(KEY_TO_ROUTE[key as SidebarKey]);
    }
  };

  return (
    <SidebarLayout
      sidebar={
        <NavSidebar
          groups={groups}
          activeKey={activeKey}
          onItemClick={handleItemClick}
        />
      }
    >
      {children}
    </SidebarLayout>
  );
}
