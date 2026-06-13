import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { render, waitFor } from "./testing-react.ts";
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

  it("debounces preview regeneration when updateDebounceMs is set", async () => {
    const initial = "\\id GEN\n\\c 1\n\\p\n\\v 1 First.";
    const updated = "\\id GEN\n\\c 1\n\\p\n\\v 1 Second.";

    const { container, rerender } = render(
      <UsfmPreview value={initial} updateDebounceMs={50} />,
    );
    expect(container.textContent).toContain("First");

    rerender(<UsfmPreview value={updated} updateDebounceMs={50} />);
    expect(container.textContent).toContain("First");

    await waitFor(() => {
      expect(container.textContent).toContain("Second");
    });
  });
});
