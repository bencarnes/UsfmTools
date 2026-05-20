/**
 * Standard USFM 3.x book identifiers after `\id`, ordered as in the official table
 * (Number column / publication order).
 *
 * @see https://ubsicap.github.io/usfm/identification/books.html
 */

export type StandardBookCanonGroup = "ot" | "nt" | "other";

export interface StandardBookIdentifier {
  /** Three-character (or digit-prefixed) identifier code, uppercase. */
  readonly code: string;
  /** Number label from the USFM book table (e.g. "01", "41", "A4", "94"). */
  readonly number: string;
  /** Old Testament (01–39), New Testament (41–67), or any other standard identifier. */
  readonly canonGroup: StandardBookCanonGroup;
}

/**
 * All standard identifiers in USFM table order (used for picker sorting).
 */
export const STANDARD_USFM_BOOK_IDENTIFIERS: readonly StandardBookIdentifier[] = [
  { code: "GEN", number: "01", canonGroup: "ot" },
  { code: "EXO", number: "02", canonGroup: "ot" },
  { code: "LEV", number: "03", canonGroup: "ot" },
  { code: "NUM", number: "04", canonGroup: "ot" },
  { code: "DEU", number: "05", canonGroup: "ot" },
  { code: "JOS", number: "06", canonGroup: "ot" },
  { code: "JDG", number: "07", canonGroup: "ot" },
  { code: "RUT", number: "08", canonGroup: "ot" },
  { code: "1SA", number: "09", canonGroup: "ot" },
  { code: "2SA", number: "10", canonGroup: "ot" },
  { code: "1KI", number: "11", canonGroup: "ot" },
  { code: "2KI", number: "12", canonGroup: "ot" },
  { code: "1CH", number: "13", canonGroup: "ot" },
  { code: "2CH", number: "14", canonGroup: "ot" },
  { code: "EZR", number: "15", canonGroup: "ot" },
  { code: "NEH", number: "16", canonGroup: "ot" },
  { code: "EST", number: "17", canonGroup: "ot" },
  { code: "JOB", number: "18", canonGroup: "ot" },
  { code: "PSA", number: "19", canonGroup: "ot" },
  { code: "PRO", number: "20", canonGroup: "ot" },
  { code: "ECC", number: "21", canonGroup: "ot" },
  { code: "SNG", number: "22", canonGroup: "ot" },
  { code: "ISA", number: "23", canonGroup: "ot" },
  { code: "JER", number: "24", canonGroup: "ot" },
  { code: "LAM", number: "25", canonGroup: "ot" },
  { code: "EZK", number: "26", canonGroup: "ot" },
  { code: "DAN", number: "27", canonGroup: "ot" },
  { code: "HOS", number: "28", canonGroup: "ot" },
  { code: "JOL", number: "29", canonGroup: "ot" },
  { code: "AMO", number: "30", canonGroup: "ot" },
  { code: "OBA", number: "31", canonGroup: "ot" },
  { code: "JON", number: "32", canonGroup: "ot" },
  { code: "MIC", number: "33", canonGroup: "ot" },
  { code: "NAM", number: "34", canonGroup: "ot" },
  { code: "HAB", number: "35", canonGroup: "ot" },
  { code: "ZEP", number: "36", canonGroup: "ot" },
  { code: "HAG", number: "37", canonGroup: "ot" },
  { code: "ZEC", number: "38", canonGroup: "ot" },
  { code: "MAL", number: "39", canonGroup: "ot" },
  { code: "MAT", number: "41", canonGroup: "nt" },
  { code: "MRK", number: "42", canonGroup: "nt" },
  { code: "LUK", number: "43", canonGroup: "nt" },
  { code: "JHN", number: "44", canonGroup: "nt" },
  { code: "ACT", number: "45", canonGroup: "nt" },
  { code: "ROM", number: "46", canonGroup: "nt" },
  { code: "1CO", number: "47", canonGroup: "nt" },
  { code: "2CO", number: "48", canonGroup: "nt" },
  { code: "GAL", number: "49", canonGroup: "nt" },
  { code: "EPH", number: "50", canonGroup: "nt" },
  { code: "PHP", number: "51", canonGroup: "nt" },
  { code: "COL", number: "52", canonGroup: "nt" },
  { code: "1TH", number: "53", canonGroup: "nt" },
  { code: "2TH", number: "54", canonGroup: "nt" },
  { code: "1TI", number: "55", canonGroup: "nt" },
  { code: "2TI", number: "56", canonGroup: "nt" },
  { code: "TIT", number: "57", canonGroup: "nt" },
  { code: "PHM", number: "58", canonGroup: "nt" },
  { code: "HEB", number: "59", canonGroup: "nt" },
  { code: "JAS", number: "60", canonGroup: "nt" },
  { code: "1PE", number: "61", canonGroup: "nt" },
  { code: "2PE", number: "62", canonGroup: "nt" },
  { code: "1JN", number: "63", canonGroup: "nt" },
  { code: "2JN", number: "64", canonGroup: "nt" },
  { code: "3JN", number: "65", canonGroup: "nt" },
  { code: "JUD", number: "66", canonGroup: "nt" },
  { code: "REV", number: "67", canonGroup: "nt" },
  { code: "TOB", number: "68", canonGroup: "other" },
  { code: "JDT", number: "69", canonGroup: "other" },
  { code: "ESG", number: "70", canonGroup: "other" },
  { code: "WIS", number: "71", canonGroup: "other" },
  { code: "SIR", number: "72", canonGroup: "other" },
  { code: "BAR", number: "73", canonGroup: "other" },
  { code: "LJE", number: "74", canonGroup: "other" },
  { code: "S3Y", number: "75", canonGroup: "other" },
  { code: "SUS", number: "76", canonGroup: "other" },
  { code: "BEL", number: "77", canonGroup: "other" },
  { code: "1MA", number: "78", canonGroup: "other" },
  { code: "2MA", number: "79", canonGroup: "other" },
  { code: "3MA", number: "80", canonGroup: "other" },
  { code: "4MA", number: "81", canonGroup: "other" },
  { code: "1ES", number: "82", canonGroup: "other" },
  { code: "2ES", number: "83", canonGroup: "other" },
  { code: "MAN", number: "84", canonGroup: "other" },
  { code: "PS2", number: "85", canonGroup: "other" },
  { code: "ODA", number: "86", canonGroup: "other" },
  { code: "PSS", number: "87", canonGroup: "other" },
  { code: "EZA", number: "A4", canonGroup: "other" },
  { code: "5EZ", number: "A5", canonGroup: "other" },
  { code: "6EZ", number: "A6", canonGroup: "other" },
  { code: "DAG", number: "B2", canonGroup: "other" },
  { code: "PS3", number: "B3", canonGroup: "other" },
  { code: "2BA", number: "B4", canonGroup: "other" },
  { code: "LBA", number: "B5", canonGroup: "other" },
  { code: "JUB", number: "B6", canonGroup: "other" },
  { code: "ENO", number: "B7", canonGroup: "other" },
  { code: "1MQ", number: "B8", canonGroup: "other" },
  { code: "2MQ", number: "B9", canonGroup: "other" },
  { code: "3MQ", number: "C0", canonGroup: "other" },
  { code: "REP", number: "C1", canonGroup: "other" },
  { code: "4BA", number: "C2", canonGroup: "other" },
  { code: "LAO", number: "C3", canonGroup: "other" },
  { code: "FRT", number: "A0", canonGroup: "other" },
  { code: "BAK", number: "A1", canonGroup: "other" },
  { code: "OTH", number: "A2", canonGroup: "other" },
  { code: "INT", number: "A7", canonGroup: "other" },
  { code: "CNC", number: "A8", canonGroup: "other" },
  { code: "GLO", number: "A9", canonGroup: "other" },
  { code: "TDX", number: "B0", canonGroup: "other" },
  { code: "NDX", number: "B1", canonGroup: "other" },
  { code: "XXA", number: "94", canonGroup: "other" },
  { code: "XXB", number: "95", canonGroup: "other" },
  { code: "XXC", number: "96", canonGroup: "other" },
  { code: "XXD", number: "97", canonGroup: "other" },
  { code: "XXE", number: "98", canonGroup: "other" },
  { code: "XXF", number: "99", canonGroup: "other" },
  { code: "XXG", number: "100", canonGroup: "other" },
] as const;

const codeToOrder: ReadonlyMap<string, number> = new Map(
  STANDARD_USFM_BOOK_IDENTIFIERS.map((row, index) => [row.code, index]),
);

const codeToMeta: ReadonlyMap<string, StandardBookIdentifier> = new Map(
  STANDARD_USFM_BOOK_IDENTIFIERS.map((row) => [row.code, row]),
);

/** Uppercase ASCII book code from `\id` line (first token only). */
export function normalizeUsfmBookCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const token = trimmed.split(/\s+/)[0] ?? "";
  return token.toUpperCase();
}

export function isStandardUsfmBookIdentifier(code: string): boolean {
  return codeToOrder.has(normalizeUsfmBookCode(code));
}

/** Table order index (lower = earlier in the USFM book list). */
export function getStandardUsfmBookOrderIndex(code: string): number | undefined {
  return codeToOrder.get(normalizeUsfmBookCode(code));
}

export function getStandardUsfmBookIdentifier(
  code: string,
): StandardBookIdentifier | undefined {
  return codeToMeta.get(normalizeUsfmBookCode(code));
}
