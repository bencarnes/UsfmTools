import { registerDomTestHooks } from "./deno-test-setup.ts";

registerDomTestHooks({});
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  applyPreviewHtml,
  splitPreviewHtml,
  type PreviewChunks,
} from "../src/components/usfm-preview/preview-dom.js";

// Markup in the shape the Go engine's preview renderer emits.
const chapter = (n: number, text: string) =>
  `<section class="usfm-chapter" data-chapter="${n}"><h2 class="usfm-chapter-num">Chapter ${n}</h2>` +
  `<div class="usfm-chapter-body"><p class="usfm-line usfm-p usfm-line--prose">` +
  `<sup class="usfm-v" data-verse="1">1</sup><span class="usfm-txt">${text}</span></p></div></section>`;
const book = (code: string, body: string) =>
  `<section class="usfm-book" data-code="${code}"><header class="usfm-book-hd">` +
  `<h1 class="usfm-book-code">${code}</h1></header>${body}</section>`;
const article = (...books: string[]) => `<article class="usfm-document">${books.join("")}</article>`;

/** Preview HTML of a one-book document with one verse per chapter. */
function previewHtml(chapterTexts: readonly string[]): string {
  return article(book("GEN", chapterTexts.map((t, i) => chapter(i + 1, t)).join("")));
}

const CLEAN = ["One.", "Two.", "Three."];

function host(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("splitPreviewHtml", () => {
  it("splits head and one chunk per chapter, reassembling to the input", () => {
    const html = previewHtml(CLEAN);
    const chunks = splitPreviewHtml(html);
    expect(chunks.head.startsWith("<article")).toBe(true);
    expect(chunks.chapters).toHaveLength(3);
    expect(chunks.incompatible).toBe(false);
    expect(chunks.head + chunks.chapters.join("")).toBe(html);
  });

  it("flags multi-book documents as incompatible", () => {
    const html = article(book("GEN", chapter(1, "A.")), book("EXO", chapter(1, "B.")));
    expect(splitPreviewHtml(html).incompatible).toBe(true);
  });

  it("handles documents without chapters", () => {
    const html = article(
      book("FRT", '<div class="usfm-preamble"><p class="usfm-line usfm-p">Front.</p></div>'),
    );
    const chunks = splitPreviewHtml(html);
    expect(chunks.chapters).toHaveLength(0);
    expect(chunks.head).toBe(html);
  });
});

describe("applyPreviewHtml", () => {
  function apply(container: HTMLElement, chapters: readonly string[], prev: PreviewChunks | null) {
    return applyPreviewHtml(container, previewHtml(chapters), prev);
  }

  it("reuses untouched chapter DOM and swaps only the changed chapter", () => {
    const container = host();
    let chunks = apply(container, CLEAN, null);
    const before = Array.from(container.querySelectorAll("section.usfm-chapter"));
    expect(before).toHaveLength(3);

    chunks = apply(container, ["One.", "Two edited.", "Three."], chunks);
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
    chunks = apply(container, [...CLEAN, "Four."], chunks);
    expect(container.querySelectorAll("section.usfm-chapter")).toHaveLength(4);
    expect(container.querySelectorAll("section.usfm-chapter")[0]).not.toBe(before);
    expect(chunks.chapters).toHaveLength(4);
  });

  it("round-trips to the same markup as a plain innerHTML swap", () => {
    const container = host();
    const reference = host();
    let chunks = apply(container, CLEAN, null);
    const edits = [
      ["One more.", "Two.", "Three."],
      ["One more.", "Two.", "Three. <b>x</b>"],
      CLEAN,
    ];
    for (const chapters of edits) {
      chunks = apply(container, chapters, chunks);
      reference.innerHTML = previewHtml(chapters);
      expect(container.innerHTML).toBe(reference.innerHTML);
    }
  });
});
