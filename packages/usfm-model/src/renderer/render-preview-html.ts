import { parse } from "@usfm-tools/parser";
import { PublicationViewModel } from "../view-models/publication-preview.js";

export type RenderPreviewOptions = {
  /**
   * When true, paragraphs that contain multiple verse milestones are expanded so
   * each verse renders on its own preview line.
   */
  versePerLine?: boolean;
};

/**
 * Render a USFM source string as publication-style HTML using a fixed
 * default markup. Parser errors (if any) are surfaced as a banner at the
 * top of the output. CSS hooks (class names like `usfm-line`, `usfm-v`,
 * `usfm-chapter`, `usfm-nd`, …) are the only customization surface —
 * style them in your app's stylesheet.
 */
export function renderPreviewHtml(usfm: string, options?: RenderPreviewOptions): string {
  const { document, errors } = parse(usfm);
  const preview = PublicationViewModel.buildPreview(document, {
    versePerLine: options?.versePerLine,
  });
  const booksHtml = preview.books.map(renderBook).join("");
  const firstCode = preview.books[0]?.code;
  const idAttr = firstCode ? ` data-usfm-id="${escapeText(firstCode)}"` : "";
  const body = `<article class="usfm-document"${idAttr}>${booksHtml}</article>`;
  if (errors.length === 0) return body;
  const errorParts = errors.map((e) => `<span>${escapeText(e.message)}</span>`).join(" ");
  return `<aside class="usfm-preview-errors" role="status">${errorParts}</aside>${body}`;
}

function escapeText(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markerClass(marker: string): string {
  return `usfm-${marker.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function renderBook(book: PublicationViewModel.PreviewBook): string {
  const desc = book.description
    ? `<p class="usfm-book-desc">${escapeText(book.description)}</p>`
    : "";
  const preamble = book.preambleBlocks.length
    ? `<div class="usfm-preamble">${book.preambleBlocks.map(renderBlock).join("")}</div>`
    : "";
  const chapters = book.chapters.map(renderChapter).join("");
  return `<section class="usfm-book" data-code="${escapeText(book.code)}"><header class="usfm-book-hd"><h1 class="usfm-book-code">${escapeText(book.code)}</h1>${desc}</header>${preamble}${chapters}</section>`;
}

function renderChapter(ch: PublicationViewModel.PreviewChapter): string {
  const inner = ch.blocks.map(renderBlock).join("");
  return `<section class="usfm-chapter" data-chapter="${escapeText(ch.number)}"><h2 class="usfm-chapter-num">Chapter ${escapeText(ch.number)}</h2><div class="usfm-chapter-body">${inner}</div></section>`;
}

function renderBlock(block: PublicationViewModel.PreviewBlock): string {
  switch (block.kind) {
    case "heading":
      return `<h3 class="usfm-heading ${markerClass(block.marker)}">${renderSegments(block.segments)}</h3>`;
    case "line": {
      const flowClass = block.flow === "poetry" ? "usfm-line--poetry" : "usfm-line--prose";
      return `<p class="usfm-line ${markerClass(block.marker)} ${flowClass}">${renderSegments(block.segments)}</p>`;
    }
    case "blank":
      return `<div class="usfm-blank" aria-hidden="true"></div>`;
    case "table": {
      const rows = block.rows
        .map((row) => {
          const cells = row.cells
            .map((c) => `<td class="usfm-tc ${markerClass(c.marker)}">${renderSegments(c.segments)}</td>`)
            .join("");
          return `<tr class="usfm-tr">${cells}</tr>`;
        })
        .join("");
      return `<table class="usfm-table"><tbody>${rows}</tbody></table>`;
    }
    case "unsupported": {
      const m = block.marker ? ` marker-${markerClass(block.marker)}` : "";
      return `<!-- unsupported:${escapeText(block.reason)}${m} -->`;
    }
    default:
      return "";
  }
}

function renderSegments(segments: PublicationViewModel.PublicationSegment[]): string {
  return segments
    .map((s) => {
      switch (s.kind) {
        case "verse":
          return `<sup class="usfm-v">${escapeText(s.number)}</sup>`;
        case "text":
          return `<span class="usfm-txt">${escapeText(s.text)}</span>`;
        case "styled":
          return `<span class="usfm-char ${markerClass(s.marker)}">${renderSegments(s.children)}</span>`;
        case "note":
          return `<span class="usfm-note ${markerClass(s.marker)}" data-caller="${escapeText(s.caller)}"><span class="usfm-note-caller">${escapeText(s.caller)}</span><span class="usfm-note-body">${renderSegments(s.children)}</span></span>`;
        case "ref":
          return `<span class="usfm-ref">${renderSegments(s.children)}</span>`;
        default:
          return "";
      }
    })
    .join("");
}
