import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanup, fireEvent, render, screen, waitFor } from "./testing-react.ts";
import { UsfmShell } from "../src/components/usfm-shell/UsfmShell.js";
import type { UsfmShellHost } from "../src/components/usfm-shell/host.js";
import type { ApplicationSettings } from "../src/components/settings-pane/settings-model.js";
import { lineColumnToSourceOffset, sourceOffsetToLineColumn } from "../src/components/usfm-shell/line-offsets.js";


function makeHost(
  files: readonly { id: string; name: string; usfm: string }[],
  settingsStore?: { value: ApplicationSettings | null },
): UsfmShellHost {
  const store = settingsStore ?? { value: null };
  return {
    label: "Test folder",
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
});
