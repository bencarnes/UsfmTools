import { Lexer } from "@usfm-tools/parser";
import type { Token } from "@usfm-tools/parser";
import type { TokenClassification } from "./protocol.js";
import { TokenType } from "./protocol.js";

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
