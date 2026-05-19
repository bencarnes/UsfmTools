import type { PublicationViewModel } from "../view-models/publication-preview.js";

/**
 * Hooks for turning a {@link PublicationViewModel.PreviewDocument} into HTML.
 * Override methods to customize markup and CSS class names; always escape
 * untrusted text in {@link UsfmRenderTemplate.escapeText}.
 */
export interface UsfmRenderTemplate {
  escapeText(text: string): string;

  document(inner: string, meta: { idCode?: string }): string;
  book(code: string, description: string | undefined, inner: string): string;
  preamble(inner: string): string;
  chapter(number: string, inner: string): string;

  heading(marker: string, inner: string): string;
  line(marker: string, flow: PublicationViewModel.LineFlow, inner: string): string;
  blank(): string;

  table(rowsHtml: string): string;
  tableRow(cellsHtml: string): string;
  tableCell(marker: string, inner: string): string;

  verseNumber(number: string): string;
  textSpan(text: string): string;
  styledSpan(marker: string, inner: string): string;
  note(marker: string, caller: string, inner: string): string;
  ref(inner: string): string;

  unsupported(reason: string, marker?: string): string;
}
