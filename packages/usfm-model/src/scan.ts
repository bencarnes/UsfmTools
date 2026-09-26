/**
 * @usfm-tools/model/scan
 *
 * The parser-free part of the model: standard book identifier metadata, text
 * scans (book code, picker header, chapter markers), file-picker grouping,
 * and helpers over already-parsed book nodes. Nothing here imports
 * `@usfm-tools/parser` at runtime, so consumers that must not bundle the TS
 * parser (the bible-edit app via `@usfm-tools/controls`) import from this
 * entry point instead of the package root.
 */

export {
  STANDARD_USFM_BOOK_IDENTIFIERS,
  normalizeUsfmBookCode,
  isStandardUsfmBookIdentifier,
  getStandardUsfmBookOrderIndex,
  getStandardUsfmBookIdentifier,
} from "./book-identifiers/standard-book-identifiers.js";
export type {
  StandardBookIdentifier,
  StandardBookCanonGroup,
} from "./book-identifiers/standard-book-identifiers.js";

export { scanUsfmBookCode } from "./book-identifiers/usfm-book-code-scan.js";
export {
  scanUsfmPickerHeader,
  scanUsfmPickerHeaderFromText,
} from "./book-identifiers/usfm-picker-header-scan.js";
export type {
  UsfmPickerHeaderScanResult,
  UsfmPickerHeaderScanState,
} from "./book-identifiers/usfm-picker-header-scan.js";

export type {
  UsfmBookPickerCanonGroup,
  UsfmBookPickerFileInput,
  UsfmBookPickerBook,
  UsfmBookPickerGroups,
} from "./book-identifiers/usfm-book-picker-model.js";
export { buildUsfmFilePickerGroups } from "./book-identifiers/usfm-file-picker-model.js";
export type {
  UsfmFilePickerFileInput,
  UsfmFilePickerFile,
  UsfmFilePickerGroups,
} from "./book-identifiers/usfm-file-picker-model.js";

export { listChapterNumbersFromBook } from "./list-chapter-numbers-from-book.js";
export {
  listChapterMarkersInBook,
  chapterNumberAtOrBeforeSourceOffset,
} from "./list-chapter-markers-in-book.js";
export type { ChapterMarkerInBook } from "./list-chapter-markers-in-book.js";
export {
  bookIdMarkerOffsetInUsfm,
  listChapterMarkersInUsfm,
} from "./list-chapter-markers-in-usfm.js";
