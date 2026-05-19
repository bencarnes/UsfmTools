/* eslint-disable @typescript-eslint/no-namespace -- PublicationViewModel groups related types and buildPreview */
import type {
  BookNode,
  CellNode,
  ChapterNode,
  CharNode,
  DocumentNode,
  FigureNode,
  NoteNode,
  ParagraphNode,
  RefNode,
  RowNode,
  TextNode,
  UsfmNode,
  VerseNode,
} from "@usfm-tools/parser";
import { getMarkerCategory, isParaMarker } from "@usfm-tools/parser";

/**
 * Publication-style reading layout derived from parsed USFM.
 */
export namespace PublicationViewModel {
  export type PreviewDocument = {
    books: PreviewBook[];
  };

  export type PreviewBook = {
    code: string;
    description?: string;
    preambleBlocks: PreviewBlock[];
    chapters: PreviewChapter[];
  };

  export type PreviewChapter = {
    number: string;
    blocks: PreviewBlock[];
  };

  export type PreviewBlock =
    | HeadingBlock
    | LineBlock
    | BlankBlock
    | TableBlock
    | UnsupportedBlock;

  export type HeadingBlock = {
    kind: "heading";
    marker: string;
    segments: PublicationSegment[];
  };

  export type LineFlow = "prose" | "poetry";

  export type LineBlock = {
    kind: "line";
    marker: string;
    flow: LineFlow;
    segments: PublicationSegment[];
  };

  export type BlankBlock = { kind: "blank" };

  export type TableBlock = {
    kind: "table";
    rows: PreviewTableRow[];
  };

  export type PreviewTableRow = {
    cells: PreviewTableCell[];
  };

  export type PreviewTableCell = {
    marker: string;
    segments: PublicationSegment[];
  };

  export type UnsupportedBlock = {
    kind: "unsupported";
    reason: string;
    marker?: string;
  };

  export type PublicationSegment =
    | { kind: "verse"; number: string }
    | { kind: "text"; text: string }
    | { kind: "styled"; marker: string; children: PublicationSegment[] }
    | { kind: "note"; marker: string; caller: string; children: PublicationSegment[] }
    | { kind: "ref"; children: PublicationSegment[] };

  /**
   * Build a publication-oriented view model from a parser document tree.
   */
  export function buildPreview(document: DocumentNode): PreviewDocument {
    const books: PreviewBook[] = [];
    for (const child of document.children) {
      if (child.type === "book") {
        books.push(buildBook(child as BookNode));
      } else {
        books.push({
          code: "",
          preambleBlocks: nodeToBlocks(child),
          chapters: [],
        });
      }
    }
    return { books };
  }
}

function buildBook(book: BookNode): PublicationViewModel.PreviewBook {
  const preambleBlocks: PublicationViewModel.PreviewBlock[] = [];
  const chapters: PublicationViewModel.PreviewChapter[] = [];
  for (const child of book.children) {
    if (child.type === "chapter") {
      chapters.push(buildChapter(child as ChapterNode));
    } else {
      preambleBlocks.push(...nodeToBlocks(child));
    }
  }
  return {
    code: book.code,
    description: book.description,
    preambleBlocks,
    chapters,
  };
}

function buildChapter(chapter: ChapterNode): PublicationViewModel.PreviewChapter {
  const blocks: PublicationViewModel.PreviewBlock[] = [];
  for (const child of chapter.children) {
    blocks.push(...nodeToBlocks(child));
  }
  return { number: chapter.number, blocks };
}

function nodeToBlocks(node: UsfmNode): PublicationViewModel.PreviewBlock[] {
  switch (node.type) {
    case "paragraph":
      return [paragraphToBlock(node as ParagraphNode)];
    case "verse":
      return [orphanVerseLine(node as VerseNode)];
    case "row":
      return [rowToTableBlock(node as RowNode)];
    case "text": {
      const t = node as TextNode;
      if (!t.text.trim()) return [];
      return [
        {
          kind: "line",
          marker: "p",
          flow: "prose",
          segments: [{ kind: "text", text: normalizeSpaces(t.text) }],
        },
      ];
    }
    case "figure":
      return [figureBlock(node as FigureNode)];
    case "sidebar":
      return [{ kind: "unsupported", reason: "sidebar", marker: "esb" }];
    case "table":
      return [{ kind: "unsupported", reason: "table-wrapper", marker: "table" }];
    case "unknown":
      return [{ kind: "unsupported", reason: "unknown-marker", marker: node.marker }];
    case "char":
    case "note":
    case "ref":
    case "milestone":
    case "optbreak":
      return [];
    default:
      return [{ kind: "unsupported", reason: `node:${node.type}`, marker: node.marker }];
  }
}

function figureBlock(fig: FigureNode): PublicationViewModel.LineBlock {
  const alt = fig.attributes?.alt ?? "";
  return {
    kind: "line",
    marker: "fig",
    flow: "prose",
    segments: alt
      ? [{ kind: "text", text: `[Figure: ${normalizeSpaces(alt)}]` }]
      : [{ kind: "text", text: "[Figure]" }],
  };
}

function orphanVerseLine(v: VerseNode): PublicationViewModel.LineBlock {
  return {
    kind: "line",
    marker: "p",
    flow: "prose",
    segments: [{ kind: "verse", number: v.number }],
  };
}

function rowToTableBlock(row: RowNode): PublicationViewModel.TableBlock {
  const cells: PublicationViewModel.PreviewTableCell[] = [];
  for (const cell of row.children) {
    if (cell.type === "cell") {
      const c = cell as CellNode;
      cells.push({
        marker: c.marker,
        segments: buildSegments(c.children, []),
      });
    }
  }
  return { kind: "table", rows: [{ cells }] };
}

function paragraphToBlock(p: ParagraphNode): PublicationViewModel.PreviewBlock {
  const marker = p.marker;
  if (marker === "b") {
    return { kind: "blank" };
  }

  const cat = getMarkerCategory(marker);
  if (cat === "title" || cat === "sectionpara") {
    return {
      kind: "heading",
      marker,
      segments: buildSegments(p.children, []),
    };
  }

  return {
    kind: "line",
    marker,
    flow: paragraphFlow(marker, cat),
    segments: buildSegments(p.children, []),
  };
}

function paragraphFlow(marker: string, cat: string): PublicationViewModel.LineFlow {
  if (cat === "introduction" || cat === "versepara") {
    if (
      /^q[1-9]?$/.test(marker) ||
      marker === "qc" ||
      marker === "qr" ||
      marker === "qm" ||
      /^qm[1-9]$/.test(marker) ||
      /^iq[1-9]?$/.test(marker) ||
      marker === "li" ||
      /^li[1-9]$/.test(marker)
    ) {
      return "poetry";
    }
  }
  if (cat === "list") {
    return /^li/.test(marker) ? "poetry" : "prose";
  }
  return "prose";
}

function buildSegments(nodes: UsfmNode[], styleStack: string[]): PublicationViewModel.PublicationSegment[] {
  const out: PublicationViewModel.PublicationSegment[] = [];
  for (const node of nodes) {
    const piece = nodeToSegment(node, styleStack);
    if (piece) {
      if (piece.kind === "text" && out.length > 0 && out[out.length - 1]!.kind === "text") {
        const prev = out[out.length - 1] as { kind: "text"; text: string };
        prev.text = normalizeSpaces(prev.text + piece.text);
      } else {
        out.push(piece);
      }
    }
  }
  return mergeAdjacentText(out);
}

function nodeToSegment(
  node: UsfmNode,
  styleStack: string[],
): PublicationViewModel.PublicationSegment | null {
  switch (node.type) {
    case "text": {
      const raw = (node as TextNode).text;
      const t = normalizeSpaces(raw);
      return t ? { kind: "text", text: t } : null;
    }
    case "verse":
      return { kind: "verse", number: (node as VerseNode).number };
    case "char": {
      const c = node as CharNode;
      return {
        kind: "styled",
        marker: c.marker,
        children: buildSegments(c.children, [...styleStack, c.marker]),
      };
    }
    case "note": {
      const n = node as NoteNode;
      return {
        kind: "note",
        marker: n.marker,
        caller: n.caller,
        children: buildSegments(n.children, styleStack),
      };
    }
    case "ref":
      return { kind: "ref", children: buildSegments((node as RefNode).children, styleStack) };
    case "paragraph":
      if (isParaMarker((node as ParagraphNode).marker)) {
        return {
          kind: "text",
          text: ` ${inlineParagraphFallback(node as ParagraphNode)} `,
        };
      }
      return null;
    case "optbreak":
      return { kind: "text", text: " " };
    case "milestone":
      return null;
    default:
      return null;
  }
}

function inlineParagraphFallback(p: ParagraphNode): string {
  const parts: string[] = [];
  for (const c of p.children) {
    if (c.type === "text") parts.push((c as TextNode).text);
  }
  return normalizeSpaces(parts.join(""));
}

function mergeAdjacentText(
  segments: PublicationViewModel.PublicationSegment[],
): PublicationViewModel.PublicationSegment[] {
  const merged: PublicationViewModel.PublicationSegment[] = [];
  for (const seg of segments) {
    if (seg.kind === "text" && merged.length > 0 && merged[merged.length - 1]!.kind === "text") {
      const prev = merged[merged.length - 1] as { kind: "text"; text: string };
      prev.text = normalizeSpaces(prev.text + seg.text);
    } else if (seg.kind === "styled" || seg.kind === "note" || seg.kind === "ref") {
      merged.push({
        ...seg,
        children: mergeAdjacentText(seg.children),
      } as PublicationViewModel.PublicationSegment);
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
