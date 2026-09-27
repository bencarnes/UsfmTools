# UI Terminology

Names for the major parts of the BibleEdit UI (the `UsfmShell` from
`packages/usfm-controls`, hosted by `apps/bible-edit`). Use these terms in
change requests so it is clear which part is meant. Each entry gives the
**term**, what it is, and where it lives in code.

## Layout at a glance

```
┌──┬───────────────┬──────────────────────────────────────────────────────┐
│A │ Sidebar panel │ Tab group header                                     │
│c │ (Files or     │ ┌──────────────────────────┬─┬───────────────┬────┐  │
│t │  Search)      │ │ Tab strip: [GEN ×][EXO ●]│▾│ Pane toolbar  │ ▦  │  │
│i │               │ └──────────────────────────┴─┴───────────────┴────┘  │
│v │  File list    │ ┌──────────────────────────┬───────────────────────┐ │
│i │  (Files)      │ │ Editor                   ┃ Preview               │ │
│t │               │ │  ┌ Find bar ┐            ┃                       │ │
│y │               │ │                          ┃ (split view)          │ │
│  │               │ └──────────────────────────┴───────────────────────┘ │
│b │───────────────│                        Workspace (grid of tab groups)│
│a │Folder selector├──────────────────────────────────────────────────────┤
│r │               │ Bottom bar: [Errors 3]                           [⌄] │
│  │               │ Bottom panel (Errors panel)                          │
└──┴───────────────┴──────────────────────────────────────────────────────┘
```

## Shell (whole window)

| Term | Description | Code |
|------|-------------|------|
| **Shell** | The whole application UI: sidebar, workspace and bottom bar. Owns the workspace model, open files and document sessions. | `usfm-shell/UsfmShell.tsx` |
| **Sidebar** | The full-height left region: the activity bar plus (when expanded) the sidebar panel. | `UsfmShell` `<aside>`, test id `usfm-shell-sidebar` |
| **Activity bar** | Narrow vertical icon strip at the far left. Top: **Files** and **Search** icons (select the sidebar panel). Bottom: **Settings** gear and the **sidebar toggle** (collapse/expand). | `role="tablist"` in `UsfmShell` |
| **Sidebar panel** | The 16rem-wide area next to the activity bar that shows the Files panel or the Search panel. Hidden when the sidebar is collapsed. | test id `usfm-shell-sidebar-panel` |
| **Bottom bar** | The strip under the workspace (not under the sidebar) holding icon tabs (currently only **Errors**, with a red count badge) and the **bottom bar toggle** on the right. | test id `usfm-shell-bottom-bar` |
| **Bottom panel** | The area under the bottom bar tabs that shows the selected bottom tab (the Errors panel). Hidden when the bottom bar is collapsed. | test id `usfm-shell-bottom-panel` |
| **Unsaved changes dialog** | Modal asking Save / Discard / Cancel when closing a dirty tab or exiting the app. | `usfm-shell/unsaved-changes-dialog.tsx` |
| **Drag ghost** | Floating file-name label that follows the pointer while dragging a file from the file list into a tab group. | `fileGhostRef` in `UsfmShell` |

## Sidebar panels

| Term | Description | Code |
|------|-------------|------|
| **Files panel** (file browser) | Sidebar panel listing the files in the open folder, with the folder selector at its bottom. | `usfm-shell/file-browser.tsx` |
| **File list** (file picker) | The list of book buttons inside the Files panel, grouped into sections separated by dividers: Old Testament, New Testament, other standard books, then non‑standard files. Click to open in the active tab group; drag onto a tab group to open there. | `usfm-file-picker/UsfmFilePicker.tsx` |
| **Folder selector** | Row at the bottom of the Files panel: current folder name, **recent folders** dropdown, and **Open new folder** button. | `usfm-shell/folder-selector.tsx` |
| **Search panel** | Sidebar panel for searching across *all* files in the folder: query box, match-case / whole-word / regex toggles, and a **search results** list; clicking a result opens the file and selects the match. | `usfm-shell/search.tsx` |

## Workspace (editing area)

| Term | Description | Code |
|------|-------------|------|
| **Workspace** | The main area to the right of the sidebar, above the bottom bar. A grid (up to the chosen rows × columns) of tab groups. | `usfm-workspace/UsfmWorkspace.tsx` |
| **Tab group** | One cell of the workspace grid: a tab group header plus the content of its active tab. Exactly one is the **active tab group** (the last one clicked); new files open there. In code also called a *slot* or *editor group*. | `EditorGroupPanel`, `workspace-model.ts` (`slots`) |
| **Empty tab group** | A tab group with no tabs; shows a dashed "Drop a tab here" target. | `EmptySlotDropTarget` |
| **Splitter** (resize handle) | Draggable divider between tab groups (columns) or rows of tab groups. | `aria-label="Resize tab groups"` / `"Resize tab group rows"` |
| **Tab group header** | The bar across the top of a tab group: tab strip, tab list dropdown, pane toolbar, layout selector (left to right). | top `div` of `EditorGroupPanel` |
| **Tab strip** | The row of tabs in a tab group header. Tabs can be dragged to reorder or moved to another tab group. | `TabStrip` |
| **Tab** | One open file (or the Settings page) in a tab group. Shows the file name; an unsaved (**dirty**) tab is italic and its close button (×) becomes a hollow dot. The same file may be open in several tab groups; those tabs share one live document. | `TabStrip`, `UsfmWorkspaceTabState` |
| **Tab context menu** | Right-click menu on a tab: Close, Close Others, Close All. | `usfm-workspace/tab-context-menu.tsx` |
| **Tab list dropdown** | Chevron button right after the tab strip listing all tabs in the group, for jumping to one that has scrolled out of view. | `usfm-workspace/tab-list-dropdown.tsx` |
| **Layout selector** | Grid icon at the right end of each tab group header; opens a rows × columns picker that sets the workspace grid layout. | `tab-group-layout-selector/TabGroupLayoutSelector.tsx` |

## File pane (a USFM file tab's content)

| Term | Description | Code |
|------|-------------|------|
| **Pane** (file pane) | Content of a USFM file tab: its toolbar plus the editor, preview, or both. | `usfm-pane/UsfmPane.tsx` |
| **Pane toolbar** | The active tab's controls, rendered into the tab group header. In order: chapter navigator, scroll sync toggle, word wrap toggle, verse-per-line toggle, find button, save button, view mode button. | `toolbar` in `UsfmPane` (portaled into the header), test id `usfm-pane-toolbar` |
| **Chapter navigator** | Previous chapter ‹, current chapter button, next chapter ›. The current chapter button opens the chapter picker. | `usfm-pane/chapter-navigator.tsx` |
| **Chapter picker** | Dropdown grid of chapter-number buttons for jumping to a chapter. | `chapter-picker/ChapterPicker.tsx` |
| **Scroll sync toggle** | Turns synchronized scrolling between editor and preview (split view) on/off. | `usfm-pane/scroll-sync-toggle.tsx` |
| **Word wrap toggle** | Turns soft word wrap in the editor on/off. | `usfm-pane/word-wrap-toggle.tsx` |
| **Verse-per-line toggle** | Numbered-lines switch that lays out the preview one verse per line, ignoring paragraph and poetry breaks (disabled in edit-only view). | `usfm-pane/verse-per-line-toggle.tsx` |
| **Find button** | Magnifier that opens the editor's find bar (disabled in preview-only view). | `usfm-pane/find-toolbar-button.tsx` |
| **Save button** | Floppy disk; saves the tab (enabled only when dirty). | `usfm-pane/save-toolbar-button.tsx` |
| **View mode button** | Cycles the pane through **Edit** view → **Preview** view → **Split** view (edit + preview side by side). Its icon shows the *next* mode. | `usfm-pane/view-mode-toggle.tsx` |
| **Split divider** | Draggable vertical bar between editor and preview in split view. | `role="separator"` in `UsfmPane` |

## Editor and preview

| Term | Description | Code |
|------|-------------|------|
| **Editor** | The CodeMirror USFM source editor: line-number **gutter**, syntax highlighting, native caret. | `usfm-editor/UsfmEditor.tsx`, `codemirror-usfm.ts` |
| **Find bar** | The in-editor find/replace panel (Ctrl+F): Find field, case / whole-word / regex toggles, next/previous, and an expandable **replace row**. Searches only the current file — contrast with the Search panel. | `usfm-editor/usfm-search-panel.ts` |
| **Completion popup** | Autocomplete list of USFM markers shown while typing. | `autocompletion` in `codemirror-usfm.ts` |
| **Lint markers** | Inline error underlines/tooltips in the editor from the language client's diagnostics. | `usfmLintExtension` in `codemirror-usfm.ts` |
| **Preview** | Rendered (formatted scripture) view of the USFM. | `usfm-preview/UsfmPreview.tsx` |

## Bottom panel contents

| Term | Description | Code |
|------|-------------|------|
| **Errors panel** | Lists diagnostics for the active file ("Errors — GEN.usfm" header with count). Clicking an error moves the editor cursor to it. | `usfm-shell/errors-panel.tsx` |

## Settings

| Term | Description | Code |
|------|-------------|------|
| **Settings page** (settings tab) | A special singleton tab (opened from the activity bar gear) that holds app settings, currently the **Theme** choice: Light / Dark / System. It has no pane toolbar and no diagnostics. | `settings-pane/SettingsPane.tsx` |

## Easily confused terms

- **Search panel** (sidebar, all files) vs **Find bar** (inside the editor, current file).
- **Sidebar panel** / **Bottom panel** (shell regions) vs **Pane** (a tab's content).
- **Tab group header** (the whole bar) vs **Tab strip** (just the tabs) vs **Pane toolbar** (the active tab's buttons within the header).
- **Tab group** vs **workspace**: the workspace is the grid; a tab group is one cell.
- **Layout selector** (grid of tab groups) vs **View mode button** (edit / preview / split within one pane).
- **Active tab** (selected tab in one group) vs **active tab group** (the group that receives newly opened files).
