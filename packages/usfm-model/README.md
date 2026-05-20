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

- **`ViewModels.Publication`** — alias of **`PublicationViewModel`**: publication / “Bible app” reading layout (`buildPreview`, `applyVersePerLine`, and types such as `PreviewDocument`).

```typescript
import { ViewModels, parse } from "@usfm-tools/model";

const { document } = parse(usfmText);
const preview = ViewModels.Publication.buildPreview(document, { versePerLine: true });
```

### HTML rendering (`renderPreviewHtml`)

**`renderPreviewHtml(usfm, options?)`** turns a USFM source string into publication-style HTML with a fixed, hardcoded markup. Parser errors (if any) are surfaced as an `<aside class="usfm-preview-errors">` banner at the top of the output. The optional **`RenderPreviewOptions`** currently supports `{ versePerLine: true }` to expand multi-verse paragraphs into one `<p>` per verse. Customize presentation by styling the emitted CSS class hooks (`usfm-document`, `usfm-book`, `usfm-chapter`, `usfm-line`, `usfm-line--prose`, `usfm-line--poetry`, `usfm-v`, `usfm-txt`, `usfm-nd`, `usfm-note`, `usfm-ref`, …) in your app's stylesheet.

```typescript
import { renderPreviewHtml } from "@usfm-tools/model";

const html = renderPreviewHtml(src, { versePerLine: true });
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
│       ├── render-preview-html.ts  # renderPreviewHtml(usfm, options?)
│       └── index.ts
├── tests/
│   ├── model.test.ts
│   ├── publication-preview.test.ts
│   └── render-preview-html.test.ts
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
└── package.json
```

## Architecture

```
USFM text → @usfm-tools/parser (AST) → view models (e.g. PublicationViewModel) → renderPreviewHtml → HTML
```

The publication view model flattens the AST into blocks (headings, poetry/prose lines, tables, etc.) and inline **segments** (verse milestones, text, character styles, notes). **`renderPreviewHtml`** walks that structure and emits HTML with a fixed set of `usfm-*` CSS class hooks — customize presentation through CSS rather than markup overrides.

## License

MIT
