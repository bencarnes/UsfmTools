import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks();
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
import { render, screen, fireEvent } from "./testing-react.ts";
import { UsfmFilePicker } from "../src/components/usfm-file-picker/UsfmFilePicker.js";

describe("UsfmFilePicker", () => {
  it("renders OT and NT files vertically with file names", () => {
    render(
      <UsfmFilePicker
        files={[
          { id: "g", name: "01-GEN.usfm", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
          { id: "m", name: "40-MAT.usfm", usfm: "\\id MAT\n\\toc3 Mat\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    const gen = screen.getByRole("button", { name: /Open 01-GEN\.usfm \(GEN\)/ });
    const mat = screen.getByRole("button", { name: /Open 40-MAT\.usfm \(MAT\)/ });
    expect(gen.closest("li")).toBeTruthy();
    expect(mat.closest("li")).toBeTruthy();
    expect(gen.textContent).toBe("01-GEN.usfm");
    expect(mat.textContent).toBe("40-MAT.usfm");
  });

  it("orders canonical books by standard table, not input order", () => {
    render(
      <UsfmFilePicker
        files={[
          { id: "m", name: "MAT.usfm", usfm: "\\id MAT\n\\c 1\n\\p\n" },
          { id: "g", name: "GEN.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["GEN.usfm", "MAT.usfm"]);
  });

  it("renders standard other books in a vertical list when present", () => {
    render(
      <UsfmFilePicker
        files={[{ id: "t", name: "TOB.usfm", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" }]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Open TOB\.usfm \(TOB\)/ });
    expect(btn).toBeTruthy();
    expect(btn.closest("li")).toBeTruthy();
  });

  it("renders non-standard files in a separate vertical list", () => {
    render(
      <UsfmFilePicker
        files={[
          { id: "g", name: "GEN.usfm", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
          { id: "h", name: "hymnal.usfm", usfm: "\\id HYM\n\\toc1 Hymnal\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Open hymnal\.usfm \(HYM\)/ });
    expect(btn).toBeTruthy();
    expect(btn.closest("li")).toBeTruthy();
  });

  it("fires onFileSelect with file id and code", () => {
    const onFileSelect = spy((_selection: { fileId: string; code: string }) => {});
    render(
      <UsfmFilePicker
        files={[{ id: "myfile", name: "LUK.usfm", usfm: "\\id LUK\n\\toc3 Luk\n\\c 1\n\\p\n" }]}
        onFileSelect={onFileSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open LUK\.usfm \(LUK\)/ }));
    expect(onFileSelect.calls[0]?.args).toEqual([{ fileId: "myfile", code: "LUK" }]);
  });

  it("renders files without \\id using the file name", () => {
    render(
      <UsfmFilePicker
        files={[{ id: "supp", name: "supplement.usfm", usfm: "\\toc1 Supplement\n\\c 1\n\\p\n" }]}
      />,
    );
    expect(screen.getByRole("button", { name: /^Open supplement\.usfm$/ })).toBeTruthy();
  });

  it("fires onFileSelect with empty code when there is no \\id", () => {
    const onFileSelect = spy((_selection: { fileId: string; code: string }) => {});
    render(
      <UsfmFilePicker
        files={[{ id: "z", name: "zine.usfm", usfm: "\\toc1 Zine\n\\c 1\n\\p\n" }]}
        onFileSelect={onFileSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open zine\.usfm$/ }));
    expect(onFileSelect.calls[0]?.args).toEqual([{ fileId: "z", code: "" }]);
  });

  it("renders multiple copies of the same book as separate rows", () => {
    render(
      <UsfmFilePicker
        files={[
          { id: "draft", name: "GEN-draft.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
          { id: "final", name: "GEN-final.usfm", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent)).toEqual(["GEN-draft.usfm", "GEN-final.usfm"]);
  });

  it("renders standard books without \\toc3", () => {
    render(
      <UsfmFilePicker
        files={[{ id: "1", name: "ROM.usfm", usfm: "\\id ROM\n\\c 1\n\\p\n" }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Open ROM\.usfm \(ROM\)/ })).toBeTruthy();
  });

  it("marks the active file with aria-current", () => {
    render(
      <UsfmFilePicker
        files={[
          { id: "g", name: "GEN.usfm", usfm: "\\id GEN\n\\c 1\n\\p\n" },
          { id: "m", name: "MAT.usfm", usfm: "\\id MAT\n\\c 1\n\\p\n" },
        ]}
        activeFileId="m"
      />,
    );
    expect(screen.getByRole("button", { name: /Open MAT\.usfm/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /Open GEN\.usfm/ }).getAttribute("aria-current")).toBeNull();
  });
});
