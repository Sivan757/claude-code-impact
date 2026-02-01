import { atomWithStorage } from "@/store/persistence";

// MessageView
export const originalChatAtom = atomWithStorage("claudecodeimpact:originalChat", true);
export const markdownPreviewAtom = atomWithStorage("claudecodeimpact:markdownPreview", false);

// SessionList
export const sessionContextTabAtom = atomWithStorage<"global" | "project">("claudecodeimpact:sessions:contextTab", "project");
export const sessionSelectModeAtom = atomWithStorage("claudecodeimpact:sessionSelectMode", false);
export const hideEmptySessionsAtom = atomWithStorage("claudecodeimpact-hide-empty-sessions", false);
export const userPromptsOnlyAtom = atomWithStorage("claudecodeimpact:userPromptsOnly", false);

// ProjectList
export const chatViewModeAtom = atomWithStorage<"projects" | "sessions" | "chats">("claudecodeimpact:chatViewMode", "projects");
export const allProjectsSortByAtom = atomWithStorage<"name" | "recent" | "sessions">("claudecodeimpact:allProjects:sortBy", "recent");
export const hideEmptySessionsAllAtom = atomWithStorage("claudecodeimpact-hide-empty-sessions-all", false);
