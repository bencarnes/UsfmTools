import { describe, it, expect } from "vitest";
import {
  lastVerseNumberBeforeOffset,
  listParagraphMarkerOffsetsInRange,
  paragraphIndexAtSourceOffset,
  scrollSyncModeFromMarkers,
  sourceOffsetForChapterVerse,
  sourceOffsetForParagraphIndex,
} from "../src/components/book-edit-pane/scroll-sync.js";

describe("scrollSyncModeFromMarkers", () => {
  it("uses chapter-verse when chapter markers exist", () => {
    expect(scrollSyncModeFromMarkers(true, "\\p\n\\v 1")).toBe("chapter-verse");
  });

  it("uses paragraph mode when there are no chapters but there are \\p and \\v markers", () => {
    expect(scrollSyncModeFromMarkers(false, "\\p\n\\v 1")).toBe("paragraph");
  });

  it("disables sync when there are no chapters and no verse markers (even with \\p)", () => {
    expect(scrollSyncModeFromMarkers(false, "\\p\nHello")).toBe("none");
  });

  it("disables sync when there are no chapters and no \\p markers", () => {
    expect(scrollSyncModeFromMarkers(false, "\\q1\n\\v 1 only")).toBe("none");
  });
});

describe("paragraphIndexAtSourceOffset", () => {
  const src = "\\id X\n\\p\n\\v 1 A\n\\p\n\\v 2 B";

  it("returns 0 before the second \\p", () => {
    const p1 = listParagraphMarkerOffsetsInRange(src, 0, src.length)[0]!;
    const p2 = listParagraphMarkerOffsetsInRange(src, 0, src.length)[1]!;
    expect(paragraphIndexAtSourceOffset(src, 0, p1)).toBe(0);
    expect(paragraphIndexAtSourceOffset(src, 0, p1 + 5)).toBe(0);
    expect(paragraphIndexAtSourceOffset(src, 0, p2)).toBe(1);
  });
});

describe("lastVerseNumberBeforeOffset", () => {
  it("returns the last verse token as a string (no numeric parsing)", () => {
    const s = "\\c 1\n\\p\n\\v ١٢ text \\v ٣ more";
    expect(lastVerseNumberBeforeOffset(s, 0, s.length)).toBe("٣");
  });
});

describe("sourceOffsetForChapterVerse", () => {
  it("returns the chapter marker offset when verse is null", () => {
    const markers = [{ number: "1", markerOffset: 10 }] as const;
    const doc = "0123456789\\c 1\n\\p\n\\v 9";
    expect(sourceOffsetForChapterVerse(doc, markers, 10, null)).toBe(10);
  });

  it("returns the offset of a verse marker by verbatim number match", () => {
    const text = "\\c 1\n\\p\n\\v ٥ text";
    const markers = [{ number: "1", markerOffset: 0 }] as const;
    const off = sourceOffsetForChapterVerse(text, markers, 0, "٥");
    expect(off).not.toBeNull();
    expect(text.slice(off!, off! + 2)).toBe("\\v");
  });
});

describe("sourceOffsetForParagraphIndex", () => {
  it("returns the offset of the nth \\p marker", () => {
    const text = "\\id G\n\\p\n\\v 1\n\\p\n\\v 2";
    const offs = listParagraphMarkerOffsetsInRange(text, 0, text.length);
    expect(sourceOffsetForParagraphIndex(text, 0, 0)).toBe(offs[0]);
    expect(sourceOffsetForParagraphIndex(text, 0, 1)).toBe(offs[1]);
  });
});
