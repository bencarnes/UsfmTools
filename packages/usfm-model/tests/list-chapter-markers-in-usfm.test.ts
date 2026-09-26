import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  bookIdMarkerOffsetInUsfm,
  chapterNumberAtOrBeforeSourceOffset,
  listChapterMarkersInUsfm,
} from "../src/list-chapter-markers-in-usfm.js";

describe("listChapterMarkersInUsfm", () => {
  it("lists multi-chapter books in document order", () => {
    expect(listChapterMarkersInUsfm("\\id PSA\n\\c 10\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1")).toEqual([
      { number: "10", markerOffset: 8 },
      { number: "2", markerOffset: 22 },
    ]);
  });

  it("returns an empty list when there are no chapters", () => {
    expect(listChapterMarkersInUsfm("\\id FRT\n\\p\n\\v 1 Only.")).toEqual([]);
  });

  it("skips front matter before the first chapter", () => {
    expect(
      listChapterMarkersInUsfm("\\id GEN\n\\mt Genesis\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1"),
    ).toEqual([
      { number: "1", markerOffset: 20 },
      { number: "2", markerOffset: 33 },
    ]);
  });

  it("keeps Arabic-Indic chapter numbers verbatim", () => {
    expect(
      listChapterMarkersInUsfm("\\id GEN\n\\c ١٢\n\\p\n\\v 1 Text\n\\c ٣\n\\p\n\\v 1 More"),
    ).toEqual([
      { number: "١٢", markerOffset: 8 },
      { number: "٣", markerOffset: 27 },
    ]);
  });

  it("stops at a second \\id marker", () => {
    expect(listChapterMarkersInUsfm("\\id GEN\n\\c 1\n\\p\n\\id EXO\n\\c 2\n\\p\n")).toEqual([
      { number: "1", markerOffset: 8 },
    ]);
  });

  it("returns an empty list when there is no \\id book", () => {
    expect(listChapterMarkersInUsfm("\\c 1\n\\p\n\\v 1")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    expect(
      listChapterMarkersInUsfm("\\id GEN\r\n\\mt Genesis\r\n\\c 1\r\n\\p\r\n\\v 1\r\n\\c 2\r\n\\p\r\n"),
    ).toEqual([
      { number: "1", markerOffset: 22 },
      { number: "2", markerOffset: 38 },
    ]);
  });

  it("finds every chapter of Berean Psalms", async () => {
    const psaPath = new URL("../../../bibles/bsb/usfm/PSA.usfm", import.meta.url);
    const usfm = await Deno.readTextFile(psaPath);
    const markers = listChapterMarkersInUsfm(usfm);
    expect(markers.map((m) => m.number)).toEqual(
      Array.from({ length: 150 }, (_, i) => String(i + 1)),
    );
    for (const m of markers) {
      expect(usfm.slice(m.markerOffset, m.markerOffset + 3)).toBe("\\c ");
    }
  });
});

describe("bookIdMarkerOffsetInUsfm", () => {
  it("returns the offset of the first \\id marker", () => {
    expect(bookIdMarkerOffsetInUsfm("\\mt Genesis\n\\id GEN\n\\c 1\n")).toBe(12);
  });

  it("returns null when there is no \\id marker", () => {
    expect(bookIdMarkerOffsetInUsfm("\\c 1\n\\p\n")).toBeNull();
  });
});

describe("chapterNumberAtOrBeforeSourceOffset", () => {
  it("returns null before any chapter marker", () => {
    const markers = listChapterMarkersInUsfm("\\id GEN\n\\mt Genesis\n\\c 1\n\\p\n\\v 1");
    expect(chapterNumberAtOrBeforeSourceOffset(markers, 0)).toBeNull();
    expect(chapterNumberAtOrBeforeSourceOffset(markers, markers[0]!.markerOffset - 1)).toBeNull();
  });

  it("returns the chapter active at a source offset", () => {
    const markers = listChapterMarkersInUsfm("\\id GEN\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
    const c2 = markers.find((m) => m.number === "2")!;
    expect(chapterNumberAtOrBeforeSourceOffset(markers, c2.markerOffset)).toBe("2");
    expect(chapterNumberAtOrBeforeSourceOffset(markers, c2.markerOffset + 500)).toBe("2");
    expect(chapterNumberAtOrBeforeSourceOffset(markers, markers[0]!.markerOffset)).toBe("1");
  });
});
