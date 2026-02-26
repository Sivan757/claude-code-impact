import { getUiPreference } from "@/lib/uiPreferences";
import type { UserProfile } from "@/types";

export const LAUNCH_DRAFT_RETENTION_DEFAULT_HOURS = 24;
export const LAUNCH_DRAFT_RETENTION_MIN_HOURS = 1;
export const LAUNCH_DRAFT_RETENTION_MAX_HOURS = 30 * 24;
export const LAUNCH_DRAFT_RETENTION_OPTIONS_HOURS = [1, 3, 6, 12, 24, 72] as const;

function normalizeRetentionHours(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return LAUNCH_DRAFT_RETENTION_DEFAULT_HOURS;
  }
  const rounded = Math.round(value);
  if (rounded < LAUNCH_DRAFT_RETENTION_MIN_HOURS) {
    return LAUNCH_DRAFT_RETENTION_MIN_HOURS;
  }
  if (rounded > LAUNCH_DRAFT_RETENTION_MAX_HOURS) {
    return LAUNCH_DRAFT_RETENTION_MAX_HOURS;
  }
  return rounded;
}

export function resolveLaunchDraftRetentionHours(
  profile?: Pick<UserProfile, "launchDraftRetentionHours"> | null,
): number {
  return normalizeRetentionHours(profile?.launchDraftRetentionHours);
}

export function resolveLaunchDraftRetentionSeconds(
  profile?: Pick<UserProfile, "launchDraftRetentionHours"> | null,
): number {
  return resolveLaunchDraftRetentionHours(profile) * 60 * 60;
}

export function getConfiguredLaunchDraftRetentionSeconds(): number {
  const profile = getUiPreference<UserProfile>("claudecodeimpact:profile");
  return resolveLaunchDraftRetentionSeconds(profile ?? null);
}
