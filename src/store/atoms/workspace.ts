import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { WorkspaceData } from "@/views/Workspace/types";

// Primary feature for main nav (not affected by secondary nav like settings/marketplace from profile menu)
export const primaryFeatureAtom = atomWithStorage<string | null>("claudecodeimpact:primaryFeature", null);

// Workspace data (shared between App.tsx and WorkspaceView)
export const workspaceDataAtom = atom<WorkspaceData | null>(null);
export const workspaceLoadingAtom = atom<boolean>(true);
export const collapsedProjectGroupsAtom = atomWithStorage<string[]>("collapsed-project-groups", []);

// Dashboard sessions panel visibility
export const dashboardSessionsVisibleAtom = atomWithStorage("dashboard-sessions-visible", true);
