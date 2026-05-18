# @usfm-tools/controls

React UI controls for editing USFM scripture text, built on [CodeMirror 6](https://codemirror.net/) with a language-server-style architecture.

## Features

- **Syntax highlighting** — color-coded markers, verse/chapter numbers, attributes
- **Error diagnostics** — red squiggles under parse errors with hover messages
- **Autocomplete** — type `\` to get a filtered list of USFM markers with descriptions; navigate with arrows, accept with Tab
- **Async language service** — LSP-inspired message protocol for clean separation between editor UI and language intelligence

## Installation

```bash
npm install @usfm-tools/controls
```

Peer dependencies: `react >= 18`, `react-dom >= 18`

## Usage

```tsx
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

### Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM content to display |
| `onChange` | `(value: string) => void` | Called when content changes |
| `className` | `string` | CSS class for the container (use for height) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  UsfmEditor (React component)                   │
│  ┌───────────────────────────────────────────┐  │
│  │  CodeMirror 6 (editing surface)           │  │
│  │  - Decoration plugin (syntax colors)      │  │
│  │  - Linter extension (red squiggles)       │  │
│  │  - Autocomplete extension (marker menu)   │  │
│  └───────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────┘
                    │ async messages
┌───────────────────▼─────────────────────────────┐
│  USFM Language Service                          │
│  - classify(content) → token classifications    │
│  - validate(content) → diagnostics              │
│  - complete(content, pos) → completion items    │
│                                                 │
│  Uses: @usfm-tools/parser                       │
└─────────────────────────────────────────────────┘
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

Stories demonstrate the editor with:
- Genesis 1 (prose + poetry + footnotes)
- Psalm 1 (poetry formatting)
- Empty state
- Error state (unknown markers, stray end markers)

### Project Structure

```
packages/usfm-controls/
├── src/
│   ├── index.ts                     # Public API exports
│   ├── styles.css                   # Tailwind base
│   ├── components/
│   │   └── usfm-editor/
│   │       ├── UsfmEditor.tsx       # React component
│   │       ├── UsfmEditor.stories.tsx
│   │       ├── codemirror-usfm.ts   # CM6 extensions (highlight, lint, autocomplete)
│   │       └── index.ts
│   └── language-service/
│       ├── index.ts                 # Service exports
│       ├── protocol.ts              # Message types
│       ├── service.ts               # Service + async client factory
│       ├── diagnostics.ts           # Error detection via parser
│       ├── completions.ts           # Marker completions
│       └── classifier.ts            # Token classification
├── tests/
│   └── language-service.test.ts
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
