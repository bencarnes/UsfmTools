import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { UsfmPreview } from "../src/components/usfm-preview/UsfmPreview.js";

const MULTI_VERSE = "\\id GEN\n\\c 1\n\\p\n\\v 1 One. \\v 2 Two.";

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

  it("renders a single <p> for a multi-verse paragraph when versePerLine is off", () => {
    const { container } = render(<UsfmPreview value={MULTI_VERSE} />);
    expect(container.querySelectorAll("p.usfm-line").length).toBe(1);
  });

  it("renders one <p> per verse when versePerLine is true", () => {
    const { container } = render(<UsfmPreview value={MULTI_VERSE} versePerLine />);
    expect(container.querySelectorAll("p.usfm-line").length).toBe(2);
  });

  it("treats Storybook-style string 'true' as versePerLine on", () => {
    const { container } = render(
      <UsfmPreview value={MULTI_VERSE} versePerLine={"true" as unknown as boolean} />,
    );
    expect(container.querySelectorAll("p.usfm-line").length).toBe(2);
  });

  it("updates the rendered HTML when the versePerLine prop toggles", () => {
    const { container, rerender } = render(
      <UsfmPreview value={MULTI_VERSE} versePerLine={false} />,
    );
    expect(container.querySelectorAll("p.usfm-line").length).toBe(1);

    rerender(<UsfmPreview value={MULTI_VERSE} versePerLine={true} />);
    expect(container.querySelectorAll("p.usfm-line").length).toBe(2);

    rerender(<UsfmPreview value={MULTI_VERSE} versePerLine={false} />);
    expect(container.querySelectorAll("p.usfm-line").length).toBe(1);
  });
});
