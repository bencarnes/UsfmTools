import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { usfmHighlighter, usfmLinter, usfmAutocomplete } from "./codemirror-usfm.js";

export interface UsfmEditorHandle {
  /** Scroll so that {@link offset} sits at the top of the visible editor area. */
  scrollSourceOffsetIntoView(offset: number): void;
  /** Document offset nearest the top of the viewport, or `null` if the editor is not mounted. */
  getTopVisibleSourceOffset(): number | null;
}

export interface UsfmEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  /**
   * Fired (debounced ~120ms after scroll or selection-driven viewport changes) with the
   * document offset closest to the top edge of the viewport.
   */
  onViewportAnchorChange?: (sourceOffset: number) => void;
}

export const UsfmEditor = forwardRef<UsfmEditorHandle, UsfmEditorProps>(function UsfmEditor(
  { value = "", onChange, onViewportAnchorChange, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onViewportAnchorChangeRef = useRef(onViewportAnchorChange);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onChangeRef.current = onChange;
  onViewportAnchorChangeRef.current = onViewportAnchorChange;

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
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
      if (update.selectionSet) scheduleViewportReport();
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        usfmHighlighter,
        usfmLinter,
        usfmAutocomplete,
        updateListener,
        EditorView.theme({
          "&": {
            fontSize: "14px",
            height: "100%",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          ".cm-usfm-marker": {
            color: "#1e40af",
            fontWeight: "bold",
          },
          ".cm-usfm-endmarker": {
            color: "#6b21a8",
            fontWeight: "bold",
          },
          ".cm-usfm-versenum": {
            color: "#b91c1c",
            fontWeight: "bold",
          },
          ".cm-usfm-chapternum": {
            color: "#c2410c",
            fontWeight: "bold",
            fontSize: "1.1em",
          },
          ".cm-usfm-attribute": {
            color: "#0f766e",
          },
          ".cm-usfm-attrvalue": {
            color: "#15803d",
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
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`border border-gray-300 rounded-md overflow-hidden ${className ?? ""}`}
    />
  );
});

UsfmEditor.displayName = "UsfmEditor";
