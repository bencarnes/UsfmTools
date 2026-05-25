import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SAMPLE_BSB_GENESIS_USFM, SAMPLE_EXO_SNIPPET_USFM } from "../../fixtures/sample-bsb-genesis-usfm.js";
import {
  buildWorkspaceModelFromInitialTabs,
  newWorkspaceId,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetTabValue,
  workspaceSplitCurrentTabToNewGroupBelow,
  workspaceSplitCurrentTabToNewGroupRight,
  workspaceSplitTabToNewGroup,
  type UsfmWorkspaceInitialTab,
  type UsfmWorkspaceModel,
} from "./workspace-model.js";
import { UsfmWorkspace } from "./UsfmWorkspace.js";

const meta: Meta<typeof UsfmWorkspace> = {
  title: "Controls/UsfmWorkspace",
  component: UsfmWorkspace,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledWorkspace({ initialTabs }: { readonly initialTabs: readonly UsfmWorkspaceInitialTab[] }) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs(initialTabs));

  return (
    <UsfmWorkspace
      rows={model.rows}
      tabsById={model.tabsById}
      onActivateTab={(groupId, tabId) => setModel((p) => workspaceActivateTab(p, groupId, tabId))}
      onUpdateTabValue={(tabId, value) => setModel((p) => workspaceSetTabValue(p, tabId, value))}
      onCloseTab={(groupId, tabId) => setModel((p) => workspaceCloseTab(p, groupId, tabId))}
      onReorderTabInGroup={(groupId, tabId, toIndex) =>
        setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
      }
      onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
      onSplitTabToNewGroup={(d) => setModel((p) => workspaceSplitTabToNewGroup(p, d))}
      onSplitCurrentTabRight={(groupId, tabId) =>
        setModel((p) => workspaceSplitCurrentTabToNewGroupRight(p, groupId, tabId))
      }
      onSplitCurrentTabBelow={(groupId, tabId) =>
        setModel((p) => workspaceSplitCurrentTabToNewGroupBelow(p, groupId, tabId))
      }
    />
  );
}

export const SingleGroupTwoTabs: Story = {
  render: () => (
    <div className="h-[min(90vh,720px)] p-4 box-border">
      <ControlledWorkspace
        initialTabs={[
          { fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM },
          { fileName: "EXO.usfm", value: SAMPLE_EXO_SNIPPET_USFM, dirty: true },
        ]}
      />
    </div>
  ),
};

export const TwoEditorGroups: Story = {
  render: () => (
    <div className="h-[min(90vh,720px)] p-4 box-border">
      <ControlledWorkspace
        initialTabs={[
          { fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM, groupIndex: 0 },
          { fileName: "EXO.usfm", value: SAMPLE_EXO_SNIPPET_USFM, groupIndex: 1 },
        ]}
      />
    </div>
  ),
};

const SHORT_LEV = `\\id LEV
\\c 1
\\p
\\v 1 The LORD called Moses and spoke to him from the tent of meeting.
`;

export const OpenFileDemo: Story = {
  render: () => {
    const [model, setModel] = useState<UsfmWorkspaceModel>(() =>
      buildWorkspaceModelFromInitialTabs([{ fileName: "GEN.usfm", value: SAMPLE_BSB_GENESIS_USFM }]),
    );

    const openLeviticus = () => {
      setModel((p) => {
        const gid = p.rows[0]?.groups[0]?.id;
        if (!gid) return p;
        return workspaceAppendTab(p, {
          groupId: gid,
          tab: { id: newWorkspaceId("tab"), fileName: "LEV.usfm", value: SHORT_LEV },
        });
      });
    };

    return (
      <div className="flex h-[min(90vh,720px)] flex-col gap-2 p-4 box-border">
        <button
          type="button"
          className="self-start rounded border border-gray-400 bg-white px-3 py-1 text-sm hover:bg-gray-50"
          onClick={openLeviticus}
        >
          Open LEV.usfm (append tab)
        </button>
        <div className="min-h-0 flex-1">
          <UsfmWorkspace
            rows={model.rows}
            tabsById={model.tabsById}
            onActivateTab={(groupId, tabId) => setModel((p) => workspaceActivateTab(p, groupId, tabId))}
            onUpdateTabValue={(tabId, value) => setModel((p) => workspaceSetTabValue(p, tabId, value))}
            onCloseTab={(groupId, tabId) => setModel((p) => workspaceCloseTab(p, groupId, tabId))}
            onReorderTabInGroup={(groupId, tabId, toIndex) =>
              setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
            }
            onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
            onSplitTabToNewGroup={(d) => setModel((p) => workspaceSplitTabToNewGroup(p, d))}
            onSplitCurrentTabRight={(groupId, tabId) =>
              setModel((p) => workspaceSplitCurrentTabToNewGroupRight(p, groupId, tabId))
            }
            onSplitCurrentTabBelow={(groupId, tabId) =>
              setModel((p) => workspaceSplitCurrentTabToNewGroupBelow(p, groupId, tabId))
            }
          />
        </div>
      </div>
    );
  },
};
