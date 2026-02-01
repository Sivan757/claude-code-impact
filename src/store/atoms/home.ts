import { atomWithStorage } from "@/store/persistence";

export const activityViewModeAtom = atomWithStorage<"weekday" | "hour">("claudecodeimpact:home:activityViewMode", "hour");
export const commandRangeAtom = atomWithStorage<"1m" | "3m" | "all">("claudecodeimpact:home:commandRange", "3m");
export const commandModeAtom = atomWithStorage<"weekly" | "cumulative">("claudecodeimpact:home:commandMode", "cumulative");
