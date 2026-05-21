import type { BookNode, ChapterNode } from "@usfm-tools/parser";

/**
 * Returns every `\\c` chapter number string on {@link book}, in **document order**
 * (depth-first over the book’s immediate children). Each chapter node contributes
 * one entry; values are not normalized, sorted, or deduplicated — they match the
 * parser’s `ChapterNode.number` field exactly.
 */
export function listChapterNumbersFromBook(book: BookNode): readonly string[] {
  const out: string[] = [];
  for (const child of book.children) {
    if (child.type === "chapter") {
      out.push((child as ChapterNode).number);
    }
  }
  return out;
}
