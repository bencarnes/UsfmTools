import type {
  Token,
  ParserOptions,
  ParseResult,
  ParseError,
  DocumentNode,
  BookNode,
  ChapterNode,
  VerseNode,
  ParagraphNode,
  CharNode,
  NoteNode,
  RowNode,
  CellNode,
  MilestoneNode,
  TextNode,
  OptBreakNode,
  UsfmNode,
  ParentNode,
} from "./types.js";
import { TokenType } from "./types.js";
import { Lexer } from "./lexer.js";
import {
  getMarkerCategory,
  isParaMarker,
  isCharMarker,
  isNoteMarker,
  isCellMarker,
  isMilestoneMarker,
  DEFAULT_ATTRIBUTES,
} from "./grammar.js";

/**
 * Parses USFM text into a document AST.
 */
export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private errors: ParseError[] = [];
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = options;
  }

  /**
   * Parse USFM text and return a structured document.
   */
  parse(input: string): ParseResult {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    this.errors = [];

    const document = this.parseDocument();

    return {
      document,
      errors: this.errors,
    };
  }

  private parseDocument(): DocumentNode {
    const doc: DocumentNode = {
      type: "document",
      children: [],
    };

    while (this.pos < this.tokens.length) {
      const node = this.parseTopLevel();
      if (node) {
        doc.children.push(node);
      }
    }

    return doc;
  }

  private parseTopLevel(): UsfmNode | null {
    const token = this.current();
    if (!token) return null;

    if (token.type === TokenType.Marker) {
      const marker = token.value;

      if (marker === "id") {
        return this.parseId();
      }
      if (marker === "c") {
        return this.parseChapter();
      }
      if (marker === "v") {
        return this.parseVerse();
      }
      if (isParaMarker(marker)) {
        return this.parseParagraph();
      }
      if (isCharMarker(marker)) {
        return this.parseChar();
      }
      if (isNoteMarker(marker)) {
        return this.parseNote();
      }
      if (isCellMarker(marker)) {
        return this.parseCell();
      }
      if (isMilestoneMarker(marker)) {
        return this.parseMilestone();
      }
      if (marker === "tr") {
        return this.parseTableRow();
      }
      if (marker === "fig") {
        return this.parseFigure();
      }
      if (marker === "esb") {
        return this.parseSidebar();
      }

      // Header/attribute markers that appear at book level
      const cat = getMarkerCategory(marker);
      if (cat === "header" || cat === "attribute" || cat === "internal") {
        return this.parseHeaderOrMisc();
      }

      // Unknown marker — advance and produce an unknown node
      return this.parseUnknown();
    }

    if (token.type === TokenType.EndMarker) {
      this.addError(
        `Unexpected end marker '\\${token.value}*' with no matching opening marker`,
        token.position,
      );
      this.advance();
      return null;
    }

    if (token.type === TokenType.Text || token.type === TokenType.Newline) {
      return this.parseTextRun();
    }

    // Skip other token types at the top level
    this.advance();
    return null;
  }

  private parseId(): BookNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \id marker

    let code = "";
    let description: string | undefined;

    // The text following \id is: CODE optional-description
    const textToken = this.current();
    if (textToken && (textToken.type === TokenType.Text || textToken.type === TokenType.Newline)) {
      const text = this.consumeTextLine();
      const parts = text.trimStart().split(/\s+/);
      code = parts[0] ?? "";
      if (parts.length > 1) {
        description = parts.slice(1).join(" ").trim();
      }
    }

    const node: BookNode = {
      type: "book",
      marker: "id",
      code,
      position,
      children: [],
    };

    if (description) {
      node.description = description;
    }

    // Parse remaining book-level content (headers, etc.) until next \id or end
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker && cur.value === "id") break;

      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseChapter(): ChapterNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \c

    let number = "";
    const textToken = this.current();
    if (textToken && textToken.type === TokenType.Text) {
      const text = textToken.value.trimStart();
      const parts = text.split(/\s+/);
      number = parts[0] ?? "";
      this.advance();
    }

    // Skip newline after chapter number
    this.skipNewlines();

    const node: ChapterNode = {
      type: "chapter",
      marker: "c",
      number,
      position,
      children: [],
    };

    // Consume chapter-level content
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker && (cur.value === "c" || cur.value === "id")) break;

      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseVerse(): VerseNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \v

    let number = "";
    const textToken = this.current();
    if (textToken && textToken.type === TokenType.Text) {
      const text = textToken.value.trimStart();
      const match = text.match(/^(\S+)\s*(.*)/);
      if (match) {
        number = match[1];
        const remaining = match[2];
        if (remaining) {
          // Replace the current text token with remainder
          this.tokens[this.pos] = {
            ...textToken,
            value: remaining,
          };
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    const node: VerseNode = {
      type: "verse",
      marker: "v",
      number,
      position,
      children: [],
    };

    // Consume verse content until next verse, chapter, or paragraph marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker) {
        if (cur.value === "v" || cur.value === "c" || cur.value === "id") break;
        if (isParaMarker(cur.value)) break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseParagraph(): ParagraphNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: ParagraphNode = {
      type: "paragraph",
      marker,
      position,
      children: [],
    };

    // Skip leading newlines
    this.skipNewlines();

    // Consume paragraph content until next paragraph-level marker, chapter, etc.
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker) {
        if (isParaMarker(cur.value)) break;
        if (cur.value === "c" || cur.value === "id") break;
        if (cur.value === "tr") break;
        if (cur.value === "esb" || cur.value === "esbe") break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseChar(): CharNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: CharNode = {
      type: "char",
      marker,
      position,
      children: [],
    };

    // Consume content until the closing marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;

      if (cur.type === TokenType.EndMarker && cur.value === marker) {
        this.advance();
        break;
      }

      // Capture attributes on the char node
      if (cur.type === TokenType.Attribute) {
        this.applyAttributes(node, cur);
        this.advance();
        continue;
      }

      // Also break on paragraph markers or other structure changes
      if (cur.type === TokenType.Marker) {
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseNote(): NoteNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    let caller = "";

    // First text token after note marker is the caller (e.g. "+", "-", "a")
    const textToken = this.current();
    if (textToken && textToken.type === TokenType.Text) {
      const text = textToken.value.trimStart();
      const parts = text.split(/\s+/);
      caller = parts[0] ?? "";
      const remaining = parts.slice(1).join(" ");
      if (remaining) {
        this.tokens[this.pos] = { ...textToken, value: remaining };
      } else {
        this.advance();
      }
    }

    const node: NoteNode = {
      type: "note",
      marker,
      caller,
      position,
      children: [],
    };

    // Consume note content until end marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;

      if (cur.type === TokenType.EndMarker && cur.value === marker) {
        this.advance();
        break;
      }

      // Break on structural markers
      if (cur.type === TokenType.Marker) {
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseTableRow(): RowNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \tr

    const node: RowNode = {
      type: "row",
      marker: "tr",
      position,
      children: [],
    };

    // Skip newlines after \tr
    this.skipNewlines();

    // Consume cells until next row or non-table marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker) {
        if (cur.value === "tr") break;
        if (isCellMarker(cur.value)) {
          node.children.push(this.parseCell());
          continue;
        }
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }

      if (cur.type === TokenType.Newline) {
        this.advance();
        continue;
      }

      // Preserve non-cell inline content (text, char markers, etc.)
      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseCell(): CellNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: CellNode = {
      type: "cell",
      marker,
      position,
      children: [],
    };

    // Consume cell content until next cell, row, or structure marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker) {
        if (isCellMarker(cur.value) || cur.value === "tr") break;
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }
      if (cur.type === TokenType.Newline) {
        this.advance();
        break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseMilestone(): MilestoneNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: MilestoneNode = {
      type: "milestone",
      marker,
      position,
    };

    // Consume attributes if present
    const next = this.current();
    if (next && next.type === TokenType.Attribute) {
      node.attributes = next.attributes ?? { default: next.value };
      this.advance();
    }

    // Skip trailing end marker if present (\marker*)
    const end = this.current();
    if (end && end.type === TokenType.EndMarker && end.value === marker) {
      this.advance();
    }

    return node;
  }

  private parseFigure(): UsfmNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \fig

    const node: UsfmNode = {
      type: "figure",
      marker: "fig",
      position,
      attributes: {},
    };

    // Consume text and attributes until \fig*
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.EndMarker && cur.value === "fig") {
        this.advance();
        break;
      }
      if (cur.type === TokenType.Attribute) {
        if (cur.attributes) {
          node.attributes = { ...node.attributes, ...cur.attributes };
        } else if (cur.value) {
          node.attributes!["default"] = cur.value;
        }
        this.advance();
        continue;
      }
      if (cur.type === TokenType.Text) {
        // Figure description text stored as caption attribute
        if (!node.attributes!["caption"]) {
          node.attributes!["caption"] = cur.value.trim();
        }
      }
      this.advance();
    }

    return node;
  }

  private parseSidebar(): ParentNode {
    const token = this.current()!;
    const position = token.position;
    this.advance(); // skip \esb

    const node: ParentNode = {
      type: "sidebar",
      marker: "esb",
      position,
      children: [],
    };

    this.skipNewlines();

    // Consume until \esbe
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Marker && cur.value === "esbe") {
        this.advance();
        break;
      }

      const child = this.parseTopLevel();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseHeaderOrMisc(): ParagraphNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: ParagraphNode = {
      type: "paragraph",
      marker,
      position,
      children: [],
    };

    // Consume content on this line (text, char styles, attributes, etc.)
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Newline) {
        this.advance();
        break;
      }
      // A new paragraph-level or structural marker ends this header line
      if (cur.type === TokenType.Marker) {
        if (isParaMarker(cur.value) || cur.value === "c" || cur.value === "id") break;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseUnknown(): UsfmNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    this.addError(`Unknown marker '\\${marker}'`, position);

    const node: UsfmNode = {
      type: "unknown",
      marker,
      position,
    };
    return node;
  }

  private parseInlineContent(): UsfmNode | null {
    const cur = this.current();
    if (!cur) return null;

    if (cur.type === TokenType.Text) {
      return this.parseTextRun();
    }

    if (cur.type === TokenType.Newline) {
      // Convert newlines in inline content to space text nodes
      this.advance();
      const node: TextNode = {
        type: "text",
        text: " ",
        position: cur.position,
      };
      return node;
    }

    if (cur.type === TokenType.Marker) {
      const marker = cur.value;
      if (marker === "v") {
        return this.parseVerse();
      }

      const cat = getMarkerCategory(marker);

      // Handle footnote/crossref char markers before general char markers,
      // since they have implicit closure semantics
      if (cat === "footnotechar" || cat === "crossreferencechar") {
        return this.parseNoteChar(cat);
      }
      if (isCharMarker(marker)) {
        return this.parseChar();
      }
      if (isNoteMarker(marker)) {
        return this.parseNote();
      }
      if (isMilestoneMarker(marker)) {
        return this.parseMilestone();
      }

      // Handle attribute markers that appear inline (like \ca, \va, \vp)
      if (cat === "attribute") {
        return this.parseInlineAttribute();
      }

      // Unknown inline marker
      return this.parseUnknown();
    }

    if (cur.type === TokenType.EndMarker) {
      this.addError(
        `Unexpected end marker '\\${cur.value}*' with no matching opening marker`,
        cur.position,
      );
      this.advance();
      return null;
    }

    if (cur.type === TokenType.OptBreak) {
      this.advance();
      const node: OptBreakNode = {
        type: "optbreak",
        position: cur.position,
      };
      return node;
    }

    if (cur.type === TokenType.Attribute) {
      // Attribute token not consumed by a char/note-char node — skip but warn
      this.addError(
        `Attribute data not attached to any marker`,
        cur.position,
      );
      this.advance();
      return null;
    }

    this.advance();
    return null;
  }

  private parseNoteChar(
    _category: string,
  ): CharNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: CharNode = {
      type: "char",
      marker,
      position,
      children: [],
    };

    // Consume until end marker or next note-char or note end
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;

      if (cur.type === TokenType.EndMarker && cur.value === marker) {
        this.advance();
        break;
      }
      // Implicitly closed by next footnotechar/crossreferencechar
      if (cur.type === TokenType.Marker) {
        const cat = getMarkerCategory(cur.value);
        if (
          cat === "footnotechar" ||
          cat === "crossreferencechar"
        ) {
          break;
        }
        if (isNoteMarker(cur.value)) break;
        if (isParaMarker(cur.value)) break;
      }
      if (cur.type === TokenType.EndMarker) {
        // End of parent note — don't consume
        break;
      }

      // Capture attributes on the note-char node
      if (cur.type === TokenType.Attribute) {
        this.applyAttributes(node, cur);
        this.advance();
        continue;
      }

      const child = this.parseInlineContent();
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  }

  private parseInlineAttribute(): UsfmNode {
    const token = this.current()!;
    const position = token.position;
    const marker = token.value;
    this.advance();

    const node: CharNode = {
      type: "char",
      marker,
      position,
      children: [],
    };

    // Consume content until end marker
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.EndMarker && cur.value === marker) {
        this.advance();
        break;
      }
      if (cur.type === TokenType.Marker) break;
      if (cur.type === TokenType.Newline) break;

      if (cur.type === TokenType.Text) {
        node.children.push({
          type: "text",
          text: cur.value,
          position: cur.position,
        } as TextNode);
      }
      this.advance();
    }

    return node;
  }

  private parseTextRun(): TextNode {
    const token = this.current()!;
    let text = token.value;
    const position = token.position;
    this.advance();

    // Merge consecutive text and newline tokens
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Text) {
        text += cur.value;
        this.advance();
      } else {
        break;
      }
    }

    return {
      type: "text",
      text,
      position,
    };
  }

  private consumeTextLine(): string {
    let text = "";
    while (this.pos < this.tokens.length) {
      const cur = this.current();
      if (!cur) break;
      if (cur.type === TokenType.Text) {
        text += cur.value;
        this.advance();
      } else if (cur.type === TokenType.Newline) {
        this.advance();
        break;
      } else {
        break;
      }
    }
    return text;
  }

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): void {
    this.pos++;
  }

  private skipNewlines(): void {
    while (
      this.pos < this.tokens.length &&
      this.tokens[this.pos].type === TokenType.Newline
    ) {
      this.pos++;
    }
  }

  /**
   * Apply an Attribute token to a node. Handles both key-value attributes
   * and positional (default) attributes using DEFAULT_ATTRIBUTES.
   */
  private applyAttributes(node: CharNode, token: Token): void {
    if (!node.attributes) {
      node.attributes = {};
    }

    if (token.attributes && Object.keys(token.attributes).length > 0) {
      Object.assign(node.attributes, token.attributes);
    } else if (token.value) {
      const defaultKey = DEFAULT_ATTRIBUTES[node.marker];
      if (defaultKey) {
        node.attributes[defaultKey] = token.value;
      } else {
        node.attributes["default"] = token.value;
      }
    }
  }

  private addError(message: string, position?: { line: number; column: number; offset: number }): void {
    const error: ParseError = { message, position };
    this.errors.push(error);
    if (this.options.strict) {
      throw new Error(`Parse error at ${position?.line}:${position?.column}: ${message}`);
    }
  }
}
