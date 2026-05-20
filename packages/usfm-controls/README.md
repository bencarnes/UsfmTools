# @usfm-tools/controls

React UI controls for editing USFM scripture text, built on [CodeMirror 6](https://codemirror.net/) with a language-server-style architecture.

## Features

- **Syntax highlighting** — color-coded markers, verse/chapter numbers, attributes
- **Error diagnostics** — red squiggles under parse errors with hover messages
- **Autocomplete** — type `\` to get a filtered list of USFM markers with descriptions; navigate with arrows, accept with Tab
- **Async language service** — LSP-inspired message protocol for clean separation between editor UI and language intelligence
- **Publication preview** — **`UsfmPreview`** renders USFM as continuous reading text (similar to a Bible app) using **`renderPreviewHtml`** from `@usfm-tools/model`; HTML output is memoized for fast updates next to the editor
- **Book picker** — **`UsfmBookPicker`** lists books from caller-supplied USFM strings (no filesystem access): standard `\\id` codes in Old Testament, New Testament, and other standard groups, plus a fourth list for non-standard `\\id` values; selection is reported through **`onBookSelect`**

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

Renders USFM as HTML for reading (not editing). Uses **`renderPreviewHtml`** from **`@usfm-tools/model`**, which emits a fixed set of `usfm-*` CSS class hooks — style them in your app's stylesheet to customize presentation.

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
| `versePerLine` | `boolean` | When true, split paragraphs that contain multiple `\\v` milestones so each verse appears on its own preview line (default `false`) |
| `className` | `string` | CSS class on the root wrapper |

### UsfmBookPicker

Lists books from an array of `{ id, usfm }` entries (your app supplies file contents and stable ids). The model’s **`buildUsfmBookPickerGroups`** parses each `usfm` string and splits results into **Old Testament** and **New Testament** (responsive grids of short labels), **other** standard identifiers (for example apocrypha or front matter), and **non-standard** files whose `\\id` code is not in the [USFM book list](https://ubsicap.github.io/usfm/identification/books.html). The last two sections are single-column lists, each separated by a horizontal rule when present.

```tsx
import { UsfmBookPicker } from "@usfm-tools/controls";

const files = [
  { id: "path/to/GEN.usfm", usfm: "\\id GEN\n\\toc3 Gen\n..." },
  { id: "path/to/MAT.usfm", usfm: "\\id MAT\n\\toc3 Mat\n..." },
  { id: "path/to/hymnal.usfm", usfm: "\\id HYM\n\\toc1 Hymnal\n..." },
];

<UsfmBookPicker
  files={files}
  onBookSelect={({ fileId, code }) => {
    /* wire navigation or editor load */
  }}
  className="max-w-2xl border rounded-md p-3"
/>;
```

| Prop | Type | Description |
|------|------|-------------|
| `files` | `{ id: string; usfm: string }[]` | One entry per file; `id` is an application-defined key (path, URI, etc.); `usfm` is the file body |
| `onBookSelect` | `(detail: { fileId: string; code: string }) => void` | Optional; called when the user activates a book (click or keyboard) |
| `className` | `string` | CSS class on the root wrapper |

The package also **re-exports** from **`@usfm-tools/model`**: `renderPreviewHtml`, **`RenderPreviewOptions`**, `ViewModels`, `PublicationViewModel`, **`buildUsfmBookPickerGroups`**, **`UsfmBookPickerCanonGroup`**, **`UsfmBookPickerFileInput`**, **`UsfmBookPickerBook`**, and **`UsfmBookPickerGroups`**, so you can use the model without a second import path.

### UsfmEditor props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM content to display |
| `onChange` | `(value: string) => void` | Called when content changes |
| `className` | `string` | CSS class for the container (use for height) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  UsfmEditor / UsfmPreview / UsfmBookPicker (React)               │
│  ┌───────────────────────────────────────────┐  │
│  │  CodeMirror 6 (editor only)               │  │
│  └───────────────────────────────────────────┘  │
└───────────────┬─────────────────┬───────────────┘
                │                 │
                │                 │ renderPreviewHtml
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

Stories demonstrate the editor, preview, and book picker with:
- Genesis 1 (prose + poetry + footnotes)
- Psalm 1 (poetry formatting)
- Empty state
- Error state (unknown markers, stray end markers)
- **UsfmPreview** — **`GenesisPreview`** uses `render: (args) => <UsfmPreview {...args} />` so Controls map to props; **`WithEditor`** must use that same **`args` parameter** (not a zero-arg render) so `versePerLine` updates when you toggle Controls or the checkbox (`useArgs` is only for pushing checkbox state back into Storybook). **Verse Per Line Compare** shows both modes side by side.

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
│   │   └── usfm-book-picker/
│   │       ├── UsfmBookPicker.tsx   # OT / NT / other book grid + list
│   │       ├── UsfmBookPicker.stories.tsx
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
