import type { ChapterMarkerInBook } from "./list-chapter-markers-in-book.js";

/** Matches a USFM chapter marker at the start of a line (`\c` or `\c 1`). */
const CHAPTER_LINE_RE = /^\s*\\c(\s|$)/;

/** Matches a USFM book-id marker at the start of a line (`\id` or `\id GEN`). */
const ID_LINE_RE = /^\s*\\id(\s|$)/;

const CHAPTER_NUMBER_RE = /^\\c\s+(\S+)/;

function chapterMarkerOnLine(line: string): { markerOffsetInLine: number; number: string } | null {
  if (!CHAPTER_LINE_RE.test(line)) return null;
  const markerOffsetInLine = line.indexOf("\\c");
  if (markerOffsetInLine < 0) return null;
  const tail = line.slice(markerOffsetInLine);
  const number = CHAPTER_NUMBER_RE.exec(tail)?.[1] ?? "";
  return { markerOffsetInLine, number };
}

/**
 * Returns the source offset of the first `\id` book marker, or `null` when the file
 * has no book-id line.
 */
export function bookIdMarkerOffsetInUsfm(usfm: string): number | null {
  let offset = 0;
  for (const line of usfm.split(/\r\n|\r|\n/)) {
    if (ID_LINE_RE.test(line)) {
      const markerOffsetInLine = line.indexOf("\\id");
      if (markerOffsetInLine >= 0) return offset + markerOffsetInLine;
    }
    offset += line.length + 1;
  }
  return null;
}

/**
 * Lists every `\c` chapter marker in the first `\id` book of {@link usfm}, in document
 * order, with the source offset where each `\c` marker begins. Scanning stops before a
 * second `\id` line. This is a lightweight alternative to `parse` + `listChapterMarkersInBook`
 * for editor tooling that only needs chapter navigation offsets.
 */
export function listChapterMarkersInUsfm(usfm: string): readonly ChapterMarkerInBook[] {
  const out: ChapterMarkerInBook[] = [];
  let offset = 0;
  let inFirstBook = false;

  for (const line of usfm.split(/\r\n|\r|\n/)) {
    if (ID_LINE_RE.test(line)) {
      if (inFirstBook) break;
      inFirstBook = true;
    }

    if (inFirstBook) {
      const chapter = chapterMarkerOnLine(line);
      if (chapter) {
        out.push({
          number: chapter.number,
          markerOffset: offset + chapter.markerOffsetInLine,
        });
      }
    }

    offset += line.length + 1;
  }

  return out;
}
