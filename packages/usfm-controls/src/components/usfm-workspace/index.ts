export { UsfmWorkspace } from "./UsfmWorkspace.js";
export type {
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceInitialTab,
  UsfmWorkspaceModel,
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
  workspaceSetGridLayout,
  workspaceSetTabValue,
} from "./workspace-model.js";
