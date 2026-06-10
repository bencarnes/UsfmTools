import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parse, ViewModels } from "../src/index.js";
import type { PublicationViewModel } from "../src/view-models/publication-preview.js";

describe("ViewModels.Publication", () => {
  it("builds preview with chapter and verse", () => {
    const { document } = parse("\\id GEN Test\n\\c 1\n\\p\n\\v 1 Hello world.");
    const preview = ViewModels.Publication.buildPreview(document);
    expect(preview.books).toHaveLength(1);
    expect(preview.books[0]!.code).toBe("GEN");
    expect(preview.books[0]!.chapters).toHaveLength(1);
    const ch = preview.books[0]!.chapters[0]!;
    expect(ch.number).toBe("1");
    const line = ch.blocks.find((b) => b.kind === "line") as PublicationViewModel.LineBlock;
    expect(line).toBeDefined();
    expect(line.segments.some((s) => s.kind === "verse" && s.number === "1")).toBe(true);
    expect(line.segments.some((s) => s.kind === "text" && s.text.includes("Hello"))).toBe(true);
  });

  it("classifies poetry markers", () => {
    const { document } = parse("\\id PSA\n\\c 1\n\\q1 \\v 1 Line one\n\\q2 second.");
    const preview = ViewModels.Publication.buildPreview(document);
    const line = preview.books[0]!.chapters[0]!.blocks.find(
      (b) => b.kind === "line" && b.marker === "q1",
    ) as PublicationViewModel.LineBlock;
    expect(line.flow).toBe("poetry");
  });

  it("emits heading blocks for section markers", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\s1 The Beginning\n\\p\n\\v 1 Text.");
    const preview = ViewModels.Publication.buildPreview(document);
    const h = preview.books[0]!.chapters[0]!.blocks.find((b) => b.kind === "heading") as PublicationViewModel.HeadingBlock;
    expect(h.marker).toBe("s1");
    expect(h.segments.some((s) => s.kind === "text" && s.text.includes("Beginning"))).toBe(true);
  });

  it("splits multi-verse paragraphs when versePerLine is enabled", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\p\n\\v 1 First. \\v 2 Second.");
    const merged = ViewModels.Publication.buildPreview(document);
    const lineBlocks = merged.books[0]!.chapters[0]!.blocks.filter((b) => b.kind === "line");
    expect(lineBlocks).toHaveLength(1);

    const split = ViewModels.Publication.buildPreview(document, { versePerLine: true });
    const lines = split.books[0]!.chapters[0]!.blocks.filter((b) => b.kind === "line");
    expect(lines).toHaveLength(2);
    expect((lines[0] as PublicationViewModel.LineBlock).segments.some((s) => s.kind === "verse" && s.number === "1")).toBe(true);
    expect((lines[1] as PublicationViewModel.LineBlock).segments.some((s) => s.kind === "verse" && s.number === "2")).toBe(true);
  });
});
