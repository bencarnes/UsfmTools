import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "../src/index.js";
import { listChapterNumbersFromBook } from "../src/list-chapter-numbers-from-book.js";

function firstBook(usfm: string): BookNode {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) {
    throw new Error("Expected a book node");
  }
  return book;
}

describe("listChapterNumbersFromBook", () => {
  it("lists chapter numbers in document order without sorting or deduping", () => {
    const book = firstBook(
      "\\id PSA\n\\c 3\n\\p\n\\v 1 A\n\\c 1\n\\p\n\\v 1 B\n\\c 3\n\\p\n\\v 1 C",
    );
    expect(listChapterNumbersFromBook(book)).toEqual(["3", "1", "3"]);
  });

  it("preserves non–Western Arabic digit strings exactly", () => {
    const book = firstBook("\\id GEN\n\\c ١٢\n\\p\n\\v 1 Text\n\\c ٣\n\\p\n\\v 1 More");
    expect(listChapterNumbersFromBook(book)).toEqual(["١٢", "٣"]);
  });

  it("returns an empty array when the book has no \\c children", () => {
    const book = firstBook("\\id FRT\n\\p\n\\v 1 Front matter only.");
    expect(listChapterNumbersFromBook(book)).toEqual([]);
  });
});
