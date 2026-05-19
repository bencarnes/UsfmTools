# @usfm-tools/controls

React UI controls for editing USFM scripture text, built on [CodeMirror 6](https://codemirror.net/) with a language-server-style architecture.

## Features

- **Syntax highlighting** — color-coded markers, verse/chapter numbers, attributes
- **Error diagnostics** — red squiggles under parse errors with hover messages
- **Autocomplete** — type `\` to get a filtered list of USFM markers with descriptions; navigate with arrows, accept with Tab
- **Async language service** — LSP-inspired message protocol for clean separation between editor UI and language intelligence
- **Publication preview** — **`UsfmPreview`** renders USFM as continuous reading text (similar to a Bible app) using **`UsfmRenderer`** from `@usfm-tools/model`; parsing and HTML output are memoized for fast updates next to the editor

## Installation

```bash
npm install @usfm-tools/controls
```

Peer dependencies: `react >= 18`, `react-dom >= 18`

## Usage

```tsx
import { useState } from "react";
import { UsfmEditor } from "@usfm-tools/controls";

function App() {
  const [content, setContent] = useState("\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning.");

  return (
    <UsfmEditor
      value={content}
      onChange={setContent}
      className="h-[500px]"
    />
  );
}
```

### UsfmPreview

Renders USFM as HTML for reading (not editing). Uses the parser and **`UsfmRenderer`** from **`@usfm-tools/model`**; override the **`UsfmRenderTemplate`** (partial merge) to change markup or CSS hooks.

```tsx
import { useState } from "react";
import { UsfmEditor, UsfmPreview } from "@usfm-tools/controls";

function App() {
  const [content, setContent] = useState("\\id GEN\n\\c 1\n\\p\n\\v 1 In the beginning.");

  return (
    <div className="grid grid-cols-2 gap-4">
      <UsfmEditor value={content} onChange={setContent} className="h-[400px]" />
      <UsfmPreview value={content} className="overflow-auto p-4 border rounded" />
    </div>
  );
}
```

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM source to render |
| `template` | `Partial<UsfmRenderTemplate>` | Optional template overrides (merge with default); memoize in the parent if it is stable across renders |
| `className` | `string` | CSS class on the root wrapper |

The package also **re-exports** `UsfmRenderer`, `defaultPublicationTemplate`, `mergePublicationTemplate`, `UsfmRenderTemplate`, `ViewModels`, and `PublicationViewModel` from **`@usfm-tools/model`** so you can configure rendering without a second import path.

### UsfmEditor props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM content to display |
| `onChange` | `(value: string) => void` | Called when content changes |
| `className` | `string` | CSS class for the container (use for height) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  UsfmEditor / UsfmPreview (React)               │
│  ┌───────────────────────────────────────────┐  │
│  │  CodeMirror 6 (editor only)               │  │
│  └───────────────────────────────────────────┘  │
└───────────────┬─────────────────┬───────────────┘
                │                 │
                │                 │ parse + UsfmRenderer
                │                 ▼
                │         ┌───────────────────────┐
                │         │  @usfm-tools/model    │
                │         │  view models + HTML   │
                │         └───────────────────────┘
                │ async messages
┌───────────────▼─────────────────────────────────┐
│  USFM Language Service (editor diagnostics)     │
│  Uses: @usfm-tools/parser                         │
└───────────────────────────────────────────────────┘
```

### Language Service Protocol

The language service uses a simple request/response protocol inspired by LSP:

```typescript
// Request types
{ type: "validate", id, content }
{ type: "complete", id, content, position: { line, column } }
{ type: "classify", id, content }

// Response types
{ type: "validate", id, diagnostics: [...] }
{ type: "complete", id, items: [...] }
{ type: "classify", id, tokens: [...] }
```

The service is currently synchronous (runs in the main thread via `createLanguageClient()`). The message-based design allows a future upgrade to Web Worker transport for large documents without changing the protocol.

### Token Types

| Type | Color | Example |
|------|-------|---------|
| `Marker` | Blue bold | `\p`, `\v`, `\nd` |
| `EndMarker` | Purple bold | `\nd*`, `\f*` |
| `VerseNumber` | Red bold | `1`, `2-3` |
| `ChapterNumber` | Orange bold | `1`, `23` |
| `Attribute` | Teal | `lemma=` |
| `AttributeValue` | Green | `"grace"` |

## Design Considerations

**Single-chapter default, multi-chapter future:** The editor currently works best with one chapter of USFM at a time. The async language service and CodeMirror's efficient rendering make it straightforward to scale to full-book editing in the future — the main enhancement needed would be incremental document sync in the protocol (sending diffs instead of full content on each keystroke).

**Lightweight:** No VS Code / Monaco fork. CodeMirror 6 provides the editing primitives; the USFM-specific intelligence lives in our language service.

## Development

### Prerequisites

- Node.js 20+
- npm
- `@usfm-tools/parser` and `@usfm-tools/model` must be built first

### Setup

```bash
cd packages/usfm-controls
npm install
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Bundle with tsup |
| `npm run dev` | Watch mode rebuild |
| `npm test` | Run tests (vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check |
| `npm run storybook` | Launch Storybook dev server |
| `npm run build-storybook` | Build static Storybook |

### Storybook

```bash
npm run storybook
```

Stories demonstrate the editor and preview with:
- Genesis 1 (prose + poetry + footnotes)
- Psalm 1 (poetry formatting)
- Empty state
- Error state (unknown markers, stray end markers)
- **UsfmPreview** (static sample and **With Editor** — live source + publication HTML)

### Project Structure

```
packages/usfm-controls/
├── src/
│   ├── index.ts                     # Public API exports
│   ├── styles.css                   # Tailwind + default preview reading styles
│   ├── components/
│   │   ├── usfm-editor/
│   │   │   ├── UsfmEditor.tsx       # React component
│   │   │   ├── UsfmEditor.stories.tsx
│   │   │   ├── codemirror-usfm.ts   # CM6 extensions (highlight, lint, autocomplete)
│   │   │   └── index.ts
│   │   └── usfm-preview/
│   │       ├── UsfmPreview.tsx      # Publication-style HTML preview
│   │       ├── UsfmPreview.stories.tsx
│   │       └── index.ts
│   └── language-service/
│       ├── index.ts                 # Service exports
│       ├── protocol.ts              # Message types
│       ├── service.ts               # Service + async client factory
│       ├── diagnostics.ts           # Error detection via parser
│       ├── completions.ts           # Marker completions
│       └── classifier.ts            # Token classification
├── tests/
│   ├── language-service.test.ts
│   └── usfm-preview.test.tsx
├── vitest.config.ts                 # jsdom for React tests
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
└── package.json
```

## References

- [CodeMirror 6](https://codemirror.net/)
- [USFM Spec](https://docs.usfm.bible/usfm/3.1.1/index.html)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)

## License

MIT
