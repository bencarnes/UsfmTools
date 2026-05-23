import { describe, it, expect } from "vitest";
import {
  lastVerseNumberBeforeOffset,
  scrollSyncModeFromMarkers,
  sourceOffsetForChapterVerse,
} from "../src/components/book-edit-pane/scroll-sync.js";

describe("scrollSyncModeFromMarkers", () => {
  it("uses chapter-verse when chapter markers exist", () => {
    expect(scrollSyncModeFromMarkers(true)).toBe("chapter-verse");
  });

  it("disables sync when there are no chapter markers", () => {
    expect(scrollSyncModeFromMarkers(false)).toBe("none");
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
