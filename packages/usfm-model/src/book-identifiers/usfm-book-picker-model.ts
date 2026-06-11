import type {
  BookNode,
  DocumentNode,
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
  /**
   * Identifier code from the first `\\id` line (uppercase first token), or an empty string
   * when the file has no `\\id` or the `\\id` line has no code token.
   */
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
   * Non-standard entries: a non-empty `\\id` code not in the USFM standard list, **or**
   * a missing/empty `\\id` (including files with no `book` node but non-empty USFM).
   * Order matches the input `files` array.
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

function extractTocFromParagraphChildren(children: readonly UsfmNode[]): {
  toc1?: string;
  toc2?: string;
  toc3?: string;
} {
  let toc1: string | undefined;
  let toc2: string | undefined;
  let toc3: string | undefined;

  for (const child of children) {
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

function extractTocFromBook(book: BookNode): {
  toc1?: string;
  toc2?: string;
  toc3?: string;
} {
  return extractTocFromParagraphChildren(book.children);
}

function extractTocFromDocument(document: DocumentNode): {
  toc1?: string;
  toc2?: string;
  toc3?: string;
} {
  return extractTocFromParagraphChildren(document.children);
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

/** `\\toc1` → `\\toc2` → `\\toc3` → normalized `\\id` code → `fileId`. */
function displayLabelNonStandard(
  normalizedIdCode: string,
  toc: { toc1?: string; toc2?: string; toc3?: string },
  fileId: string,
): string {
  const t1 = toc.toc1?.trim();
  if (t1) return t1;
  const t2 = toc.toc2?.trim();
  if (t2) return t2;
  const t3 = toc.toc3?.trim();
  if (t3) return t3;
  if (normalizedIdCode) return normalizedIdCode;
  return fileId;
}

/**
 * Parses each file's USFM and groups books for the USFM book picker control.
 * Standard `\\id` codes are split into Old Testament, New Testament, and other;
 * non-standard rows include unknown `\\id` codes, an empty/missing `\\id` line on
 * the first book, or **no** `\\id` at all (non-empty USFM), in input order.
 * Only the **first** `book` node is used when present; otherwise TOC markers are read
 * from top-level paragraphs on the document.
 */
type PickerBookRow = UsfmBookPickerBook & { readonly inputOrder: number };

function comparePickerBookRows(a: PickerBookRow, b: PickerBookRow): number {
  const byTable = a.sortIndex - b.sortIndex;
  return byTable !== 0 ? byTable : a.inputOrder - b.inputOrder;
}

export function buildUsfmBookPickerGroups(
  files: readonly UsfmBookPickerFileInput[],
): UsfmBookPickerGroups {
  const standardPicked: PickerBookRow[] = [];
  const nonStandardList: UsfmBookPickerBook[] = [];

  for (let inputOrder = 0; inputOrder < files.length; inputOrder++) {
    const file = files[inputOrder]!;
    const trimmed = file.usfm.trim();
    if (!trimmed) continue;

    const { document } = parse(file.usfm);
    const firstBook = document.children.find((c) => c.type === "book") as BookNode | undefined;

    if (firstBook) {
      const rawCode = normalizeUsfmBookCode(firstBook.code);
      const toc = extractTocFromBook(firstBook);

      if (rawCode && isStandardUsfmBookIdentifier(rawCode)) {
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
          inputOrder,
        });
      } else {
        const displayLabel = displayLabelNonStandard(rawCode, toc, file.id);
        nonStandardList.push({
          fileId: file.id,
          code: rawCode,
          displayLabel,
          canonGroup: "nonStandard",
          sortIndex: 0,
        });
      }
    } else {
      const toc = extractTocFromDocument(document);
      const displayLabel = displayLabelNonStandard("", toc, file.id);
      nonStandardList.push({
        fileId: file.id,
        code: "",
        displayLabel,
        canonGroup: "nonStandard",
        sortIndex: 0,
      });
    }
  }

  standardPicked.sort(comparePickerBookRows);

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
