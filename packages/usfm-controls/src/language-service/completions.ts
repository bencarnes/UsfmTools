import type { CompletionItem } from "./protocol.js";

interface MarkerDef {
  label: string;
  detail: string;
  insertText: string;
}

const MARKER_COMPLETIONS: MarkerDef[] = [
  // Identification & headers
  { label: "\\id", detail: "Book identification", insertText: "\\id " },
  { label: "\\h", detail: "Running header", insertText: "\\h " },
  { label: "\\toc1", detail: "Long table of contents", insertText: "\\toc1 " },
  { label: "\\toc2", detail: "Short table of contents", insertText: "\\toc2 " },
  { label: "\\toc3", detail: "Book abbreviation", insertText: "\\toc3 " },
  { label: "\\mt1", detail: "Main title level 1", insertText: "\\mt1 " },
  { label: "\\mt2", detail: "Main title level 2", insertText: "\\mt2 " },

  // Structure
  { label: "\\c", detail: "Chapter", insertText: "\\c " },
  { label: "\\v", detail: "Verse", insertText: "\\v " },

  // Paragraphs
  { label: "\\p", detail: "Paragraph", insertText: "\\p " },
  { label: "\\m", detail: "Paragraph continuation (no indent)", insertText: "\\m " },
  { label: "\\pi1", detail: "Indented paragraph level 1", insertText: "\\pi1 " },
  { label: "\\nb", detail: "No-break paragraph", insertText: "\\nb " },
  { label: "\\pmo", detail: "Embedded text opening", insertText: "\\pmo " },
  { label: "\\pc", detail: "Centered paragraph", insertText: "\\pc " },

  // Poetry
  { label: "\\q1", detail: "Poetry indent level 1", insertText: "\\q1 " },
  { label: "\\q2", detail: "Poetry indent level 2", insertText: "\\q2 " },
  { label: "\\q3", detail: "Poetry indent level 3", insertText: "\\q3 " },
  { label: "\\qr", detail: "Poetry right-aligned", insertText: "\\qr " },
  { label: "\\qc", detail: "Poetry centered", insertText: "\\qc " },
  { label: "\\b", detail: "Poetry stanza break", insertText: "\\b" },

  // Section headings
  { label: "\\s1", detail: "Section heading level 1", insertText: "\\s1 " },
  { label: "\\s2", detail: "Section heading level 2", insertText: "\\s2 " },
  { label: "\\r", detail: "Parallel reference", insertText: "\\r " },
  { label: "\\d", detail: "Descriptive title (Psalms)", insertText: "\\d " },
  { label: "\\sp", detail: "Speaker identification", insertText: "\\sp " },

  // Character styles
  { label: "\\nd", detail: "Name of deity", insertText: "\\nd " },
  { label: "\\wj", detail: "Words of Jesus", insertText: "\\wj " },
  { label: "\\bk", detail: "Book name", insertText: "\\bk " },
  { label: "\\it", detail: "Italic", insertText: "\\it " },
  { label: "\\bd", detail: "Bold", insertText: "\\bd " },
  { label: "\\sc", detail: "Small caps", insertText: "\\sc " },
  { label: "\\w", detail: "Wordlist/glossary entry", insertText: "\\w " },
  { label: "\\add", detail: "Translator addition", insertText: "\\add " },
  { label: "\\pn", detail: "Proper name", insertText: "\\pn " },
  { label: "\\qt", detail: "OT quotation in NT", insertText: "\\qt " },

  // Notes
  { label: "\\f", detail: "Footnote", insertText: "\\f + " },
  { label: "\\fe", detail: "Endnote", insertText: "\\fe + " },
  { label: "\\x", detail: "Cross reference", insertText: "\\x - " },
  { label: "\\fr", detail: "Footnote origin reference", insertText: "\\fr " },
  { label: "\\ft", detail: "Footnote text", insertText: "\\ft " },
  { label: "\\fq", detail: "Footnote quotation", insertText: "\\fq " },
  { label: "\\fqa", detail: "Footnote alternate rendering", insertText: "\\fqa " },
  { label: "\\xo", detail: "Cross-ref origin", insertText: "\\xo " },
  { label: "\\xt", detail: "Cross-ref target", insertText: "\\xt " },

  // References
  { label: "\\ref", detail: "Reference link", insertText: "\\ref " },

  // Tables
  { label: "\\tr", detail: "Table row", insertText: "\\tr " },
  { label: "\\th1", detail: "Table header cell 1", insertText: "\\th1 " },
  { label: "\\tc1", detail: "Table cell 1", insertText: "\\tc1 " },

  // Lists
  { label: "\\li1", detail: "List item level 1", insertText: "\\li1 " },
  { label: "\\li2", detail: "List item level 2", insertText: "\\li2 " },

  // Introduction
  { label: "\\imt1", detail: "Intro major title", insertText: "\\imt1 " },
  { label: "\\ip", detail: "Intro paragraph", insertText: "\\ip " },
  { label: "\\is1", detail: "Intro section heading", insertText: "\\is1 " },
];

export function getCompletions(
  content: string,
  line: number,
  column: number,
): CompletionItem[] {
  const lines = content.split("\n");
  if (line >= lines.length) return [];

  const lineText = lines[line];
  const textBeforeCursor = lineText.slice(0, column);

  // Find the partial marker being typed (e.g. "\s" or "\q")
  const match = textBeforeCursor.match(/\\(\+?[a-zA-Z0-9-]*)$/);
  if (!match) return [];

  const partial = match[0]; // includes the backslash

  return MARKER_COMPLETIONS.filter((item) =>
    item.label.startsWith(partial),
  ).map((item) => ({
    label: item.label,
    detail: item.detail,
    insertText: item.insertText,
  }));
}
