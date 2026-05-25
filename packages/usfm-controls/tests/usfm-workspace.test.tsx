import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import {
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetTabValue,
  workspaceSplitTabToNewGroup,
  type UsfmWorkspaceInitialTab,
  type UsfmWorkspaceModel,
} from "../src/components/usfm-workspace/workspace-model.js";
import { UsfmWorkspace } from "../src/components/usfm-workspace/UsfmWorkspace.js";

afterEach(() => {
  cleanup();
});

function Harness({ initialTabs }: { readonly initialTabs: readonly UsfmWorkspaceInitialTab[] }) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs(initialTabs));

  return (
    <UsfmWorkspace
      groups={model.groups}
      tabsById={model.tabsById}
      onActivateTab={(groupId, tabId) => setModel((p) => workspaceActivateTab(p, groupId, tabId))}
      onUpdateTabValue={(tabId, value) => setModel((p) => workspaceSetTabValue(p, tabId, value))}
      onCloseTab={(groupId, tabId) => setModel((p) => workspaceCloseTab(p, groupId, tabId))}
      onReorderTabInGroup={(groupId, tabId, toIndex) =>
        setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
      }
      onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
      onSplitTabToNewGroup={(d) => setModel((p) => workspaceSplitTabToNewGroup(p, d))}
    />
  );
}

describe("UsfmWorkspace", () => {
  it("renders tab labels from file names", () => {
    render(
      <Harness
        initialTabs={[
          { id: "t-a", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi." },
          { id: "t-b", fileName: "EXO.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 Hi." },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: /GEN\.usfm/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /EXO\.usfm/i })).toBeTruthy();
  });

  it("shows dirty stub as a circle on the close control", () => {
    render(
      <Harness
        initialTabs={[
          { id: "t-d", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi.", dirty: true },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /close tab \(unsaved/i })).toBeTruthy();
  });

  it("updates toolbar controls when switching tabs", () => {
    render(
      <Harness
        initialTabs={[
          {
            id: "t1",
            fileName: "One.usfm",
            value: "\\id GEN\n\\c 1\n\\p\n\\v 1 One.\n\\c 2\n\\p\n\\v 1 Two.",
          },
          {
            id: "t2",
            fileName: "Two.usfm",
            value: "\\id FRT\n\\p\n\\v 1 Front matter without chapters.",
          },
        ]}
      />,
    );
    const sw = screen.getByRole("switch", { name: /scroll sync between editor and preview/i });
    expect(sw.hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: /Two\.usfm/i }));
    expect(
      screen.getByRole("switch", { name: /scroll sync between editor and preview/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("activates a tab from the tab list dropdown", () => {
    render(
      <Harness
        initialTabs={[
          { id: "x1", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
          { id: "x2", fileName: "B.usfm", value: "\\id EXO\n\\c 2\n\\p\n\\v 1 B" },
        ]}
      />,
    );
    const select = screen.getByRole("combobox", { name: /open tab/i });
    fireEvent.change(select, { target: { value: "x2" } });
    expect(screen.getByRole("tab", { name: /B\.usfm/i }).getAttribute("aria-selected")).toBe("true");
  });

  it("workspaceAppendTab adds a tab to a group", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a1", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
    ]);
    const gid = m0.groups[0]!.id;
    const m1 = workspaceAppendTab(m0, {
      groupId: gid,
      tab: { fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
    });
    expect(m1.groups[0]!.tabIds.length).toBe(2);
    expect(m1.groups[0]!.activeTabId).toBe(m1.groups[0]!.tabIds[1]);
    expect(m1.tabsById["a1"]).toBeTruthy();
    const secondId = m1.groups[0]!.tabIds.find((t) => t !== "a1");
    expect(secondId && m1.tabsById[secondId!]?.fileName).toBe("B.usfm");
  });
});
