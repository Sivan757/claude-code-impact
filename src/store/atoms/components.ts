import { atomWithStorage } from "jotai/utils";

// CollapsibleCard states (dynamic keys)
export const collapsibleStatesAtom = atomWithStorage<Record<string, boolean>>("claudecodeimpact:collapsibleStates", {});

// DocumentReader collapsed groups
export const docReaderCollapsedGroupsAtom = atomWithStorage<Record<string, string[]>>("claudecodeimpact:docReader:collapsedGroups", {});
