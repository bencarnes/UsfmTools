import type {
  BookNode,
  ParagraphNode,
  ParentNode,
  TextNode,
  UsfmNode,
} from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import {
  getStandardUsfmBookIdentifier,
  getStandardUsfmBookOrderIndex,
  isStandardUsfmBookIdentifier,
  normalizeUsfmBookCode,
  type StandardBookCanonGroup,
} from "./standard-book-identifiers.js";

export type UsfmBookPickerCanonGroup = StandardBookCanonGroup | "nonStandard";

export interface UsfmBookPickerFileInput {
  /** Stable id for the file (e.g. path or key); not read from USFM. */
  readonly id: string;
  readonly usfm: string;
}

export interface UsfmBookPickerBook {
  readonly fileId: string;
  /** Identifier code from `\\id` (uppercase first token). */
  readonly code: string;
  /** Short label for buttons / list (see USFM book picker rules). */
  readonly displayLabel: string;
  readonly canonGroup: UsfmBookPickerCanonGroup;
  /**
   * For standard books: index in the official USFM book table (sorting).
   * For non-standard books: unused (order follows the input `files` array).
   */
  readonly sortIndex: number;
}

export interface UsfmBookPickerGroups {
  readonly oldTestament: readonly UsfmBookPickerBook[];
  readonly newTestament: readonly UsfmBookPickerBook[];
  /** Standard identifiers outside Old/New Testament (peripherals, deuterocanon, etc.). */
  readonly other: readonly UsfmBookPickerBook[];
  /**
   * Files whose first `\\id` code is not in the USFM standard book list.
   * Order matches the order of those entries in the input `files` array.
   */
  readonly nonStandard: readonly UsfmBookPickerBook[];
}

function isParent(n: UsfmNode): n is ParentNode {
  return "children" in n && Array.isArray((n as ParentNode).children);
}

function paragraphPlainText(node: ParagraphNode): string {
  if (!isParent(node)) return "";
  const parts: string[] = [];
  for (const ch of node.children) {
    parts.push(nodePlainText(ch));
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

function nodePlainText(n: UsfmNode): string {
  if (n.type === "text") {
    return (n as TextNode).text;
  }
  if (isParent(n)) {
    return n.children.map(nodePlainText).join("");
  }
  return "";
}

function extractTocFromBook(book: BookNode): {
  toc1?: string;
  toc2?: string;
  toc3?: string;
} {
  let toc1: string | undefined;
  let toc2: string | undefined;
  let toc3: string | undefined;

  for (const child of book.children) {
    if (child.type !== "paragraph") continue;
    const p = child as ParagraphNode;
    if (p.marker === "toc1" && toc1 === undefined) {
      const t = paragraphPlainText(p);
      if (t) toc1 = t;
    } else if (p.marker === "toc2" && toc2 === undefined) {
      const t = paragraphPlainText(p);
      if (t) toc2 = t;
    } else if (p.marker === "toc3" && toc3 === undefined) {
      const t = paragraphPlainText(p);
      if (t) toc3 = t;
    }
  }

  return { toc1, toc2, toc3 };
}

function displayLabelForBook(
  code: string,
  canonGroup: StandardBookCanonGroup,
  toc: { toc1?: string; toc2?: string; toc3?: string },
): string {
  if (canonGroup === "ot" || canonGroup === "nt") {
    const t3 = toc.toc3?.trim();
    if (t3) return t3;
    return code;
  }
  const t1 = toc.toc1?.trim();
  if (t1) return t1;
  const t2 = toc.toc2?.trim();
  if (t2) return t2;
  const t3 = toc.toc3?.trim();
  if (t3) return t3;
  return code;
}

/**
 * Parses each file's USFM and groups books for the USFM book picker control.
 * Standard `\\id` codes are split into Old Testament, New Testament, and other;
 * any other non-empty `\\id` appears in **nonStandard**, in input order.
 * Only the **first** `book` node in each document is considered (one canonical book per file).
 */
export function buildUsfmBookPickerGroups(
  files: readonly UsfmBookPickerFileInput[],
): UsfmBookPickerGroups {
  const standardPicked: UsfmBookPickerBook[] = [];
  const nonStandardList: UsfmBookPickerBook[] = [];

  for (const file of files) {
    const { document } = parse(file.usfm);
    const firstBook = document.children.find((c) => c.type === "book") as BookNode | undefined;
    if (!firstBook) continue;

    const rawCode = normalizeUsfmBookCode(firstBook.code);
    if (!rawCode) continue;

    const toc = extractTocFromBook(firstBook);

    if (isStandardUsfmBookIdentifier(rawCode)) {
      const meta = getStandardUsfmBookIdentifier(rawCode)!;
      const order = getStandardUsfmBookOrderIndex(rawCode);
      if (order === undefined) continue;

      const displayLabel = displayLabelForBook(meta.code, meta.canonGroup, toc);

      standardPicked.push({
        fileId: file.id,
        code: meta.code,
        displayLabel,
        canonGroup: meta.canonGroup,
        sortIndex: order,
      });
    } else {
      const displayLabel = displayLabelForBook(rawCode, "other", toc);
      nonStandardList.push({
        fileId: file.id,
        code: rawCode,
        displayLabel,
        canonGroup: "nonStandard",
        sortIndex: 0,
      });
    }
  }

  standardPicked.sort((a, b) => a.sortIndex - b.sortIndex);

  const oldTestament: UsfmBookPickerBook[] = [];
  const newTestament: UsfmBookPickerBook[] = [];
  const other: UsfmBookPickerBook[] = [];

  for (const b of standardPicked) {
    if (b.canonGroup === "ot") oldTestament.push(b);
    else if (b.canonGroup === "nt") newTestament.push(b);
    else other.push(b);
  }

  return { oldTestament, newTestament, other, nonStandard: nonStandardList };
}
