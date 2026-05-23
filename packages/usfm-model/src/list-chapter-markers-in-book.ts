import type { BookNode, ChapterNode } from "@usfm-tools/parser";

/**
 * One `\\c` chapter marker on a book, with the source offset of the marker token
 * (the position of `\\c` in the file — same as {@link ChapterNode.position.offset}
 * when the parser attached positions).
 */
export interface ChapterMarkerInBook {
  readonly number: string;
  /** Byte offset in the USFM source where the `\\c` marker begins. */
  readonly markerOffset: number;
}

/**
 * Lists every chapter marker on {@link book} in document order with its source
 * offset. Chapters without a {@link ChapterNode.position} are skipped (defensive).
 */
export function listChapterMarkersInBook(book: BookNode): readonly ChapterMarkerInBook[] {
  const out: ChapterMarkerInBook[] = [];
  for (const child of book.children) {
    if (child.type !== "chapter") continue;
    const ch = child as ChapterNode;
    const off = ch.position?.offset;
    if (typeof off !== "number") continue;
    out.push({ number: ch.number, markerOffset: off });
  }
  return out;
}

/**
 * Returns the chapter number for the last `\\c` marker whose {@link ChapterMarkerInBook.markerOffset}
 * is still at or before {@link sourceOffset}, or `null` when there is no such marker
 * (for example, the viewport is entirely before the first `\\c`, or the book has no chapters).
 */
export function chapterNumberAtOrBeforeSourceOffset(
  markers: readonly ChapterMarkerInBook[],
  sourceOffset: number,
): string | null {
  let best: string | null = null;
  for (const m of markers) {
    if (m.markerOffset <= sourceOffset) best = m.number;
  }
  return best;
}
