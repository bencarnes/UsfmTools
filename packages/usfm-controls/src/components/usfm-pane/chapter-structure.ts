import {
  bookIdMarkerOffsetInUsfm,
  listChapterMarkersInUsfm,
  type ChapterMarkerInBook,
} from "@usfm-tools/model";
import type { StructureResult } from "../../language-service/protocol.js";

/**
 * The chapter-navigation view of a document: the first book's `\c` markers
 * (number + source offset), where the book starts, and whether it has an
 * `\id` at all. Consumed by the pane's chapter navigator and scroll sync.
 */
export interface ChapterStructure {
  readonly markers: readonly ChapterMarkerInBook[];
  /** Source offset (UTF-16) of the `\id` marker, or 0 when there is none. */
  readonly bookStartOffset: number;
  readonly hasBookId: boolean;
}

export const EMPTY_CHAPTER_STRUCTURE: ChapterStructure = {
  markers: [],
  bookStartOffset: 0,
  hasBookId: false,
};

/**
 * Chapter structure of the first book of an engine {@link StructureResult}.
 * Preferred over {@link chapterStructureFromText}: it reuses the real parse
 * the engine already ran, off the UI thread.
 */
export function chapterStructureFromEngine(result: StructureResult): ChapterStructure {
  const book = result.books[0];
  if (!book) return EMPTY_CHAPTER_STRUCTURE;
  const markers: ChapterMarkerInBook[] = [];
  for (const chapter of book.chapters) {
    const offset = chapter.position.offset;
    if (typeof offset !== "number") continue; // defensive: engine always sets it
    markers.push({ number: chapter.number, markerOffset: offset });
  }
  return {
    markers,
    bookStartOffset: book.position.offset ?? 0,
    hasBookId: true,
  };
}

/**
 * Chapter structure via the in-process regex line scan. Fallback for when no
 * engine document is mounted (e.g. preview-only view mode); on the UI thread,
 * so avoid on the typing hot path.
 */
export function chapterStructureFromText(text: string): ChapterStructure {
  const bookOffset = bookIdMarkerOffsetInUsfm(text);
  return {
    markers: listChapterMarkersInUsfm(text),
    bookStartOffset: bookOffset ?? 0,
    hasBookId: bookOffset != null,
  };
}
