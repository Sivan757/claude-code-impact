import { atomWithStorage } from "@/store/persistence";

// ReferenceView
export const referenceCollapsedGroupsAtom = atomWithStorage<Record<string, string[]>>(
  "claudecodeimpact:reference:collapsedGroups",
  {}
);

export const referenceExpandedSourceAtom = atomWithStorage<string | null>(
  "claudecodeimpact:reference:expandedSource",
  null
);
