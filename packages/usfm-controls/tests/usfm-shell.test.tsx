import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanup, fireEvent, render, screen, waitFor } from "./testing-react.ts";
import { createRef } from "react";
import { UsfmShell, type UsfmShellHandle } from "../src/components/usfm-shell/UsfmShell.js";
import { createFixtureUsfmShellHost } from "../src/components/usfm-shell/fixture-host.js";
import type { UsfmShellHost } from "../src/components/usfm-shell/host.js";
import type { ApplicationSettings } from "../src/components/settings-pane/settings-model.js";
import { lineColumnToSourceOffset, sourceOffsetToLineColumn } from "../src/components/usfm-shell/line-offsets.js";


/**
 * jsdom has no layout engine, so `document.elementFromPoint` always returns null. The file
 * drag-drop gesture resolves its target group through that API, so stub it to report a chosen
 * element. Returns a restore function.
 */
function stubElementFromPoint(el: Element): () => void {
  const original = document.elementFromPoint;
  document.elementFromPoint = () => el;
  return () => {
    document.elementFromPoint = original;
  };
}

function makeHost(
  files: readonly { id: string; name: string; usfm: string }[],
  settingsStore?: { value: ApplicationSettings | null },
  writeLog?: { id: string; content: string }[],
): UsfmShellHost {
  const store = settingsStore ?? { value: null };
  const folderPath = "/test/folder";
  const host: UsfmShellHost = {
    label: "Test folder",
    folderPath,
    async listRecentFolders() {
      return [{ path: folderPath, label: "Test folder" }];
    },
    async openFolder() {},
    async pickFolder() {},
    async listFiles() {
      return files.map((f) => ({ id: f.id, name: f.name }));
    },
    async readFile(id: string) {
      const f = files.find((x) => x.id === id);
      return f ? f.usfm : null;
    },
    async loadSettings() {
      return store.value;
    },
    async saveSettings(next) {
      store.value = next;
    },
  };
  if (writeLog) {
    host.writeFile = async (id, content) => {
      writeLog.push({ id, content });
    };
  }
  return host;
}

describe("UsfmShell — line-offset helpers", () => {
  it("round-trips offsets through line/column", () => {
    const text = "line 0\nline one\nline two";
    expect(lineColumnToSourceOffset(text, 0, 0)).toBe(0);
    expect(lineColumnToSourceOffset(text, 1, 0)).toBe(7);
    expect(lineColumnToSourceOffset(text, 1, 4)).toBe(11);
    expect(sourceOffsetToLineColumn(text, 11)).toEqual({ line: 1, column: 4 });
  });

  it("clamps out-of-range positions", () => {
    const text = "a\nb";
    expect(lineColumnToSourceOffset(text, 99, 99)).toBe(text.length);
    expect(lineColumnToSourceOffset(text, 0, 99)).toBe(1); // clamped to line length
  });
});

describe("UsfmShell", () => {
  it("lists files from the host in the file browser tab (default)", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
      { id: "f://b", name: "B.usfm", usfm: "\\id EXO\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    expect(screen.getByTestId("usfm-shell-file-B.usfm")).toBeTruthy();
    // The file-browser tab is selected by default.
    const filesTab = screen.getByTestId("usfm-shell-sidebar-tab-files");
    expect(filesTab.getAttribute("aria-selected")).toBe("true");
    // Folder name is shown in the bottom selector, not as a top heading.
    expect(screen.getByTestId("usfm-shell-folder-selector-label").textContent).toBe("Test folder");
    expect(screen.queryByText("Test folder", { selector: ".uppercase" })).toBeNull();
  });

  it("shows the folder path as a tooltip and exposes recent/open controls", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-folder-selector"));
    const label = screen.getByTestId("usfm-shell-folder-selector-label");
    expect(label.getAttribute("title")).toBe("/test/folder");
    expect(screen.getByTestId("usfm-shell-folder-selector-recent").getAttribute("title")).toBe(
      "open recent folder",
    );
    expect(screen.getByTestId("usfm-shell-folder-selector-open").getAttribute("title")).toBe(
      "Open new folder",
    );
  });

  it("switches folders from the recent dropdown and open-new-folder button", async () => {
    const host = createFixtureUsfmShellHost();
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-GEN.usfm"));
    expect(screen.getByTestId("usfm-shell-folder-selector-label").textContent).toBe(
      "Sample bible folder",
    );

    fireEvent.click(screen.getByTestId("usfm-shell-folder-selector-open"));
    await waitFor(() =>
      expect(screen.getByTestId("usfm-shell-folder-selector-label").textContent).toBe(
        "Compact bible folder",
      ),
    );
    expect(screen.getByTestId("usfm-shell-folder-selector-label").getAttribute("title")).toBe(
      "/fake/bible/compact",
    );

    fireEvent.click(screen.getByTestId("usfm-shell-folder-selector-recent"));
    const recentOption = await screen.findByRole("option", { name: /Sample bible folder/i });
    fireEvent.click(recentOption);
    await waitFor(() =>
      expect(screen.getByTestId("usfm-shell-folder-selector-label").textContent).toBe(
        "Sample bible folder",
      ),
    );
    await waitFor(() => screen.getByTestId("usfm-shell-file-PSA.usfm"));
  });

  it("opens a file as a workspace tab on click", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
  });

  it("focuses the existing tab when the same file is clicked again", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    const tabs = screen.getAllByRole("tab", { name: /A\.usfm/i });
    expect(tabs.length).toBe(1);
  });

  it("opens the same file in a second tab group while keeping one copy per group", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));

    // Open A in the only group, then split into 1×2 so slot 1 is empty.
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByRole("button", { name: /tab group layout 1×1/i }));
    fireEvent.click(screen.getByRole("option", { name: /1×2 layout/i }));
    const emptySlot = await screen.findByLabelText(/empty tab group/i);

    // Activate the empty group and open A again — it opens a second tab there (one per group).
    fireEvent.pointerDown(emptySlot, { button: 0 });
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => expect(screen.getAllByRole("tab", { name: /A\.usfm/i }).length).toBe(2));

    // Clicking A again while the second group is active focuses the existing copy — no third tab.
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    expect(screen.getAllByRole("tab", { name: /A\.usfm/i }).length).toBe(2);
  });

  it("toggles the sidebar between expanded and collapsed", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN" },
    ]);
    render(<UsfmShell host={host} />);
    expect(screen.getByTestId("usfm-shell-sidebar-panel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-toggle"));
    expect(screen.queryByTestId("usfm-shell-sidebar-panel")).toBeNull();
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-toggle"));
    expect(screen.getByTestId("usfm-shell-sidebar-panel")).toBeTruthy();
  });

  it("switches sidebar tab from files to search via vertical tabs", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-tab-search"));
    expect(screen.getByTestId("usfm-shell-file-search")).toBeTruthy();
    expect(screen.queryByTestId("usfm-shell-file-browser")).toBeNull();
  });

  it("shows search results across files and selecting one opens that file", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 alpha bravo" },
      { id: "f://b", name: "B.usfm", usfm: "\\id EXO\n\\c 1\n\\p\n\\v 1 charlie bravo delta" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-tab-search"));
    const input = screen.getByLabelText(/search query/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "bravo" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => screen.getByTestId("usfm-shell-search-result-0"));
    fireEvent.click(screen.getByTestId("usfm-shell-search-result-0"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
  });

  it("renders the errors tab with bug icon and validation count", async () => {
    const host = makeHost([
      // \xyz is an unknown marker — triggers a diagnostic from the language service.
      { id: "f://bad", name: "Bad.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 ok\n\\xyz unknown\n" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-Bad.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-file-Bad.usfm"));
    const count = await screen.findByTestId("usfm-shell-errors-count", undefined, { timeout: 2500 });
    expect(Number(count.textContent)).toBeGreaterThan(0);
  });

  it("opens files into the active tab group and follows it in the errors panel", async () => {
    const host = makeHost([
      // \xyz is an unknown marker, so Bad.usfm produces a diagnostic; Good.usfm is clean.
      { id: "f://bad", name: "Bad.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 ok\n\\xyz unknown\n" },
      { id: "f://good", name: "Good.usfm", usfm: "\\id EXO\n\\c 1\n\\p\n\\v 1 fine" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-Bad.usfm"));

    // Open Bad in the only (active) group; its error surfaces in the errors panel.
    fireEvent.click(screen.getByTestId("usfm-shell-file-Bad.usfm"));
    await screen.findByTestId("usfm-shell-errors-count", undefined, { timeout: 2500 });

    // Split into 1×2; Bad stays in slot 0, leaving slot 1 empty.
    fireEvent.click(screen.getByRole("button", { name: /tab group layout 1×1/i }));
    fireEvent.click(screen.getByRole("option", { name: /1×2 layout/i }));
    const emptySlot = await screen.findByLabelText(/empty tab group/i);

    // Pressing inside the empty group makes it active, so the next opened file lands there.
    fireEvent.pointerDown(emptySlot, { button: 0 });
    fireEvent.click(screen.getByTestId("usfm-shell-file-Good.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /Good\.usfm/i }));
    // Both groups are populated now — Bad did not move out of slot 0.
    expect(screen.getByRole("tab", { name: /Bad\.usfm/i })).toBeTruthy();
    // Good (clean) is the active tab page, so the errors panel clears its count.
    await waitFor(() => expect(screen.queryByTestId("usfm-shell-errors-count")).toBeNull());

    // Pressing inside Bad's pane re-activates slot 0; the errors panel follows it back.
    const badPane = document.querySelectorAll(".cm-content")[0]!;
    fireEvent.pointerDown(badPane, { button: 0 });
    await screen.findByTestId("usfm-shell-errors-count", undefined, { timeout: 2500 });
  });

  it("opens a file dragged from the sidebar into a tab group", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
      { id: "f://b", name: "B.usfm", usfm: "\\id EXO\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));

    // Open A so the group has a tab (which surfaces the layout selector), then split into 1×2 so
    // slot 1 is empty.
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByRole("button", { name: /tab group layout 1×1/i }));
    fireEvent.click(screen.getByRole("option", { name: /1×2 layout/i }));
    const emptySlot = await screen.findByLabelText(/empty tab group/i);

    // Pointer-drag B out of the sidebar and drop it onto the empty slot. jsdom has no layout, so
    // stub elementFromPoint to report the empty slot under the pointer.
    const restore = stubElementFromPoint(emptySlot);
    try {
      const row = screen.getByTestId("usfm-shell-file-B.usfm");
      fireEvent.pointerDown(row, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(row, { clientX: 200, clientY: 40 }); // past the drag threshold
      fireEvent.pointerUp(row, { clientX: 200, clientY: 40 });
    } finally {
      restore();
    }

    // B opened into the previously empty slot, so no empty drop target remains.
    await waitFor(() => screen.getByRole("tab", { name: /B\.usfm/i }));
    expect(screen.queryByLabelText(/empty tab group/i)).toBeNull();
    expect(screen.getByRole("tab", { name: /A\.usfm/i })).toBeTruthy();
  });

  it("closes every tab in a group from the tab context menu", async () => {
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
      { id: "f://b", name: "B.usfm", usfm: "\\id EXO\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));

    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByTestId("usfm-shell-file-B.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /B\.usfm/i }));

    fireEvent.contextMenu(screen.getByRole("tab", { name: /A\.usfm/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close All" }));

    await waitFor(() => expect(screen.queryByRole("tab", { name: /A\.usfm/i })).toBeNull());
    expect(screen.queryByRole("tab", { name: /B\.usfm/i })).toBeNull();
  });

  it("toggles the bottom bar between expanded and collapsed", () => {
    const host = makeHost([]);
    render(<UsfmShell host={host} />);
    expect(screen.getByTestId("usfm-shell-bottom-panel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("usfm-shell-bottom-toggle"));
    expect(screen.queryByTestId("usfm-shell-bottom-panel")).toBeNull();
    fireEvent.click(screen.getByTestId("usfm-shell-bottom-toggle"));
    expect(screen.getByTestId("usfm-shell-bottom-panel")).toBeTruthy();
  });

  it("opens the settings pane as a workspace tab when the gear is clicked", async () => {
    const host = makeHost([]);
    render(<UsfmShell host={host} />);
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-settings"));
    await waitFor(() => screen.getByTestId("settings-pane"));
    expect(screen.getByRole("tab", { name: /Settings/i })).toBeTruthy();
  });

  it("reuses the single settings tab when the gear is clicked again", async () => {
    const host = makeHost([]);
    render(<UsfmShell host={host} />);
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-settings"));
    await waitFor(() => screen.getByTestId("settings-pane"));
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-settings"));
    expect(screen.getAllByRole("tab", { name: /Settings/i }).length).toBe(1);
  });

  it("loads the persisted theme and saves a change through the host", async () => {
    const store: { value: ApplicationSettings | null } = { value: { theme: "dark" } };
    const host = makeHost([], store);
    render(<UsfmShell host={host} />);
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-settings"));
    await waitFor(() => screen.getByTestId("settings-pane"));

    // Persisted "dark" is reflected as the checked option and applied to the shell.
    const dark = screen.getByTestId("settings-theme-option-dark").querySelector("input")!;
    await waitFor(() => expect((dark as HTMLInputElement).checked).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("dark"),
    );

    // Selecting "light" persists through the host and updates the resolved theme.
    const light = screen.getByTestId("settings-theme-option-light").querySelector("input")!;
    fireEvent.click(light);
    expect(store.value).toEqual({ theme: "light" });
    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("light"),
    );
  });

  it("toggles the resolved theme when light and dark are selected in settings", async () => {
    const host = makeHost([]);
    render(<UsfmShell host={host} />);
    fireEvent.click(screen.getByTestId("usfm-shell-sidebar-settings"));
    await waitFor(() => screen.getByTestId("settings-pane"));

    fireEvent.click(screen.getByTestId("settings-theme-option-light").querySelector("input")!);
    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("light"),
    );
    expect(screen.getByTestId("theme-scope").classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByTestId("settings-theme-option-dark").querySelector("input")!);
    await waitFor(() =>
      expect(screen.getByTestId("theme-scope").getAttribute("data-theme")).toBe("dark"),
    );
    expect(screen.getByTestId("theme-scope").classList.contains("dark")).toBe(true);
  });

  it("defaults to the system theme preference when no settings are persisted", async () => {
    const host = makeHost([]);
    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("theme-scope"));
    const resolved = screen.getByTestId("theme-scope").getAttribute("data-theme");
    expect(resolved === "light" || resolved === "dark").toBe(true);
  });

  it("reopens file content from the host instead of a stale sidebar cache", async () => {
    const disk = new Map<string, string>([["f://a", "\\id GEN\n\\c 1\n\\p\n\\v 1 original"]]);
    const host = makeHost([]);
    host.listFiles = async () => [{ id: "f://a", name: "A.usfm" }];
    host.readFile = async (id) => disk.get(id) ?? null;
    host.writeFile = async (id, content) => {
      disk.set(id, content);
    };

    render(<UsfmShell host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));

    disk.set("f://a", "\\id GEN\n\\c 1\n\\p\n\\v 1 saved on disk");
    fireEvent.click(screen.getByRole("button", { name: /^close tab$/i }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: /A\.usfm/i })).toBeNull());

    fireEvent.click(screen.getByTestId("usfm-shell-file-A.usfm"));
    await waitFor(() => screen.getByRole("tab", { name: /A\.usfm/i }));
    await waitFor(() => {
      expect(document.querySelector(".cm-content")?.textContent).toContain("saved on disk");
    });
  });

  it("reports no unsaved changes when all tabs are clean", async () => {
    const shellRef = createRef<UsfmShellHandle>();
    const host = makeHost([
      { id: "f://a", name: "A.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n\\v 1 hi" },
    ]);
    render(<UsfmShell ref={shellRef} host={host} />);
    await waitFor(() => screen.getByTestId("usfm-shell-file-A.usfm"));
    expect(shellRef.current?.hasUnsavedChanges()).toBe(false);
    await expect(shellRef.current!.confirmExit()).resolves.toBe(true);
  });
});
