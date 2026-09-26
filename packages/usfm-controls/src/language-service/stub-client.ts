import {
  bookIdMarkerOffsetInUsfm,
  listChapterMarkersInUsfm,
  scanUsfmBookCode,
} from "@usfm-tools/model";
import type {
  BookInfo,
  DocumentChange,
  Position,
  StructureResult,
  UsfmLanguageClient,
} from "./protocol.js";

/**
 * Inert in-process {@link UsfmLanguageClient} for component stories, tests
 * and standalone library use, where the Go engine isn't available.
 *
 * It keeps the protocol's document lifecycle (version-gated incremental sync)
 * but does no analysis: diagnostics, tokens and completions are always empty,
 * no analyses are pushed, book/chapter structure comes from the lightweight
 * text scans in `@usfm-tools/model`, and the preview is the escaped source in
 * a `<pre>`. Applications inject an engine-backed client instead (bible-edit).
 */
export function createStubLanguageClient(): UsfmLanguageClient {
  const docs = new Map<string, { version: number; text: string }>();

  function mustGet(id: string) {
    const doc = docs.get(id);
    if (!doc) throw new Error(`document not open: ${id}`);
    return doc;
  }

  /** Run `fn` against an open document, rejecting when it isn't open. */
  function withDoc<T>(id: string, fn: (doc: { version: number; text: string }) => T): Promise<T> {
    try {
      return Promise.resolve(fn(mustGet(id)));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return {
    openDocument(id, version, text) {
      if (docs.has(id)) {
        return Promise.reject(new Error(`document already open: ${id}`));
      }
      docs.set(id, { version, text });
      return Promise.resolve();
    },

    applyChanges(id, version, changes) {
      return withDoc(id, (doc) => {
        if (version <= doc.version) {
          throw new Error(`stale document version: at ${doc.version}, got ${version}`);
        }
        doc.text = applyChangesToText(doc.text, changes);
        doc.version = version;
      });
    },

    closeDocument(id) {
      return withDoc(id, () => {
        docs.delete(id);
      });
    },

    getDiagnostics: (id) => withDoc(id, (doc) => ({ version: doc.version, diagnostics: [] })),
    getStructure: (id) => withDoc(id, (doc) => structureOf(doc.version, doc.text)),
    classifyDocument: (id) => withDoc(id, (doc) => ({ version: doc.version, tokens: [] })),
    classifyRange: (id) => withDoc(id, (doc) => ({ version: doc.version, tokens: [] })),
    getCompletions: (id) => withDoc(id, () => []),
    renderPreviewDocument: (id) =>
      withDoc(id, (doc) => ({ version: doc.version, html: previewHtml(doc.text) })),
    renderPreview: (text) => Promise.resolve(previewHtml(text)),
    onAnalysis: () => () => {},
  };
}

let shared: UsfmLanguageClient | null = null;

/**
 * Lazily created process-wide stub client, used as the default when no
 * client is injected (component stories, tests, standalone library use).
 */
export function sharedStubLanguageClient(): UsfmLanguageClient {
  shared ??= createStubLanguageClient();
  return shared;
}

/**
 * Apply an edit batch (ascending, non-overlapping, offsets into the original
 * text). JavaScript string indices are UTF-16 code units, so the protocol
 * offsets can be used directly; applying in reverse keeps them valid.
 */
export function applyChangesToText(text: string, changes: DocumentChange[]): string {
  let prevFrom = Infinity;
  for (let i = changes.length - 1; i >= 0; i--) {
    const ch = changes[i]!;
    if (ch.from < 0 || ch.to < ch.from || ch.to > text.length) {
      throw new Error(`invalid edit range [${ch.from},${ch.to})`);
    }
    if (ch.to > prevFrom) throw new Error("invalid edit: overlapping or unsorted ranges");
    prevFrom = ch.from;
    text = text.slice(0, ch.from) + ch.text + text.slice(ch.to);
  }
  return text;
}

/** First-book outline from the text scans (no parse). */
function structureOf(version: number, text: string): StructureResult {
  const idOffset = bookIdMarkerOffsetInUsfm(text);
  if (idOffset === null) return { version, books: [] };
  const book: BookInfo = {
    code: scanUsfmBookCode(text) ?? "",
    position: positionAt(text, idOffset),
    chapters: listChapterMarkersInUsfm(text).map((m) => ({
      number: m.number,
      position: positionAt(text, m.markerOffset),
    })),
  };
  return { version, books: [book] };
}

/** Line/column/offset of a UTF-16 offset (lines split on `\n`). */
function positionAt(text: string, offset: number): Position {
  let line = 0;
  let lineStart = 0;
  for (let nl = text.indexOf("\n"); nl >= 0 && nl < offset; nl = text.indexOf("\n", nl + 1)) {
    line++;
    lineStart = nl + 1;
  }
  return { line, column: offset - lineStart, offset };
}

function previewHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<article class="usfm-document"><pre class="usfm-stub-preview">${escaped}</pre></article>`;
}
