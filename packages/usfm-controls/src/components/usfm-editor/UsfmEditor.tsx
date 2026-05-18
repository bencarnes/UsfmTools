import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { usfmHighlighter, usfmLinter, usfmAutocomplete } from "./codemirror-usfm.js";

export interface UsfmEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function UsfmEditor({ value = "", onChange, className }: UsfmEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
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

    return () => {
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
}
