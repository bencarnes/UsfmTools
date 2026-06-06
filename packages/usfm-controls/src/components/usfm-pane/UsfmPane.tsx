import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { BookNode } from "@usfm-tools/parser";
import { parse } from "@usfm-tools/parser";
import {
  chapterNumberAtOrBeforeSourceOffset,
  listChapterMarkersInBook,
  type ChapterMarkerInBook,
} from "@usfm-tools/model";
import type { ChapterPickerSelectDetail } from "../chapter-picker/ChapterPicker.js";
import { ChapterNavigator } from "./chapter-navigator.js";
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
import {
  lastVerseNumberBeforeOffset,
  readTopVisibleScrollAnchor,
  scrollPreviewToAnchor,
  scrollSyncModeFromMarkers,
  sourceOffsetForChapterVerse,
} from "./scroll-sync.js";
import { ScrollSyncToggleButton } from "./scroll-sync-toggle.js";
import { nextViewMode, ViewModeCycleButton, type UsfmPaneViewMode } from "./view-mode-toggle.js";
import { FindToolbarButton } from "./find-toolbar-button.js";
import { themedControlButton } from "../../theme-tokens.js";

export type { UsfmPaneViewMode };

export interface UsfmPaneProps {
  /** Full-book USFM (controlled). Multiple panes may share the same string reference updates. */
  readonly value: string;
  readonly onChange?: (value: string) => void;
  /**
   * When set together with `toolbarActive`, chapter navigation, scroll sync, and view mode render
   * into this host element (for example the strip to the right of editor tabs).
   */
  readonly toolbarMount?: HTMLElement | null;
  /** When false, this pane does not render its toolbar into `toolbarMount` (inactive tab). */
  readonly toolbarActive?: boolean;
  readonly defaultViewMode?: UsfmPaneViewMode;
  readonly versePerLine?: boolean;
  readonly className?: string;
  /**
   * Initial on/off state for split-pane scroll sync when chapter markers exist.
   * When there are no chapter markers, the switch stays disabled and sync does not run.
   */
  readonly defaultScrollSyncEnabled?: boolean;
  /**
   * One-shot request to position the editor caret / selection and scroll it into view.
   * Each new object identity is treated as a new request (compare the `nonce`).
   * Forces view mode to include the editor when emitted from preview.
   */
  readonly selectionRequest?: UsfmPaneSelectionRequest;
}

export interface UsfmPaneSelectionRequest {
  readonly from: number;
  readonly to?: number;
  /** Bump this when re-emitting the same offset to retrigger a select+scroll. */
  readonly nonce: number;
}

const btnBase: CSSProperties = {
  ...themedControlButton,
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const toolbarRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "nowrap",
  flexShrink: 0,
};

function firstBookFromUsfm(usfm: string): BookNode | undefined {
  const { document } = parse(usfm);
  const node = document.children.find((c) => c.type === "book");
  if (!node || node.type !== "book") return undefined;
  return node as BookNode;
}

export function UsfmPane({
  value,
  onChange,
  toolbarMount,
  toolbarActive = true,
  defaultViewMode = "split",
  versePerLine,
  className,
  defaultScrollSyncEnabled = true,
  selectionRequest,
}: UsfmPaneProps) {
  const [viewMode, setViewMode] = useState<UsfmPaneViewMode>(defaultViewMode);
  const [splitPct, setSplitPct] = useState(50);
  const [editorTopOffset, setEditorTopOffset] = useState(0);
  const [previewTopChapter, setPreviewTopChapter] = useState<string | null>(null);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(defaultScrollSyncEnabled);

  const editorRef = useRef<UsfmEditorHandle>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const splitHostRef = useRef<HTMLDivElement>(null);
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

  const bookStartOffset = useMemo(() => {
    const off = firstBook?.position?.offset;
    return typeof off === "number" ? off : 0;
  }, [firstBook]);

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
      if (!scrollSyncEnabled) return;
      const mode = scrollSyncModeFromMarkers(hasChapters);
      if (mode === "none") return;
      syncLockRef.current = true;
      const mi = indexOfLastChapterMarkerAtOrBefore(markers, sourceOffset);
      const chapterNumber = mi >= 0 ? markers[mi]!.number : null;
      const chapterMarkerOffset = mi >= 0 ? markers[mi]!.markerOffset : bookStartOffset;
      const verseNumber = lastVerseNumberBeforeOffset(value, chapterMarkerOffset, sourceOffset);
      scrollPreviewToAnchor(root, mode, { kind: "cv", chapterNumber, verseNumber });
      releaseSyncLockSoon();
    },
    [viewMode, hasChapters, scrollSyncEnabled, value, bookStartOffset, markers, releaseSyncLockSoon],
  );

  const syncEditorToPreviewTop = useCallback(() => {
    if (viewMode !== "split") return;
    const root = previewScrollRef.current;
    const ed = editorRef.current;
    if (!root || !ed || syncLockRef.current) return;
    if (!scrollSyncEnabled) return;
    const mode = scrollSyncModeFromMarkers(hasChapters);
    if (mode === "none") return;
    const anchor = readTopVisibleScrollAnchor(root, mode);
    if (!anchor) return;
    const chapterMarkerBase =
      anchor.chapterNumber == null
        ? bookStartOffset
        : (markerOffsetForChapterNumber(markers, anchor.chapterNumber) ?? bookStartOffset);
    const targetOffset = sourceOffsetForChapterVerse(value, markers, chapterMarkerBase, anchor.verseNumber);
    if (targetOffset == null) return;
    syncLockRef.current = true;
    ed.scrollSourceOffsetIntoView(targetOffset);
    releaseSyncLockSoon();
  }, [viewMode, hasChapters, scrollSyncEnabled, value, bookStartOffset, markers, releaseSyncLockSoon]);

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

  const lastSelectionNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectionRequest) return;
    if (lastSelectionNonceRef.current === selectionRequest.nonce) return;
    lastSelectionNonceRef.current = selectionRequest.nonce;
    if (viewMode === "preview") setViewMode("split");
    const apply = () => editorRef.current?.selectSourceRange(selectionRequest.from, selectionRequest.to);
    if (viewMode === "preview") {
      const t = setTimeout(apply, 0);
      return () => clearTimeout(t);
    }
    apply();
  }, [selectionRequest, viewMode]);

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

  const toolbar = (
    <div style={toolbarRowStyle} data-testid="usfm-pane-toolbar">
      <ChapterNavigator
        navChapterText={navChapterText}
        hasChapters={hasChapters}
        atLastChapter={atLastChapter}
        firstBook={firstBook}
        buttonStyle={btnBase}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
        onChapterPicked={onChapterPicked}
      />

      <ScrollSyncToggleButton
        scrollSyncEnabled={scrollSyncEnabled}
        hasChapters={hasChapters}
        buttonStyle={btnBase}
        onToggle={() => setScrollSyncEnabled((v) => !v)}
      />

      <FindToolbarButton
        disabled={viewMode === "preview"}
        buttonStyle={btnBase}
        onOpenFind={() => editorRef.current?.openFind()}
      />

      <ViewModeCycleButton
        viewMode={viewMode}
        buttonStyle={btnBase}
        onCycle={() => setViewMode(nextViewMode(viewMode))}
      />
    </div>
  );

  const useExternalToolbar = Boolean(toolbarMount);
  const showToolbarInline = !useExternalToolbar;
  const showToolbarPortal = useExternalToolbar && toolbarActive && toolbarMount;

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900 ${
        useExternalToolbar ? "min-h-0" : "min-h-[280px]"
      } ${className ?? ""}`}
    >
      {showToolbarInline ? (
        <header
          style={{
            ...toolbarRowStyle,
            flexWrap: "wrap",
            padding: "0.4rem 0.5rem",
            borderBottom: "1px solid var(--usfm-border-subtle)",
            background: "var(--usfm-surface-muted)",
          }}
        >
          {toolbar}
        </header>
      ) : null}
      {showToolbarPortal ? createPortal(toolbar, toolbarMount) : null}

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
              className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-500"
              onMouseDown={onSplitMouseDown}
            />
            <div style={{ flex: 1, minWidth: 0 }} className="flex min-h-0 flex-col">
              <div
                ref={previewScrollRef}
                className="flex-1 min-h-0 overflow-auto border-l border-gray-200 p-3 dark:border-gray-700"
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
