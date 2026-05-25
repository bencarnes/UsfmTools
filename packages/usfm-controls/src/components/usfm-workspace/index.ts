export { UsfmWorkspace } from "./UsfmWorkspace.js";
export type {
  UsfmWorkspaceProps,
  UsfmWorkspaceTabState,
  UsfmWorkspaceEditorGroupState,
  UsfmWorkspaceEditorRowState,
  UsfmWorkspaceInitialTab,
  UsfmWorkspaceModel,
} from "./workspace-model.js";
export {
  buildWorkspaceModelFromInitialTabs,
  newWorkspaceId,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceFlattenGroups,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetTabValue,
  workspaceSplitCurrentTabToNewGroupBelow,
  workspaceSplitCurrentTabToNewGroupRight,
  workspaceSplitTabToNewGroup,
} from "./workspace-model.js";
