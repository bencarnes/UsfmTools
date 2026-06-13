import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parse } from "@usfm-tools/parser";
import type { BookNode } from "@usfm-tools/parser";
import { listChapterMarkersInBook } from "../src/list-chapter-markers-in-book.js";
import {
  bookIdMarkerOffsetInUsfm,
  listChapterMarkersInUsfm,
} from "../src/list-chapter-markers-in-usfm.js";

function markersFromParse(usfm: string): readonly ReturnType<typeof listChapterMarkersInBook>[number][] {
  const { document } = parse(usfm);
  const book = document.children.find((c) => c.type === "book") as BookNode | undefined;
  if (!book) return [];
  return listChapterMarkersInBook(book);
}

function expectScanMatchesParse(usfm: string): void {
  expect(listChapterMarkersInUsfm(usfm)).toEqual(markersFromParse(usfm));
}

describe("listChapterMarkersInUsfm", () => {
  it("matches parse() for multi-chapter books", () => {
    expectScanMatchesParse("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
  });

  it("matches parse() when there are no chapters", () => {
    expectScanMatchesParse("\\id FRT\n\\p\n\\v 1 Only.");
  });

  it("matches parse() for front matter before the first chapter", () => {
    expectScanMatchesParse("\\id GEN\n\\mt Genesis\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
  });

  it("matches parse() for Arabic-Indic chapter numbers", () => {
    expectScanMatchesParse("\\id GEN\n\\c ١٢\n\\p\n\\v 1 Text\n\\c ٣\n\\p\n\\v 1 More");
  });

  it("stops at a second \\id marker", () => {
    const usfm = "\\id GEN\n\\c 1\n\\p\n\\id EXO\n\\c 2\n\\p\n";
    expectScanMatchesParse(usfm);
  });

  it("returns an empty list when there is no \\id book", () => {
    expect(listChapterMarkersInUsfm("\\c 1\n\\p\n\\v 1")).toEqual([]);
  });

  it("matches parse() with CRLF line endings", () => {
    expectScanMatchesParse("\\id GEN\r\n\\mt Genesis\r\n\\c 1\r\n\\p\r\n\\v 1\r\n\\c 2\r\n\\p\r\n");
  });

  it("matches parse() for Berean Psalms", async () => {
    const psaPath = new URL("../../../bibles/bsb/usfm/PSA.usfm", import.meta.url);
    const usfm = await Deno.readTextFile(psaPath);
    expectScanMatchesParse(usfm);
  });
});

describe("bookIdMarkerOffsetInUsfm", () => {
  it("returns the offset of the first \\id marker", () => {
    const usfm = "\\mt Genesis\n\\id GEN\n\\c 1\n";
    const { document } = parse(usfm);
    const book = document.children.find((c) => c.type === "book");
    expect(bookIdMarkerOffsetInUsfm(usfm)).toBe(book?.position?.offset ?? null);
  });

  it("returns null when there is no \\id marker", () => {
    expect(bookIdMarkerOffsetInUsfm("\\c 1\n\\p\n")).toBeNull();
  });
});
