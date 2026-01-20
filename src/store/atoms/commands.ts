import { atomWithStorage } from "jotai/utils";

export const commandsSortKeyAtom = atomWithStorage<"name" | "usage" | "modified">("claudecodeimpact:commands:sortKey", "usage");
export const commandsSortDirAtom = atomWithStorage<"asc" | "desc">("claudecodeimpact:commands:sortDir", "desc");
export const commandsShowDeprecatedAtom = atomWithStorage("claudecodeimpact:commands:showDeprecated", false);
export const commandsViewModeAtom = atomWithStorage<"flat" | "tree">("claudecodeimpact:commands:viewMode", "tree");
export const commandsExpandedFoldersAtom = atomWithStorage<string[]>("claudecodeimpact:commands:expandedFolders", []);
