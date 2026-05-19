import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";
import { ViewModels } from "../src/index.js";

describe("ViewModels.Publication", () => {
  it("builds preview with chapter and verse", () => {
    const { document } = parse("\\id GEN Test\n\\c 1\n\\p\n\\v 1 Hello world.");
    const preview = ViewModels.Publication.buildPreview(document);
    expect(preview.books).toHaveLength(1);
    expect(preview.books[0]!.code).toBe("GEN");
    expect(preview.books[0]!.chapters).toHaveLength(1);
    const ch = preview.books[0]!.chapters[0]!;
    expect(ch.number).toBe("1");
    const line = ch.blocks.find((b) => b.kind === "line") as ViewModels.Publication.LineBlock;
    expect(line).toBeDefined();
    expect(line.segments.some((s) => s.kind === "verse" && s.number === "1")).toBe(true);
    expect(line.segments.some((s) => s.kind === "text" && s.text.includes("Hello"))).toBe(true);
  });

  it("classifies poetry markers", () => {
    const { document } = parse("\\id PSA\n\\c 1\n\\q1 \\v 1 Line one\n\\q2 second.");
    const preview = ViewModels.Publication.buildPreview(document);
    const line = preview.books[0]!.chapters[0]!.blocks.find(
      (b) => b.kind === "line" && b.marker === "q1",
    ) as ViewModels.Publication.LineBlock;
    expect(line.flow).toBe("poetry");
  });

  it("emits heading blocks for section markers", () => {
    const { document } = parse("\\id GEN\n\\c 1\n\\s1 The Beginning\n\\p\n\\v 1 Text.");
    const preview = ViewModels.Publication.buildPreview(document);
    const h = preview.books[0]!.chapters[0]!.blocks.find((b) => b.kind === "heading") as ViewModels.Publication.HeadingBlock;
    expect(h.marker).toBe("s1");
    expect(h.segments.some((s) => s.kind === "text" && s.text.includes("Beginning"))).toBe(true);
  });
});
