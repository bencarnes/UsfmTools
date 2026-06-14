/**
 * Message protocol for the USFM language service.
 * Modeled after LSP but simplified for USFM-specific use.
 */

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Info = 3,
  Hint = 4,
}

export interface Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
}

export interface CompletionItem {
  label: string;
  detail?: string;
  insertText: string;
}

export interface TokenClassification {
  range: Range;
  type: TokenType;
}

export enum TokenType {
  Marker = "marker",
  EndMarker = "endMarker",
  Text = "text",
  Attribute = "attribute",
  AttributeValue = "attributeValue",
  VerseNumber = "verseNumber",
  ChapterNumber = "chapterNumber",
  Caller = "caller",
}

// --- Request/Response types ---

export type RequestMessage =
  | { type: "validate"; id: string; content: string }
  | { type: "complete"; id: string; content: string; position: Position }
  | { type: "classify"; id: string; content: string }
  | { type: "classifyRange"; id: string; content: string; from: number; to: number };

export type ResponseMessage =
  | { type: "validate"; id: string; diagnostics: Diagnostic[] }
  | { type: "complete"; id: string; items: CompletionItem[] }
  | { type: "classify"; id: string; tokens: TokenClassification[] }
  | { type: "classifyRange"; id: string; tokens: TokenClassification[] };
