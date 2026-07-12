import { parse } from "@usfm-tools/parser";
import type {
  AnalysisEvent,
  BookInfo,
  CompletionItem,
  Diagnostic,
  DiagnosticsResult,
  DocumentChange,
  Position,
  StructureResult,
  TokensResult,
  UsfmLanguageClient,
} from "./protocol.js";
import { getDiagnostics } from "./diagnostics.js";
import { getCompletions } from "./completions.js";
import { classifyTokens, classifyTokensInRange } from "./classifier.js";

/** How long a document stays quiet after an edit before it is re-analyzed. */
const DEFAULT_ANALYSIS_DEBOUNCE_MS = 150;

export interface LocalLanguageClientOptions {
  /** Analysis debounce after edits; 0 analyzes on the next task. */
  readonly analysisDebounceMs?: number;
}

interface LocalDocument {
  version: number;
  text: string;
  analysisTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * In-process {@link UsfmLanguageClient} backed by the TypeScript language
 * service, mirroring the Go engine's semantics (version-gated incremental
 * sync, push analyses). It keeps component stories and tests self-contained;
 * applications with a Go engine available (bible-edit) should inject their
 * engine-backed client instead.
 */
export function createLocalLanguageClient(
  options?: LocalLanguageClientOptions,
): UsfmLanguageClient {
  const debounceMs = options?.analysisDebounceMs ?? DEFAULT_ANALYSIS_DEBOUNCE_MS;
  const docs = new Map<string, LocalDocument>();
  const listeners = new Set<(event: AnalysisEvent) => void>();

  function analyze(id: string): { version: number; diagnostics: Diagnostic[] } | null {
    const doc = docs.get(id);
    if (!doc) return null;
    const diagnostics = getDiagnostics(doc.text);
    for (const d of diagnostics) {
      addOffsets(doc.text, d.range.start);
      addOffsets(doc.text, d.range.end);
    }
    return { version: doc.version, diagnostics };
  }

  function scheduleAnalysis(id: string) {
    const doc = docs.get(id);
    if (!doc) return;
    if (doc.analysisTimer) clearTimeout(doc.analysisTimer);
    doc.analysisTimer = setTimeout(() => {
      doc.analysisTimer = null;
      // Re-check: the document may have been closed while waiting.
      const result = analyze(id);
      if (!result) return;
      for (const listener of [...listeners]) listener({ id, ...result });
    }, debounceMs);
  }

  function mustGet(id: string): LocalDocument {
    const doc = docs.get(id);
    if (!doc) throw new Error(`document not open: ${id}`);
    return doc;
  }

  return {
    openDocument(id, version, text) {
      if (docs.has(id)) {
        return Promise.reject(new Error(`document already open: ${id}`));
      }
      docs.set(id, { version, text, analysisTimer: null });
      scheduleAnalysis(id);
      return Promise.resolve();
    },

    applyChanges(id, version, changes) {
      const doc = docs.get(id);
      if (!doc) return Promise.reject(new Error(`document not open: ${id}`));
      if (version <= doc.version) {
        return Promise.reject(
          new Error(`stale document version: at ${doc.version}, got ${version}`),
        );
      }
      try {
        doc.text = applyChangesToText(doc.text, changes);
      } catch (err) {
        return Promise.reject(err);
      }
      doc.version = version;
      scheduleAnalysis(id);
      return Promise.resolve();
    },

    closeDocument(id) {
      const doc = docs.get(id);
      if (!doc) return Promise.reject(new Error(`document not open: ${id}`));
      if (doc.analysisTimer) clearTimeout(doc.analysisTimer);
      docs.delete(id);
      return Promise.resolve();
    },

    getDiagnostics(id): Promise<DiagnosticsResult> {
      try {
        mustGet(id);
        return Promise.resolve(analyze(id)!);
      } catch (err) {
        return Promise.reject(err);
      }
    },

    getStructure(id): Promise<StructureResult> {
      try {
        const doc = mustGet(id);
        return Promise.resolve({ version: doc.version, books: structureOf(doc.text) });
      } catch (err) {
        return Promise.reject(err);
      }
    },

    classifyDocument(id): Promise<TokensResult> {
      try {
        const doc = mustGet(id);
        return Promise.resolve({ version: doc.version, tokens: classifyTokens(doc.text) });
      } catch (err) {
        return Promise.reject(err);
      }
    },

    classifyRange(id, from, to): Promise<TokensResult> {
      try {
        const doc = mustGet(id);
        return Promise.resolve({
          version: doc.version,
          tokens: classifyTokensInRange(doc.text, from, to),
        });
      } catch (err) {
        return Promise.reject(err);
      }
    },

    getCompletions(id, line, column): Promise<CompletionItem[]> {
      try {
        const doc = mustGet(id);
        return Promise.resolve(getCompletions(doc.text, line, column));
      } catch (err) {
        return Promise.reject(err);
      }
    },

    onAnalysis(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let shared: UsfmLanguageClient | null = null;

/**
 * Lazily created process-wide local client, used as the default when no
 * client is injected (component stories, tests, standalone library use).
 */
export function sharedLocalLanguageClient(): UsfmLanguageClient {
  shared ??= createLocalLanguageClient();
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

/** Fill in the UTF-16 document offset for a line/column position. */
function addOffsets(text: string, pos: Position) {
  if (pos.offset != null) return;
  let offset = 0;
  let line = 0;
  while (line < pos.line) {
    const nl = text.indexOf("\n", offset);
    if (nl < 0) break;
    offset = nl + 1;
    line++;
  }
  pos.offset = offset + pos.column;
}

/** Book/chapter outline from a fresh parse (matches the Go engine's Structure). */
function structureOf(text: string): BookInfo[] {
  const books: BookInfo[] = [];
  for (const node of parse(text).document.children) {
    if (node.type !== "book" || !node.position) continue;
    const book: BookInfo = {
      code: (node as { code?: string }).code ?? "",
      description: (node as { description?: string }).description,
      position: node.position,
      chapters: [],
    };
    for (const child of (node as { children?: readonly unknown[] }).children ?? []) {
      const c = child as { type?: string; number?: string; position?: Position };
      if (c.type === "chapter" && c.position) {
        book.chapters.push({ number: c.number ?? "", position: c.position });
      }
    }
    books.push(book);
  }
  return books;
}
