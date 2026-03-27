import type { ReactNode } from "react";
import { SidebarLayout } from "@/components/shared";
import { KnowledgeSidebar } from "./KnowledgeSidebar";
import type { FeatureType } from "@/types";

interface KnowledgeLayoutProps {
  children: ReactNode;
  currentFeature: FeatureType | null;
  onFeatureClick: (feature: FeatureType) => void;
}

export function KnowledgeLayout({ children, currentFeature, onFeatureClick }: KnowledgeLayoutProps) {
  return (
    <SidebarLayout
      sidebar={<KnowledgeSidebar currentFeature={currentFeature} onFeatureClick={onFeatureClick} />}
    >
      {children}
    </SidebarLayout>
  );
}
