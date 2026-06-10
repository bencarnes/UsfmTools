
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  indexOfLastChapterMarkerAtOrBefore,
  markerOffsetForChapterNumber,
} from "../src/components/usfm-pane/chapter-offset-helpers.js";

describe("chapter-offset-helpers", () => {
  const markers = [
    { number: "1", markerOffset: 10 },
    { number: "2", markerOffset: 50 },
  ] as const;

  it("indexOfLastChapterMarkerAtOrBefore returns -1 before the first marker", () => {
    expect(indexOfLastChapterMarkerAtOrBefore(markers, 0)).toBe(-1);
    expect(indexOfLastChapterMarkerAtOrBefore(markers, 9)).toBe(-1);
  });

  it("indexOfLastChapterMarkerAtOrBefore tracks the active marker by offset", () => {
    expect(indexOfLastChapterMarkerAtOrBefore(markers, 10)).toBe(0);
    expect(indexOfLastChapterMarkerAtOrBefore(markers, 49)).toBe(0);
    expect(indexOfLastChapterMarkerAtOrBefore(markers, 50)).toBe(1);
  });

  it("markerOffsetForChapterNumber picks the first matching chapter number", () => {
    expect(markerOffsetForChapterNumber(markers, "2")).toBe(50);
    expect(markerOffsetForChapterNumber(markers, null)).toBe(10);
  });
});
