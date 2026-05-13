/** Position in source text */
interface Position {
    line: number;
    column: number;
    offset: number;
}
/** Token types produced by the lexer */
declare enum TokenType {
    Marker = "marker",
    Text = "text",
    Attribute = "attribute",
    OptBreak = "optbreak",
    EndMarker = "end_marker",
    Newline = "newline"
}
/** A single token from the lexer */
interface Token {
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
type MarkerCategory = "identification" | "header" | "title" | "introduction" | "introchar" | "sectionpara" | "versepara" | "char" | "footnote" | "footnotechar" | "crossreference" | "crossreferencechar" | "list" | "listchar" | "cell" | "milestone" | "attribute" | "otherpara" | "internal" | "unknown";
/** AST node types */
type NodeType = "document" | "book" | "chapter" | "verse" | "paragraph" | "char" | "note" | "table" | "row" | "cell" | "milestone" | "figure" | "sidebar" | "optbreak" | "text" | "ref" | "unknown";
/** Base AST node */
interface UsfmNode {
    type: NodeType;
    marker?: string;
    position?: Position;
    attributes?: Record<string, string>;
}
/** Text node */
interface TextNode extends UsfmNode {
    type: "text";
    text: string;
}
/** A node that may contain children */
interface ParentNode extends UsfmNode {
    children: UsfmNode[];
}
/** Document root node */
interface DocumentNode extends ParentNode {
    type: "document";
}
/** Book identification node */
interface BookNode extends ParentNode {
    type: "book";
    code: string;
    description?: string;
}
/** Chapter node */
interface ChapterNode extends ParentNode {
    type: "chapter";
    number: string;
}
/** Verse node */
interface VerseNode extends ParentNode {
    type: "verse";
    number: string;
}
/** Paragraph node (covers all para-style markers) */
interface ParagraphNode extends ParentNode {
    type: "paragraph";
    marker: string;
}
/** Character style node */
interface CharNode extends ParentNode {
    type: "char";
    marker: string;
}
/** Footnote or cross-reference note node */
interface NoteNode extends ParentNode {
    type: "note";
    marker: string;
    caller: string;
}
/** Table node */
interface TableNode extends ParentNode {
    type: "table";
}
/** Table row node */
interface RowNode extends ParentNode {
    type: "row";
}
/** Table cell node */
interface CellNode extends ParentNode {
    type: "cell";
    marker: string;
}
/** Milestone node */
interface MilestoneNode extends UsfmNode {
    type: "milestone";
    marker: string;
}
/** Figure node */
interface FigureNode extends UsfmNode {
    type: "figure";
    marker: string;
}
/** Sidebar node */
interface SidebarNode extends ParentNode {
    type: "sidebar";
}
/** Optional break node */
interface OptBreakNode extends UsfmNode {
    type: "optbreak";
}
/** Reference node */
interface RefNode extends ParentNode {
    type: "ref";
}
type AnyNode = DocumentNode | BookNode | ChapterNode | VerseNode | ParagraphNode | CharNode | NoteNode | TableNode | RowNode | CellNode | MilestoneNode | FigureNode | SidebarNode | OptBreakNode | TextNode | RefNode;
/** Parser options */
interface ParserOptions {
    /** If true, parsing errors throw instead of being collected */
    strict?: boolean;
}
/** A parser error with position info */
interface ParseError {
    message: string;
    position?: Position;
}
/** Result from parsing */
interface ParseResult {
    document: DocumentNode;
    errors: ParseError[];
}

/**
 * Parses USFM text into a document AST.
 */
declare class Parser {
    private tokens;
    private pos;
    private errors;
    private options;
    constructor(options?: ParserOptions);
    /**
     * Parse USFM text and return a structured document.
     */
    parse(input: string): ParseResult;
    private parseDocument;
    private parseTopLevel;
    private parseId;
    private parseChapter;
    private parseVerse;
    private parseParagraph;
    private parseChar;
    private parseNote;
    private parseTableRow;
    private parseCell;
    private parseMilestone;
    private parseFigure;
    private parseSidebar;
    private parseHeaderOrMisc;
    private parseUnknown;
    private parseInlineContent;
    private parseNoteChar;
    private parseInlineAttribute;
    private parseTextRun;
    private consumeTextLine;
    private current;
    private advance;
    private skipNewlines;
    private addError;
}

/**
 * Tokenizes USFM source text into a stream of tokens.
 *
 * The lexer recognizes:
 * - Markers: `\marker` or `\+marker` (nested) or `\marker*` (end)
 * - Text content between markers
 * - Attributes: `|key="value"` or `|default text`
 * - Optional breaks: `//`
 * - Newlines
 */
declare class Lexer {
    private source;
    private pos;
    private line;
    private col;
    private tokens;
    constructor(source: string);
    tokenize(): Token[];
    private currentPosition;
    private peek;
    private advance;
    private readMarker;
    private readAttributes;
    private readUntilMarkerEnd;
    private readOptBreak;
    private readNewline;
    private readText;
    private appendText;
    private skipSpaces;
}

/**
 * Get the category of a marker.
 */
declare function getMarkerCategory(marker: string): MarkerCategory;
/**
 * Check if a marker represents a paragraph-level element.
 */
declare function isParaMarker(marker: string): boolean;
/**
 * Check if a marker represents a character-level element.
 */
declare function isCharMarker(marker: string): boolean;
/**
 * Check if a marker represents a note (footnote/crossref).
 */
declare function isNoteMarker(marker: string): boolean;
/**
 * Check if a marker is a cell marker (table).
 */
declare function isCellMarker(marker: string): boolean;
/**
 * Check if a marker is a milestone marker.
 */
declare function isMilestoneMarker(marker: string): boolean;

/**
 * Parse USFM text into a document AST.
 * This is a convenience function that creates a Parser instance internally.
 *
 * @param input - USFM source text
 * @param options - Parser options
 * @returns Parse result with document tree and any errors
 */
declare function parse(input: string, options?: ParserOptions): ParseResult;

export { type AnyNode, type BookNode, type CellNode, type ChapterNode, type CharNode, type DocumentNode, type FigureNode, Lexer, type MarkerCategory, type MilestoneNode, type NodeType, type NoteNode, type OptBreakNode, type ParagraphNode, type ParentNode, type ParseError, type ParseResult, Parser, type ParserOptions, type Position, type RefNode, type RowNode, type SidebarNode, type TableNode, type TextNode, type Token, TokenType, type UsfmNode, type VerseNode, getMarkerCategory, isCellMarker, isCharMarker, isMilestoneMarker, isNoteMarker, isParaMarker, parse };
