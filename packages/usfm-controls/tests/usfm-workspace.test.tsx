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
  workspaceCloseTabs,
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


/**
 * jsdom has no layout engine, so `document.elementFromPoint` always returns null. Tab dragging
 * resolves its drop target through that API, so stub it to report a chosen element. Returns a
 * restore function.
 */
function stubElementFromPoint(el: Element): () => void {
  const original = document.elementFromPoint;
  document.elementFromPoint = () => el;
  return () => {
    document.elementFromPoint = original;
  };
}

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
      onCloseOtherTabs={(groupId, keepTabId) =>
        setModel((p) => {
          const group = p.slots.find((s) => s.id === groupId);
          return group ? workspaceCloseTabs(p, groupId, group.tabIds.filter((t) => t !== keepTabId)) : p;
        })
      }
      onCloseAllTabs={(groupId) =>
        setModel((p) => {
          const group = p.slots.find((s) => s.id === groupId);
          return group ? workspaceCloseTabs(p, groupId, [...group.tabIds]) : p;
        })
      }
      onReorderTabInGroup={(groupId, tabId, toIndex) =>
        setModel((p) => workspaceReorderTabInGroup(p, groupId, tabId, toIndex))
      }
      onMoveTabToGroup={(d) => setModel((p) => workspaceMoveTabToGroup(p, d))}
      onChangeGridLayout={(rows, cols) => setModel((p) => workspaceSetGridLayout(p, rows, cols))}
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

  it("drops a tab from another group into an empty tab group", () => {
    render(
      <Harness
        initialTabs={[
          { id: "t-gen", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi.", groupIndex: 0 },
          { id: "t-exo", fileName: "EXO.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 Hi.", groupIndex: 0 },
        ]}
      />,
    );

    // Split into a 1×2 grid; both tabs stay in slot 0, leaving slot 1 empty.
    fireEvent.click(screen.getByRole("button", { name: /tab group layout 1×1/i }));
    fireEvent.click(screen.getByRole("option", { name: /1×2 layout/i }));
    expect(screen.getByLabelText(/empty tab group/i)).toBeTruthy();

    // Pointer-drag GEN out of the populated group and drop it onto the empty slot. jsdom has no
    // layout, so stub elementFromPoint to report the empty slot under the pointer.
    const emptyTarget = screen.getByLabelText(/empty tab group/i);
    const restore = stubElementFromPoint(emptyTarget);
    try {
      const genTab = screen.getByRole("tab", { name: /GEN\.usfm/i });
      fireEvent.pointerDown(genTab, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(genTab, { clientX: 200, clientY: 40 }); // past the drag threshold
      fireEvent.pointerUp(genTab, { clientX: 200, clientY: 40 });
    } finally {
      restore();
    }

    // Each slot now holds exactly one tab, so no empty drop target remains.
    expect(screen.queryByLabelText(/empty tab group/i)).toBeNull();
    expect(screen.getByRole("tab", { name: /GEN\.usfm/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /EXO\.usfm/i })).toBeTruthy();
  });

  it("keeps same-file tabs in different groups in sync for value, dirty, and saved state", () => {
    // One file (fileId "doc") open as two tabs, one per group.
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "g0", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN v1", groupIndex: 0 },
      { id: "g1", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN v1", groupIndex: 1 },
    ]);

    // Editing one tab updates both tabs' value and marks both dirty.
    const edited = workspaceSetTabValue(m0, "g0", "\\id GEN v2");
    expect(edited.tabsById["g0"]?.value).toBe("\\id GEN v2");
    expect(edited.tabsById["g1"]?.value).toBe("\\id GEN v2");
    expect(edited.tabsById["g0"]?.dirty).toBe(true);
    expect(edited.tabsById["g1"]?.dirty).toBe(true);

    // Saving one tab clears dirty and advances savedValue on both.
    const saved = workspaceMarkTabSaved(edited, "g1");
    expect(saved.tabsById["g0"]?.dirty).toBe(false);
    expect(saved.tabsById["g1"]?.dirty).toBe(false);
    expect(saved.tabsById["g0"]?.savedValue).toBe("\\id GEN v2");
    expect(saved.tabsById["g1"]?.savedValue).toBe("\\id GEN v2");
  });

  it("workspaceAppendTab refuses a second copy of a file in the same group", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "g0", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN" },
    ]);
    const gid = m0.slots[0]!.id;
    const m1 = workspaceAppendTab(m0, {
      groupId: gid,
      tab: { fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN" },
    });
    // No new tab was created; the existing one is focused instead.
    expect(m1.slots[0]!.tabIds).toEqual(["g0"]);
    expect(m1.slots[0]!.activeTabId).toBe("g0");
  });

  it("workspaceMoveTabToGroup closes the dragged duplicate when the target already shows the file", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "g0", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN", groupIndex: 0 },
      { id: "g1", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN", groupIndex: 1 },
    ]);
    const from = m0.slots[1]!.id;
    const to = m0.slots[0]!.id;
    const moved = workspaceMoveTabToGroup(m0, { tabId: "g1", fromGroupId: from, toGroupId: to, insertIndex: 1 });
    // The dragged tab is dropped; the destination still shows the file exactly once and focuses it.
    expect(moved.slots[0]!.tabIds).toEqual(["g0"]);
    expect(moved.slots[0]!.activeTabId).toBe("g0");
    expect(moved.slots[1]!.tabIds).toEqual([]);
    expect(moved.tabsById["g1"]).toBeUndefined();
  });

  it("workspaceSetGridLayout closes duplicate file tabs when groups merge", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "g0", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN", groupIndex: 0 },
      { id: "g1", fileId: "doc", fileName: "GEN.usfm", value: "\\id GEN", groupIndex: 1 },
    ]);
    // Collapse the 1×2 grid back to a single group: the two copies of the file would land together.
    const merged = workspaceSetGridLayout(m0, 1, 1);
    expect(merged.slots).toHaveLength(1);
    const remaining = merged.slots[0]!.tabIds.filter((id) => merged.tabsById[id]?.fileId === "doc");
    expect(remaining).toHaveLength(1);
    expect(Object.keys(merged.tabsById)).toHaveLength(1);
  });

  it("workspaceCloseTabs closes several tabs at once and keeps the active tab valid", () => {
    const m0 = buildWorkspaceModelFromInitialTabs([
      { id: "a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
      { id: "b", fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
      { id: "c", fileName: "C.usfm", value: "\\id LEV\n\\c 1\n\\p\n\\v 1 C" },
    ]);
    const gid = m0.slots[0]!.id;
    const active = workspaceActivateTab(m0, gid, "b");

    // Closing the active tab plus another leaves the surviving tab active.
    const closed = workspaceCloseTabs(active, gid, ["a", "b"]);
    expect(closed.slots[0]!.tabIds).toEqual(["c"]);
    expect(closed.slots[0]!.activeTabId).toBe("c");
    expect(Object.keys(closed.tabsById).sort()).toEqual(["c"]);

    // Closing every tab empties the slot without creating a replacement tab.
    const all = workspaceCloseTabs(m0, gid, [...m0.slots[0]!.tabIds]);
    expect(all.slots[0]!.tabIds).toEqual([]);
    expect(all.slots[0]!.activeTabId).toBeNull();
    expect(Object.keys(all.tabsById)).toHaveLength(0);
  });

  it("closes other tabs from the tab context menu, keeping only the right-clicked one", () => {
    render(
      <Harness
        initialTabs={[
          { id: "t-a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
          { id: "t-b", fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
          { id: "t-c", fileName: "C.usfm", value: "\\id LEV\n\\c 1\n\\p\n\\v 1 C" },
        ]}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tab", { name: /B\.usfm/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close Others" }));

    expect(screen.getByRole("tab", { name: /B\.usfm/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /A\.usfm/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /C\.usfm/i })).toBeNull();
  });

  it("closes all tabs from the tab context menu", () => {
    render(
      <Harness
        initialTabs={[
          { id: "t-a", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" },
          { id: "t-b", fileName: "B.usfm", value: "\\id EXO\n\\c 1\n\\p\n\\v 1 B" },
        ]}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close All" }));

    expect(screen.queryByRole("tab", { name: /A\.usfm/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /B\.usfm/i })).toBeNull();
  });

  it("disables Close Others in the context menu when a group holds a single tab", () => {
    render(
      <Harness
        initialTabs={[{ id: "t-only", fileName: "A.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 A" }]}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tab", { name: /A\.usfm/i }));
    const closeOthers = screen.getByRole("menuitem", { name: "Close Others" }) as HTMLButtonElement;
    expect(closeOthers.disabled).toBe(true);
  });

  it("changes the grid layout from the tab group toolbar selector", () => {
    render(
      <Harness
        initialTabs={[{ id: "t-layout", fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 Hi." }]}
      />,
    );

    // Single group, single tab → exactly one layout selector in the toolbar.
    const trigger = screen.getByRole("button", { name: /tab group layout 1×1/i });
    fireEvent.click(trigger);

    // Pick the 2×2 corner cell to split into a four-group grid.
    fireEvent.click(screen.getByRole("option", { name: /2×2 layout/i }));

    // The grid now exposes a selector per non-empty group; the existing tab stays put.
    expect(screen.getByRole("tab", { name: /GEN\.usfm/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tab group layout 2×2/i })).toBeTruthy();
  });
});
