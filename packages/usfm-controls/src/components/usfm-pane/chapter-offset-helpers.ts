import type { ChapterMarkerInBook } from "@usfm-tools/model";

/** Index of the last marker with `markerOffset <= sourceOffset`, or `-1`. */
export function indexOfLastChapterMarkerAtOrBefore(
  markers: readonly ChapterMarkerInBook[],
  sourceOffset: number,
): number {
  let idx = -1;
  for (let i = 0; i < markers.length; i++) {
    if (markers[i]!.markerOffset <= sourceOffset) idx = i;
  }
  return idx;
}

export function markerOffsetForChapterNumber(
  markers: readonly ChapterMarkerInBook[],
  chapterNumber: string | null,
): number | null {
  if (markers.length === 0) return null;
  if (!chapterNumber) return markers[0]!.markerOffset;
  const hit = markers.find((m) => m.number === chapterNumber);
  return hit?.markerOffset ?? null;
}
