/**
 * @usfm-tools/model
 *
 * Application-level model for USFM scripture data.
 * Built on top of @usfm-tools/parser, this package provides higher-level
 * abstractions for working with parsed USFM content — including indexing,
 * querying, and facilities for rendering to a UI.
 *
 * This package is a work in progress. APIs will be added as needs arise.
 */

export { parse } from "@usfm-tools/parser";
export type { ParseResult, DocumentNode } from "@usfm-tools/parser";

export { PublicationViewModel } from "./view-models/publication-preview.js";
import { PublicationViewModel } from "./view-models/publication-preview.js";

/**
 * Container for view-model namespaces. {@link PublicationViewModel} is the first;
 * additional domains can be hung here as the package grows.
 */
export const ViewModels = {
  Publication: PublicationViewModel,
} as const;

export { renderPreviewHtml } from "./renderer/index.js";
export type { RenderPreviewOptions } from "./renderer/index.js";

export {
  STANDARD_USFM_BOOK_IDENTIFIERS,
  normalizeUsfmBookCode,
  isStandardUsfmBookIdentifier,
  getStandardUsfmBookOrderIndex,
  getStandardUsfmBookIdentifier,
  buildUsfmBookPickerGroups,
  buildUsfmFilePickerGroups,
} from "./book-identifiers/index.js";
export type {
  StandardBookIdentifier,
  StandardBookCanonGroup,
  UsfmBookPickerCanonGroup,
  UsfmBookPickerFileInput,
  UsfmBookPickerBook,
  UsfmBookPickerGroups,
  UsfmFilePickerFileInput,
  UsfmFilePickerFile,
  UsfmFilePickerGroups,
} from "./book-identifiers/index.js";

export { listChapterNumbersFromBook } from "./list-chapter-numbers-from-book.js";
export {
  listChapterMarkersInBook,
  chapterNumberAtOrBeforeSourceOffset,
} from "./list-chapter-markers-in-book.js";
export type { ChapterMarkerInBook } from "./list-chapter-markers-in-book.js";
