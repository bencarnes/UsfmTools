# @usfm-tools/model

Application-level model for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) scripture data, built on top of [`@usfm-tools/parser`](../usfm-parser/).

## Purpose

The parser produces a low-level AST that faithfully represents the USFM markup structure. This package provides higher-level abstractions closer to what applications need — things like:

- **Indexing** — look up content by book, chapter, and verse
- **Querying** — extract verse ranges, search across books
- **Rendering support** — structured data ready for UI rendering
- **Cross-reference resolution** — follow `\ref` and `\x` links between passages

This package is a work in progress. APIs will be added as needs arise.

## Installation

```bash
npm install @usfm-tools/model
```

## Usage

Currently re-exports the parser's `parse` function. Model-specific APIs will be added here as they are developed.

```typescript
import { parse } from "@usfm-tools/model";

const result = parse(`\\id GEN
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.`);
```

## Development

### Prerequisites

- Node.js 20+
- npm
- The `@usfm-tools/parser` package must be built first (`npm run build` in `packages/usfm-parser`)

### Setup

```bash
cd packages/usfm-model
npm install
```

### Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run build`    | Bundle with tsup (ESM + CJS + .d.ts) |
| `npm run dev`      | Watch mode rebuild                   |
| `npm test`         | Run tests (vitest)                   |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run lint`     | Lint with ESLint                     |
| `npm run lint:fix` | Lint and auto-fix                    |
| `npm run typecheck` | Type-check without emitting         |

### Project Structure

```
packages/usfm-model/
├── src/
│   └── index.ts        # Public API (currently re-exports parser)
├── tests/
│   └── model.test.ts   # Smoke test verifying parser integration
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
└── package.json
```

## Architecture

This package sits between the parser and the application:

```
USFM text → @usfm-tools/parser (AST) → @usfm-tools/model (application model) → UI / export / etc.
```

The parser's AST is a faithful representation of the markup. The model transforms it into structures optimized for application use — for example, a verse-indexed map that allows `O(1)` lookup by reference, or a flat rendering list suitable for virtualized UI scrolling.

## License

MIT
