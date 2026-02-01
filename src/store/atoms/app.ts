import { atomWithStorage } from "@/store/persistence";
import type { FeatureType, TemplateCategory, UserProfile } from "@/types";

// 侧边栏折叠状态 (always true - expanded sidebar removed from legacy layout)
export const sidebarCollapsedAtom = atomWithStorage("claudecodeimpact:sidebarCollapsed", true);

// Marketplace 分类
export const marketplaceCategoryAtom = atomWithStorage<TemplateCategory>("claudecodeimpact:marketplaceCategory", "skills");

// 路径缩短显示
export const shortenPathsAtom = atomWithStorage("claudecodeimpact:shortenPaths", true);

// 用户档案
export const profileAtom = atomWithStorage<UserProfile>("claudecodeimpact:profile", { nickname: "", avatarUrl: "" });



// Primary feature for main nav (not affected by secondary nav like settings/marketplace from profile menu)
export const primaryFeatureAtom = atomWithStorage<FeatureType | null>("claudecodeimpact:primaryFeature", null);
