/** Position in source text */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/** Token types produced by the lexer */
export enum TokenType {
  Marker = "marker",
  Text = "text",
  Attribute = "attribute",
  OptBreak = "optbreak",
  EndMarker = "end_marker",
  Newline = "newline",
}

/** A single token from the lexer */
export interface Token {
  type: TokenType;
  value: string;
  position: Position;
  /** Whether this is a nested ('+' prefixed) marker */
  isNested?: boolean;
  /** Whether this is a closing marker (ends with '*') */
  isEnd?: boolean;
  /** Parsed attributes if present */
  attributes?: Record<string, string>;
}

/** USFM marker category */
export type MarkerCategory =
  | "identification"
  | "header"
  | "title"
  | "introduction"
  | "introchar"
  | "sectionpara"
  | "versepara"
  | "char"
  | "footnote"
  | "footnotechar"
  | "crossreference"
  | "crossreferencechar"
  | "list"
  | "listchar"
  | "cell"
  | "milestone"
  | "attribute"
  | "otherpara"
  | "internal"
  | "unknown";

/** AST node types */
export type NodeType =
  | "document"
  | "book"
  | "chapter"
  | "verse"
  | "paragraph"
  | "char"
  | "note"
  | "table"
  | "row"
  | "cell"
  | "milestone"
  | "figure"
  | "sidebar"
  | "optbreak"
  | "text"
  | "ref"
  | "unknown";

/** Base AST node */
export interface UsfmNode {
  type: NodeType;
  marker?: string;
  position?: Position;
  attributes?: Record<string, string>;
}

/** Text node */
export interface TextNode extends UsfmNode {
  type: "text";
  text: string;
}

/** A node that may contain children */
export interface ParentNode extends UsfmNode {
  children: UsfmNode[];
}

/** Document root node */
export interface DocumentNode extends ParentNode {
  type: "document";
}

/** Book identification node */
export interface BookNode extends ParentNode {
  type: "book";
  code: string;
  description?: string;
}

/** Chapter node */
export interface ChapterNode extends ParentNode {
  type: "chapter";
  number: string;
}

/** Verse node */
export interface VerseNode extends ParentNode {
  type: "verse";
  number: string;
}

/** Paragraph node (covers all para-style markers) */
export interface ParagraphNode extends ParentNode {
  type: "paragraph";
  marker: string;
}

/** Character style node */
export interface CharNode extends ParentNode {
  type: "char";
  marker: string;
}

/** Footnote or cross-reference note node */
export interface NoteNode extends ParentNode {
  type: "note";
  marker: string;
  caller: string;
}

/** Table node */
export interface TableNode extends ParentNode {
  type: "table";
}

/** Table row node */
export interface RowNode extends ParentNode {
  type: "row";
}

/** Table cell node */
export interface CellNode extends ParentNode {
  type: "cell";
  marker: string;
}

/** Milestone node */
export interface MilestoneNode extends UsfmNode {
  type: "milestone";
  marker: string;
}

/** Figure node */
export interface FigureNode extends UsfmNode {
  type: "figure";
  marker: string;
}

/** Sidebar node */
export interface SidebarNode extends ParentNode {
  type: "sidebar";
}

/** Optional break node */
export interface OptBreakNode extends UsfmNode {
  type: "optbreak";
}

/** Reference node */
export interface RefNode extends ParentNode {
  type: "ref";
}

export type AnyNode =
  | DocumentNode
  | BookNode
  | ChapterNode
  | VerseNode
  | ParagraphNode
  | CharNode
  | NoteNode
  | TableNode
  | RowNode
  | CellNode
  | MilestoneNode
  | FigureNode
  | SidebarNode
  | OptBreakNode
  | TextNode
  | RefNode;

/** Parser options */
export interface ParserOptions {
  /** If true, parsing errors throw instead of being collected */
  strict?: boolean;
}

/** A parser error with position info */
export interface ParseError {
  message: string;
  position?: Position;
}

/** Result from parsing */
export interface ParseResult {
  document: DocumentNode;
  errors: ParseError[];
}
