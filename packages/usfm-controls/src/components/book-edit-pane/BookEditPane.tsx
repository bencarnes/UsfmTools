import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import {
  chapterNumberAtOrBeforeSourceOffset,
  listChapterMarkersInBook,
  type ChapterMarkerInBook,
} from "@usfm-tools/model";
import { ChapterPicker } from "../chapter-picker/ChapterPicker.js";
import type { ChapterPickerSelectDetail } from "../chapter-picker/ChapterPicker.js";
import { UsfmEditor, type UsfmEditorHandle } from "../usfm-editor/UsfmEditor.js";
import { UsfmPreview } from "../usfm-preview/UsfmPreview.js";
import {
  indexOfLastChapterMarkerAtOrBefore,
  markerOffsetForChapterNumber,
} from "./chapter-offset-helpers.js";
import {
  scrollPreviewContainerToChapter,
  topVisibleChapterNumberInPreview,
} from "./preview-chapter-scroll.js";

export type BookEditPaneViewMode = "edit" | "preview" | "split";

export interface BookEditPaneProps {
  /** Full-book USFM (controlled). Multiple panes may share the same string reference updates. */
  readonly value: string;
  readonly onChange?: (value: string) => void;
  /** Short label for the top bar (for example the `\\id` code or filename). */
  readonly bookTitle: string;
  readonly defaultViewMode?: BookEditPaneViewMode;
  readonly versePerLine?: boolean;
  readonly className?: string;
}

const mono: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const btnBase: CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  border: "1px solid color-mix(in srgb, CanvasText 22%, transparent)",
  background: "color-mix(in srgb, Canvas 96%, CanvasText 4%)",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
  padding: "0.4rem 0.5rem",
  borderBottom: "1px solid color-mix(in srgb, CanvasText 18%, transparent)",
  background: "color-mix(in srgb, Canvas 97%, CanvasText 3%)",
};

function firstBookFromUsfm(usfm: string): BookNode | undefined {
  const { document } = parse(usfm);
  const node = document.children.find((c) => c.type === "book");
  if (!node || node.type !== "book") return undefined;
  return node as BookNode;
}

export function BookEditPane({
  value,
  onChange,
  bookTitle,
  defaultViewMode = "split",
  versePerLine,
  className,
}: BookEditPaneProps) {
  const [viewMode, setViewMode] = useState<BookEditPaneViewMode>(defaultViewMode);
  const [splitPct, setSplitPct] = useState(50);
  const [editorTopOffset, setEditorTopOffset] = useState(0);
  const [previewTopChapter, setPreviewTopChapter] = useState<string | null>(null);

  const editorRef = useRef<UsfmEditorHandle>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const splitHostRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLDetailsElement>(null);
  const syncLockRef = useRef(false);
  const splitDragRef = useRef<{ startX: number; startPct: number } | null>(null);
  const previewScrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstBook = useMemo(() => firstBookFromUsfm(value), [value]);
  const markers: readonly ChapterMarkerInBook[] = useMemo(
    () => (firstBook ? listChapterMarkersInBook(firstBook) : []),
    [firstBook],
  );

  const navChapterText = useMemo(() => {
    if (viewMode === "preview") return previewTopChapter ?? "—";
    const n = chapterNumberAtOrBeforeSourceOffset(markers, editorTopOffset);
    return n ?? "—";
  }, [viewMode, previewTopChapter, markers, editorTopOffset]);

  const hasChapters = markers.length > 0;

  const releaseSyncLockSoon = useCallback(() => {
    window.setTimeout(() => {
      syncLockRef.current = false;
    }, 40);
  }, []);

  const syncPreviewToEditorOffset = useCallback(
    (sourceOffset: number) => {
      if (viewMode !== "split") return;
      const root = previewScrollRef.current;
      if (!root || syncLockRef.current) return;
      const ch = chapterNumberAtOrBeforeSourceOffset(markers, sourceOffset);
      syncLockRef.current = true;
      scrollPreviewContainerToChapter(root, ch);
      releaseSyncLockSoon();
    },
    [viewMode, markers, releaseSyncLockSoon],
  );

  const syncEditorToPreviewTop = useCallback(() => {
    if (viewMode !== "split") return;
    const root = previewScrollRef.current;
    const ed = editorRef.current;
    if (!root || !ed || syncLockRef.current) return;
    const ch = topVisibleChapterNumberInPreview(root);
    const off = markerOffsetForChapterNumber(markers, ch);
    if (off == null) return;
    syncLockRef.current = true;
    ed.scrollSourceOffsetIntoView(off);
    releaseSyncLockSoon();
  }, [viewMode, markers, releaseSyncLockSoon]);

  const onEditorViewportAnchor = useCallback(
    (offset: number) => {
      setEditorTopOffset(offset);
      syncPreviewToEditorOffset(offset);
    },
    [syncPreviewToEditorOffset],
  );

  const readPreviewChapter = useCallback(() => {
    const root = previewScrollRef.current;
    setPreviewTopChapter(topVisibleChapterNumberInPreview(root));
  }, []);

  const schedulePreviewChapterRead = useCallback(() => {
    if (previewScrollDebounceRef.current) clearTimeout(previewScrollDebounceRef.current);
    previewScrollDebounceRef.current = setTimeout(() => {
      previewScrollDebounceRef.current = null;
      readPreviewChapter();
    }, 120);
  }, [readPreviewChapter]);

  useEffect(() => {
    if (viewMode !== "preview") return;
    const root = previewScrollRef.current;
    if (!root) return;
    readPreviewChapter();
    root.addEventListener("scroll", schedulePreviewChapterRead, { passive: true });
    return () => {
      root.removeEventListener("scroll", schedulePreviewChapterRead);
      if (previewScrollDebounceRef.current) clearTimeout(previewScrollDebounceRef.current);
    };
  }, [viewMode, value, readPreviewChapter, schedulePreviewChapterRead]);

  useEffect(() => {
    if (viewMode === "preview") readPreviewChapter();
  }, [value, viewMode, readPreviewChapter]);

  const goChapterIndex = useCallback(
    (idx: number) => {
      if (!hasChapters) return;
      const m = markers[idx];
      if (!m) return;
      if (viewMode === "preview") {
        scrollPreviewContainerToChapter(previewScrollRef.current, m.number);
        readPreviewChapter();
      } else {
        editorRef.current?.scrollSourceOffsetIntoView(m.markerOffset);
      }
    },
    [hasChapters, markers, viewMode, readPreviewChapter],
  );

  const currentMarkerIndex = useMemo(() => {
    if (viewMode === "preview") {
      if (!previewTopChapter) return -1;
      return markers.findIndex((m) => m.number === previewTopChapter);
    }
    return indexOfLastChapterMarkerAtOrBefore(markers, editorTopOffset);
  }, [viewMode, previewTopChapter, markers, editorTopOffset]);

  const onPrevChapter = useCallback(() => {
    if (!hasChapters) return;
    if (currentMarkerIndex <= 0) {
      goChapterIndex(0);
      return;
    }
    goChapterIndex(currentMarkerIndex - 1);
  }, [hasChapters, currentMarkerIndex, goChapterIndex]);

  const onNextChapter = useCallback(() => {
    if (!hasChapters) return;
    if (currentMarkerIndex < 0) {
      goChapterIndex(0);
      return;
    }
    if (currentMarkerIndex >= markers.length - 1) return;
    goChapterIndex(currentMarkerIndex + 1);
  }, [hasChapters, currentMarkerIndex, markers.length, goChapterIndex]);

  const onChapterPicked = useCallback(
    (d: ChapterPickerSelectDetail) => {
      chapterMenuRef.current?.removeAttribute("open");
      const off = markerOffsetForChapterNumber(markers, d.chapterNumber);
      if (off == null) return;
      if (viewMode === "preview") {
        scrollPreviewContainerToChapter(previewScrollRef.current, d.chapterNumber);
        readPreviewChapter();
      } else {
        editorRef.current?.scrollSourceOffsetIntoView(off);
      }
    },
    [markers, viewMode, readPreviewChapter],
  );

  const onPreviewScroll = useCallback(() => {
    if (viewMode === "preview") schedulePreviewChapterRead();
    if (viewMode === "split") syncEditorToPreviewTop();
  }, [viewMode, schedulePreviewChapterRead, syncEditorToPreviewTop]);

  const onSplitMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      splitDragRef.current = { startX: e.clientX, startPct: splitPct };
      const onMove = (ev: MouseEvent) => {
        const drag = splitDragRef.current;
        const host = splitHostRef.current;
        if (!drag || !host) return;
        const width = host.getBoundingClientRect().width || 1;
        const dx = ev.clientX - drag.startX;
        const deltaPct = (dx / width) * 100;
        const next = Math.min(80, Math.max(20, drag.startPct + deltaPct));
        setSplitPct(next);
      };
      const onUp = () => {
        splitDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [splitPct],
  );

  const atLastChapter =
    hasChapters && currentMarkerIndex >= 0 && currentMarkerIndex >= markers.length - 1;

  const bodyClass = "flex-1 min-h-0 flex flex-col";

  return (
    <div
      className={`flex flex-col min-h-[280px] h-full border border-gray-300 rounded-md overflow-hidden bg-white ${className ?? ""}`}
    >
      <header style={toolbarStyle}>
        <strong style={{ marginRight: "auto", fontSize: "0.95rem" }}>{bookTitle}</strong>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} aria-label="Chapter">
          <button
            type="button"
            aria-label="Previous chapter"
            disabled={!hasChapters}
            style={{ ...btnBase, opacity: hasChapters ? 1 : 0.45 }}
            onClick={onPrevChapter}
          >
            ◀
          </button>
          <span
            style={{
              ...mono,
              minWidth: "3.5rem",
              textAlign: "center",
              fontSize: "0.9rem",
            }}
            aria-live="polite"
          >
            {navChapterText}
          </span>
          <button
            type="button"
            aria-label="Next chapter"
            disabled={!hasChapters || atLastChapter}
            style={{
              ...btnBase,
              opacity: hasChapters && !atLastChapter ? 1 : 0.45,
            }}
            onClick={onNextChapter}
          >
            ▶
          </button>
          <details ref={chapterMenuRef} style={{ position: "relative" }}>
            <summary
              style={{
                ...btnBase,
                listStyle: "none",
                cursor: hasChapters ? "pointer" : "not-allowed",
                opacity: hasChapters ? 1 : 0.45,
              }}
              aria-label="Open chapter list"
              onClick={(ev) => {
                if (!hasChapters) ev.preventDefault();
              }}
            >
              Chapters ▾
            </summary>
            <div
              style={{
                position: "absolute",
                right: 0,
                zIndex: 20,
                marginTop: "0.25rem",
                padding: "0.5rem",
                maxHeight: "14rem",
                overflow: "auto",
                minWidth: "12rem",
                background: "Canvas",
                border: "1px solid color-mix(in srgb, CanvasText 22%, transparent)",
                borderRadius: "6px",
                boxShadow: "0 4px 12px color-mix(in srgb, CanvasText 12%, transparent)",
              }}
            >
              {firstBook ? (
                <ChapterPicker book={firstBook} onChapterSelect={onChapterPicked} />
              ) : (
                <span style={{ fontSize: "0.85rem", color: "#666" }}>No \\id book in source.</span>
              )}
            </div>
          </details>
        </div>

        <div style={{ display: "flex", gap: "0.25rem" }} role="group" aria-label="View mode">
          {(
            [
              ["edit", "Edit"],
              ["preview", "Preview"],
              ["split", "Edit + Preview"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              style={{
                ...btnBase,
                fontWeight: viewMode === mode ? 700 : 400,
                outline: viewMode === mode ? "2px solid #2563eb" : undefined,
              }}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className={bodyClass}>
        {viewMode === "edit" && (
          <UsfmEditor
            ref={editorRef}
            value={value}
            onChange={onChange}
            onViewportAnchorChange={onEditorViewportAnchor}
            className="flex-1 min-h-0 h-full border-0 rounded-none"
          />
        )}

        {viewMode === "preview" && (
          <div
            ref={previewScrollRef}
            className="flex-1 min-h-0 overflow-auto p-3"
            onScroll={onPreviewScroll}
          >
            <UsfmPreview value={value} versePerLine={versePerLine} />
          </div>
        )}

        {viewMode === "split" && (
          <div ref={splitHostRef} className="flex flex-1 min-h-0 flex-row">
            <div style={{ width: `${splitPct}%`, minWidth: 0 }} className="flex min-h-0 flex-col">
              <UsfmEditor
                ref={editorRef}
                value={value}
                onChange={onChange}
                onViewportAnchorChange={onEditorViewportAnchor}
                className="flex-1 min-h-0 h-full border-0 rounded-none"
              />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-gray-400"
              onMouseDown={onSplitMouseDown}
            />
            <div style={{ flex: 1, minWidth: 0 }} className="flex min-h-0 flex-col">
              <div
                ref={previewScrollRef}
                className="flex-1 min-h-0 overflow-auto p-3 border-l border-gray-200"
                onScroll={onPreviewScroll}
              >
                <UsfmPreview value={value} versePerLine={versePerLine} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
