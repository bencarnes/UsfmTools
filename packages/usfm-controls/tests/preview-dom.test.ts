import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({});
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { renderPreviewHtml } from "@usfm-tools/model";
import {
  applyPreviewHtml,
  splitPreviewHtml,
  type PreviewChunks,
} from "../src/components/usfm-preview/preview-dom.js";

const CLEAN = "\\id GEN Genesis\n\\h Genesis\n\\c 1\n\\p\n\\v 1 One.\n\\c 2\n\\p\n\\v 1 Two.\n\\c 3\n\\p\n\\v 1 Three.";

function host(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("splitPreviewHtml", () => {
  it("splits head and one chunk per chapter, reassembling to the input", () => {
    const html = renderPreviewHtml(CLEAN);
    const chunks = splitPreviewHtml(html);
    expect(chunks.head.startsWith("<article")).toBe(true);
    expect(chunks.chapters).toHaveLength(3);
    expect(chunks.incompatible).toBe(false);
    expect(chunks.head + chunks.chapters.join("")).toBe(html);
  });

  it("flags multi-book documents as incompatible", () => {
    const html = renderPreviewHtml(
      "\\id GEN\n\\c 1\n\\p\n\\v 1 A.\n\\id EXO\n\\c 1\n\\p\n\\v 1 B.",
    );
    expect(splitPreviewHtml(html).incompatible).toBe(true);
  });

  it("handles documents without chapters", () => {
    const chunks = splitPreviewHtml(renderPreviewHtml("\\id FRT\n\\p\n\\v 1 Front."));
    expect(chunks.chapters).toHaveLength(0);
    expect(chunks.head.length).toBeGreaterThan(0);
  });
});

describe("applyPreviewHtml", () => {
  function apply(container: HTMLElement, usfm: string, prev: PreviewChunks | null) {
    return applyPreviewHtml(container, renderPreviewHtml(usfm), prev);
  }

  it("reuses untouched chapter DOM and swaps only the changed chapter", () => {
    const container = host();
    let chunks = apply(container, CLEAN, null);
    const before = Array.from(container.querySelectorAll("section.usfm-chapter"));
    expect(before).toHaveLength(3);

    chunks = apply(container, CLEAN.replace("Two.", "Two edited."), chunks);
    const after = Array.from(container.querySelectorAll("section.usfm-chapter"));
    expect(after).toHaveLength(3);
    // Chapters 1 and 3 keep their exact DOM nodes; chapter 2 is new.
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]!.textContent).toContain("Two edited.");
  });

  it("falls back to a full swap when the chapter count changes", () => {
    const container = host();
    let chunks = apply(container, CLEAN, null);
    const before = container.querySelectorAll("section.usfm-chapter")[0];
    chunks = apply(container, CLEAN + "\n\\c 4\n\\p\n\\v 1 Four.", chunks);
    expect(container.querySelectorAll("section.usfm-chapter")).toHaveLength(4);
    expect(container.querySelectorAll("section.usfm-chapter")[0]).not.toBe(before);
    expect(chunks.chapters).toHaveLength(4);
  });

  it("round-trips to the same markup as a plain innerHTML swap", () => {
    const container = host();
    const reference = host();
    let chunks = apply(container, CLEAN, null);
    const edits = [
      CLEAN.replace("One.", "One more."),
      CLEAN.replace("One.", "One more.") + "\n\\zbad x",
      CLEAN,
    ];
    for (const usfm of edits) {
      chunks = apply(container, usfm, chunks);
      reference.innerHTML = renderPreviewHtml(usfm);
      expect(container.innerHTML).toBe(reference.innerHTML);
    }
  });
});
