import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarLayout, NavSidebar } from "@/components/shared";
import { TEMPLATE_CATEGORIES } from "@/constants";
import type { FeatureType, TemplateCategory } from "@/types";
import { useTranslation } from "react-i18next";

type SidebarKey = TemplateCategory | "basic-env" | "basic-llm" | "basic-settings" | "extensions" | "lsps";

// Map sidebar key to route path
const KEY_TO_ROUTE: Record<SidebarKey, string> = {
  "basic-env": "/settings/env",
  "basic-llm": "/settings/llm",
  "basic-settings": "/settings",
  context: "/context",
  settings: "/settings",
  mcps: "/mcp",
  skills: "/skills",
  hooks: "/hooks",
  agents: "/agents",
  extensions: "/extensions",
  lsps: "/lsp",
};

// Map feature type to sidebar key
const FEATURE_TO_KEY: Partial<Record<FeatureType, SidebarKey>> = {
  "basic-env": "basic-env",
  "basic-llm": "basic-llm",
  settings: "basic-settings",
  context: "context",
  mcp: "mcps",
  lsp: "lsps",
  skills: "skills",
  hooks: "hooks",
  "sub-agents": "agents",
  extensions: "extensions",
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
      title: t('common.basic').toUpperCase(),
      items: [
        { key: "basic-env", label: t('features.basic-env') },
        { key: "basic-llm", label: t('features.basic-llm') },
      ],
    },
    {
      title: t('common.config').toUpperCase(),
      items: [
        ...TEMPLATE_CATEGORIES.map(c => ({
          key: c.key,
          label: t(`features.${c.key === 'mcps' ? 'mcp' : c.key === 'agents' ? 'sub-agents' : c.key}`)
        })),
        { key: "extensions", label: t('features.plugins') },
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
        lsps: "lsp",
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
