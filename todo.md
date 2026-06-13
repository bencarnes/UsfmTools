# USFM editor typing performance

Fixes to reduce lag when editing large books (e.g. Psalms), especially with the preview pane open.

## Todo

- [x] **Stop full parsing in `UsfmPane` on every keystroke** — `firstBookFromUsfm` calls `parse(usfm)` whenever `value` changes (~16 ms on Psalms). Replace with a lightweight `\c` marker scan, cached/incremental marker list, or debounced refresh separate from editor `onChange`.
- [x] **Stop lifting the full document string to React on every keystroke** — keep document state in CodeMirror; debounce or ref-sync to the workspace model for save/dirty tracking only.
- [ ] **Unify validation** — share one debounced full-document parse between the CodeMirror linter and the shell errors panel instead of two independent parses (~250–300 ms apart).
- [x] **Pause scroll sync while typing** — defer split-pane scroll sync until typing idle, or sync only on explicit scroll; avoid `querySelectorAll` over the full preview DOM every ~120 ms while the cursor moves.
- [ ] **Incremental syntax highlighting** — avoid full-document lexer passes and decoration rebuilds on every pause; scope to viewport or use incremental tokenization.

## Context

Preview HTML regeneration is debounced (1.5 s) in split mode. Scroll sync is paused during typing and resumes after 500 ms idle. Workspace model updates are debounced (500 ms) while dirty state is marked immediately; save flushes the editor buffer first. Remaining per-keystroke cost is dominated by full-document validation/highlighting inside CodeMirror.

## Key files

- `packages/usfm-controls/src/components/usfm-pane/UsfmPane.tsx`
- `packages/usfm-controls/src/components/usfm-editor/UsfmEditor.tsx`
- `packages/usfm-controls/src/components/usfm-editor/codemirror-usfm.ts`
- `packages/usfm-controls/src/components/usfm-shell/UsfmShell.tsx`
- `packages/usfm-controls/src/components/usfm-pane/scroll-sync.ts`
