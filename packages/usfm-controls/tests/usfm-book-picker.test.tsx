import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { UsfmBookPicker } from "../src/components/usfm-book-picker/UsfmBookPicker.js";

afterEach(() => {
  cleanup();
});

describe("UsfmBookPicker", () => {
  it("renders OT and NT grids and omits optional groups when empty", () => {
    render(
      <UsfmBookPicker
        files={[
          { id: "g", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
          { id: "m", usfm: "\\id MAT\n\\toc3 Mat\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Open Gen \(GEN\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Mat \(MAT\)/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /TOB/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hymnal/ })).toBeNull();
  });

  it("renders standard other books as a vertical list when present", () => {
    render(
      <UsfmBookPicker
        files={[{ id: "t", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" }]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Open Tobit \(TOB\)/ });
    expect(btn).toBeTruthy();
    expect(btn.closest("li")).toBeTruthy();
  });

  it("renders non-standard books in a fourth vertical list", () => {
    render(
      <UsfmBookPicker
        files={[
          { id: "g", usfm: "\\id GEN\n\\toc3 Gen\n\\c 1\n\\p\n" },
          { id: "h", usfm: "\\id HYM\n\\toc1 Hymnal\n\\c 1\n\\p\n" },
        ]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Open Hymnal \(HYM\)/ });
    expect(btn).toBeTruthy();
    expect(btn.closest("li")).toBeTruthy();
  });

  it("fires onBookSelect with file id and code", () => {
    const onBookSelect = vi.fn();
    render(
      <UsfmBookPicker
        files={[{ id: "myfile", usfm: "\\id LUK\n\\toc3 Luk\n\\c 1\n\\p\n" }]}
        onBookSelect={onBookSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open Luk \(LUK\)/ }));
    expect(onBookSelect).toHaveBeenCalledWith({ fileId: "myfile", code: "LUK" });
  });

  it("renders non-standard file without \\id using aria label without code suffix", () => {
    render(
      <UsfmBookPicker files={[{ id: "supp", usfm: "\\toc1 Supplement\n\\c 1\n\\p\n" }]} />,
    );
    expect(screen.getByRole("button", { name: /^Open Supplement$/ })).toBeTruthy();
  });

  it("fires onBookSelect with empty code when there is no \\id", () => {
    const onBookSelect = vi.fn();
    render(
      <UsfmBookPicker
        files={[{ id: "z", usfm: "\\toc1 Zine\n\\c 1\n\\p\n" }]}
        onBookSelect={onBookSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open Zine$/ }));
    expect(onBookSelect).toHaveBeenCalledWith({ fileId: "z", code: "" });
  });

  it("fires onBookSelect for non-standard ids", () => {
    const onBookSelect = vi.fn();
    render(
      <UsfmBookPicker
        files={[{ id: "hym", usfm: "\\id HYM\n\\toc1 Hymnal\n\\c 1\n\\p\n" }]}
        onBookSelect={onBookSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open Hymnal \(HYM\)/ }));
    expect(onBookSelect).toHaveBeenCalledWith({ fileId: "hym", code: "HYM" });
  });
});
