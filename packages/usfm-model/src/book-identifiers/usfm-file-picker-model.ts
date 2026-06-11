import {
  buildUsfmBookPickerGroups,
  type UsfmBookPickerBook,
  type UsfmBookPickerGroups,
} from "./usfm-book-picker-model.js";

export interface UsfmFilePickerFileInput {
  /** Stable id for the file (e.g. path or key); not read from USFM. */
  readonly id: string;
  /** Display name (typically the file basename). */
  readonly name: string;
  readonly usfm: string;
}

/** Same grouping as the book picker; {@link UsfmFilePickerFile.displayLabel} is the file name. */
export type UsfmFilePickerFile = UsfmBookPickerBook;

export type UsfmFilePickerGroups = UsfmBookPickerGroups;

function fileNameFor(
  fileId: string,
  nameById: ReadonlyMap<string, string>,
): string {
  return nameById.get(fileId) ?? fileId;
}

function withFileNames(
  books: readonly UsfmBookPickerBook[],
  nameById: ReadonlyMap<string, string>,
): UsfmFilePickerFile[] {
  return books.map((book) => ({
    ...book,
    displayLabel: fileNameFor(book.fileId, nameById),
  }));
}

function compareFilePickerRows(
  a: UsfmFilePickerFile,
  b: UsfmFilePickerFile,
  nameById: ReadonlyMap<string, string>,
): number {
  const byTable = a.sortIndex - b.sortIndex;
  if (byTable !== 0) return byTable;

  return fileNameFor(a.fileId, nameById).localeCompare(
    fileNameFor(b.fileId, nameById),
    undefined,
    { sensitivity: "base" },
  );
}

function sortFilePickerGroup(
  books: readonly UsfmFilePickerFile[],
  nameById: ReadonlyMap<string, string>,
): UsfmFilePickerFile[] {
  return [...books].sort((a, b) => compareFilePickerRows(a, b, nameById));
}

/**
 * Parses each file's USFM and groups files for the USFM file picker control.
 * Standard `\\id` codes are split into Old Testament, New Testament, and other;
 * non-standard rows include unknown `\\id` codes, an empty/missing `\\id` line on
 * the first book, or **no** `\\id` at all (non-empty USFM).
 * Labels are always the supplied {@link UsfmFilePickerFileInput.name} — table-of-contents
 * markers are not used. Multiple files with the same standard `\\id` (for example two
 * `GEN.usfm` copies) each appear as separate rows, ordered by the book table, then file
 * name when the table index ties. Files without `\\toc3` (or any `\\toc`) are grouped
 * from `\\id` alone.
 */
export function buildUsfmFilePickerGroups(
  files: readonly UsfmFilePickerFileInput[],
): UsfmFilePickerGroups {
  const nameById = new Map(files.map((f) => [f.id, f.name] as const));
  const groups = buildUsfmBookPickerGroups(
    files.map((f) => ({ id: f.id, usfm: f.usfm })),
  );

  const finalize = (books: readonly UsfmBookPickerBook[]) =>
    sortFilePickerGroup(withFileNames(books, nameById), nameById);

  return {
    oldTestament: finalize(groups.oldTestament),
    newTestament: finalize(groups.newTestament),
    other: finalize(groups.other),
    nonStandard: finalize(groups.nonStandard),
  };
}
