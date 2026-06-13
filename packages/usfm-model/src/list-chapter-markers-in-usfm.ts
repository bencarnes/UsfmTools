import type { ChapterMarkerInBook } from "./list-chapter-markers-in-book.js";

/** Matches a USFM chapter marker at the start of a line (`\c` or `\c 1`). */
const CHAPTER_LINE_RE = /^\s*\\c(\s|$)/;

/** Matches a USFM book-id marker at the start of a line (`\id` or `\id GEN`). */
const ID_LINE_RE = /^\s*\\id(\s|$)/;

const CHAPTER_NUMBER_RE = /^\\c\s+(\S+)/;

interface LineAtOffset {
  readonly line: string;
  readonly start: number;
}

function* linesWithOffsets(usfm: string): Generator<LineAtOffset> {
  let start = 0;
  for (let i = 0; i < usfm.length; i++) {
    const ch = usfm[i];
    if (ch !== "\n" && ch !== "\r") continue;
    yield { line: usfm.slice(start, i), start };
    const newlineLength = ch === "\r" && usfm[i + 1] === "\n" ? 2 : 1;
    i += newlineLength - 1;
    start = i + 1;
  }
  if (start < usfm.length) {
    yield { line: usfm.slice(start), start };
  }
}

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
  for (const { line, start } of linesWithOffsets(usfm)) {
    if (!ID_LINE_RE.test(line)) continue;
    const markerOffsetInLine = line.indexOf("\\id");
    if (markerOffsetInLine >= 0) return start + markerOffsetInLine;
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
  let inFirstBook = false;

  for (const { line, start } of linesWithOffsets(usfm)) {
    if (ID_LINE_RE.test(line)) {
      if (inFirstBook) break;
      inFirstBook = true;
    }

    if (!inFirstBook) continue;

    const chapter = chapterMarkerOnLine(line);
    if (!chapter) continue;
    out.push({
      number: chapter.number,
      markerOffset: start + chapter.markerOffsetInLine,
    });
  }

  return out;
}
