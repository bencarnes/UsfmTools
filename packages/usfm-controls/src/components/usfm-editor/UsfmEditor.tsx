import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, EditorSelection, Prec, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import type {
  Diagnostic as LanguageDiagnostic,
  UsfmLanguageClient,
} from "../../language-service/protocol.js";
import { DocumentSync } from "../../language-service/document-sync.js";
import { sharedLocalLanguageClient } from "../../language-service/local-client.js";
import {
  languageDiagnosticsToCm,
  usfmHighlighter,
  usfmLintExtension,
  usfmAutocomplete,
  type EditorLanguageSession,
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
  /**
   * Language client serving diagnostics, highlighting, and completions. The
   * editor opens its own engine document, forwards CodeMirror change sets
   * incrementally, and closes it on unmount. Must be stable for the editor's
   * lifetime; defaults to the in-process TypeScript client.
   */
  languageClient?: UsfmLanguageClient;
  /** Fired with fresh parse diagnostics whenever the engine re-analyzes. */
  onDiagnostics?: (diagnostics: readonly LanguageDiagnostic[]) => void;
  /**
   * Reports the language-client document id backing this editor: the id on
   * mount, `null` on unmount. Lets siblings (e.g. the split-pane preview)
   * issue requests against the editor's synced document copy.
   */
  onDocumentIdChange?: (id: string | null) => void;
  /**
   * Registers a reader for the live document buffer. Called on mount/update;
   * return value unregisters on cleanup.
   */
  onRegisterDocumentReader?: (readDocument: () => string) => void | (() => void);
  /** When set, Ctrl+S / Cmd+S triggers this callback instead of the browser save dialog. */
  onSave?: () => void;
  /** When true (default), long lines soft-wrap; when false, the editor scrolls horizontally. */
  wordWrap?: boolean;
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
    languageClient,
    onDiagnostics,
    onDocumentIdChange,
    onRegisterDocumentReader,
    onSave,
    onViewportAnchorChange,
    wordWrap = true,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const wordWrapCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onDirtyRef = useRef(onDirty);
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onDiagnosticsRef = useRef(onDiagnostics);
  const onDocumentIdChangeRef = useRef(onDocumentIdChange);
  const languageClientRef = useRef(languageClient);
  const onSaveRef = useRef(onSave);
  const onViewportAnchorChangeRef = useRef(onViewportAnchorChange);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedRef = useRef(value);
  // True while an emitted change is still round-tripping through the parent
  // as a `value` echo (cleared when the echo arrives). See the value effect.
  const echoPendingRef = useRef(false);
  const dirtyReportedRef = useRef(false);

  onChangeRef.current = onChange;
  onDirtyRef.current = onDirty;
  onDocumentChangeRef.current = onDocumentChange;
  onDiagnosticsRef.current = onDiagnostics;
  onDocumentIdChangeRef.current = onDocumentIdChange;
  languageClientRef.current = languageClient;
  onSaveRef.current = onSave;
  onViewportAnchorChangeRef.current = onViewportAnchorChange;

  const readDocument = () => viewRef.current?.state.doc.toString() ?? "";

  const emitChange = (content: string) => {
    lastEmittedRef.current = content;
    echoPendingRef.current = onChangeRef.current != null;
    onChangeRef.current?.(content);
  };

  // Emit only when the document actually changed since the last emission (or
  // external replace). A no-op emission would produce no state change in the
  // parent and therefore no `value` echo, leaving the echo guard armed
  // forever — which would block all future external value updates (e.g.
  // edits arriving from another tab sharing this file's buffer).
  const emitChangedDocument = () => {
    const content = readDocument();
    if (content !== lastEmittedRef.current) emitChange(content);
    return content;
  };

  const emitPendingChange = () => {
    if (changeDebounceRef.current) {
      clearTimeout(changeDebounceRef.current);
      changeDebounceRef.current = null;
    }
    return emitChangedDocument();
  };

  // The document string is materialized when the change is emitted, not per
  // keystroke — toString() over a large book on every edit is avoidable work.
  const scheduleChange = () => {
    if (!onChangeRef.current) return;
    if (onChangeDebounceMs <= 0) {
      emitChangedDocument();
      return;
    }
    if (changeDebounceRef.current) clearTimeout(changeDebounceRef.current);
    changeDebounceRef.current = setTimeout(() => {
      changeDebounceRef.current = null;
      emitChangedDocument();
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

    // Each mounted editor owns one engine document: open with the initial
    // text, forward every CodeMirror change set incrementally, close on
    // unmount. A unique id isolates this instance from other tabs/editors
    // (including other editors showing the same file).
    const client = languageClientRef.current ?? sharedLocalLanguageClient();
    const documentId = `usfm-editor-${crypto.randomUUID()}`;
    const sync = new DocumentSync({
      client,
      id: documentId,
      getText: readDocument,
    });
    const session: EditorLanguageSession = {
      classifyRange: (from, to) =>
        sync.request(() => client.classifyRange(documentId, from, to)).then((r) => r.tokens),
      getCompletions: (line, column) =>
        sync.request(() => client.getCompletions(documentId, line, column)),
    };

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
        sync.applyChanges(update.changes);
        onDocumentChangeRef.current?.();
        if (!dirtyReportedRef.current) {
          dirtyReportedRef.current = true;
          onDirtyRef.current?.();
        }
        scheduleChange();
      }
      // Typing moves the selection every keystroke; skip viewport sync then so split-pane
      // scroll alignment does not walk the preview DOM on each character.
      if (update.selectionSet && !update.docChanged) scheduleViewportReport();
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        wordWrapCompartmentRef.current.of(wordWrap ? EditorView.lineWrapping : []),
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
        usfmHighlighter(session),
        usfmLintExtension,
        usfmAutocomplete(session),
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
          // Autocomplete (intellisense) dropdown. The default CodeMirror theme
          // assumes light mode, so drive its colors from our CSS variables.
          ".cm-tooltip.cm-tooltip-autocomplete": {
            backgroundColor: "var(--usfm-cm-tooltip-bg)",
            color: "var(--usfm-cm-fg)",
            border: "1px solid var(--usfm-cm-tooltip-border)",
          },
          ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
            color: "var(--usfm-cm-fg)",
          },
          ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
            backgroundColor: "var(--usfm-cm-tooltip-selected-bg)",
            color: "var(--usfm-cm-tooltip-selected-fg)",
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

    // Open the engine document (after viewRef is set, so getText reads the
    // live buffer) and route its pushed analyses into lint squiggles and the
    // onDiagnostics callback.
    sync.open();
    onDocumentIdChangeRef.current?.(documentId);
    const unsubscribeAnalysis = client.onAnalysis((event) => {
      if (event.id !== documentId) return;
      // An analysis older than the edits already forwarded carries pre-edit
      // positions, and the client is guaranteed to re-analyze after every
      // edit, so a fresh push follows. Skip it: CodeMirror has been mapping
      // the previously applied squiggles through the edits meanwhile, which
      // is more accurate than painting stale offsets.
      if (event.version < sync.version) return;
      const v = viewRef.current;
      if (v) {
        v.dispatch(setDiagnostics(v.state, languageDiagnosticsToCm(v.state.doc, event.diagnostics)));
      }
      onDiagnosticsRef.current?.(event.diagnostics);
    });

    return () => {
      onDocumentIdChangeRef.current?.(null);
      unsubscribeAnalysis();
      sync.close();
      view.scrollDOM.removeEventListener("scroll", scheduleViewportReport);
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = null;
      if (changeDebounceRef.current) {
        clearTimeout(changeDebounceRef.current);
        changeDebounceRef.current = null;
        // Flush rather than drop: unmounting mid-debounce (e.g. a view-mode
        // switch remounting the editor) must not lose the last edits.
        emitChangedDocument();
      }
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
    view.dispatch({
      effects: wordWrapCompartmentRef.current.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wordWrap]);

  // Update content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastEmittedRef.current) {
      echoPendingRef.current = false;
      return;
    }
    // While an emitted change is still echoing back through the parent, a
    // differing prop is a *stale* echo of an older emission (this effect runs
    // after paint, so under main-thread congestion the next debounced
    // emission can land before the previous echo's effect does). Treating it
    // as an external change would replace the document with old content —
    // wiping the newest edits and throwing the caret to offset 0. Skip it;
    // the echo of the latest emission follows and clears the flag.
    if (echoPendingRef.current) return;
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
