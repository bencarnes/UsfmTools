import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({ flushTimers: true });
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { render, waitFor } from "./testing-react.ts";
import { UsfmPreview } from "../src/components/usfm-preview/UsfmPreview.js";
import { createStubLanguageClient } from "../src/language-service/stub-client.js";
import type { UsfmLanguageClient } from "../src/language-service/protocol.js";

const MULTI_VERSE = "\\id GEN\n\\c 1\n\\p\n\\v 1 One. \\v 2 Two.";

/** Stub client whose preview records the `versePerLine` option it was given. */
function optionsClient(): UsfmLanguageClient {
  return {
    ...createStubLanguageClient(),
    renderPreview: (_text, options) =>
      Promise.resolve(
        `<article class="usfm-document" data-verse-per-line="${!!options?.versePerLine}"></article>`,
      ),
  };
}

function versePerLineRendered(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>("article.usfm-document")?.dataset.versePerLine;
}

describe("UsfmPreview", () => {
  it("renders publication HTML", async () => {
    const { container } = render(
      <UsfmPreview value={"\\id GEN\n\\c 1\n\\p\n\\v 1 Hello."} />,
    );
    expect(container.querySelector(".usfm-preview-root")).toBeTruthy();
    // Rendering is asynchronous (the language client returns a promise).
    await waitFor(() => {
      expect(container.querySelector("article.usfm-document")).toBeTruthy();
    });
    expect(container.textContent).toContain("Hello");
  });

  it("renders invalid input without an error banner", async () => {
    const { container } = render(<UsfmPreview value={"\\id GEN\n\\c 1\n\\p\n\\v 1 \\zzz bad"} />);
    await waitFor(() => {
      expect(container.querySelector("article.usfm-document")).toBeTruthy();
    });
    expect(container.querySelector("aside")).toBeNull();
  });

  it("renders without versePerLine by default", async () => {
    const { container } = render(<UsfmPreview value={MULTI_VERSE} languageClient={optionsClient()} />);
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("false");
    });
  });

  it("asks the client for one line per verse when versePerLine is true", async () => {
    const { container } = render(
      <UsfmPreview value={MULTI_VERSE} versePerLine languageClient={optionsClient()} />,
    );
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("true");
    });
  });

  it("treats Storybook-style string 'true' as versePerLine on", async () => {
    const { container } = render(
      <UsfmPreview
        value={MULTI_VERSE}
        versePerLine={"true" as unknown as boolean}
        languageClient={optionsClient()}
      />,
    );
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("true");
    });
  });

  it("updates the rendered HTML when the versePerLine prop toggles", async () => {
    const client = optionsClient();
    const { container, rerender } = render(
      <UsfmPreview value={MULTI_VERSE} versePerLine={false} languageClient={client} />,
    );
    // Rendering is asynchronous (the language client returns a promise), so
    // each assertion waits for the refreshed HTML to land.
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("false");
    });

    rerender(<UsfmPreview value={MULTI_VERSE} versePerLine={true} languageClient={client} />);
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("true");
    });

    rerender(<UsfmPreview value={MULTI_VERSE} versePerLine={false} languageClient={client} />);
    await waitFor(() => {
      expect(versePerLineRendered(container)).toBe("false");
    });
  });

  it("debounces preview regeneration when updateDebounceMs is set", async () => {
    const initial = "\\id GEN\n\\c 1\n\\p\n\\v 1 First.";
    const updated = "\\id GEN\n\\c 1\n\\p\n\\v 1 Second.";

    const { container, rerender } = render(
      <UsfmPreview value={initial} updateDebounceMs={50} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("First");
    });

    rerender(<UsfmPreview value={updated} updateDebounceMs={50} />);
    expect(container.textContent).toContain("First");

    await waitFor(() => {
      expect(container.textContent).toContain("Second");
    });
  });
});
