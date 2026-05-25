export { UsfmWorkspace } from "./UsfmWorkspace.js";
export type {
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceInitialTab,
  UsfmWorkspaceModel,
} from "./workspace-model.js";
export {
  buildWorkspaceModelFromInitialTabs,
  newWorkspaceId,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetTabValue,
  workspaceSplitTabToNewGroup,
} from "./workspace-model.js";
