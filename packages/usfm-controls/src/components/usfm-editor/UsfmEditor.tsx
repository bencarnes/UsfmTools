import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, EditorSelection, Prec } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import type { Diagnostic as LanguageDiagnostic } from "../../language-service/protocol.js";
import {
  languageDiagnosticsToCm,
  usfmHighlighter,
  usfmLintExtension,
  usfmAutocomplete,
} from "./codemirror-usfm.js";
import {
  usfmSearchExtensions,
  openFindPanel,
  openFindReplacePanel,
} from "./usfm-search-panel.js";

export interface UsfmEditorHandle {
  /** Scroll so that {@link offset} sits at the top of the visible editor area. */
  scrollSourceOffsetIntoView(offset: number): void;
  /** Document offset nearest the top of the viewport, or `null` if the editor is not mounted. */
  getTopVisibleSourceOffset(): number | null;
  /** Current document text (includes edits not yet emitted through `onChange`). */
  getDocument(): string;
  /** Emit any pending debounced `onChange` immediately and return the current document text. */
  flushChange(): string;
  /** Move the cursor/selection to the given source range and scroll it into view. */
  selectSourceRange(from: number, to?: number): void;
  /** Convert a 1-based line / 0-based column to a clamped source offset, or `null` if no view. */
  lineColumnToOffset(line: number, column: number): number | null;
  /** Open the find bar (same as Ctrl+F). */
  openFind(): void;
  /** Open find and replace (same as Ctrl+H). */
  openFindReplace(): void;
}

export interface UsfmEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  /**
   * When positive, delays lifting the full document string to React until this many
   * milliseconds after the last edit. `0` emits on every change (default).
   */
  onChangeDebounceMs?: number;
  /** Fired on the first document edit while the parent still considers the tab clean. */
  onDirty?: () => void;
  /** Fired on every document edit (before any `onChange` debounce). */
  onDocumentChange?: () => void;
  /** Parse diagnostics for the current tab (owned by the shell; drives lint squiggles). */
  diagnostics?: readonly LanguageDiagnostic[];
  /**
   * Registers a reader for the live document buffer. Called on mount/update;
   * return value unregisters on cleanup.
   */
  onRegisterDocumentReader?: (readDocument: () => string) => void | (() => void);
  /** When set, Ctrl+S / Cmd+S triggers this callback instead of the browser save dialog. */
  onSave?: () => void;
  className?: string;
  /**
   * Fired (debounced ~120ms after scroll or selection-driven viewport changes) with the
   * document offset closest to the top edge of the viewport.
   */
  onViewportAnchorChange?: (sourceOffset: number) => void;
}

export const UsfmEditor = forwardRef<UsfmEditorHandle, UsfmEditorProps>(function UsfmEditor(
  {
    value = "",
    onChange,
    onChangeDebounceMs = 0,
    onDirty,
    onDocumentChange,
    diagnostics = [],
    onRegisterDocumentReader,
    onSave,
    onViewportAnchorChange,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onDirtyRef = useRef(onDirty);
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onSaveRef = useRef(onSave);
  const onViewportAnchorChangeRef = useRef(onViewportAnchorChange);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedRef = useRef(value);
  const dirtyReportedRef = useRef(false);

  onChangeRef.current = onChange;
  onDirtyRef.current = onDirty;
  onDocumentChangeRef.current = onDocumentChange;
  onSaveRef.current = onSave;
  onViewportAnchorChangeRef.current = onViewportAnchorChange;

  const readDocument = () => viewRef.current?.state.doc.toString() ?? "";

  const emitChange = (content: string) => {
    lastEmittedRef.current = content;
    onChangeRef.current?.(content);
  };

  const emitPendingChange = () => {
    if (changeDebounceRef.current) {
      clearTimeout(changeDebounceRef.current);
      changeDebounceRef.current = null;
    }
    const content = readDocument();
    emitChange(content);
    return content;
  };

  const scheduleChange = (content: string) => {
    if (!onChangeRef.current) return;
    if (onChangeDebounceMs <= 0) {
      emitChange(content);
      return;
    }
    if (changeDebounceRef.current) clearTimeout(changeDebounceRef.current);
    changeDebounceRef.current = setTimeout(() => {
      changeDebounceRef.current = null;
      emitChange(content);
    }, onChangeDebounceMs);
  };

  useImperativeHandle(ref, () => ({
    scrollSourceOffsetIntoView(offset: number) {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const o = Math.max(0, Math.min(offset, doc.length));
      view.dispatch({
        effects: EditorView.scrollIntoView(o, { y: "start", yMargin: 0 }),
      });
    },
    getTopVisibleSourceOffset() {
      const view = viewRef.current;
      if (!view) return null;
      const rect = view.scrollDOM.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + 4;
      return view.posAtCoords({ x, y }, false) ?? 0;
    },
    getDocument() {
      return readDocument();
    },
    flushChange() {
      return emitPendingChange();
    },
    selectSourceRange(from: number, to?: number) {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const a = Math.max(0, Math.min(from, doc.length));
      const b = to == null ? a : Math.max(0, Math.min(to, doc.length));
      view.dispatch({
        selection: EditorSelection.single(a, b),
        effects: EditorView.scrollIntoView(EditorSelection.range(a, b), { y: "center" }),
      });
      view.focus();
    },
    lineColumnToOffset(line: number, column: number) {
      const view = viewRef.current;
      if (!view) return null;
      const doc = view.state.doc;
      const safeLine = Math.max(1, Math.min(line, doc.lines));
      const l = doc.line(safeLine);
      const off = l.from + Math.max(0, Math.min(column, l.length));
      return off;
    },
    openFind() {
      const view = viewRef.current;
      if (view) openFindPanel(view);
    },
    openFindReplace() {
      const view = viewRef.current;
      if (view) openFindReplacePanel(view);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const scheduleViewportReport = () => {
      if (!onViewportAnchorChangeRef.current) return;
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = setTimeout(() => {
        viewportDebounceRef.current = null;
        const view = viewRef.current;
        const cb = onViewportAnchorChangeRef.current;
        if (!view || !cb) return;
        const rect = view.scrollDOM.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + 4;
        cb(view.posAtCoords({ x, y }, false) ?? 0);
      }, 120);
    };

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocumentChangeRef.current?.();
        if (!dirtyReportedRef.current) {
          dirtyReportedRef.current = true;
          onDirtyRef.current?.();
        }
        scheduleChange(update.state.doc.toString());
      }
      // Typing moves the selection every keystroke; skip viewport sync then so split-pane
      // scroll alignment does not walk the preview DOM on each character.
      if (update.selectionSet && !update.docChanged) scheduleViewportReport();
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                emitPendingChange();
                onSaveRef.current?.();
                return true;
              },
            },
          ]),
        ),
        usfmHighlighter,
        usfmLintExtension,
        usfmAutocomplete,
        usfmSearchExtensions,
        updateListener,
        EditorView.theme({
          "&": {
            fontSize: "14px",
            height: "100%",
            backgroundColor: "var(--usfm-cm-bg)",
            color: "var(--usfm-cm-fg)",
          },
          // No drawSelection() extension is enabled, so the editor uses the
          // native browser caret. Its color comes from `caret-color`, not the
          // `.cm-cursor` DOM layer (which is never rendered here).
          ".cm-content": {
            caretColor: "var(--usfm-cm-caret)",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          ".cm-gutters": {
            backgroundColor: "var(--usfm-cm-gutter)",
            color: "var(--usfm-cm-gutter-fg)",
            borderRight: "1px solid var(--usfm-border-subtle)",
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
            backgroundColor: "var(--usfm-cm-selection)",
          },
          ".cm-usfm-marker": {
            color: "var(--usfm-syntax-marker)",
            fontWeight: "bold",
          },
          ".cm-usfm-endmarker": {
            color: "var(--usfm-syntax-endmarker)",
            fontWeight: "bold",
          },
          ".cm-usfm-versenum": {
            color: "var(--usfm-syntax-verse)",
            fontWeight: "bold",
          },
          ".cm-usfm-chapternum": {
            color: "var(--usfm-syntax-chapter)",
            fontWeight: "bold",
            fontSize: "1.1em",
          },
          ".cm-usfm-attribute": {
            color: "var(--usfm-syntax-attribute)",
          },
          ".cm-usfm-attrvalue": {
            color: "var(--usfm-syntax-attrvalue)",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    view.scrollDOM.addEventListener("scroll", scheduleViewportReport, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener("scroll", scheduleViewportReport);
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = null;
      if (changeDebounceRef.current) clearTimeout(changeDebounceRef.current);
      changeDebounceRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    dirtyReportedRef.current = false;
  }, [value]);

  useEffect(() => {
    if (!onRegisterDocumentReader) return;
    return onRegisterDocumentReader(readDocument) ?? undefined;
  }, [onRegisterDocumentReader]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, languageDiagnosticsToCm(view.state.doc, diagnostics)));
  }, [diagnostics]);

  // Update content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastEmittedRef.current) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
      lastEmittedRef.current = value;
      dirtyReportedRef.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`usfm-editor-root relative overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900 ${className ?? ""}`}
    />
  );
});

UsfmEditor.displayName = "UsfmEditor";
