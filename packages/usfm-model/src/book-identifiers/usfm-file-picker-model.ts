import { scanUsfmBookCode } from "./usfm-book-code-scan.js";
import {
  getStandardUsfmBookIdentifier,
  getStandardUsfmBookOrderIndex,
  isStandardUsfmBookIdentifier,
  normalizeUsfmBookCode,
  type StandardBookCanonGroup,
} from "./standard-book-identifiers.js";

export type UsfmFilePickerCanonGroup = StandardBookCanonGroup | "nonStandard";

export interface UsfmFilePickerFileInput {
  /** Stable id for the file (e.g. path or key); not read from USFM. */
  readonly id: string;
  /** Display name (typically the file basename). */
  readonly name: string;
  readonly usfm: string;
}

export interface UsfmFilePickerFile {
  readonly fileId: string;
  /**
   * Identifier code from the first `\\id` line (uppercase first token), or an empty string
   * when the file has no `\\id` or the `\\id` line has no code token.
   */
  readonly code: string;
  /** The file name ({@link UsfmFilePickerFileInput.name}). */
  readonly displayLabel: string;
  readonly canonGroup: UsfmFilePickerCanonGroup;
  /**
   * For standard books: index in the official USFM book table (sorting).
   * For non-standard files: unused.
   */
  readonly sortIndex: number;
}

export interface UsfmFilePickerGroups {
  readonly oldTestament: readonly UsfmFilePickerFile[];
  readonly newTestament: readonly UsfmFilePickerFile[];
  /** Standard identifiers outside Old/New Testament (peripherals, deuterocanon, etc.). */
  readonly other: readonly UsfmFilePickerFile[];
  /**
   * Non-standard entries: a non-empty `\\id` code not in the USFM standard list, **or**
   * a missing/empty `\\id` (non-empty USFM with no book code).
   */
  readonly nonStandard: readonly UsfmFilePickerFile[];
}

function compareFilePickerRows(a: UsfmFilePickerFile, b: UsfmFilePickerFile): number {
  const byTable = a.sortIndex - b.sortIndex;
  if (byTable !== 0) return byTable;

  return a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: "base" });
}

/**
 * Groups files for the USFM file picker control by each file's `\\id` code
 * (read with a lightweight text scan). Standard `\\id` codes are split into
 * Old Testament, New Testament, and other; non-standard rows include unknown `\\id` codes, an
 * empty `\\id` line, or **no** `\\id` at all (non-empty USFM).
 * Labels are always the supplied {@link UsfmFilePickerFileInput.name} — table-of-contents
 * markers are not used. Multiple files with the same standard `\\id` (for example two
 * `GEN.usfm` copies) each appear as separate rows, ordered by the book table, then file
 * name when the table index ties.
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
