import type { ReactNode } from "react";
import { NavSidebar, SidebarLayout } from "@/components/shared";
import { TEMPLATE_CATEGORIES } from "@/constants";
import type { TemplateCategory } from "@/types";

interface MarketplaceLayoutProps {
  children: ReactNode;
  currentCategory: TemplateCategory;
  onCategoryClick: (category: TemplateCategory) => void;
}

const MARKETPLACE_NAV_ITEMS = TEMPLATE_CATEGORIES
  .filter((category) => category.key !== "settings")
  .map((category) => ({ key: category.key, label: category.label }));

export function MarketplaceLayout({ children, currentCategory, onCategoryClick }: MarketplaceLayoutProps) {
  return (
    <SidebarLayout
      sidebar={
        <NavSidebar
          items={MARKETPLACE_NAV_ITEMS}
          activeKey={currentCategory}
          onItemClick={(key) => onCategoryClick(key as TemplateCategory)}
        />
      }
    >
      {children}
    </SidebarLayout>
  );
}
