import { atomWithStorage } from "@/store/persistence";
import type { FeatureType, TemplateCategory, UserProfile } from "@/types";
import { DEFAULT_TERMINAL_PREFERENCE } from "@/lib/terminalPreference";
import { LAUNCH_DRAFT_RETENTION_DEFAULT_HOURS } from "@/lib/launchDraftRetention";

// Marketplace 分类
export const marketplaceCategoryAtom = atomWithStorage<TemplateCategory>("claudecodeimpact:marketplaceCategory", "skills");

// 路径缩短显示
export const shortenPathsAtom = atomWithStorage("claudecodeimpact:shortenPaths", true);

// 用户档案
export const profileAtom = atomWithStorage<UserProfile>("claudecodeimpact:profile", {
  nickname: "",
  avatarUrl: "",
  terminalPreference: DEFAULT_TERMINAL_PREFERENCE,
  launchDraftRetentionHours: LAUNCH_DRAFT_RETENTION_DEFAULT_HOURS,
});



// Primary feature for main nav (not affected by secondary nav like settings/marketplace from profile menu)
export const primaryFeatureAtom = atomWithStorage<FeatureType | null>("claudecodeimpact:primaryFeature", null);
