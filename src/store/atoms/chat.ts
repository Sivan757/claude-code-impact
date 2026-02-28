import { atomWithStorage } from "@/store/persistence";

// HistoryWorkbench
export const originalChatAtom = atomWithStorage("claudecodeimpact:originalChat", true);
export const markdownPreviewAtom = atomWithStorage("claudecodeimpact:markdownPreview", true);
export const hideEmptySessionsAtom = atomWithStorage("claudecodeimpact-hide-empty-sessions", false);
