import { Lexer } from "@usfm-tools/parser";
import type { Token } from "@usfm-tools/parser";
import type { TokenClassification } from "./protocol.js";
import { TokenType } from "./protocol.js";

/** 0-based line index at a UTF-16 offset (handles `\\r\\n`). */
export function lineIndexAtOffset(content: string, offset: number): number {
  let line = 0;
  const end = Math.min(offset, content.length);
  for (let i = 0; i < end; i++) {
    if (content[i] === "\n") line++;
    else if (content[i] === "\r" && content[i + 1] === "\n") {
      line++;
      i++;
    }
  }
  return line;
}

/** UTF-16 offset of the start of the line containing `offset`. */
export function lineStartOffset(content: string, offset: number): number {
  let i = Math.min(offset, content.length);
  while (i > 0) {
    const ch = content[i - 1];
    if (ch === "\n" || ch === "\r") return i;
    i--;
  }
  return 0;
}

function offsetRangeClassifications(
  tokens: TokenClassification[],
  lineOffset: number,
): TokenClassification[] {
  if (lineOffset === 0) return tokens;
  return tokens.map((token) => ({
    type: token.type,
    range: {
      start: {
        line: token.range.start.line + lineOffset,
        column: token.range.start.column,
      },
      end: {
        line: token.range.end.line + lineOffset,
        column: token.range.end.column,
      },
    },
  }));
}

function isMarker(token: Token): boolean {
  return token.type === "marker";
}

function isEndMarker(token: Token): boolean {
  return token.type === "end_marker";
}

function isAttribute(token: Token): boolean {
  return token.type === "attribute";
}

function isText(token: Token): boolean {
  return token.type === "text";
}

export function classifyTokens(content: string): TokenClassification[] {
  const lexer = new Lexer(content);
  const tokens = lexer.tokenize();
  const classifications: TokenClassification[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const startLine = token.position.line;
    const startCol = token.position.column;

    let type: TokenType;
    let length: number;

    if (isMarker(token)) {
      type = TokenType.Marker;
      length = 1 + token.value.length + (token.isNested ? 1 : 0);
    } else if (isEndMarker(token)) {
      type = TokenType.EndMarker;
      length = 1 + token.value.length + 1 + (token.isNested ? 1 : 0);
    } else if (isAttribute(token)) {
      type = token.attributes ? TokenType.Attribute : TokenType.AttributeValue;
      length = token.value.length || 1;
    } else if (isText(token)) {
      const prev = i > 0 ? tokens[i - 1] : null;
      if (prev && isMarker(prev) && prev.value === "v") {
        const numMatch = token.value.match(/^\s*(\S+)/);
        if (numMatch) {
          const leadingSpaces = token.value.length - token.value.trimStart().length;
          classifications.push({
            range: {
              start: { line: startLine, column: startCol + leadingSpaces },
              end: {
                line: startLine,
                column: startCol + leadingSpaces + numMatch[1].length,
              },
            },
            type: TokenType.VerseNumber,
          });
        }
      } else if (prev && isMarker(prev) && prev.value === "c") {
        const numMatch = token.value.match(/^\s*(\S+)/);
        if (numMatch) {
          const leadingSpaces = token.value.length - token.value.trimStart().length;
          classifications.push({
            range: {
              start: { line: startLine, column: startCol + leadingSpaces },
              end: {
                line: startLine,
                column: startCol + leadingSpaces + numMatch[1].length,
              },
            },
            type: TokenType.ChapterNumber,
          });
        }
      }
      continue;
    } else {
      continue;
    }

    classifications.push({
      range: {
        start: { line: startLine, column: startCol },
        end: { line: startLine, column: startCol + length },
      },
      type,
    });
  }

  return classifications;
}

/**
 * Classify tokens in a document slice. The slice starts at the line boundary
 * before `from` so verse/chapter numbers on the same line stay correct.
 */
export function classifyTokensInRange(
  content: string,
  from: number,
  to: number,
): TokenClassification[] {
  const safeFrom = lineStartOffset(content, Math.max(0, from));
  const safeTo = Math.min(content.length, Math.max(from, to));
  if (safeFrom >= safeTo) return [];

  const slice = content.slice(safeFrom, safeTo);
  const lineOffset = lineIndexAtOffset(content, safeFrom);
  return offsetRangeClassifications(classifyTokens(slice), lineOffset);
}
