import type { UsfmRenderTemplate } from "./types.js";

function markerClass(marker: string): string {
  return `usfm-${marker.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function escapeText(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sensible default HTML: semantic wrappers, BEM-ish marker classes, escaped text.
 */
export function defaultPublicationTemplate(): UsfmRenderTemplate {
  return {
    escapeText,

    document(inner, meta) {
      const idAttr = meta.idCode ? ` data-usfm-id="${escapeText(meta.idCode)}"` : "";
      return `<article class="usfm-document"${idAttr}>${inner}</article>`;
    },

    book(code, description, inner) {
      const desc = description
        ? `<p class="usfm-book-desc">${escapeText(description)}</p>`
        : "";
      return `<section class="usfm-book" data-code="${escapeText(code)}"><header class="usfm-book-hd"><h1 class="usfm-book-code">${escapeText(code)}</h1>${desc}</header>${inner}</section>`;
    },

    preamble(inner) {
      return `<div class="usfm-preamble">${inner}</div>`;
    },

    chapter(number, inner) {
      return `<section class="usfm-chapter" data-chapter="${escapeText(number)}"><h2 class="usfm-chapter-num">Chapter ${escapeText(number)}</h2><div class="usfm-chapter-body">${inner}</div></section>`;
    },

    heading(marker, inner) {
      return `<h3 class="usfm-heading ${markerClass(marker)}">${inner}</h3>`;
    },

    line(marker, flow, inner) {
      const flowClass = flow === "poetry" ? "usfm-line--poetry" : "usfm-line--prose";
      return `<p class="usfm-line ${markerClass(marker)} ${flowClass}">${inner}</p>`;
    },

    blank() {
      return `<div class="usfm-blank" aria-hidden="true"></div>`;
    },

    table(rowsHtml) {
      return `<table class="usfm-table"><tbody>${rowsHtml}</tbody></table>`;
    },

    tableRow(cellsHtml) {
      return `<tr class="usfm-tr">${cellsHtml}</tr>`;
    },

    tableCell(marker, inner) {
      return `<td class="usfm-tc ${markerClass(marker)}">${inner}</td>`;
    },

    verseNumber(number) {
      return `<sup class="usfm-v">${escapeText(number)}</sup>`;
    },

    textSpan(text) {
      return `<span class="usfm-txt">${escapeText(text)}</span>`;
    },

    styledSpan(marker, inner) {
      return `<span class="usfm-char ${markerClass(marker)}">${inner}</span>`;
    },

    note(marker, caller, inner) {
      return `<span class="usfm-note ${markerClass(marker)}" data-caller="${escapeText(caller)}"><span class="usfm-note-caller">${escapeText(caller)}</span><span class="usfm-note-body">${inner}</span></span>`;
    },

    ref(inner) {
      return `<span class="usfm-ref">${inner}</span>`;
    },

    unsupported(reason, marker) {
      const m = marker ? ` marker-${markerClass(marker)}` : "";
      return `<!-- unsupported:${escapeText(reason)}${m} -->`;
    },
  };
}
