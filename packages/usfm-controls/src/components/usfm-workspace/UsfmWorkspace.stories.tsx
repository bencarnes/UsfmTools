import type { Story, StoryDefault } from "@ladle/react";
import { useState, type ReactNode } from "react";
import { SAMPLE_BSB_GENESIS_USFM, SAMPLE_EXO_SNIPPET_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import { TabGroupLayoutSelector } from "../tab-group-layout-selector/TabGroupLayoutSelector.js";
import {
  buildWorkspaceModelFromInitialTabs,
  newWorkspaceId,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetGridLayout,
  workspaceSetTabValue,
  type UsfmWorkspaceInitialTab,
  type UsfmWorkspaceModel,
} from "./workspace-model.js";
import { UsfmWorkspace } from "./UsfmWorkspace.js";

const STORY_WORKSPACE_HEIGHT = "640px";
const STORY_WORKSPACE_MAX_WIDTH = "1560px";

export default {
  title: "Controls/UsfmWorkspace",
} satisfies StoryDefault;

function StoryChrome({ toolbar, workspace }: { readonly toolbar: ReactNode; readonly workspace: ReactNode }) {
  return (
    <div className="box-border flex w-full flex-col gap-2" style={{ maxWidth: STORY_WORKSPACE_MAX_WIDTH }}>
      {toolbar}
      <div className="w-full overflow-hidden rounded border border-gray-300" style={{ height: STORY_WORKSPACE_HEIGHT }}>
        {workspace}
      </div>
    </div>
  );
}

function WorkspaceFromModel({
  model,
  setModel,
}: {
  readonly model: UsfmWorkspaceModel;
  readonly setModel: (fn: (p: UsfmWorkspaceModel) => UsfmWorkspaceModel) => void;
}) {
  return (
    <UsfmWorkspace
      gridRows={model.gridRows}
      gridCols={model.gridCols}
      slots={model.slots}
      tabsById={model.tabsById}
      className="h-full min-h-0"
      onActivateTab={(groupId, tabId) => setModel((p) => workspaceActivateTab(p, groupId, tabId))}
      onUpdateTabValue={(tabId, value) => setModel((p) => workspaceSetTabValue(p, tabId, value))}
      onCloseTab={(groupId, tabId) => setModel((p) => workspaceCloseTab(p, groupId, tabId))}
      onReorderTabInGroup={(groupId, tabId, toIndex) =>
        setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
      }
      onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
    />
  );
}

function ControlledWorkspace({ initialTabs }: { readonly initialTabs: readonly UsfmWorkspaceInitialTab[] }) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs(initialTabs));

  return (
    <StoryChrome
      toolbar={
        <TabGroupLayoutSelector
          gridRows={model.gridRows}
          gridCols={model.gridCols}
          onChange={(rows, cols) => setModel((p) => workspaceSetGridLayout(p, rows, cols))}
        />
      }
      workspace={<WorkspaceFromModel model={model} setModel={setModel} />}
    />
  );
}

export const SingleGroupTwoTabs: Story = () => (
  <ControlledWorkspace
    initialTabs={[
      { fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM },
      { fileName: "EXO.usfm", value: SAMPLE_EXO_SNIPPET_USFM, dirty: true },
    ]}
  />
);

export const TwoEditorGroups: Story = () => (
  <ControlledWorkspace
    initialTabs={[
      { fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM, groupIndex: 0 },
      { fileName: "EXO.usfm", value: SAMPLE_EXO_SNIPPET_USFM, groupIndex: 1 },
    ]}
  />
);

const SHORT_LEV = `\\id LEV
\\c 1
\\p
\\v 1 The LORD called Moses and spoke to him from the tent of meeting.
`;

export const OpenFileDemo: Story = () => {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() =>
    buildWorkspaceModelFromInitialTabs([{ fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM }]),
  );

  const openLeviticus = () => {
    setModel((p) => {
      const gid = p.slots[0]?.id;
      if (!gid) return p;
      return workspaceAppendTab(p, {
        groupId: gid,
        tab: { id: newWorkspaceId("tab"), fileName: "LEV.usfm", value: SHORT_LEV },
      });
    });
  };

  return (
    <StoryChrome
      toolbar={
        <div className="flex items-center gap-2">
          <TabGroupLayoutSelector
            gridRows={model.gridRows}
            gridCols={model.gridCols}
            onChange={(rows, cols) => setModel((p) => workspaceSetGridLayout(p, rows, cols))}
          />
          <button
            type="button"
            className="rounded border border-gray-400 bg-white px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            onClick={openLeviticus}
          >
            Open LEV.usfm (append tab)
          </button>
        </div>
      }
      workspace={<WorkspaceFromModel model={model} setModel={setModel} />}
    />
  );
};
