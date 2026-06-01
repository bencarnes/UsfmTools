# @usfm-tools/controls

React UI controls for editing USFM scripture text, built on [CodeMirror 6](https://codemirror.net/) with a language-server-style architecture.

## Features

- **Syntax highlighting** — color-coded markers, verse/chapter numbers, attributes
- **Error diagnostics** — red squiggles under parse errors with hover messages
- **Autocomplete** — type `\` to get a filtered list of USFM markers with descriptions; navigate with arrows, accept with Tab
- **Find and replace** — **Ctrl+F** / **Ctrl+H** open a VS Code–style search widget in the upper-right (built on [`@codemirror/search`](https://codemirror.net/docs/ref/#search)); chevron toggles the replace row; icon buttons for match case (**Aa**), whole word (**ab**), and regex (**.\***)
- **Async language service** — LSP-inspired message protocol for clean separation between editor UI and language intelligence
- **Publication preview** — **`UsfmPreview`** renders USFM as continuous reading text (similar to a Bible app) using **`renderPreviewHtml`** from `@usfm-tools/model`; HTML output is memoized for fast updates next to the editor
- **Book picker** — **`UsfmBookPicker`** lists books from caller-supplied USFM strings (no filesystem access): standard `\\id` codes in Old Testament, New Testament, and other standard groups, plus a fourth list for non-standard `\\id` values; selection is reported through **`onBookSelect`**
- **Chapter picker** — **`ChapterPicker`** lays out one book’s **`\\c`** markers as a wrapping row of equal-width buttons (labels are shown exactly as in the USFM, in source order); selection is reported through **`onChapterSelect`**

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

Lists books from an array of `{ id, usfm }` entries (your app supplies file contents and stable ids). The model’s **`buildUsfmBookPickerGroups`** parses each `usfm` string and splits results into **Old Testament** and **New Testament** (responsive grids of short labels), **other** standard identifiers (for example apocrypha or front matter), and **non-standard** material: unknown `\\id` codes, an empty/missing `\\id` on the first book, or **no `\\id` at all** (with titles from top-level `\\toc` markers when there is no book node). The last two sections are single-column lists, each separated by a horizontal rule when present.

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
| `onBookSelect` | `(detail: { fileId: string; code: string }) => void` | Optional; called when the user activates a book (click or keyboard). **`code`** is empty when the file has no `\\id` or an empty `\\id` line. |
| `className` | `string` | CSS class on the root wrapper |

### UsfmPane

**`UsfmPane`** is a full-book editor surface: a body that switches between **Edit**, **Preview**, and **Edit + Preview** (split with a draggable splitter). By default it includes an **inline toolbar** (chapter navigation, a **scroll-sync** icon toggle with up/down arrows — bold when on — and a single **view-mode** button that cycles edit → preview → split) above the body. The view-mode icon shows the **next** mode (eye for Preview, document-with-pencil for Edit, both icons for Edit + Preview). When embedded in **`UsfmWorkspace`**, pass **`toolbarMount`** (a host element to the right of the tabs) and **`toolbarActive`** so only the selected tab’s controls render there, similar to VS Code.

The editor and preview share the same controlled **`value`** / **`onChange`** pair, so **several panes can edit one file** when the parent shares state. Chapter navigation uses **`listChapterMarkersInBook`** from **`@usfm-tools/model`** for marker offsets; the current chapter is a compact dropdown (with **`ChapterPicker`** inside) flanked by previous/next buttons with tooltips. In split mode, scrolling one side debounces (~120ms) and aligns the other to the **same chapter** (approximate co-viewing; line-level sync is not guaranteed). The navigator stays visible for front matter without **`\\c`** markers; arrows and the menu are inert when there are no chapters.

```tsx
import { useState } from "react";
import { UsfmPane } from "@usfm-tools/controls";

function App() {
  const [usfm, setUsfm] = useState("\\id GEN\\n\\c 1\\n\\p\\n\\v 1 ...");
  return <UsfmPane value={usfm} onChange={setUsfm} className="h-[600px]" />;
}
```

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | Full USFM file body (controlled) |
| `onChange` | `(value: string) => void` | Optional; same contract as **`UsfmEditor`** |
| `toolbarMount` | `HTMLElement \| null` | When set with **`toolbarActive`**, renders the chapter / sync / view toolbar into this node |
| `toolbarActive` | `boolean` | When false, this pane does not occupy **`toolbarMount`** (inactive tab) |
| `defaultViewMode` | `"edit" \| "preview" \| "split"` | Initial layout (default **`split`**) |
| `versePerLine` | `boolean` | Passed through to **`UsfmPreview`** in preview / split |
| `className` | `string` | Optional root wrapper class |

### UsfmWorkspace

**`UsfmWorkspace`** is a **fully controlled** tabbed document layout (**TDI**) on a **tab-group grid** (up to **2×2**, default **1×1**). You pass **`gridRows`**, **`gridCols`**, **`slots`** (row-major groups; empty slots have **`tabIds: []`**), **`tabsById`**, and callbacks. The UI shows **`UsfmPane`** per tab, filenames on tabs, chapter / sync / view controls **to the right of the tab strip**, a scrollable tab strip, a chevron **tab-list** dropdown (tooltip: Select tab) immediately after the tabs, close (**×** vs **circle** when **`dirty`**), **drag-and-drop** to reorder tabs or move them between groups (including **empty** slots). Closing the last tab in a group leaves an **empty slot** (no placeholder document is created).

Resize the grid with **`TabGroupLayoutSelector`** (outside the workspace) and **`workspaceSetGridLayout`**: expanding adds empty slots; shrinking moves tabs from removed slots into the remaining groups without creating or destroying tabs. **Draggable splitter bars** between adjacent tab groups (horizontal) and rows (vertical) adjust relative size within the workspace panel.

```tsx
import { useState } from "react";
import {
  UsfmWorkspace,
  TabGroupLayoutSelector,
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetGridLayout,
  workspaceSetTabValue,
} from "@usfm-tools/controls";

function App() {
  const [model, setModel] = useState(() =>
    buildWorkspaceModelFromInitialTabs([{ fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ..." }]),
  );

  return (
    <div className="flex h-[720px] flex-col gap-2">
      <TabGroupLayoutSelector
        gridRows={model.gridRows}
        gridCols={model.gridCols}
        onChange={(rows, cols) => setModel((m) => workspaceSetGridLayout(m, rows, cols))}
      />
      <UsfmWorkspace
        gridRows={model.gridRows}
        gridCols={model.gridCols}
        slots={model.slots}
        tabsById={model.tabsById}
        onActivateTab={(groupId, tabId) => setModel((m) => workspaceActivateTab(m, groupId, tabId))}
        onUpdateTabValue={(tabId, value) => setModel((m) => workspaceSetTabValue(m, tabId, value))}
        onCloseTab={(groupId, tabId) => setModel((m) => workspaceCloseTab(m, groupId, tabId))}
        onReorderTabInGroup={(groupId, tabId, toIndex) =>
          setModel((m) => workspaceReorderTabInGroup(m, groupId, tabId, toIndex))
        }
        onMoveTabToGroup={(d) => setModel((m) => workspaceMoveTabToGroup(m, d))}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
```

| Prop | Type | Description |
|------|------|-------------|
| `gridRows` / `gridCols` | `1 \| 2` | Visible grid size (max 2×2) |
| `slots` | `UsfmWorkspaceEditorGroupState[]` | Row-major groups for the current grid (**`id`**, **`tabIds`**, **`activeTabId`**) |
| `tabsById` | `Record<string, UsfmWorkspaceTabState>` | Tab id → **`fileName`**, **`value`**, **`dirty`** |
| `onActivateTab` | `(groupId, tabId) => void` | User selected a tab |
| `onUpdateTabValue` | `(tabId, value) => void` | Editor content changed |
| `onCloseTab` | `(groupId, tabId) => void` | User closed a tab |
| `onReorderTabInGroup` | `(groupId, tabId, toIndex) => void` | Reorder within the same strip |
| `onMoveTabToGroup` | `(detail) => void` | Move tab to another slot (**`toGroupId`**, **`insertIndex`**, **`fromGroupId`**) |
| `className` | `string` | Optional root wrapper class |

### TabGroupLayoutSelector

Dropdown with a **2×2 grid** trigger icon. The menu shows four squares; clicking cell **(row, col)** sets **`gridRows = row + 1`** and **`gridCols = col + 1`** (e.g. bottom-right → 2×2). Wire **`onChange`** to **`workspaceSetGridLayout`** on your workspace model.

| Prop | Type | Description |
|------|------|-------------|
| `gridRows` / `gridCols` | `1 \| 2` | Current layout |
| `onChange` | `(rows, cols) => void` | User picked a new layout |
| `className` | `string` | Optional wrapper class |

### ChapterPicker

Shows every **`\\c`** chapter on a single parsed **`BookNode`**: buttons use a **fixed width** sized for three monospace **digit** cells (plus padding), **`flex-wrap`** so they flow left-to-right and wrap, and the root is **`width: 100%`** so the control tracks its parent. Labels are the raw **`ChapterNode.number`** strings in **document order** (no sorting, deduplication, or locale-specific reformatting).

```tsx
import { ChapterPicker } from "@usfm-tools/controls";
import { parse } from "@usfm-tools/model";

const { document } = parse("\\id PSA\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");
const book = document.children.find((n) => n.type === "book");
if (!book || book.type !== "book") throw new Error("Expected \\id book");

<ChapterPicker
  book={book}
  onChapterSelect={({ chapterNumber }) => {
    /* load chapter text, scroll editor, etc. */
  }}
  className="border rounded-md p-2"
/>;
```

| Prop | Type | Description |
|------|------|-------------|
| `book` | `BookNode` | Parsed book from **`@usfm-tools/parser`** (same shape as children of a `DocumentNode` after **`parse`**) |
| `onChapterSelect` | `(detail: { chapterNumber: string }) => void` | Optional; fired when the user activates a chapter button |
| `className` | `string` | CSS class on the root wrapper |

The package also **re-exports** from **`@usfm-tools/model`**: `renderPreviewHtml`, **`RenderPreviewOptions`**, `ViewModels`, `PublicationViewModel`, **`buildUsfmBookPickerGroups`**, **`listChapterNumbersFromBook`**, **`listChapterMarkersInBook`**, **`chapterNumberAtOrBeforeSourceOffset`**, **`UsfmBookPickerCanonGroup`**, **`UsfmBookPickerFileInput`**, **`UsfmBookPickerBook`**, **`UsfmBookPickerGroups`**, and the type **`ChapterMarkerInBook`**, so you can use the model without a second import path.

### UsfmEditor props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM content to display |
| `onChange` | `(value: string) => void` | Called when content changes |
| `className` | `string` | CSS class for the container (use for height) |
| `onViewportAnchorChange` | `(sourceOffset: number) => void` | Optional; debounced (~120ms) after scroll or selection moves the viewport — document offset near the top edge |

**Find / replace:** **Ctrl+F** opens find-only; **Ctrl+H** opens find with the replace row. The left **chevron** expands or collapses replace. Inline toggles: **Match Case** (Aa), **Match Whole Word** (ab), **Use Regular Expression** (.\*). **Replace** updates the current match and moves to the next; **Replace All** replaces every match. **F3** / **Ctrl+G** find next; **Shift+F3** / **Shift+Ctrl+G** find previous; **Escape** closes the panel. All controls have tooltips.

**Imperative handle** (`ref` on **`UsfmEditor`**): **`scrollSourceOffsetIntoView`**, **`getTopVisibleSourceOffset`**, **`openFind()`**, **`openFindReplace()`** — same behavior as the keyboard shortcuts.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  UsfmEditor / UsfmPreview / UsfmBookPicker / ChapterPicker / UsfmPane / UsfmWorkspace (React) │
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

**Full-book editing:** **`UsfmPane`** targets entire files (multiple **`\\c`** markers). For very large books, callers may still prefer virtualization or worker-backed language features; the editor itself remains a single CodeMirror document. The language service protocol could later send diffs instead of full text on each keystroke.

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

Stories demonstrate the editor, preview, book picker, and chapter picker with:
- Genesis 1 (prose + poetry + footnotes)
- Psalm 1 (poetry formatting)
- Empty state
- Error state (unknown markers, stray end markers)
- **UsfmPane** — **`FullBookSplit`** and **`TwoPanesSharedState`** use a shared `useState` USFM string; **`FrontMatterNoChapters`** shows the toolbar when there are no `\\c` markers.
- **UsfmWorkspace** — **`SingleGroupTwoTabs`**, **`TwoEditorGroups`**, and **`OpenFileDemo`** (append tab). Shared long USFM lives under **`src/fixtures/`** for Storybook.
- **UsfmPreview** — **`GenesisPreview`** uses `render: (args) => <UsfmPreview {...args} />` so Controls map to props; **`WithEditor`** must use that same **`args` parameter** (not a zero-arg render) so `versePerLine` updates when you toggle Controls or the checkbox (`useArgs` is only for pushing checkbox state back into Storybook). **Verse Per Line Compare** shows both modes side by side.

### Project Structure

```
packages/usfm-controls/
├── src/
│   ├── fixtures/
│   │   └── sample-bsb-genesis-usfm.ts  # Long sample USFM for Storybook (not part of the published entry)
│   ├── index.ts                     # Public API exports
│   ├── styles.css                   # Tailwind + default preview reading styles
│   ├── components/
│   │   ├── usfm-editor/
│   │   │   ├── UsfmEditor.tsx       # React component
│   │   │   ├── UsfmEditor.stories.tsx
│   │   │   ├── codemirror-usfm.ts   # CM6 extensions (highlight, lint, autocomplete)
│   │   │   ├── usfm-search-panel.ts # Find/replace panel (@codemirror/search)
│   │   │   ├── search-mode-icons.ts # Icons for search mode toggles
│   │   │   └── index.ts
│   │   ├── usfm-preview/
│   │   │   ├── UsfmPreview.tsx      # Publication-style HTML preview
│   │   │   ├── UsfmPreview.stories.tsx
│   │   │   └── index.ts
│   │   ├── usfm-book-picker/
│   │   │   ├── UsfmBookPicker.tsx   # OT / NT / other book grid + list
│   │   │   ├── UsfmBookPicker.stories.tsx
│   │   │   └── index.ts
│   │   ├── usfm-pane/
│   │   │   ├── UsfmPane.tsx       # Full-book edit + preview + toolbar (inline or portaled)
│   │   │   └── UsfmPane.stories.tsx
│   │   ├── usfm-workspace/
│   │   │   ├── UsfmWorkspace.tsx    # Tab-group grid workspace (up to 2×2)
│   │   ├── tab-group-layout-selector/
│   │   │   ├── TabGroupLayoutSelector.tsx
│   │   │   ├── workspace-model.ts # Controlled props + immutable state helpers
│   │   │   ├── UsfmWorkspace.stories.tsx
│   │   │   └── index.ts
│   │   └── chapter-picker/
│   │       ├── ChapterPicker.tsx    # Wrapping row of equal-width chapter buttons
│   │       ├── ChapterPicker.stories.tsx
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
│   ├── usfm-preview.test.tsx
│   ├── usfm-book-picker.test.tsx
│   ├── usfm-pane.test.tsx
│   ├── usfm-editor-search.test.tsx
│   ├── usfm-workspace.test.tsx
│   ├── chapter-offset-helpers.test.ts
│   └── chapter-picker.test.tsx
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
