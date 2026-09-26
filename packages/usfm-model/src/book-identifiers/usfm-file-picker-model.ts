import type { UsfmBookPickerBook, UsfmBookPickerGroups } from "./usfm-book-picker-model.js";
import { scanUsfmBookCode } from "./usfm-book-code-scan.js";
import {
  getStandardUsfmBookIdentifier,
  getStandardUsfmBookOrderIndex,
  isStandardUsfmBookIdentifier,
  normalizeUsfmBookCode,
} from "./standard-book-identifiers.js";

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

function compareFilePickerRows(a: UsfmFilePickerFile, b: UsfmFilePickerFile): number {
  const byTable = a.sortIndex - b.sortIndex;
  if (byTable !== 0) return byTable;

  return a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: "base" });
}

/**
 * Groups files for the USFM file picker control by each file's `\\id` code
 * (read with a parser-free scan, so the app's file browser never loads the
 * TS parser). Standard `\\id` codes are split into Old Testament, New
 * Testament, and other; non-standard rows include unknown `\\id` codes, an
 * empty `\\id` line, or **no** `\\id` at all (non-empty USFM).
 * Labels are always the supplied {@link UsfmFilePickerFileInput.name} — table-of-contents
 * markers are not used. Multiple files with the same standard `\\id` (for example two
 * `GEN.usfm` copies) each appear as separate rows, ordered by the book table, then file
 * name when the table index ties. Groups match {@link buildUsfmBookPickerGroups} apart
 * from labels and ordering.
 */
export function buildUsfmFilePickerGroups(
  files: readonly UsfmFilePickerFileInput[],
): UsfmFilePickerGroups {
  const oldTestament: UsfmFilePickerFile[] = [];
  const newTestament: UsfmFilePickerFile[] = [];
  const other: UsfmFilePickerFile[] = [];
  const nonStandard: UsfmFilePickerFile[] = [];

  for (const file of files) {
    if (!file.usfm.trim()) continue;

    const code = normalizeUsfmBookCode(scanUsfmBookCode(file.usfm) ?? "");
    const meta = code && isStandardUsfmBookIdentifier(code)
      ? getStandardUsfmBookIdentifier(code)
      : undefined;
    const order = meta ? getStandardUsfmBookOrderIndex(code) : undefined;
    if (!meta || order === undefined) {
      nonStandard.push({
        fileId: file.id,
        code,
        displayLabel: file.name,
        canonGroup: "nonStandard",
        sortIndex: 0,
      });
      continue;
    }

    const row: UsfmFilePickerFile = {
      fileId: file.id,
      code: meta.code,
      displayLabel: file.name,
      canonGroup: meta.canonGroup,
      sortIndex: order,
    };
    if (meta.canonGroup === "ot") oldTestament.push(row);
    else if (meta.canonGroup === "nt") newTestament.push(row);
    else other.push(row);
  }

  return {
    oldTestament: oldTestament.sort(compareFilePickerRows),
    newTestament: newTestament.sort(compareFilePickerRows),
    other: other.sort(compareFilePickerRows),
    nonStandard: nonStandard.sort(compareFilePickerRows),
  };
}
