import type { Token, Position } from "./types.js";
import { TokenType } from "./types.js";

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
export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 0;
  private col: number = 0;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 0;
    this.col = 0;

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      if (ch === "\\") {
        this.readMarker();
      } else if (ch === "|") {
        this.readAttributes();
      } else if (ch === "/" && this.peek(1) === "/") {
        this.readOptBreak();
      } else if (ch === "\n" || ch === "\r") {
        this.readNewline();
      } else {
        this.readText();
      }
    }

    return this.tokens;
  }

  private currentPosition(): Position {
    return { line: this.line, column: this.col, offset: this.pos };
  }

  private peek(ahead: number = 0): string | undefined {
    return this.source[this.pos + ahead];
  }

  private advance(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.pos < this.source.length) {
        if (this.source[this.pos] === "\n") {
          this.line++;
          this.col = 0;
        } else {
          this.col++;
        }
        this.pos++;
      }
    }
  }

  private readMarker(): void {
    const position = this.currentPosition();
    this.advance(); // skip backslash

    // Check for escaped characters: \\, \|, \~, \newline
    const ch = this.source[this.pos];
    if (ch === "\\" || ch === "|" || ch === "~") {
      // Escaped special character — treat as text
      const text = ch;
      this.advance();
      this.appendText(text, position);
      return;
    }
    if (ch === "\n" || ch === "\r") {
      // Escaped newline — treat as soft line break in text
      this.readNewline();
      return;
    }

    let isNested = false;
    if (this.source[this.pos] === "+") {
      isNested = true;
      this.advance();
    }

    // Read marker name
    let marker = "";
    while (
      this.pos < this.source.length &&
      /[a-zA-Z_0-9-]/.test(this.source[this.pos])
    ) {
      marker += this.source[this.pos];
      this.advance();
    }

    if (marker === "") {
      // Bare backslash with no following marker name — treat as text
      this.appendText("\\", position);
      return;
    }

    // Check for end marker
    let isEnd = false;
    if (this.pos < this.source.length && this.source[this.pos] === "*") {
      isEnd = true;
      this.advance();
    }

    const token: Token = {
      type: isEnd ? TokenType.EndMarker : TokenType.Marker,
      value: marker,
      position,
      isNested,
      isEnd,
    };

    this.tokens.push(token);
  }

  private readAttributes(): void {
    const position = this.currentPosition();
    this.advance(); // skip pipe

    const attributes: Record<string, string> = {};
    let defaultValue = "";

    // Try to read key="value" pairs
    this.skipSpaces();

    let hasKeyValue = false;
    while (this.pos < this.source.length) {
      // Attempt key="value"
      const keyStart = this.pos;
      let key = "";
      while (
        this.pos < this.source.length &&
        /[a-zA-Z_0-9-]/.test(this.source[this.pos])
      ) {
        key += this.source[this.pos];
        this.advance();
      }

      this.skipSpaces();

      if (key && this.source[this.pos] === "=") {
        this.advance(); // skip =
        this.skipSpaces();

        if (this.source[this.pos] === '"') {
          this.advance(); // skip opening quote
          let value = "";
          while (
            this.pos < this.source.length &&
            this.source[this.pos] !== '"'
          ) {
            if (
              this.source[this.pos] === "\\" &&
              this.peek(1) === '"'
            ) {
              this.advance();
            }
            value += this.source[this.pos];
            this.advance();
          }
          if (this.source[this.pos] === '"') {
            this.advance(); // skip closing quote
          }
          attributes[key] = value;
          hasKeyValue = true;
          this.skipSpaces();
          continue;
        }
      }

      // Not a key=value pair — rewind and read as default attribute text
      if (!hasKeyValue) {
        this.pos = keyStart;
        this.col = position.column + 1;
        this.line = position.line;
        // Recompute position from start
        this.pos = keyStart;
        defaultValue = this.readUntilMarkerEnd();
        break;
      } else {
        // Already have some key=value, stop
        this.pos = keyStart;
        break;
      }
    }

    if (hasKeyValue) {
      this.tokens.push({
        type: TokenType.Attribute,
        value: "",
        position,
        attributes,
      });
    } else if (defaultValue) {
      this.tokens.push({
        type: TokenType.Attribute,
        value: defaultValue,
        position,
      });
    }
  }

  private readUntilMarkerEnd(): string {
    let text = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") break;
      if (ch === "\n" || ch === "\r") break;
      text += ch;
      this.advance();
    }
    return text;
  }

  private readOptBreak(): void {
    const position = this.currentPosition();
    this.advance(); // skip first /
    this.advance(); // skip second /
    this.tokens.push({
      type: TokenType.OptBreak,
      value: "//",
      position,
    });
  }

  private readNewline(): void {
    const position = this.currentPosition();
    if (this.source[this.pos] === "\r") {
      this.advance();
    }
    if (this.pos < this.source.length && this.source[this.pos] === "\n") {
      this.advance();
    }
    this.tokens.push({
      type: TokenType.Newline,
      value: "\n",
      position,
    });
  }

  private readText(): void {
    const position = this.currentPosition();
    let text = "";

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") break;
      if (ch === "|") break;
      if (ch === "\n" || ch === "\r") break;
      if (ch === "/" && this.peek(1) === "/") break;
      text += ch;
      this.advance();
    }

    if (text) {
      this.appendText(text, position);
    }
  }

  private appendText(text: string, position: Position): void {
    // Merge with previous text token if adjacent
    const last = this.tokens[this.tokens.length - 1];
    if (last && last.type === TokenType.Text) {
      last.value += text;
    } else {
      this.tokens.push({
        type: TokenType.Text,
        value: text,
        position,
      });
    }
  }

  private skipSpaces(): void {
    while (
      this.pos < this.source.length &&
      (this.source[this.pos] === " " || this.source[this.pos] === "\t")
    ) {
      this.advance();
    }
  }
}
