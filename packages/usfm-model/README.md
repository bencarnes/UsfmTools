# @usfm-tools/model

Application-level model for [USFM](https://docs.usfm.bible/usfm/3.1.1/index.html) scripture data, built on top of [`@usfm-tools/parser`](../usfm-parser/).

## Purpose

The parser produces a low-level AST that faithfully represents the USFM markup structure. This package provides higher-level abstractions closer to what applications need — including **view models** for UI-friendly projections and **HTML rendering** for publication-style reading views.

## Installation

```bash
npm install @usfm-tools/model
```

## Usage

### Parse (re-exported from the parser)

```typescript
import { parse } from "@usfm-tools/model";

const result = parse(`\\id GEN
\\c 1
\\p
\\v 1 In the beginning God created the heavens and the earth.`);
```

### View models

View models reshape the AST for specific UI tasks. They live under the **`ViewModels`** object so additional families can be added later without colliding.

- **`ViewModels.Publication`** — alias of **`PublicationViewModel`**: publication / “Bible app” reading layout (`buildPreview`, and types such as `PreviewDocument`).

```typescript
import { ViewModels, parse } from "@usfm-tools/model";

const { document } = parse(usfmText);
const preview = ViewModels.Publication.buildPreview(document);
```

### HTML rendering (`UsfmRenderer`)

**`UsfmRenderer`** turns either a parser **`DocumentNode`** (via `renderDocument`) or a pre-built publication preview (via `renderPreview`) into HTML using a pluggable **`UsfmRenderTemplate`**. Override individual template methods (or pass a **`Partial<UsfmRenderTemplate>`** through **`mergePublicationTemplate`**) to change tags and class names. Always escape user text in **`escapeText`** when customizing.

```typescript
import {
  UsfmRenderer,
  defaultPublicationTemplate,
  mergePublicationTemplate,
  parse,
} from "@usfm-tools/model";

const template = mergePublicationTemplate(defaultPublicationTemplate(), {
  chapter: (num, inner) => `<section class="ch" data-n="${num}">${inner}</section>`,
});

const html = new UsfmRenderer(template).renderDocument(parse(src).document);
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
│   ├── index.ts                    # Public API
│   ├── view-models/
│   │   └── publication-preview.ts  # PublicationViewModel + ViewModels.Publication alias
│   └── renderer/
│       ├── types.ts                # UsfmRenderTemplate interface
│       ├── default-template.ts     # defaultPublicationTemplate()
│       ├── merge-template.ts       # mergePublicationTemplate()
│       ├── usfm-renderer.ts        # UsfmRenderer class
│       └── index.ts
├── tests/
│   ├── model.test.ts
│   ├── publication-preview.test.ts
│   └── usfm-renderer.test.ts
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
└── package.json
```

## Architecture

```
USFM text → @usfm-tools/parser (AST) → view models (e.g. PublicationViewModel) → UsfmRenderer + template → HTML
```

The publication view model flattens the AST into blocks (headings, poetry/prose lines, tables, etc.) and inline **segments** (verse milestones, text, character styles, notes). **`UsfmRenderer`** walks that structure and delegates all markup to **`UsfmRenderTemplate`**.

## License

MIT
