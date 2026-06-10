import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parse } from "@usfm-tools/parser";
import type { BookNode } from "@usfm-tools/parser";
import {
  chapterNumberAtOrBeforeSourceOffset,
  listChapterMarkersInBook,
} from "../src/list-chapter-markers-in-book.js";

function firstBook(usfm: string): BookNode {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) throw new Error("Expected book");
  return book;
}

describe("listChapterMarkersInBook", () => {
  it("returns marker offsets in document order", () => {
    const book = firstBook("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
    const markers = listChapterMarkersInBook(book);
    expect(markers.map((m) => m.number)).toEqual(["10", "2"]);
    expect(markers[0]!.markerOffset).toBeLessThan(markers[1]!.markerOffset);
  });

  it("returns an empty list when there are no chapters", () => {
    const book = firstBook("\\id FRT\n\\p\n\\v 1 Only.");
    expect(listChapterMarkersInBook(book)).toEqual([]);
  });
});

describe("chapterNumberAtOrBeforeSourceOffset", () => {
  it("returns null before any chapter marker", () => {
    const book = firstBook("\\id GEN\n\\mt Genesis\n\\c 1\n\\p\n\\v 1");
    const markers = listChapterMarkersInBook(book);
    expect(chapterNumberAtOrBeforeSourceOffset(markers, 0)).toBeNull();
    expect(chapterNumberAtOrBeforeSourceOffset(markers, markers[0]!.markerOffset - 1)).toBeNull();
  });

  it("returns the chapter active at a source offset", () => {
    const book = firstBook("\\id GEN\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
    const markers = listChapterMarkersInBook(book);
    const c2 = markers.find((m) => m.number === "2")!;
    expect(chapterNumberAtOrBeforeSourceOffset(markers, c2.markerOffset)).toBe("2");
    expect(chapterNumberAtOrBeforeSourceOffset(markers, c2.markerOffset + 500)).toBe("2");
    expect(chapterNumberAtOrBeforeSourceOffset(markers, markers[0]!.markerOffset)).toBe("1");
  });
});
