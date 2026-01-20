import { atomWithStorage } from "jotai/utils";
import type { TemplateCategory, UserProfile } from "@/types";

// 侧边栏折叠状态 (always true - expanded sidebar removed from App.tsx)
export const sidebarCollapsedAtom = atomWithStorage("claudecodeimpact:sidebarCollapsed", true);

// Marketplace 分类
export const marketplaceCategoryAtom = atomWithStorage<TemplateCategory>("claudecodeimpact:marketplaceCategory", "commands");

// 路径缩短显示
export const shortenPathsAtom = atomWithStorage("claudecodeimpact:shortenPaths", true);

// 用户档案
export const profileAtom = atomWithStorage<UserProfile>("claudecodeimpact:profile", { nickname: "", avatarUrl: "" });

// Feature Tabs 布局模式
export type FeatureTabsLayout = "horizontal" | "vertical";
export const featureTabsLayoutAtom = atomWithStorage<FeatureTabsLayout>("claudecodeimpact:featureTabsLayout", "vertical");

// 纵向 sidebar 宽度
export const verticalTabsSidebarWidthAtom = atomWithStorage<number>("claudecodeimpact:verticalTabsSidebarWidth", 220);
