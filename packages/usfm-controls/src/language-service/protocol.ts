/**
 * Message protocol for the USFM language service.
 * Modeled after LSP but simplified for USFM-specific use.
 */

export interface Position {
  line: number;
  column: number;
  /** Offset from the document start in UTF-16 code units (Go engine only). */
  offset?: number;
  /** Byte offset into the UTF-8 source (Go engine only). */
  byte?: number;
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
  /** Machine-readable problem kind, e.g. "unknown-marker" (Go engine only). */
  code?: string;
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

// --- Stateful language client (LSP-like document lifecycle) ---

/**
 * One text replacement in an edit batch. `from`/`to` are UTF-16 code-unit
 * offsets into the document as it was before the whole batch was applied —
 * the convention of CodeMirror's `ChangeSet.iterChanges`. A batch must be
 * sorted ascending by `from` with non-overlapping ranges.
 */
export interface DocumentChange {
  from: number;
  to: number;
  text: string;
}

/** Diagnostics for a document as of the analyzed `version`. */
export interface DiagnosticsResult {
  version: number;
  diagnostics: Diagnostic[];
}

/** Syntax classification for a document or range as of `version`. */
export interface TokensResult {
  version: number;
  tokens: TokenClassification[];
}

/** One `\c` marker in a book. */
export interface ChapterInfo {
  number: string;
  position: Position;
}

/** Outline of one `\id` book: where it starts and its chapters in order. */
export interface BookInfo {
  code: string;
  description?: string;
  position: Position;
  chapters: ChapterInfo[];
}

/** Book/chapter outline of a document as of the analyzed `version`. */
export interface StructureResult {
  version: number;
  books: BookInfo[];
}

/** A pushed analysis result for one document. */
export type AnalysisEvent = { id: string } & DiagnosticsResult;

/** Options for {@link UsfmLanguageClient.renderPreview}. */
export interface PreviewOptions {
  /** Render each verse on its own preview line. */
  versePerLine?: boolean;
}

/**
 * Stateful USFM language client, modeled on the LSP document lifecycle but
 * simplified. The client keeps a copy of each open document, synced by the
 * editor via openDocument / applyChanges / closeDocument with monotonically
 * increasing versions; analysis runs asynchronously and fresh diagnostics
 * are pushed to onAnalysis listeners. Feature results carry the analyzed
 * version, which may briefly lag the document version while re-analysis is
 * in flight (a push follows when it lands).
 *
 * Implementations: the Wails-backed adapter in bible-edit (Go engine).
 */
export interface UsfmLanguageClient {
  /** Register a document. id is any stable identifier (e.g. file path). */
  openDocument(id: string, version: number, text: string): Promise<void>;
  /**
   * Apply an edit batch, moving the document to `version` (must be greater
   * than the current version; out-of-order batches are rejected).
   */
  applyChanges(id: string, version: number, changes: DocumentChange[]): Promise<void>;
  /** Forget a document. No further analyses are pushed for it. */
  closeDocument(id: string): Promise<void>;
  /** Pull the latest diagnostics. */
  getDiagnostics(id: string): Promise<DiagnosticsResult>;
  /** Pull the book/chapter outline. */
  getStructure(id: string): Promise<StructureResult>;
  /** Classify the whole document for syntax highlighting. */
  classifyDocument(id: string): Promise<TokensResult>;
  /** Classify the slice between UTF-16 offsets (e.g. the viewport). */
  classifyRange(id: string, from: number, to: number): Promise<TokensResult>;
  /** Completions at a cursor position (0-based line, UTF-16 column). */
  getCompletions(id: string, line: number, column: number): Promise<CompletionItem[]>;
  /**
   * Render a USFM string as publication-style preview HTML. Takes text
   * rather than a document id because the preview renders debounced
   * snapshots and must work for tabs whose editor (and therefore synced
   * document) is not mounted, e.g. in preview-only view mode.
   */
  renderPreview(text: string, options?: PreviewOptions): Promise<string>;
  /** Subscribe to pushed analyses. Returns an unsubscribe function. */
  onAnalysis(listener: (event: AnalysisEvent) => void): () => void;
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
