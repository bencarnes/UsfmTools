import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanup, render, screen, fireEvent } from "./testing-react.ts";
import { useState } from "react";
import {
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetGridLayout,
  workspaceSetTabValue,
  workspaceSetTabDirty,
  workspaceMarkTabSaved,
  type UsfmWorkspaceInitialTab,
  type UsfmWorkspaceModel,
} from "../src/components/usfm-workspace/workspace-model.js";
import { UsfmWorkspace } from "../src/components/usfm-workspace/UsfmWorkspace.js";


function Harness({
  initialTabs,
  writeLog,
}: {
  readonly initialTabs: readonly UsfmWorkspaceInitialTab[];
  readonly writeLog?: { id: string; content: string }[];
}) {
  const [model, setModel] = useState<UsfmWorkspaceModel>(() => buildWorkspaceModelFromInitialTabs(initialTabs));

  return (
    <UsfmWorkspace
      gridRows={model.gridRows}
      gridCols={model.gridCols}
      slots={model.slots}
      tabsById={model.tabsById}
      onActivateTab={(groupId, tabId) => setModel((p) => workspaceActivateTab(p, groupId, tabId))}
      onUpdateTabValue={(tabId, value) => setModel((p) => workspaceSetTabValue(p, tabId, value))}
      onMarkTabDirty={(tabId) => setModel((p) => workspaceSetTabDirty(p, tabId))}
      onSaveTab={(tabId, content) => {
        setModel((p) => {
          writeLog?.push({ id: tabId, content });
          return workspaceMarkTabSaved(workspaceSetTabValue(p, tabId, content), tabId);
        });
      }}
      onCloseTab={(groupId, tabId) => setModel((p) => workspaceCloseTab(p, groupId, tabId))}
      onReorderTabInGroup={(groupId, tabId, toIndex) =>
        setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
      }
      onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
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

  it("workspaceSetTabDirty marks an editor tab dirty without changing value", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
    ]);
    const marked = workspaceSetTabDirty(m0, "a");
    expect(marked.tabsById["a"]?.dirty).toBe(true);
    expect(marked.tabsById["a"]?.value).toBe(m0.tabsById["a"]?.value);
  });

  it("workspaceSetTabValue marks editor tabs dirty when value differs from savedValue", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
    ]);
    const edited = workspaceSetTabValue(m0, "a", "\\id GEN\n\\c 1\n\\p\n\\v 1 changed");
    expect(edited.tabsById["a"]?.dirty).toBe(true);
    const saved = workspaceMarkTabSaved(edited, "a");
    expect(saved.tabsById["a"]?.dirty).toBe(false);
    expect(saved.tabsById["a"]?.savedValue).toBe("\\id GEN\n\\c 1\n\\p\n\\v 1 changed");
  });

  it("enables save on the toolbar when the tab is dirty", () => {
    const writeLog: { id: string; content: string }[] = [];
    render(
      <Harness
        initialTabs={[
          {
            id: "t-save",
            fileName: "GEN.usfm",
            value: "\\id GEN\n\\c 1\n\\p\n\\v 1 changed",
            savedValue: "\\id GEN\n\\c 1\n\\p\n\\v 1 clean",
            dirty: true,
          },
        ]}
        writeLog={writeLog}
      />,
    );
    const save = screen.getByTestId("usfm-pane-save");
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    expect(writeLog[0]?.content).toContain("changed");
    expect(screen.queryByRole("button", { name: /close tab \(unsaved/i })).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "Select tab" }));
    fireEvent.click(screen.getByRole("option", { name: "B.usfm" }));
    expect(screen.getByRole("tab", { name: /B\.usfm/i }).getAttribute("aria-selected")).toBe("true");
  });

  it("workspaceReorderTabInGroup reorders tabs within one group", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
      { id: "b", fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
      { id: "c", fileName: "C.usfm", value: "\\id LEV\n\\c 1\n\\p\n\\v 1 C" },
    ]);
    const gid = m0.slots[0]!.id;
    const toFront = workspaceReorderTabInGroup(m0, gid, "c", 0);
    expect(toFront.slots[0]!.tabIds).toEqual(["c", "a", "b"]);
    const toEnd = workspaceReorderTabInGroup(toFront, gid, "c", 3);
    expect(toEnd.slots[0]!.tabIds).toEqual(["a", "b", "c"]);
    const bFirst = workspaceReorderTabInGroup(toEnd, gid, "b", 0);
    expect(bFirst.slots[0]!.tabIds).toEqual(["b", "a", "c"]);
  });

  it("workspaceAppendTab adds a tab to a group", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a1", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
    ]);
    const gid = m0.slots[0]!.id;
    const m1 = workspaceAppendTab(m0, {
      groupId: gid,
      tab: { fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
    });
    expect(m1.slots[0]!.tabIds.length).toBe(2);
    expect(m1.slots[0]!.activeTabId).toBe(m1.slots[0]!.tabIds[1]);
    expect(m1.tabsById["a1"]).toBeTruthy();
    const secondId = m1.slots[0]!.tabIds.find((t) => t !== "a1");
    expect(secondId && m1.tabsById[secondId!]?.fileName).toBe("B.usfm");
  });

  it("workspaceCloseTab leaves an empty slot without creating a new tab", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "only", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
    ]);
    const gid = m0.slots[0]!.id;
    const m1 = workspaceCloseTab(m0, gid, "only");
    expect(m1.slots[0]!.tabIds).toEqual([]);
    expect(m1.slots[0]!.activeTabId).toBeNull();
    expect(Object.keys(m1.tabsById)).toHaveLength(0);
  });

  it("workspaceSetGridLayout expands with empty slots and shrinks by moving tabs", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "t1", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A", groupIndex: 0 },
      { id: "t2", fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B", groupIndex: 1 },
    ]);
    const expanded = workspaceSetGridLayout(m0, 2, 2);
    expect(expanded.gridRows).toBe(2);
    expect(expanded.gridCols).toBe(2);
    expect(expanded.slots).toHaveLength(4);
    expect(expanded.slots[2]!.tabIds).toEqual([]);
    expect(expanded.tabsById["t1"]).toBeTruthy();
    expect(expanded.tabsById["t2"]).toBeTruthy();

    const shrunk = workspaceSetGridLayout(expanded, 1, 1);
    expect(shrunk.slots).toHaveLength(1);
    expect(shrunk.slots[0]!.tabIds).toContain("t1");
    expect(shrunk.slots[0]!.tabIds).toContain("t2");
    expect(Object.keys(shrunk.tabsById).sort()).toEqual(["t1", "t2"]);
  });
});
