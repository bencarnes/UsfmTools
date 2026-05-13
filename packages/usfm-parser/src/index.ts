export { Parser } from "./parser.js";
export { Lexer } from "./lexer.js";
export {
  getMarkerCategory,
  isParaMarker,
  isCharMarker,
  isNoteMarker,
  isCellMarker,
  isMilestoneMarker,
} from "./grammar.js";
export type {
  Position,
  Token,
  TokenType,
  MarkerCategory,
  NodeType,
  UsfmNode,
  TextNode,
  ParentNode,
  DocumentNode,
  BookNode,
  ChapterNode,
  VerseNode,
  ParagraphNode,
  CharNode,
  NoteNode,
  TableNode,
  RowNode,
  CellNode,
  MilestoneNode,
  FigureNode,
  SidebarNode,
  OptBreakNode,
  RefNode,
  AnyNode,
  ParserOptions,
  ParseError,
  ParseResult,
} from "./types.js";

import { Parser } from "./parser.js";
import type { ParseResult, ParserOptions } from "./types.js";

/**
 * Parse USFM text into a document AST.
 * This is a convenience function that creates a Parser instance internally.
 *
 * @param input - USFM source text
 * @param options - Parser options
 * @returns Parse result with document tree and any errors
 */
export function parse(input: string, options?: ParserOptions): ParseResult {
  const parser = new Parser(options);
  return parser.parse(input);
}
