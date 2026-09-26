/**
 * @usfm-tools/model
 *
 * Application-level model for USFM scripture data: standard book identifier
 * metadata, lightweight text scans (book code, picker header, chapter
 * markers), and file-picker grouping. Parsing, diagnostics and preview
 * rendering live in the Go engine (`usfm-parser-go`).
 *
 * This package is a work in progress. APIs will be added as needs arise.
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

export { buildUsfmFilePickerGroups } from "./book-identifiers/usfm-file-picker-model.js";
export type {
  UsfmFilePickerCanonGroup,
  UsfmFilePickerFileInput,
  UsfmFilePickerFile,
  UsfmFilePickerGroups,
} from "./book-identifiers/usfm-file-picker-model.js";

export {
  bookIdMarkerOffsetInUsfm,
  chapterNumberAtOrBeforeSourceOffset,
  listChapterMarkersInUsfm,
} from "./list-chapter-markers-in-usfm.js";
export type { ChapterMarkerInBook } from "./list-chapter-markers-in-usfm.js";
