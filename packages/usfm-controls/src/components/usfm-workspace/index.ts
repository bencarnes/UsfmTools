export { UsfmWorkspace } from "./UsfmWorkspace.js";
export type {
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceInitialTab,
  UsfmWorkspaceModel,
  UsfmTabSelectionRequest,
  WorkspaceGridDimension,
} from "./workspace-model.js";
export {
  buildWorkspaceModelFromInitialTabs,
  newWorkspaceId,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceFlattenGroups,
  workspaceFlattenNonEmptyGroups,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceRequestTabSelection,
  workspaceSetGridLayout,
  workspaceSetTabValue,
} from "./workspace-model.js";
