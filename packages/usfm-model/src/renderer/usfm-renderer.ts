import type { DocumentNode } from "@usfm-tools/parser";
import { PublicationViewModel } from "../view-models/publication-preview.js";
import type { UsfmRenderOptions, UsfmRenderTemplate } from "./types.js";

/**
 * Converts parsed USFM (or a pre-built publication view model) into HTML
 * using a pluggable {@link UsfmRenderTemplate}.
 */
export class UsfmRenderer {
  constructor(private readonly template: UsfmRenderTemplate) {}

  renderDocument(document: DocumentNode, options?: UsfmRenderOptions): string {
    const preview = PublicationViewModel.buildPreview(document, {
      versePerLine: options?.versePerLine,
    });
    return this.renderPreview(preview);
  }

  renderPreview(preview: PublicationViewModel.PreviewDocument, options?: UsfmRenderOptions): string {
    let p = preview;
    if (options?.versePerLine) {
      p = PublicationViewModel.applyVersePerLine(preview);
    }
    const t = this.template;
    const booksHtml = p.books.map((b) => this.renderBook(b)).join("");
    const firstCode = p.books[0]?.code;
    return t.document(booksHtml, { idCode: firstCode || undefined });
  }

  private renderBook(book: PublicationViewModel.PreviewBook): string {
    const t = this.template;
    const preamble = book.preambleBlocks.length
      ? t.preamble(book.preambleBlocks.map((bl) => this.renderBlock(bl)).join(""))
      : "";
    const chapters = book.chapters.map((ch) => this.renderChapter(ch)).join("");
    return t.book(book.code, book.description, `${preamble}${chapters}`);
  }

  private renderChapter(ch: PublicationViewModel.PreviewChapter): string {
    const inner = ch.blocks.map((b) => this.renderBlock(b)).join("");
    return this.template.chapter(ch.number, inner);
  }

  private renderBlock(block: PublicationViewModel.PreviewBlock): string {
    const t = this.template;
    switch (block.kind) {
      case "heading":
        return t.heading(block.marker, this.renderSegments(block.segments));
      case "line":
        return t.line(block.marker, block.flow, this.renderSegments(block.segments));
      case "blank":
        return t.blank();
      case "table":
        return t.table(
          block.rows
            .map((row) =>
              t.tableRow(
                row.cells
                  .map((c) => t.tableCell(c.marker, this.renderSegments(c.segments)))
                  .join(""),
              ),
            )
            .join(""),
        );
      case "unsupported":
        return t.unsupported(block.reason, block.marker);
      default:
        return "";
    }
  }

  private renderSegments(segments: PublicationViewModel.PublicationSegment[]): string {
    const t = this.template;
    return segments
      .map((s) => {
        switch (s.kind) {
          case "verse":
            return t.verseNumber(s.number);
          case "text":
            return t.textSpan(s.text);
          case "styled":
            return t.styledSpan(s.marker, this.renderSegments(s.children));
          case "note":
            return t.note(s.marker, s.caller, this.renderSegments(s.children));
          case "ref":
            return t.ref(this.renderSegments(s.children));
          default:
            return "";
        }
      })
      .join("");
  }
}
