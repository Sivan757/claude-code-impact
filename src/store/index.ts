// App atoms
// App atoms (updated)
export {
  sidebarCollapsedAtom, marketplaceCategoryAtom, shortenPathsAtom, profileAtom,
  primaryFeatureAtom
} from "./atoms/app";

// UI atoms
export { activePanelIdAtom, navigationStateAtom, viewAtom, viewHistoryAtom, historyIndexAtom } from "./atoms/ui";

// Chat atoms
export {
  originalChatAtom, markdownPreviewAtom,
  sessionContextTabAtom, sessionSelectModeAtom, hideEmptySessionsAtom, userPromptsOnlyAtom,
  chatViewModeAtom, allProjectsSortByAtom, hideEmptySessionsAllAtom,
} from "./atoms/chat";

// Commands atoms
export {
  commandsSortKeyAtom, commandsSortDirAtom, commandsShowDeprecatedAtom,
  commandsViewModeAtom, commandsExpandedFoldersAtom,
} from "./atoms/commands";

// Knowledge atoms
export {
  referenceCollapsedGroupsAtom, referenceExpandedSourceAtom,
} from "./atoms/knowledge";



// Component atoms
export { collapsibleStatesAtom, docReaderCollapsedGroupsAtom } from "./atoms/components";

// Home atoms
export { activityViewModeAtom, commandRangeAtom, commandModeAtom } from "./atoms/home";
