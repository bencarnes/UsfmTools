import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UsfmShell } from "../src/components/usfm-shell/UsfmShell.js";
import type { UsfmShellHost } from "../src/components/usfm-shell/host.js";
import { lineColumnToSourceOffset, sourceOffsetToLineColumn } from "../src/components/usfm-shell/line-offsets.js";

afterEach(() => {
  cleanup();
});

function makeHost(files: readonly { id: string; name: string; usfm: string }[]): UsfmShellHost {
  return {
    label: "Test folder",
    async listFiles() {
      return files.map((f) => ({ id: f.id, name: f.name }));
    },
    async readFile(id: string) {
      const f = files.find((x) => x.id === id);
      return f ? f.usfm : null;
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
});
