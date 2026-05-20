import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UsfmBookPicker } from "../src/components/usfm-book-picker/UsfmBookPicker.js";

describe("UsfmBookPicker", () => {
  it("renders OT and NT grids and omits other group when empty", () => {
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
  });

  it("renders other books as a vertical list when present", () => {
    render(
      <UsfmBookPicker
        files={[{ id: "t", usfm: "\\id TOB\n\\toc1 Tobit\n\\c 1\n\\p\n" }]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Open Tobit \(TOB\)/ });
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
});
