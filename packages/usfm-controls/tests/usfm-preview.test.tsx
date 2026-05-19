import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { UsfmPreview } from "../src/components/usfm-preview/UsfmPreview.js";

describe("UsfmPreview", () => {
  it("renders publication HTML", () => {
    const { container } = render(
      <UsfmPreview value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} />,
    );
    expect(container.querySelector(".usfm-preview-root")).toBeTruthy();
    expect(container.querySelector("article.usfm-document")).toBeTruthy();
    expect(container.textContent).toContain("Hello");
  });

  it("surfaces parse errors without throwing", () => {
    const { container } = render(<UsfmPreview value={"\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz bad"} />);
    expect(container.querySelector(".usfm-preview-errors")).toBeTruthy();
  });

  it("honors versePerLine for multi-verse paragraphs", () => {
    const { container } = render(
      <UsfmPreview value={"\\id GEN\n\\c 1\n\\p\n\\v 1 One. \\v 2 Two."} versePerLine />,
    );
    expect(container.querySelectorAll("p.usfm-line").length).toBe(2);
  });
});
