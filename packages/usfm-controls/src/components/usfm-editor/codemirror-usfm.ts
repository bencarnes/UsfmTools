import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags, Tag } from "@lezer/highlight";
import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { linter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
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
    { tag: usfmMarkerTag, color: "#1e40af", fontWeight: "bold" },
    { tag: usfmEndMarkerTag, color: "#6b21a8", fontWeight: "bold" },
    { tag: usfmVerseNumTag, color: "#b91c1c", fontWeight: "bold" },
    { tag: usfmChapterNumTag, color: "#c2410c", fontWeight: "bold", fontSize: "1.1em" },
    { tag: usfmAttributeTag, color: "#0f766e" },
    { tag: usfmAttributeValueTag, color: "#15803d" },
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

// --- Highlight plugin ---
export const usfmHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    pending: ReturnType<typeof setTimeout> | null = null;

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        if (this.pending) clearTimeout(this.pending);
        this.pending = setTimeout(() => this.computeDecorations(update.view), 100);
      }
    }

    async computeDecorations(view: EditorView) {
      const content = view.state.doc.toString();
      const tokens = await client.classify(content);
      const builder = new RangeSetBuilder<Decoration>();

      const sorted = tokens.sort((a: TokenClassification, b: TokenClassification) => {
        const aOff = posToOffset(view.state.doc, a.range.start);
        const bOff = posToOffset(view.state.doc, b.range.start);
        return aOff - bOff;
      });

      for (const token of sorted) {
        const deco = decoForTokenType(token.type);
        if (!deco) continue;
        try {
          const from = posToOffset(view.state.doc, token.range.start);
          const to = posToOffset(view.state.doc, token.range.end);
          if (from < to && to <= view.state.doc.length) {
            builder.add(from, to, deco);
          }
        } catch {
          // Skip tokens with invalid positions
        }
      }

      this.decorations = builder.finish();
      view.dispatch({ effects: [] }); // Trigger re-render
    }
  },
  { decorations: (v) => v.decorations },
);

// --- Linter (diagnostics / red squiggles) ---
export const usfmLinter = linter(async (view) => {
  const content = view.state.doc.toString();
  const diagnostics = await client.validate(content);

  return diagnostics.map((d): CmDiagnostic => {
    const from = posToOffset(view.state.doc, d.range.start);
    const to = posToOffset(view.state.doc, d.range.end);
    return {
      from: Math.max(0, from),
      to: Math.min(view.state.doc.length, to),
      severity: "error",
      message: d.message,
    };
  });
}, { delay: 300 });

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
