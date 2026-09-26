import {
  applyChangesToText,
  createStubLanguageClient,
} from "../src/language-service/stub-client.js";
import {
  DiagnosticSeverity,
  TokenType,
  type AnalysisEvent,
  type Diagnostic,
  type Position,
  type TokenClassification,
  type TokensResult,
  type UsfmLanguageClient,
} from "../src/language-service/protocol.js";

/** Markers the fake reports as unknown. */
const UNKNOWN_MARKERS = new Set(["\\xyz", "\\zzz"]);

/**
 * Test double with just enough analysis for component tests that assert on
 * its effects, which the inert stub never produces: `\marker` tokens are
 * classified by regex (syntax highlighting), and each `\xyz` / `\zzz` marker
 * is pushed as an unknown-marker diagnostic after every open and edit.
 */
export function createFakeLanguageClient(): UsfmLanguageClient {
  const inner = createStubLanguageClient();
  const docs = new Map<string, { version: number; text: string }>();
  const listeners = new Set<(event: AnalysisEvent) => void>();

  function analyze(id: string) {
    setTimeout(() => {
      const doc = docs.get(id);
      if (!doc) return;
      const event = { id, version: doc.version, diagnostics: diagnosticsOf(doc.text) };
      for (const listener of [...listeners]) listener(event);
    }, 0);
  }

  function classify(id: string, from: number, to: number): Promise<TokensResult> {
    const doc = docs.get(id);
    if (!doc) return Promise.reject(new Error(`document not open: ${id}`));
    return Promise.resolve({
      version: doc.version,
      tokens: markerTokens(doc.text).filter(
        (t) => t.range.end.offset! >= from && t.range.start.offset! <= to,
      ),
    });
  }

  // Like the stub (and the engine), lifecycle calls take effect synchronously,
  // so a request issued right after an edit sees the edited text. The stub
  // does the validation; its promise carries any rejection.
  return {
    ...inner,
    openDocument(id, version, text) {
      const pending = inner.openDocument(id, version, text);
      if (!docs.has(id)) {
        docs.set(id, { version, text });
        analyze(id);
      }
      return pending;
    },
    applyChanges(id, version, changes) {
      const pending = inner.applyChanges(id, version, changes);
      const doc = docs.get(id);
      if (doc && version > doc.version) {
        try {
          doc.text = applyChangesToText(doc.text, changes);
          doc.version = version;
          analyze(id);
        } catch {
          // invalid batch: rejected by the stub
        }
      }
      return pending;
    },
    closeDocument(id) {
      docs.delete(id);
      return inner.closeDocument(id);
    },
    async getDiagnostics(id) {
      await inner.getDiagnostics(id); // rejects when not open
      const doc = docs.get(id)!;
      return { version: doc.version, diagnostics: diagnosticsOf(doc.text) };
    },
    classifyDocument: (id) => classify(id, 0, Infinity),
    classifyRange: (id, from, to) => classify(id, from, to),
    onAnalysis(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function markerTokens(text: string): TokenClassification[] {
  const tokens: TokenClassification[] = [];
  for (const m of text.matchAll(/\\\+?[A-Za-z][A-Za-z0-9-]*\*?/g)) {
    const start = m.index!;
    tokens.push({
      range: { start: positionAt(text, start), end: positionAt(text, start + m[0].length) },
      type: m[0].endsWith("*") ? TokenType.EndMarker : TokenType.Marker,
    });
  }
  return tokens;
}

function diagnosticsOf(text: string): Diagnostic[] {
  return markerTokens(text)
    .filter((t) => UNKNOWN_MARKERS.has(text.slice(t.range.start.offset!, t.range.end.offset!)))
    .map((t) => ({
      range: t.range,
      message: "Unknown marker",
      severity: DiagnosticSeverity.Error,
      code: "unknown-marker",
    }));
}

function positionAt(text: string, offset: number): Position {
  let line = 0;
  let lineStart = 0;
  for (let nl = text.indexOf("\n"); nl >= 0 && nl < offset; nl = text.indexOf("\n", nl + 1)) {
    line++;
    lineStart = nl + 1;
  }
  return { line, column: offset - lineStart, offset };
}
