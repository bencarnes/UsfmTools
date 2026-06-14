import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags, Tag } from "@lezer/highlight";
import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { linter } from "@codemirror/lint";
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Diagnostic as LanguageDiagnostic } from "../../language-service/protocol.js";
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { createLanguageClient } from "../../language-service/index.js";
import type { TokenClassification } from "../../language-service/index.js";
import { TokenType } from "../../language-service/index.js";

const client = createLanguageClient();

// --- Custom tags for USFM token types ---
const usfmMarkerTag = Tag.define(tags.keyword);
const usfmEndMarkerTag = Tag.define(tags.keyword);
const usfmVerseNumTag = Tag.define(tags.number);
const usfmChapterNumTag = Tag.define(tags.heading);
const usfmAttributeTag = Tag.define(tags.attributeName);
const usfmAttributeValueTag = Tag.define(tags.attributeValue);

export const usfmHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: usfmMarkerTag, color: "var(--usfm-syntax-marker)", fontWeight: "bold" },
    { tag: usfmEndMarkerTag, color: "var(--usfm-syntax-endmarker)", fontWeight: "bold" },
    { tag: usfmVerseNumTag, color: "var(--usfm-syntax-verse)", fontWeight: "bold" },
    { tag: usfmChapterNumTag, color: "var(--usfm-syntax-chapter)", fontWeight: "bold", fontSize: "1.1em" },
    { tag: usfmAttributeTag, color: "var(--usfm-syntax-attribute)" },
    { tag: usfmAttributeValueTag, color: "var(--usfm-syntax-attrvalue)" },
  ]),
);

function tagForTokenType(type: TokenType): Tag {
  switch (type) {
    case TokenType.Marker:
      return usfmMarkerTag;
    case TokenType.EndMarker:
      return usfmEndMarkerTag;
    case TokenType.VerseNumber:
      return usfmVerseNumTag;
    case TokenType.ChapterNumber:
      return usfmChapterNumTag;
    case TokenType.Attribute:
      return usfmAttributeTag;
    case TokenType.AttributeValue:
      return usfmAttributeValueTag;
    default:
      return tags.content;
  }
}

// --- Decoration classes for token highlighting ---
const markerDeco = Decoration.mark({ class: "cm-usfm-marker" });
const endMarkerDeco = Decoration.mark({ class: "cm-usfm-endmarker" });
const verseNumDeco = Decoration.mark({ class: "cm-usfm-versenum" });
const chapterNumDeco = Decoration.mark({ class: "cm-usfm-chapternum" });
const attributeDeco = Decoration.mark({ class: "cm-usfm-attribute" });
const attributeValueDeco = Decoration.mark({ class: "cm-usfm-attrvalue" });

function decoForTokenType(type: TokenType) {
  switch (type) {
    case TokenType.Marker:
      return markerDeco;
    case TokenType.EndMarker:
      return endMarkerDeco;
    case TokenType.VerseNumber:
      return verseNumDeco;
    case TokenType.ChapterNumber:
      return chapterNumDeco;
    case TokenType.Attribute:
      return attributeDeco;
    case TokenType.AttributeValue:
      return attributeValueDeco;
    default:
      return null;
  }
}

function posToOffset(doc: { line: (n: number) => { from: number } }, pos: { line: number; column: number }): number {
  const lineInfo = doc.line(pos.line + 1); // CodeMirror lines are 1-based
  return lineInfo.from + pos.column;
}

const HIGHLIGHT_MARGIN_LINES = 5;
const HIGHLIGHT_DEBOUNCE_MS = 100;

function viewportCharRange(view: EditorView): { from: number; to: number } {
  const doc = view.state.doc;
  const { from, to } = view.viewport;
  const fromLine = doc.lineAt(from);
  const toLine = doc.lineAt(to);
  const startLine = Math.max(1, fromLine.number - HIGHLIGHT_MARGIN_LINES);
  const endLine = Math.min(doc.lines, toLine.number + HIGHLIGHT_MARGIN_LINES);
  return {
    from: doc.line(startLine).from,
    to: doc.line(endLine).to,
  };
}

function decorationsForTokens(
  doc: EditorView["state"]["doc"],
  tokens: TokenClassification[],
): Array<{ from: number; to: number; value: Decoration }> {
  const sorted = [...tokens].sort((a: TokenClassification, b: TokenClassification) => {
    const aOff = posToOffset(doc, a.range.start);
    const bOff = posToOffset(doc, b.range.start);
    return aOff - bOff;
  });

  const ranges: Array<{ from: number; to: number; value: Decoration }> = [];
  for (const token of sorted) {
    const deco = decoForTokenType(token.type);
    if (!deco) continue;
    try {
      const from = posToOffset(doc, token.range.start);
      const to = posToOffset(doc, token.range.end);
      if (from < to && to <= doc.length) {
        ranges.push({ from, to, value: deco });
      }
    } catch {
      // Skip tokens with invalid positions
    }
  }
  return ranges;
}

// --- Highlight plugin (viewport-scoped, incremental decorations) ---
export const usfmHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    view: EditorView;
    pending: ReturnType<typeof setTimeout> | null = null;
    generation = 0;

    constructor(view: EditorView) {
      this.view = view;
      this.decorations = Decoration.none;
      this.scheduleRefresh();
    }

    update(update: ViewUpdate) {
      this.view = update.view;

      if (update.docChanged) {
        const viewport = viewportCharRange(this.view);
        let replacedMost = false;
        let overlapsViewport = false;

        update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
          const changeSize = Math.max(toA - fromA, toB - fromB);
          if (changeSize > this.view.state.doc.length * 0.4) {
            replacedMost = true;
          }
          if (fromB < viewport.to && toB > viewport.from) {
            overlapsViewport = true;
          }
        });

        if (replacedMost) {
          this.decorations = Decoration.none;
          overlapsViewport = true;
        } else {
          this.decorations = this.decorations.map(update.changes);
        }

        if (overlapsViewport) this.scheduleRefresh();
      } else if (update.viewportChanged) {
        this.scheduleRefresh();
      }
    }

    destroy() {
      if (this.pending) clearTimeout(this.pending);
    }

    scheduleRefresh() {
      if (this.pending) clearTimeout(this.pending);
      this.pending = setTimeout(() => {
        this.pending = null;
        void this.refreshViewport();
      }, HIGHLIGHT_DEBOUNCE_MS);
    }

    async refreshViewport() {
      const gen = ++this.generation;
      const view = this.view;
      const { from, to } = viewportCharRange(view);
      const content = view.state.doc.toString();
      const tokens = await client.classifyRange(content, from, to);
      if (gen !== this.generation || !view.dom.isConnected) return;

      const ranges = decorationsForTokens(view.state.doc, tokens);
      this.decorations = this.decorations.update({
        filter: (f, t) => t <= from || f >= to,
        add: ranges,
      });
      view.dispatch();
    }
  },
  { decorations: (v) => v.decorations },
);

// --- Linter (diagnostics supplied by the shell via setDiagnostics) ---
export function languageDiagnosticsToCm(
  doc: { length: number; line: (n: number) => { from: number } },
  diagnostics: readonly LanguageDiagnostic[],
): CmDiagnostic[] {
  return diagnostics.map((d) => {
    const from = posToOffset(doc, d.range.start);
    const to = posToOffset(doc, d.range.end);
    return {
      from: Math.max(0, from),
      to: Math.min(doc.length, to),
      severity: "error",
      message: d.message,
    };
  });
}

/** Enables lint UI; diagnostics are pushed with {@link setDiagnostics} from UsfmEditor. */
export const usfmLintExtension = linter(null);

// --- Autocomplete ---
async function usfmCompletionSource(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const before = context.matchBefore(/\\[+a-zA-Z0-9-]*/);
  if (!before) return null;

  const content = context.state.doc.toString();
  const line = context.state.doc.lineAt(context.pos);
  const lineNum = line.number - 1; // 0-based
  const col = context.pos - line.from;

  const items = await client.complete(content, lineNum, col);
  if (items.length === 0) return null;

  return {
    from: before.from,
    options: items.map((item) => ({
      label: item.label,
      detail: item.detail,
      apply: item.insertText,
    })),
  };
}

export const usfmAutocomplete = autocompletion({
  override: [usfmCompletionSource],
  activateOnTyping: true,
});

// Suppress unused exports — these are used for theming extensibility
void tagForTokenType;
void usfmHighlightStyle;
