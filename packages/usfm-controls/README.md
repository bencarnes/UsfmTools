# @usfm-tools/controls

React UI controls for editing USFM scripture text, built on [CodeMirror 6](https://codemirror.net/) with a language-server-style architecture.

## Features

- **Syntax highlighting** — viewport-scoped token coloring (markers, verse/chapter numbers, attributes); only the visible range is classified after typing pauses
- **Error diagnostics** — unified validation in **`UsfmShell`** feeds both the errors panel and editor squiggles from one debounced parse
- **Autocomplete** — type `\` to get a filtered list of USFM markers with descriptions; navigate with arrows, accept with Tab
- **Find and replace** — **Ctrl+F** / **Ctrl+H** open a VS Code–style search widget in the upper-right (built on [`@codemirror/search`](https://codemirror.net/docs/ref/#search)); chevron toggles the replace row; icon buttons for match case (**Aa**), whole word (**ab**), and regex (**.\***)
- **Async language service** — LSP-inspired message protocol for clean separation between editor UI and language intelligence
- **Publication preview** — **`UsfmPreview`** renders USFM as continuous reading text (similar to a Bible app) using **`renderPreviewHtml`** from `@usfm-tools/model`; HTML output is memoized for fast updates next to the editor
- **Book picker** — **`UsfmBookPicker`** lists books from caller-supplied USFM strings (no filesystem access): standard `\\id` codes in Old Testament, New Testament, and other standard groups, plus a fourth list for non-standard `\\id` values; selection is reported through **`onBookSelect`**
- **Chapter picker** — **`ChapterPicker`** lays out one book’s **`\\c`** markers as a wrapping row of equal-width buttons (labels are shown exactly as in the USFM, in source order); selection is reported through **`onChapterSelect`**

## Installation

Add `@usfm-tools/controls` as a dependency in your Deno workspace or import map. Peer dependencies: `react >= 18`, `react-dom >= 18`.

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
| `updateDebounceMs` | `number` | Milliseconds to wait after the last `value` change before re-rendering (default `0`). **`UsfmPane`** passes `1500` in split mode so preview HTML is not rebuilt on every keystroke |
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

**`UsfmPane`** is a full-book editor surface: a body that switches between **Edit**, **Preview**, and **Edit + Preview** (split with a draggable splitter). By default it includes an **inline toolbar** (chapter navigation, a **scroll-sync** icon toggle with up/down arrows — bold when on, a **find** button that opens the editor search bar, and a single **view-mode** button that cycles edit → preview → split) above the body. The view-mode icon shows the **next** mode (eye for Preview, document-with-pencil for Edit, both icons for Edit + Preview). When embedded in **`UsfmWorkspace`**, pass **`toolbarMount`** (a host element to the right of the tabs) and **`toolbarActive`** so only the selected tab’s controls render there, similar to VS Code.

The editor and preview share a controlled **`value`** / **`onChange`** pair when embedded in **`UsfmWorkspace`** or **`UsfmShell`**. In those layouts the live document stays in CodeMirror; **`onChange`** is debounced (500 ms) so React workspace state is not updated on every keystroke. Chapter navigation uses the lightweight **`listChapterMarkersInUsfm`** scan (not a full parse) on a debounced source string in split mode. The current chapter is a compact dropdown (with **`ChapterPicker`** inside) flanked by previous/next buttons with tooltips.

In split mode, preview HTML regeneration is debounced (1.5 s). Scroll sync between editor and preview is **paused while typing** and resumes after 500 ms idle; when active, scrolling one side aligns the other to the **same chapter** (approximate co-viewing; line-level sync is not guaranteed). The navigator stays visible for front matter without **`\\c`** markers; arrows and the menu are inert when there are no chapters.

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
| `onChange` | `(value: string) => void` | Optional; debounced when used from **`UsfmWorkspace`** / **`UsfmShell`** |
| `onDirty` | `() => void` | Optional; first edit while the tab is still clean |
| `onSave` | `(value: string) => void` | Optional; toolbar Save / Ctrl+S with flushed editor buffer |
| `dirty` | `boolean` | When true, the save control is enabled |
| `diagnostics` | `Diagnostic[]` | Optional; parse diagnostics from **`UsfmShell`** unified validation |
| `toolbarMount` | `HTMLElement \| null` | When set with **`toolbarActive`**, renders the chapter / sync / view toolbar into this node |
| `toolbarActive` | `boolean` | When false, this pane does not occupy **`toolbarMount`** (inactive tab) |
| `defaultViewMode` | `"edit" \| "preview" \| "split"` | Initial layout (default **`split`**) |
| `versePerLine` | `boolean` | Passed through to **`UsfmPreview`** in preview / split |
| `className` | `string` | Optional root wrapper class |

### UsfmWorkspace

**`UsfmWorkspace`** is a **fully controlled** tabbed document layout (**TDI**) on a **tab-group grid** (up to **2×2**, default **1×1**). You pass **`gridRows`**, **`gridCols`**, **`slots`** (row-major groups; empty slots have **`tabIds: []`**), **`tabsById`**, and callbacks. The UI shows **`UsfmPane`** per tab, filenames on tabs, chapter / sync / view controls **to the right of the tab strip**, a **`TabGroupLayoutSelector`** in the first non-empty group's toolbar (when **`onSetGridLayout`** is set), a scrollable tab strip, a chevron **tab-list** dropdown (tooltip: Select tab) immediately after the tabs, close (**×** vs **circle** when **`dirty`**), **drag-and-drop** to reorder tabs or move them between groups (including **empty** slots). Closing the last tab in a group leaves an **empty slot** (no placeholder document is created).

Pass **`onSetGridLayout`** to wire the built-in layout selector; it calls your handler with the new **`gridRows`** / **`gridCols`**. Use **`workspaceSetGridLayout`** on your model: expanding adds empty slots; shrinking moves tabs from removed slots into the remaining groups without creating or destroying tabs. **Draggable splitter bars** between adjacent tab groups (horizontal) and rows (vertical) adjust relative size within the workspace panel.

```tsx
import { useState } from "react";
import {
  UsfmWorkspace,
  buildWorkspaceModelFromInitialTabs,
  workspaceActivateTab,
  workspaceAppendTab,
  workspaceCloseTab,
  workspaceMoveTabToGroup,
  workspaceReorderTabInGroup,
  workspaceSetGridLayout,
  workspaceSetTabValue,
  workspaceSetTabDirty,
  workspaceMarkTabSaved,
} from "@usfm-tools/controls";

function App() {
  const [model, setModel] = useState(() =>
    buildWorkspaceModelFromInitialTabs([{ fileName: "GEN.usfm", value: "\\id GEN\n\\c 1\n\\p\n\\v 1 ..." }]),
  );

  return (
    <div className="flex h-[720px] flex-col">
      <UsfmWorkspace
        gridRows={model.gridRows}
        gridCols={model.gridCols}
        slots={model.slots}
        tabsById={model.tabsById}
        onActivateTab={(groupId, tabId) => setModel((m) => workspaceActivateTab(m, groupId, tabId))}
        onUpdateTabValue={(tabId, value) => setModel((m) => workspaceSetTabValue(m, tabId, value))}
        onMarkTabDirty={(tabId) => setModel((m) => workspaceSetTabDirty(m, tabId))}
        onSaveTab={(tabId, value) => {
          setModel((m) => workspaceMarkTabSaved(workspaceSetTabValue(m, tabId, value), tabId));
        }}
        onCloseTab={(groupId, tabId) => setModel((m) => workspaceCloseTab(m, groupId, tabId))}
        onReorderTabInGroup={(groupId, tabId, toIndex) =>
          setModel((m) => workspaceReorderTabInGroup(m, groupId, tabId, toIndex))
        }
        onMoveTabToGroup={(d) => setModel((m) => workspaceMoveTabToGroup(m, d))}
        onSetGridLayout={(rows, cols) => setModel((m) => workspaceSetGridLayout(m, rows, cols))}
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
| `onUpdateTabValue` | `(tabId, value) => void` | Editor content changed (debounced from the pane) |
| `onMarkTabDirty` | `(tabId) => void` | Optional; first edit on a clean tab without updating `value` |
| `onSaveTab` | `(tabId, value) => void` | Optional; explicit save with flushed editor buffer |
| `onCloseTab` | `(groupId, tabId) => void` | User closed a tab |
| `onReorderTabInGroup` | `(groupId, tabId, toIndex) => void` | Reorder within the same strip |
| `onMoveTabToGroup` | `(detail) => void` | Move tab to another slot (**`toGroupId`**, **`insertIndex`**, **`fromGroupId`**) |
| `onSetGridLayout` | `(rows, cols) => void` | Optional; shows **`TabGroupLayoutSelector`** in the first non-empty group's toolbar |
| `className` | `string` | Optional root wrapper class |

### UsfmShell

**`UsfmShell`** is a top-level application shell: a left sidebar with vertical icon tabs (file browser + folder-wide search) that **spans the full height of the shell**, and to its right a column with the **`UsfmWorkspace`** stacked above a collapsible bottom bar (the bottom bar does **not** extend under the sidebar). The shell is **host-agnostic** — it never touches the filesystem itself. Pass a **`UsfmShellHost`** that lists files and reads their contents; a fixture host (**`createFixtureUsfmShellHost`**) is exported for tests.

```tsx
import { UsfmShell, createFixtureUsfmShellHost } from "@usfm-tools/controls";

const host = createFixtureUsfmShellHost();
<UsfmShell host={host} className="h-screen" />;
```

**Sidebar.** Vertical icon tabs (document icon = file browser, magnifying-glass icon = search) on the left of the sidebar; the file browser is the default tab. A chevron button toggles the sidebar between **minimized** (icons only) and **expanded** (icons + tab panel). A **gear** button at the bottom of the icon rail opens the **`SettingsPane`** as a singleton workspace tab (see **SettingsPane** above). Clicking a file opens it as a new editor tab — or focuses the existing tab if the file is already open. Search uses regular-expression matching with **`Aa`** (match case), **`ab`** (whole word), and **`.*`** (regex) toggle buttons modeled after the editor's find bar; clicking a result opens (or focuses) the file and selects the matched range in the editor.

**Bottom bar.** A horizontal icon-tab strip with a single tab today — a bug icon for **Errors**. The shell runs **one** debounced validation (300 ms after typing stops) against the focused editor’s live buffer and shares the result with both the errors list and editor squiggles. Each diagnostic is shown as **`line:column`** + message; clicking a row moves the caret to that position. A chevron button toggles the bottom panel between expanded and collapsed (tabs only).

```ts
interface UsfmShellHost extends SettingsHost {
  readonly label: string;
  readonly folderPath: string;
  listRecentFolders(): Promise<readonly UsfmShellRecentFolder[]>;
  openFolder(path: string): Promise<void>;
  pickFolder(): Promise<void>;
  listFiles(): Promise<readonly UsfmShellFileEntry[]>;
  readFile(fileId: string): Promise<string | null>;
  readFilePickerHeader?(fileId: string): Promise<string | null>;
  writeFile?(fileId: string, content: string): Promise<void>;
  // from SettingsHost — persist application settings (see SettingsPane):
  loadSettings(): Promise<ApplicationSettings | null>;
  saveSettings(settings: ApplicationSettings): Promise<void>;
}
interface UsfmShellFileEntry {
  readonly id: string;
  readonly name: string;
}
```

| Prop | Type | Description |
|------|------|-------------|
| `host` | `UsfmShellHost` | File-system adapter — list/open folders, list/read (and optionally write) USFM files |
| `defaultSidebarExpanded` | `boolean` | Initial sidebar state (default `true`) |
| `defaultBottomExpanded` | `boolean` | Initial bottom-bar state (default `true`) |
| `className` | `string` | Optional root wrapper class (typically `h-screen` or similar) |

**Imperative handle** (`ref` on **`UsfmShell`**): **`confirmExit()`** (prompts for unsaved tabs), **`hasUnsavedChanges()`**.

### SettingsPane

**`SettingsPane`** is a workspace pane for editing application settings. Today it exposes a single setting — the **color theme** (**Light**, **Dark**, **System**) — as a radio group. Changing the theme updates the UI immediately and persists through the host. The pane reads and writes a **host-backed settings store** directly through the **`useSettings()`** hook, so it must be rendered inside a **`SettingsProvider`**; it takes no settings props of its own.

Inside **`UsfmShell`**, the sidebar **gear** button opens the **`SettingsPane`** as a **singleton** workspace tab (clicking it again focuses the existing tab), and the shell wraps its tree in a **`SettingsProvider`** bound to the host. To use the pane standalone, supply your own provider:

```tsx
import { SettingsPane, SettingsProvider } from "@usfm-tools/controls";

<SettingsProvider host={host}>
  <SettingsPane className="h-full" />
</SettingsProvider>;
```

**`SettingsProvider`** loads settings once from the host on mount (`loadSettings()`) and persists every change (`saveSettings(next)`), so neither the shell nor the **`UsfmWorkspace`** mediates settings changes. **`useSettings()`** returns `{ settings, loading, setSettings, setTheme }`. The persistence backend is the narrow **`SettingsHost`** interface, which **`UsfmShellHost`** extends:

```ts
type UiTheme = "light" | "dark" | "system";
interface ApplicationSettings {
  readonly theme: UiTheme;
}
interface SettingsHost {
  loadSettings(): Promise<ApplicationSettings | null>; // null → defaults
  saveSettings(settings: ApplicationSettings): Promise<void>;
}
```

| Export | Kind | Description |
|--------|------|-------------|
| `SettingsPane` | component | Settings UI; reads/writes via `useSettings()` (needs a provider). Props: `className` |
| `SettingsProvider` | component | Owns settings state + persistence; applies the active theme to descendants. Props: `host: SettingsHost`, `children` |
| `useSettings` | hook | `{ settings, loading, setSettings, setTheme }` — throws outside a provider |
| `ThemeScope` | component | Applies resolved light/dark styling (`dark` class + `data-theme`). Used automatically by `SettingsProvider`; pass `theme` to use standalone |
| `useResolvedTheme` | hook | Returns the effective `"light"` \| `"dark"` appearance (follows OS when preference is `system`) |
| `ApplicationSettings` / `UiTheme` | types | Settings shape and theme union |
| `UI_THEME_OPTIONS` / `DEFAULT_APPLICATION_SETTINGS` | values | Theme option list (label + description) and defaults (`theme: "system"`) |

Workspace tabs carry an optional **`kind`** (**`"editor"`** \| **`"settings"`**, default `editor`); **`UsfmWorkspace`** renders a **`SettingsPane`** for settings tabs and a **`UsfmPane`** otherwise. Open the singleton settings tab on a model with **`workspaceOpenSettingsTab(model)`** (exported alongside **`SETTINGS_TAB_ID`**).

### Theming

Components use **Tailwind `dark:` variants** and **CSS custom properties** (see **`src/styles.css`**) for surfaces, borders, CodeMirror chrome, and the find/replace panel. The default theme preference is **`system`**, which follows `prefers-color-scheme`.

Inside **`UsfmShell`**, **`SettingsProvider`** wraps the shell tree and applies the resolved theme automatically. For standalone usage, import the package stylesheet and wrap your tree:

```tsx
import "@usfm-tools/controls/styles.css"; // if you publish/export styles from your app bundle
import { ThemeScope, UsfmEditor } from "@usfm-tools/controls";

<ThemeScope theme="dark">
  <UsfmEditor value={usfm} onChange={setUsfm} className="h-[500px]" />
</ThemeScope>;
```

When integrating into an app that already owns global dark mode, either nest **`ThemeScope`** inside your own theme root or call **`useResolvedTheme()`** to align host chrome with the controls.

### TabGroupLayoutSelector

Dropdown with a **2×2 grid** trigger icon. The menu shows four squares; clicking cell **(row, col)** sets **`gridRows = row + 1`** and **`gridCols = col + 1`** (e.g. bottom-right → 2×2). **`UsfmWorkspace`** embeds this control in the tab group toolbar when **`onSetGridLayout`** is set; you can also render it standalone and wire **`onChange`** to **`workspaceSetGridLayout`** on your workspace model.

| Prop | Type | Description |
|------|------|-------------|
| `gridRows` / `gridCols` | `1 \| 2` | Current layout |
| `onChange` | `(rows, cols) => void` | User picked a new layout |
| `className` | `string` | Optional wrapper class |

### UsfmFilePicker

Folder-oriented file list with the same OT / NT / other / non-standard grouping as **`UsfmBookPicker`**, but keyed by file **`id`** and **`name`**. Accept either raw **`files`** (`{ id, name, usfm }[]`) or pre-built **`groups`** from **`buildUsfmFilePickerGroups`**. **`UsfmShell`**’s sidebar file browser uses this control.

| Prop | Type | Description |
|------|------|-------------|
| `files` | `{ id, name, usfm }[]` | Optional; grouped on the client when `groups` is omitted |
| `groups` | `UsfmFilePickerGroups` | Optional; pre-built catalog (for example from a folder index) |
| `activeFileId` | `string \| null` | Highlights the open file |
| `onFileSelect` | `(detail: { fileId, code }) => void` | Optional; user activated a file row |
| `className` | `string` | CSS class on the root wrapper |

### ChapterPicker

Shows chapter numbers as a **wrapping row of equal-width buttons** (labels are the raw `\\c` number strings in **document order** — no sorting or reformatting). Pass **`chapterNumbers`** from **`listChapterNumbersFromBook`** (parsed AST) or map **`listChapterMarkersInUsfm`** results to `.number`.

```tsx
import { ChapterPicker } from "@usfm-tools/controls";
import { listChapterMarkersInUsfm } from "@usfm-tools/model";

const markers = listChapterMarkersInUsfm("\\id PSA\n\\c 1\n\\p\n\\v 1\n\\c 2\n\\p\n\\v 1");

<ChapterPicker
  chapterNumbers={markers.map((m) => m.number)}
  onChapterSelect={({ chapterNumber }) => {
    /* scroll editor, etc. */
  }}
  className="border rounded-md p-2"
/>;
```

| Prop | Type | Description |
|------|------|-------------|
| `chapterNumbers` | `string[]` | Chapter labels exactly as on `\\c` markers, in source order |
| `onChapterSelect` | `(detail: { chapterNumber: string }) => void` | Optional; fired when the user activates a chapter button |
| `className` | `string` | CSS class on the root wrapper |

The package also **re-exports** from **`@usfm-tools/model`**: `renderPreviewHtml`, **`RenderPreviewOptions`**, `ViewModels`, `PublicationViewModel`, **`buildUsfmBookPickerGroups`**, **`buildUsfmFilePickerGroups`**, **`listChapterNumbersFromBook`**, **`listChapterMarkersInBook`**, **`listChapterMarkersInUsfm`**, **`bookIdMarkerOffsetInUsfm`**, **`chapterNumberAtOrBeforeSourceOffset`**, picker types, and **`ChapterMarkerInBook`**, so you can use the model without a second import path.

### UsfmEditor props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | USFM content to display |
| `onChange` | `(value: string) => void` | Called when content changes (debounced when `onChangeDebounceMs` > 0) |
| `onChangeDebounceMs` | `number` | Delay lifting the full document string to React (default `0`; **`UsfmPane`** uses `500`) |
| `onDirty` | `() => void` | First edit while the parent still considers the tab clean |
| `onDocumentChange` | `() => void` | Every edit, before any `onChange` debounce |
| `diagnostics` | `Diagnostic[]` | Parse diagnostics from shell unified validation (drives lint squiggles) |
| `onSave` | `() => void` | Ctrl+S / Cmd+S (flushes pending `onChange` first) |
| `className` | `string` | CSS class for the container (use for height) |
| `onViewportAnchorChange` | `(sourceOffset: number) => void` | Optional; debounced (~120ms) after scroll or selection moves the viewport — document offset near the top edge |

**Find / replace:** **Ctrl+F** opens find-only; **Ctrl+H** opens find with the replace row. The left **chevron** expands or collapses replace. Inline toggles: **Match Case** (Aa), **Match Whole Word** (ab), **Use Regular Expression** (.\*). **Replace** updates the current match and moves to the next; **Replace All** replaces every match. **F3** / **Ctrl+G** find next; **Shift+F3** / **Shift+Ctrl+G** find previous; **Escape** closes the panel. All controls have tooltips.

**Imperative handle** (`ref` on **`UsfmEditor`**): **`scrollSourceOffsetIntoView`**, **`getTopVisibleSourceOffset`**, **`getDocument`**, **`flushChange`**, **`selectSourceRange`**, **`lineColumnToOffset`**, **`openFind()`**, **`openFindReplace()`**.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  UsfmShell / UsfmWorkspace / UsfmPane / UsfmEditor (React)   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CodeMirror 6 — live document, viewport highlight,     │  │
│  │  lint squiggles from shell-provided diagnostics        │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                │ renderPreviewHtml            │ validate / classify / complete
                ▼                              ▼
        ┌───────────────────┐        ┌─────────────────────────┐
        │  @usfm-tools/model │        │  USFM Language Service │
        │  view models + HTML│        │  (@usfm-tools/parser)    │
        └───────────────────┘        └─────────────────────────┘
```

**Validation** is owned by **`UsfmShell`**: one debounced `validate` request reads the focused editor’s live buffer and pushes diagnostics to both the errors panel and **`UsfmEditor`** (via CodeMirror **`setDiagnostics`**). **Syntax highlighting** classifies only the visible viewport (plus a few lines of margin) inside the editor.

### Language Service Protocol

The language service uses a simple request/response protocol inspired by LSP:

```typescript
// Request types
{ type: "validate", id, content }
{ type: "complete", id, content, position: { line, column } }
{ type: "classify", id, content }
{ type: "classifyRange", id, content, from, to }

// Response types
{ type: "validate", id, diagnostics: [...] }
{ type: "complete", id, items: [...] }
{ type: "classify", id, tokens: [...] }
{ type: "classifyRange", id, tokens: [...] }
```

The service runs synchronously on the main thread via **`createLanguageClient()`**. The message-based design allows a future upgrade to Web Worker transport or incremental document sync without changing call sites.

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

**Full-book editing:** **`UsfmPane`** targets entire files (multiple **`\\c`** markers). The live document stays in CodeMirror; React workspace state, preview HTML, chapter-marker scans, scroll sync, and validation are debounced so large books (for example Psalms) stay responsive with the preview pane open. Further gains are possible with Web Workers, chapter-scoped preview HTML, or incremental document sync to the language service.

**Lightweight:** No VS Code / Monaco fork. CodeMirror 6 provides the editing primitives; the USFM-specific intelligence lives in our language service.

**Self-contained pane state:** cross-cutting state that nothing else in the shell reads (for example **settings**) lives in a **host-backed context store** the pane reads and writes directly (**`SettingsProvider`** + **`useSettings()`**), rather than bubbling change events up through **`UsfmWorkspace`** to **`UsfmShell`**. The shell only wires the provider to the host; it does not own or mediate the state. Reserve the shell-owned, fully-controlled pattern (state + callbacks threaded through the workspace) for data genuinely shared across the shell — open tabs, focus, dirty flags, and diagnostics.

## Development

### Prerequisites

- Deno 2+

### Setup

```bash
cd packages/usfm-controls
```

### Tasks

| Command | Description |
|---------|-------------|
| `deno task check` | Type-check `src/` |
| `deno task test` | Run tests (happy-dom + Testing Library) |
| `deno task lint` | Lint sources and tests |
| `deno task ladle` | Start [Ladle](https://ladle.dev/) dev server for component stories |
| `deno task ladle:build` | Build a static Ladle site to `build/` |

React component tests import `./testing-react.ts`, which registers happy-dom before Loading Library. CodeMirror-heavy suites call `registerDomTestHooks({ flushTimers: true })`.

Component stories (`*.stories.tsx`) use Ladle’s CSF-compatible format (`@ladle/react`). Global theming is configured in `.ladle/components.tsx` (wraps stories in `ThemeScope`). Vite resolves workspace packages via aliases in `vite.config.ts`. Ladle uses `@vitejs/plugin-react` (Babel) in `vite.config.ts` so story dev/build works with **Deno only** — no Node.js or npm CLI required.

### Project Structure

```
packages/usfm-controls/
├── src/
│   ├── fixtures/
│   │   └── sample-bsb-genesis-usfm.ts
│   ├── index.ts
│   ├── styles.css
│   ├── theme-tokens.ts
│   ├── components/
│   │   ├── usfm-editor/
│   │   │   ├── UsfmEditor.tsx
│   │   │   ├── codemirror-usfm.ts   # CM6 extensions (highlight, lint, autocomplete)
│   │   │   └── usfm-search-panel.ts
│   │   ├── usfm-preview/
│   │   ├── usfm-book-picker/
│   │   ├── usfm-file-picker/
│   │   ├── usfm-pane/
│   │   ├── usfm-workspace/
│   │   │   ├── UsfmWorkspace.tsx
│   │   │   └── workspace-model.ts
│   │   ├── tab-group-layout-selector/
│   │   ├── usfm-shell/
│   │   │   ├── UsfmShell.tsx
│   │   │   ├── host.ts
│   │   │   ├── file-catalog.ts
│   │   │   ├── file-browser.tsx
│   │   │   ├── errors-panel.tsx
│   │   │   └── search.tsx
│   │   ├── settings-pane/
│   │   └── chapter-picker/
│   └── language-service/
│       ├── protocol.ts
│       ├── service.ts
│       ├── diagnostics.ts
│       ├── completions.ts
│       └── classifier.ts
├── tests/
│   ├── dom-setup.ts
│   ├── testing-react.ts
│   ├── language-service.test.ts
│   ├── unified-validation.test.ts
│   ├── usfm-editor-debounce.test.tsx
│   ├── usfm-editor-search.test.tsx
│   ├── usfm-preview.test.tsx
│   ├── usfm-pane.test.tsx
│   ├── usfm-workspace.test.tsx
│   ├── usfm-shell.test.tsx
│   └── …
└── deno.json
```

## References

- [CodeMirror 6](https://codemirror.net/)
- [USFM Spec](https://docs.usfm.bible/usfm/3.1.1/index.html)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)

## License

MIT
