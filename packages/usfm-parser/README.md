# @usfm-tools/parser

A TypeScript parser for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) (Unified Standard Format Markers) — the standard markup format for encoding Bible/scripture text.

This parser tokenizes and parses USFM source text into a structured AST (Abstract Syntax Tree) that can be traversed, transformed, or serialized by downstream tools.

## Features

- Full USFM 3.x marker support (paragraphs, characters, footnotes, cross-references, tables, milestones, figures, sidebars)
- Dual output format: ESM and CommonJS bundles with TypeScript declarations
- Detailed position tracking for all AST nodes
- Graceful error recovery (non-strict mode) or fail-fast (strict mode)
- Zero runtime dependencies

## Installation

```bash
npm install @usfm-tools/parser
```

## Usage

### Basic Parsing

```typescript
import { parse } from "@usfm-tools/parser";

const usfm = `\\id GEN English Standard Version
\\h Genesis
\\mt1 Genesis
\\c 1
\\s1 The Creation of the World
\\p
\\v 1 In the beginning, God created the heavens and the earth.
\\v 2 The earth was without form and void.`;

const result = parse(usfm);

console.log(result.document.type); // "document"
console.log(result.errors);        // [] (empty if no errors)

// Access the book node
const book = result.document.children[0];
// book.type === "book"
// book.code === "GEN"
```

### Strict Mode

By default the parser collects errors and continues parsing. In strict mode, it throws on the first error:

```typescript
import { parse } from "@usfm-tools/parser";

try {
  const result = parse("\\id GEN\n\\v 1 \\zzz bad marker", { strict: true });
} catch (err) {
  console.error(err.message);
}
```

### Using the Lexer Directly

For advanced use cases, the lexer can be used independently to tokenize USFM:

```typescript
import { Lexer } from "@usfm-tools/parser";

const lexer = new Lexer("\\v 1 In the beginning");
const tokens = lexer.tokenize();

for (const token of tokens) {
  console.log(token.type, token.value, token.position);
}
```

### Grammar Utilities

Helper functions are exported for working with USFM markers:

```typescript
import {
  getMarkerCategory,
  isParaMarker,
  isCharMarker,
  isNoteMarker,
} from "@usfm-tools/parser";

getMarkerCategory("p");   // "versepara"
isParaMarker("q1");        // true
isCharMarker("nd");        // true
isNoteMarker("f");         // true
```

## AST Structure

The parser produces a tree of typed nodes. Key node types:

| Node Type     | Description                                  | Key Fields                  |
|---------------|----------------------------------------------|-----------------------------|
| `document`    | Root node                                    | `children`                  |
| `book`        | Book identification (`\id`)                  | `code`, `children`          |
| `chapter`     | Chapter (`\c`)                               | `number`, `children`        |
| `verse`       | Verse (`\v`)                                 | `number`, `children`        |
| `paragraph`   | Paragraph-level element (`\p`, `\q1`, etc.)  | `marker`, `children`        |
| `char`        | Character style (`\nd`, `\wj`, etc.)         | `marker`, `children`        |
| `note`        | Footnote or cross-reference (`\f`, `\x`)     | `marker`, `caller`, `children` |
| `table`       | Table container                              | `children`                  |
| `row`         | Table row (`\tr`)                            | `children`                  |
| `cell`        | Table cell (`\th1`, `\tc1`, etc.)            | `marker`, `children`        |
| `milestone`   | Milestone marker (`\qt-s`, `\ts-s`, etc.)    | `marker`, `attributes`      |
| `text`        | Plain text content                           | `text`                      |
| `optbreak`    | Optional line break (`//`)                   | —                           |

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
cd packages/usfm-parser
npm install
```

### Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run build`    | Bundle with tsup (ESM + CJS + .d.ts) |
| `npm run dev`      | Watch mode rebuild                   |
| `npm test`         | Run tests (vitest)                   |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run test:coverage` | Run tests with coverage report  |
| `npm run lint`     | Lint with ESLint                     |
| `npm run lint:fix` | Lint and auto-fix                    |
| `npm run typecheck` | Type-check without emitting         |

### Project Structure

```
packages/usfm-parser/
├── src/
│   ├── index.ts        # Public API and convenience parse() function
│   ├── lexer.ts        # Tokenizer — converts USFM text to tokens
│   ├── parser.ts       # Parser — builds AST from token stream
│   ├── grammar.ts      # Marker categories and classification helpers
│   └── types.ts        # TypeScript interfaces for tokens and AST nodes
├── tests/
│   ├── lexer.test.ts   # Lexer unit tests
│   ├── parser.test.ts  # Parser integration tests
│   └── grammar.test.ts # Grammar helper tests
├── tsconfig.json       # TypeScript configuration
├── tsup.config.ts      # Bundle configuration
├── eslint.config.js    # Linting configuration
└── package.json
```

### Architecture

The parser uses a two-phase approach:

1. **Lexer** — Scans the source text and produces a flat stream of tokens (markers, text, attributes, newlines, optional breaks).
2. **Parser** — Consumes the token stream and builds a hierarchical AST according to USFM grammar rules. It handles implicit paragraph closure, nested character styles, footnote/cross-reference structure, and table layout.

### Adding Support for New Markers

1. Add the marker to the appropriate category string in `src/grammar.ts`.
2. If the marker has special parsing behavior, add a handler method in `src/parser.ts`.
3. Add tests covering the new marker in `tests/`.

## References

- [USFM Documentation (3.1.1)](https://docs.usfm.bible/usfm/3.1.1/index.html)
- [USFM Grammar Definition](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usfm.ext)
- [Reference Python Implementation](https://github.com/usfm-bible/usfmtc)

## License

MIT
